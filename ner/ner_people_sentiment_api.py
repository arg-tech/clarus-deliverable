#!/usr/bin/env python3
"""
FastAPI service: PERSON NER + (optional) sentiment per sentence

- Loads a spaCy model (default: en_core_web_sm)
- Extracts PERSON entities
- Pairs each PERSON with the sentence they appear in
- Applies sentiment (default: VADER if installed; optional HF model)
- Returns JSON objects with: person, sentence, sent_start_char, sent_end_char, compound, label

Quickstart
---------
# 1) Install deps (choose what you need):
#    pip install "spacy>=3.6,<4" fastapi uvicorn pydantic vaderSentiment
#    python -m spacy download en_core_web_sm
#    # (Optional HF sentiment, multilingual)
#    pip install transformers torch --extra-index-url https://download.pytorch.org/whl/cpu
#
# 2) Run the server:
#    uvicorn ner_people_sentiment_api:app --host 0.0.0.0 --port 8000 --reload
#
# 3) Try it:
#    curl -X POST 'http://localhost:8000/analyze' \
#      -H 'Content-Type: application/json' \
#      -d '{"text":"Barack Obama met Angela Merkel in Berlin. They smiled.", "model":"en_core_web_sm"}'
#
#    # Or simple GET with query param
#    curl 'http://localhost:8000/analyze?text=Barack%20Obama%20met%20Angela%20Merkel%20in%20Berlin.'
"""
from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from functools import lru_cache
from typing import Callable, Dict, Iterable, List, Optional, Tuple

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

# --- Optional imports guarded for nicer error messages ---
try:
    import spacy
except Exception as e:  # pragma: no cover
    raise RuntimeError(
        "spaCy is required. Install with: pip install 'spacy>=3.6,<4' && python -m spacy download en_core_web_sm"
    ) from e

# ---------------- Sentiment helpers ----------------
SentimentFn = Callable[[str], float]

@lru_cache(maxsize=1)
def _load_vader() -> SentimentFn:
    """Load VADER once and return a scoring function mapping text -> compound in [-1,1]."""
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    except Exception as e:
        raise RuntimeError("vaderSentiment not installed: pip install vaderSentiment") from e
    analyzer = SentimentIntensityAnalyzer()
    def score(text: str) -> float:
        return float(analyzer.polarity_scores(text)["compound"])  # [-1, 1]
    return score

@lru_cache(maxsize=2)
def _load_hf_sentiment(model_name: str = "cardiffnlp/twitter-xlm-roberta-base-sentiment",
                      device: str = "cpu") -> SentimentFn:
    """Load a HuggingFace sentiment pipeline once (per model_name+device)."""
    try:
        from transformers import pipeline
        import torch
    except Exception as e:
        raise RuntimeError("transformers not installed: pip install transformers") from e

    dev_index = 0 if device.lower() == "cuda" and torch.cuda.is_available() else -1
    nlp = pipeline("sentiment-analysis", model=model_name, device=dev_index)

    def score(text: str) -> float:
        res = nlp(text[:512])[0]  # truncate long sentences defensively
        label = str(res.get("label", "")).upper()
        s = float(res.get("score", 0.0))
        if any(ch.isdigit() for ch in label):
            import re
            m = re.search(r"([1-5])", label)
            if m:
                stars = int(m.group(1))
                return (stars - 3) / 2.0  # 1->-1, 3->0, 5->+1
        if "POS" in label:
            return s
        if "NEG" in label:
            return -s
        return 0.0  # NEU/unknown

    return score


def to_sentiment_label(compound: Optional[float], pos_thresh: float = 0.05, neg_thresh: float = -0.05) -> Optional[str]:
    if compound is None:
        return None
    if compound >= pos_thresh:
        return "pos"
    if compound <= neg_thresh:
        return "neg"
    return "neu"

# ---------------- NER + sentence pairing ----------------
@dataclass
class PersonSentence:
    person: str
    sentence: str
    sent_start_char: int
    sent_end_char: int
    compound: Optional[float]
    label: Optional[str]


def _normalize_person(name: str) -> str:
    return " ".join(name.split()).strip()


def _ensure_sentences(nlp):
    # Ensure there's a sentence boundary component
    if not any(p for p in nlp.pipe_names if p in ("parser", "senter", "sentencizer")):
        nlp.add_pipe("sentencizer")


def iter_person_sentences(text: str, nlp, sentiment: Optional[SentimentFn]) -> Iterable[PersonSentence]:
    doc = nlp(text)
    sent_bounds: List[Tuple[int, int]] = [(s.start_char, s.end_char) for s in doc.sents]
    sent_sentiment: Dict[Tuple[int, int], Tuple[Optional[float], Optional[str]]] = {}

    for (start, end) in sent_bounds:
        sent_text = text[start:end]
        if sentiment is None:
            sent_sentiment[(start, end)] = (None, None)
        else:
            comp = float(sentiment(sent_text))
            sent_sentiment[(start, end)] = (comp, to_sentiment_label(comp))

    for ent in doc.ents:
        if ent.label_ == "PERSON":
            s = ent.sent
            start, end = s.start_char, s.end_char
            comp, lab = sent_sentiment[(start, end)]
            yield PersonSentence(
                person=_normalize_person(ent.text),
                sentence=text[start:end],
                sent_start_char=start,
                sent_end_char=end,
                compound=comp,
                label=lab,
            )

# --------------- Model loading (cached) ---------------
@lru_cache(maxsize=4)
def _load_spacy(model_name: str):
    try:
        nlp = spacy.load(model_name)
    except Exception as e:  # pragma: no cover
        raise RuntimeError(
            f"Failed to load spaCy model '{model_name}'. Install with: python -m spacy download {model_name}\nOriginal error: {e}"
        ) from e
    _ensure_sentences(nlp)
    return nlp

# ---------------- FastAPI schema ----------------
class AnalyzeRequest(BaseModel):
    text: str = Field(..., description="Raw text to analyze")
    model: str = Field("en_core_web_sm", description="spaCy model name")
    no_sentiment: bool = Field(False, description="Disable sentiment scoring")
    hf_sentiment_model: Optional[str] = Field(
        None,
        description=(
            "Optional HuggingFace model for sentiment, e.g. 'cardiffnlp/twitter-xlm-roberta-base-sentiment'"
        ),
    )
    hf_device: str = Field("cpu", description="'cpu' or 'cuda'")

class PersonSentenceModel(BaseModel):
    person: str
    sentence: str
    sent_start_char: int
    sent_end_char: int
    compound: Optional[float]
    label: Optional[str]

    class Config:
        orm_mode = True

# ---------------- FastAPI app ----------------
app = FastAPI(title="NER People + Sentiment API", version="1.0.0")

@app.get("/")
def root():
    return {"status": "ok", "service": "ner-people-sentiment", "version": "1.0.0"}


def _resolve_sentiment(no_sentiment: bool, hf_sentiment_model: Optional[str], hf_device: str) -> Optional[SentimentFn]:
    if no_sentiment:
        return None
    if hf_sentiment_model:
        try:
            return _load_hf_sentiment(hf_sentiment_model, hf_device)
        except Exception as e:
            # Fall back to VADER if available
            try:
                return _load_vader()
            except Exception:
                return None
    # Default: VADER if installed, else None
    try:
        return _load_vader()
    except Exception:
        return None


@app.post("/analyze", response_model=List[PersonSentenceModel])
def analyze(req: AnalyzeRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    nlp = _load_spacy(req.model)
    sentiment_fn = _resolve_sentiment(req.no_sentiment, req.hf_sentiment_model, req.hf_device)

    rows: List[PersonSentence] = list(iter_person_sentences(req.text, nlp, sentiment_fn))
    return [PersonSentenceModel(**asdict(r)) for r in rows]


@app.get("/analyze", response_model=List[PersonSentenceModel])
def analyze_get(
    text: str = Query(..., description="Raw text to analyze"),
    model: str = Query("en_core_web_sm", description="spaCy model name"),
    no_sentiment: bool = Query(False, description="Disable sentiment scoring"),
    hf_sentiment_model: Optional[str] = Query(None, description="Optional HF sentiment model name"),
    hf_device: str = Query("cpu", description="'cpu' or 'cuda'"),
):
    req = AnalyzeRequest(
        text=text,
        model=model,
        no_sentiment=no_sentiment,
        hf_sentiment_model=hf_sentiment_model,
        hf_device=hf_device,
    )
    return analyze(req)


if __name__ == "__main__":  # pragma: no cover
    import uvicorn
    uvicorn.run("ner_people_sentiment_api:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)
