#!/usr/bin/env python3
"""
NER + (optional) sentiment pairing script

- Extracts PERSON entities from text using spaCy
- Pairs each person with the sentences they appear in
- (Default) Applies VADER sentiment to each sentence (English only)
- Emits two CSVs: a detailed per-sentence file and an aggregated summary

Usage examples:
  # Install deps (once):
  #   pip install "spacy>=3.6,<4" vaderSentiment
  #   python -m spacy download en_core_web_sm
  #
  # Run on a text file (English model + VADER sentiment):
  #   python ner_people_sentiment.py --infile sample.txt --model en_core_web_sm --outdir out/
  #
  # Run on stdin:
  #   cat sample.txt | python ner_people_sentiment.py --model en_core_web_sm --outdir out/
"""

from __future__ import annotations
import argparse
import csv
import os
import sys
from dataclasses import dataclass, asdict
from typing import Callable, Dict, Iterable, List, Optional, Tuple

try:
    import spacy
except Exception as e:
    print("spaCy is required. Install with: pip install 'spacy>=3.6,<4' && python -m spacy download en_core_web_sm", file=sys.stderr)
    raise

# Sentiment (English-only default via VADER)
SentimentFn = Callable[[str], float]
# (Optional) Hugging Face transformers sentiment (multilingual-ready)
def load_hf_sentiment(model_name: str = "cardiffnlp/twitter-xlm-roberta-base-sentiment", device: str = "cpu") -> SentimentFn:
    try:
        from transformers import pipeline
        import torch
    except Exception as e:
        print("transformers is not installed. Install with: pip install transformers", file=sys.stderr)
        raise
    dev_index = 0 if device.lower() == "cuda" and torch.cuda.is_available() else -1
    nlp = pipeline("sentiment-analysis", model=model_name, device=dev_index)

    def score(text: str) -> float:
        res = nlp(text[:512])[0]  # truncate long sentences defensively
        label = str(res.get("label", "")).upper()
        s = float(res.get("score", 0.0))
        # Heuristics to map to [-1,1]
        if any(ch.isdigit() for ch in label):
            # e.g., "5 stars"
            import re
            m = re.search(r"([1-5])", label)
            if m:
                stars = int(m.group(1))
                return (stars - 3) / 2.0  # 1->-1, 3->0, 5->+1
        if "POS" in label:
            return s
        if "NEG" in label:
            return -s
        # NEU or unknown
        return 0.0

    return score


def load_vader() -> SentimentFn:
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    except Exception as e:
        print("vaderSentiment is not installed. Install with: pip install vaderSentiment", file=sys.stderr)
        raise
    analyzer = SentimentIntensityAnalyzer()
    def score(text: str) -> float:
        # Compound in [-1, 1]
        return float(analyzer.polarity_scores(text)["compound"])
    return score

def to_sentiment_label(compound: float, pos_thresh: float = 0.05, neg_thresh: float = -0.05) -> str:
    if compound >= pos_thresh:
        return "pos"
    if compound <= neg_thresh:
        return "neg"
    return "neu"

@dataclass
class PersonSentence:
    person: str
    sentence: str
    sent_start_char: int
    sent_end_char: int
    compound: Optional[float]  # sentiment
    label: Optional[str]       # pos/neg/neu

def normalize_person(name: str) -> str:
    # Lightweight normalization for grouping
    # Trim whitespace, collapse spaces, title-case
    return " ".join(name.split()).strip()

def iter_person_sentences(text: str, nlp, sentiment: Optional[SentimentFn]) -> Iterable[PersonSentence]:
    doc = nlp(text)
    # Map sentence spans to a stable index
    sent_bounds: List[Tuple[int, int]] = [(s.start_char, s.end_char) for s in doc.sents]
    # Precompute sentiment per sentence (avoid recompute for multiple persons in same sentence)
    sent_sentiment: Dict[Tuple[int, int], Tuple[Optional[float], Optional[str]]] = {}
    for (start, end) in sent_bounds:
        sent_text = text[start:end]
        if sentiment is None:
            sent_sentiment[(start, end)] = (None, None)
        else:
            comp = sentiment(sent_text)
            sent_sentiment[(start, end)] = (comp, to_sentiment_label(comp))

    for ent in doc.ents:
        if ent.label_ == "PERSON":
            # Find the containing sentence for this entity
            s = ent.sent
            start, end = s.start_char, s.end_char
            comp, lab = sent_sentiment[(start, end)]
            yield PersonSentence(
                person=normalize_person(ent.text),
                sentence=text[start:end],
                sent_start_char=start,
                sent_end_char=end,
                compound=comp,
                label=lab,
            )

def aggregate(rows: Iterable[PersonSentence]) -> List[Dict[str, object]]:
    # Aggregate by person
    agg: Dict[str, Dict[str, object]] = {}
    for r in rows:
        key = r.person
        if key not in agg:
            agg[key] = {
                "person": key,
                "mentions": 0,
                "sentences": set(),  # unique sentences per person
                "pos": 0,
                "neg": 0,
                "neu": 0,
                "sum_compound": 0.0,
                "count_scored": 0,
            }
        a = agg[key]
        a["mentions"] += 1
        a["sentences"].add(r.sentence)
        if r.label in ("pos", "neg", "neu"):
            a[r.label] += 1
        if r.compound is not None:
            a["sum_compound"] += r.compound
            a["count_scored"] += 1

    # Finalize
    out: List[Dict[str, object]] = []
    for key, a in agg.items():
        count_scored = a["count_scored"]
        avg_comp = (a["sum_compound"] / count_scored) if count_scored else None
        out.append({
            "person": a["person"],
            "unique_sentences": len(a["sentences"]),
            "mentions": a["mentions"],
            "pos": a["pos"],
            "neg": a["neg"],
            "neu": a["neu"],
            "avg_compound": round(avg_comp, 4) if avg_comp is not None else None,
        })
    # Sort by mentions desc then name
    out.sort(key=lambda d: (-d["mentions"], str(d["person"]).lower()))
    return out

def write_csv(path: str, rows: Iterable[Dict[str, object]], fieldnames: List[str]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

def main():
    ap = argparse.ArgumentParser(description="Extract PERSON entities and pair with sentence-level sentiment.")
    ap.add_argument("--infile", type=str, default=None, help="Path to input .txt. If omitted, reads from stdin.")
    ap.add_argument("--text", type=str, default=None, help="Raw text string to analyze (overrides --infile if provided).")
    ap.add_argument("--model", type=str, default="en_core_web_sm", help="spaCy model name, e.g. en_core_web_sm or el_core_news_sm")
    ap.add_argument("--no-sentiment", action="store_true", help="Disable sentiment scoring (useful for non-English or when deferring to LLM).")
    ap.add_argument("--hf-sentiment-model", type=str, default=None, help="HuggingFace model name for sentiment (e.g., cardiffnlp/twitter-xlm-roberta-base-sentiment or nlptown/bert-base-multilingual-uncased-sentiment).")
    ap.add_argument("--hf-device", type=str, default="cpu", choices=["cpu", "cuda"], help="Device for HF model. Defaults to cpu.")
    ap.add_argument("--outdir", type=str, default="out", help="Directory to write CSV outputs.")
    args = ap.parse_args()

    # Load text
    if args.text is not None:
        text = args.text
    else:
        if args.infile:
            with open(args.infile, "r", encoding="utf-8") as f:
                text = f.read()
        else:
            text = sys.stdin.read()

    if not text.strip():
        print("No input text provided.", file=sys.stderr)
        sys.exit(1)

    # Load spaCy model
    try:
        nlp = spacy.load(args.model)
    except Exception as e:
        print(f"Failed to load spaCy model '{args.model}'. Make sure it's installed:\n  python -m spacy download {args.model}\nError: {e}", file=sys.stderr)
        sys.exit(2)

    # Sentiment function (optional)
    sentiment_fn: Optional[SentimentFn] = None
    if not args.no_sentiment:
        if args.hf_sentiment_model:
            try:
                sentiment_fn = load_hf_sentiment(args.hf_sentiment_model, args.hf_device)
            except Exception:
                print("Failed to load HF sentiment model. Falling back to VADER (English only) if available...", file=sys.stderr)
                try:
                    sentiment_fn = load_vader()
                except Exception:
                    print("Proceeding without sentiment. Use --no-sentiment to silence this message.", file=sys.stderr)
                    sentiment_fn = None
        else:
            try:
                sentiment_fn = load_vader()
            except Exception:
                print("Proceeding without sentiment (VADER missing). Use --no-sentiment to silence this message.", file=sys.stderr)
                sentiment_fn = None

    # Extract rows
    detail_rows: List[PersonSentence] = list(iter_person_sentences(text, nlp, sentiment_fn))

    # Write detailed CSV
    detailed_csv = os.path.join(args.outdir, "person-sentences.csv")
    write_csv(
        detailed_csv,
        ({
            "person": r.person,
            "sentence": r.sentence,
            "sent_start_char": r.sent_start_char,
            "sent_end_char": r.sent_end_char,
            "compound": r.compound,
            "label": r.label,
        } for r in detail_rows),
        fieldnames=["person", "sentence", "sent_start_char", "sent_end_char", "compound", "label"]
    )

    # Write aggregate CSV
    agg_rows = aggregate(detail_rows)
    aggregate_csv = os.path.join(args.outdir, "person-aggregate.csv")
    write_csv(
        aggregate_csv,
        agg_rows,
        fieldnames=["person", "unique_sentences", "mentions", "pos", "neg", "neu", "avg_compound"]
    )

    print(f"Wrote:\n  {detailed_csv}\n  {aggregate_csv}")

if __name__ == "__main__":
    main()
