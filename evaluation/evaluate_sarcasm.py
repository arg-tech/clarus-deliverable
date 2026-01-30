#!/usr/bin/env python
"""
Evaluate the sarcasm model on the test dataset.

Usage:
    cd evaluation
    uv run python evaluate_sarcasm.py
"""

import sys
import json
import time
from pathlib import Path
from datetime import datetime

import pandas as pd
from sklearn.metrics import classification_report, accuracy_score

SERVICE_DIR = Path(__file__).parent.parent / "services" / "sarcasm-service"
sys.path.insert(0, str(SERVICE_DIR))

from infer_qwen_sarcasm import load_model, run_inference


def evaluate(df):
    print("Loading model...")
    load_model()

    y_true = []
    y_pred = []

    start = time.time()
    for i, row in df.iterrows():
        label_str, prob = run_inference(row["sentence"])
        pred = 1 if label_str == "sarcasm" else 0

        y_true.append(row["label_id"])
        y_pred.append(pred)

        if (i + 1) % 25 == 0:
            elapsed = time.time() - start
            print(f"Processed {i + 1}/{len(df)}... ({elapsed:.1f}s)")

    return y_true, y_pred, time.time() - start


def main():
    data_path = Path(__file__).parent / "datasets" / "ml" / "sarcasm_test.csv"
    print(f"Loading test data from {data_path}...")
    df = pd.read_csv(data_path)
    print(f"Test samples: {len(df)}")
    print(f"Label distribution: {df['label_id'].value_counts().to_dict()}")

    y_true, y_pred, elapsed = evaluate(df)

    accuracy = accuracy_score(y_true, y_pred)
    report = classification_report(
        y_true, y_pred, target_names=["not_sarcastic", "sarcastic"], digits=3, output_dict=True
    )

    print("\n" + "=" * 50)
    print("EVALUATION RESULTS")
    print("=" * 50)
    print(f"\nTotal time: {elapsed:.1f}s ({len(df) / elapsed:.1f} samples/sec)")
    print(f"\nAccuracy: {accuracy:.3f}")
    print("\nClassification Report:")
    print(
        classification_report(
            y_true, y_pred, target_names=["not_sarcastic", "sarcastic"], digits=3
        )
    )

    results = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "service": "sarcasm",
        "total_samples": len(df),
        "accuracy": float(accuracy),
        "classification_report": {
            "not_sarcastic": {
                "precision": float(report["not_sarcastic"]["precision"]),
                "recall": float(report["not_sarcastic"]["recall"]),
                "f1-score": float(report["not_sarcastic"]["f1-score"]),
                "support": int(report["not_sarcastic"]["support"]),
            },
            "sarcastic": {
                "precision": float(report["sarcastic"]["precision"]),
                "recall": float(report["sarcastic"]["recall"]),
                "f1-score": float(report["sarcastic"]["f1-score"]),
                "support": int(report["sarcastic"]["support"]),
            },
        },
        "processing_time": float(elapsed),
    }

    output_path = Path(__file__).parent / "reports" / "ml" / "sarcasm_results.json"
    output_path.write_text(json.dumps(results, indent=2))
    print(f"\nResults saved to {output_path}")


if __name__ == "__main__":
    main()
