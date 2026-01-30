#!/usr/bin/env python
"""
Extract the test dataset using the same split logic as training.
This recreates the exact test set without needing to train.

Usage:
    uv run python extract_test_dataset.py \
        --input voice_dataset.csv \
        --frac 0.3 \
        --out test_data.csv

Supports both input formats:
- .tsv files: two-column format (passive | active pairs)
- .csv files: long format (sentence, label, label_id)
"""

import argparse
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split

LABEL2ID = {"passive": 0, "active": 1}


def load_tsv(tsv_path: str, *, frac: float = 1.0, seed: int = 42) -> pd.DataFrame:
    """Read a two-column TSV (passive | active) and return a long dataframe."""
    df_pairs = pd.read_csv(tsv_path, sep="\t", header=None, names=["passive", "active"])

    if 0.0 < frac < 1.0:
        df_pairs = df_pairs.sample(frac=frac, random_state=seed)

    long_df = pd.concat(
        [
            df_pairs["passive"].to_frame("sentence").assign(label="passive"),
            df_pairs["active"].to_frame("sentence").assign(label="active"),
        ],
        ignore_index=True,
    )
    long_df["label_id"] = long_df["label"].map(LABEL2ID)
    return long_df


def load_csv(csv_path: str, *, frac: float = 1.0, seed: int = 42) -> pd.DataFrame:
    """Read a CSV with columns: sentence, label, label_id (long format)."""
    df = pd.read_csv(csv_path)

    if 0.0 < frac < 1.0:
        # Stratified sampling by label
        sampled_dfs = []
        for label in df["label"].unique():
            label_df = df[df["label"] == label]
            sampled_dfs.append(label_df.sample(frac=frac, random_state=seed))
        df = pd.concat(sampled_dfs, ignore_index=True)

    if "label_id" not in df.columns:
        df["label_id"] = df["label"].map(LABEL2ID)

    return df


def load_input(input_path: str, *, frac: float = 1.0, seed: int = 42) -> pd.DataFrame:
    """Auto-detect input format and load data."""
    if input_path.endswith(".tsv"):
        return load_tsv(input_path, frac=frac, seed=seed)
    elif input_path.endswith(".csv"):
        return load_csv(input_path, frac=frac, seed=seed)
    else:
        raise ValueError(f"Unsupported file format: {input_path}. Use .tsv or .csv")


def main(args):
    print(f"Loading data from {args.input}...")
    df = load_input(args.input, frac=args.frac, seed=args.seed)

    print(f"Total samples after sampling: {len(df)}")

    # Use indices to replicate the exact train_test_split
    indices = np.arange(len(df))
    y = df["label_id"].values

    _, test_indices, _, _ = train_test_split(
        indices, y, test_size=args.test_size, random_state=args.seed, stratify=y
    )

    # Extract test set
    test_df = df.iloc[test_indices][["sentence", "label_id"]].reset_index(drop=True)

    print(f"Test set size: {len(test_df)}")
    print(f"Label distribution: {test_df['label_id'].value_counts().to_dict()}")

    # Save
    test_df.to_csv(args.out, index=False)
    print(f"Saved test dataset to {args.out}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument(
        "--input",
        required=True,
        help="Input file: .tsv (passive|active pairs) or .csv (sentence,label,label_id)",
    )
    p.add_argument("--out", required=True, help="Output CSV for test data")
    p.add_argument(
        "--frac",
        type=float,
        default=1.0,
        help="Fraction of data to use (match training). Default: 1.0",
    )
    p.add_argument("--test_size", type=float, default=0.25)
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()
    main(args)
