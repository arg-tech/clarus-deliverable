"""
Usage:
    python services/sentiment-service/infer_sentiment_scores.py --sent "That is brilliant and great"
"""

import argparse
from transformers import pipeline
import os

DEFAULT_MODEL = "tabularisai/multilingual-sentiment-analysis"

_pipeline = None


def load_model():
    global _pipeline
    print(f"⏳ Loading model {DEFAULT_MODEL} …", flush=True)
    _pipeline = pipeline(
        task="sentiment-analysis",
        model=DEFAULT_MODEL,
    )


LABEL_COLLAPSE = {
    "Very Negative": "Negative",
    "Very Positive": "Positive",
}


def normalize_label(label: str) -> str:
    return label.replace("_", " ").strip().title()


def collapse_label(label: str) -> str:
    normalized_label = normalize_label(label)
    return LABEL_COLLAPSE.get(normalized_label, normalized_label)


def run_inference(sentence, language="en"):
    clf = _pipeline
    result = clf(sentence)[0]
    raw_label = normalize_label(result["label"])
    label = collapse_label(raw_label)
    score = result["score"]

    return label, score, raw_label


def main(args):
    load_model()

    label, prob, _ = run_inference(args.sent, args.lang)

    print(f"➜  {args.sent}\n   ⇒ {label}  (p={prob:.2%})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sent", required=True, help="Sentence to classify")
    ap.add_argument("--lang", default="en", help="Language code (e.g., en, el)")
    main(ap.parse_args())
