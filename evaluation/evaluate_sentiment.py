#!/usr/bin/env python
"""
Evaluate the sentiment analysis model on the test dataset.

Usage:
    cd evaluation
    uv run python evaluate_sentiment.py
"""

import json
import time
from pathlib import Path
from datetime import datetime
from collections import defaultdict

from transformers import pipeline

SENTIMENT_LABELS = ["VERY NEGATIVE", "NEGATIVE", "NEUTRAL", "POSITIVE", "VERY POSITIVE"]


def load_model():
    print("Loading model...", flush=True)
    return pipeline(
        task="sentiment-analysis",
        model="tabularisai/multilingual-sentiment-analysis",
    )


def load_test_data() -> list[dict]:
    data_path = Path(__file__).parent / "datasets" / "ml" / "sentiment_test.json"
    data = json.loads(data_path.read_text())
    return data["samples"]


def evaluate(model, samples: list[dict]) -> dict:
    correct = 0
    total = len(samples)

    per_class_correct = defaultdict(int)
    per_class_total = defaultdict(int)
    confusion = defaultdict(lambda: defaultdict(int))

    print(f"\nEvaluating {total} samples...\n")

    start = time.time()
    for i, sample in enumerate(samples):
        text = sample["text"]
        expected = sample["expected_sentiment"]

        result = model(text)[0]
        predicted = result["label"].upper()
        confidence = result["score"]

        is_correct = predicted == expected
        if is_correct:
            correct += 1
            per_class_correct[expected] += 1

        per_class_total[expected] += 1
        confusion[expected][predicted] += 1

        if (i + 1) % 25 == 0:
            elapsed = time.time() - start
            print(f"Processed {i + 1}/{total}... ({elapsed:.1f}s)")

    elapsed = time.time() - start
    accuracy = correct / total if total > 0 else 0

    return {
        "total": total,
        "correct": correct,
        "accuracy": accuracy,
        "per_class_correct": dict(per_class_correct),
        "per_class_total": dict(per_class_total),
        "confusion": {k: dict(v) for k, v in confusion.items()},
        "processing_time": elapsed,
    }


def print_results(results: dict):
    print("\n" + "=" * 60)
    print("EVALUATION RESULTS")
    print("=" * 60)

    print(f"\nOverall Accuracy: {results['accuracy']:.2%} ({results['correct']}/{results['total']})")
    print(f"Processing Time: {results['processing_time']:.1f}s")

    print("\nPer-Class Accuracy:")
    print("-" * 40)
    for label in SENTIMENT_LABELS:
        total = results["per_class_total"].get(label, 0)
        correct = results["per_class_correct"].get(label, 0)
        acc = correct / total if total > 0 else 0
        print(f"  {label:15} {acc:6.2%} ({correct}/{total})")

    print("\nConfusion Matrix:")
    print("-" * 60)
    print(f"{'Actual \\ Predicted':20}", end="")
    for label in SENTIMENT_LABELS:
        print(f"{label[:8]:>10}", end="")
    print()

    for actual in SENTIMENT_LABELS:
        print(f"{actual:20}", end="")
        for predicted in SENTIMENT_LABELS:
            count = results["confusion"].get(actual, {}).get(predicted, 0)
            print(f"{count:>10}", end="")
        print()


def main():
    model = load_model()
    samples = load_test_data()
    results = evaluate(model, samples)
    print_results(results)

    output_results = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "service": "sentiment",
        "total_samples": results["total"],
        "accuracy": float(results["accuracy"]),
        "per_class_metrics": {
            label: {
                "accuracy": float(results["per_class_correct"].get(label, 0) / results["per_class_total"].get(label, 1)),
                "correct": results["per_class_correct"].get(label, 0),
                "total": results["per_class_total"].get(label, 0),
            }
            for label in SENTIMENT_LABELS
            if results["per_class_total"].get(label, 0) > 0
        },
        "confusion_matrix": results["confusion"],
        "processing_time": float(results["processing_time"]),
    }

    output_path = Path(__file__).parent / "reports" / "ml" / "sentiment_results.json"
    output_path.write_text(json.dumps(output_results, indent=2))
    print(f"\nResults saved to {output_path}")


if __name__ == "__main__":
    main()
