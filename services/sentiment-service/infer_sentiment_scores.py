"""
Usage:
    python services/sentiment-service/infer_sentiment_scores.py --sent "That is brilliant and great" 
"""

import argparse
from transformers import pipeline
import os

MODEL = "tabularisai/multilingual-sentiment-analysis"

clf = None

def load_model():
    global clf, MODEL
    print("⏳ Loading embedding model and classifier …", flush=True)
    clf = pipeline(
        task="sentiment-analysis",
        model="tabularisai/multilingual-sentiment-analysis",
    )

def run_inference(sentence):
    global clf
    result = clf(sentence)[0]
    label = result["label"]  # Will be one of 5 classes: VERY NEGATIVE, NEGATIVE, NEUTRAL, POSITIVE, VERY POSITIVE
    score = result["score"]

    return label, score

def main(args):    
    load_model()

    label, prob = run_inference(args.sent)

    print(f"➜  {args.sent}\n   ⇒ {label}  (p={prob:.2%})")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sent", required=True, help="Sentence to classify")
    main(ap.parse_args())