#!/usr/bin/env python
"""
Extract the test dataset using the same split logic as training.
This recreates the exact test set without needing to train.

Usage:
    uv run python extract_test_dataset.py \
        --csv data/rhetorical_questions.csv \
        --label_col is_rq \
        --out test_data.csv
"""
import argparse
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split


def trim_texts(series: pd.Series, max_words: int):
    if max_words <= 0:
        return series
    return series.astype(str).apply(lambda s: " ".join(s.split()[:max_words]))


def load_csv(csv_path, text_col, label_col, frac, seed, max_words):
    df = pd.read_csv(csv_path)
    if text_col not in df.columns or label_col not in df.columns:
        raise ValueError(f"Missing {text_col} or {label_col} in {csv_path}")

    if 0.0 < frac < 1.0:
        df = df.sample(frac=frac, random_state=seed)

    # ensure binary 0/1
    if df[label_col].dtype == object:
        uniq = sorted(df[label_col].unique())
        if len(uniq) != 2:
            raise ValueError(f"{label_col} must be binary; found {uniq}")
        mapping = {uniq[0]: 0, uniq[1]: 1}
        df["label_id"] = df[label_col].map(mapping)
    else:
        df["label_id"] = df[label_col].astype(int)

    df = df.rename(columns={text_col: "sentence"})
    df["sentence"] = trim_texts(df["sentence"], max_words)
    return df[["sentence", "label_id"]].dropna().reset_index(drop=True)


def main(args):
    print(f"Loading data from {args.csv}...")
    df = load_csv(args.csv, args.text_col, args.label_col,
                  args.frac, args.seed, args.max_words)

    print(f"Total samples after sampling: {len(df)}")

    # Use indices to replicate the exact train_test_split
    indices = np.arange(len(df))
    y = df["label_id"].values

    _, test_indices, _, _ = train_test_split(
        indices, y,
        test_size=args.test_size,
        random_state=args.seed,
        stratify=y
    )

    # Extract test set
    test_df = df.iloc[test_indices].reset_index(drop=True)

    print(f"Test set size: {len(test_df)}")
    print(f"Label distribution: {test_df['label_id'].value_counts().to_dict()}")

    # Save
    test_df.to_csv(args.out, index=False)
    print(f"Saved test dataset to {args.out}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--csv", required=True)
    p.add_argument("--text_col", default="sentence")
    p.add_argument("--label_col", required=True)
    p.add_argument("--out", required=True, help="Output CSV for test data")
    p.add_argument("--frac", type=float, default=1.0)
    p.add_argument("--test_size", type=float, default=0.25)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--max_words", type=int, default=256)
    args = p.parse_args()
    main(args)
