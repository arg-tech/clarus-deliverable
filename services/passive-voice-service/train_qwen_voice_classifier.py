#!/usr/bin/env python
"""
Train a passive/active‑voice classifier on top of Qwen3‑Embedding‑4B

Usage
-----
python train_qwen_voice_classifier.py \
       --tsv data/magna_carta.tsv \
       --out_head models/voice_head.joblib \
       --csv data/voice_dataset.csv         # optional, just to keep a flat copy
"""
import argparse, joblib, os, pandas as pd, torch
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sentence_transformers import SentenceTransformer

EMBED_MODEL = "Qwen/Qwen3-Embedding-0.6B"      # 2560‑d vectors :contentReference[oaicite:0]{index=0}
LABEL2ID     = {"passive": 0, "active": 1}

def load_tsv(tsv_path: str, *, frac: float = 0.01, seed: int = 42) -> pd.DataFrame:
    """
    Read a two-column TSV (passive | active) and return a long dataframe
    containing *only a random fraction* of the original rows.

    Parameters
    ----------
    tsv_path : str
        Path to the tab-separated file.
    frac : float, default 0.01
        Percentage of rows to keep (0.01 == 1 %).
        Use 1.0 to keep everything.
    seed : int, default 42
        RNG seed for reproducibility.

    Returns
    -------
    pd.DataFrame with columns: sentence, label, label_id
    """
    # ❶ read the full two-column file
    df_pairs = pd.read_csv(tsv_path, sep="\t", header=None,
                           names=["passive", "active"])

    # ❷ subsample *pairs* so class balance is preserved
    if 0.0 < frac < 1.0:
        df_pairs = df_pairs.sample(frac=frac, random_state=seed)

    # ❸ explode into one sentence per row
    long_df = pd.concat(
        [
            df_pairs["passive"].to_frame("sentence").assign(label="passive"),
            df_pairs["active"].to_frame("sentence").assign(label="active"),
        ],
        ignore_index=True,
    )
    long_df["label_id"] = long_df["label"].map(LABEL2ID)
    return long_df


def embed_sentences(model: SentenceTransformer, sentences, batch_size=32):
    """Return a tensor of shape (n, hidden_size)."""
    return model.encode(list(sentences), batch_size=batch_size, convert_to_tensor=True)

def main(args):
    os.makedirs(os.path.dirname(args.out_head), exist_ok=True)

    # 1. TSV → long dataframe -------------------------------------------------
    df = load_tsv(args.tsv, frac=args.frac)
    if args.csv:
        df.to_csv(args.csv, index=False)

    # 2. Embeddings ------------------------------------------------------------
    print("⏳  Loading Qwen3‑Embedding-0.6B …")
    EMBED_MODEL = "Qwen/Qwen3-Embedding-0.6B"
    qwen = SentenceTransformer(
        EMBED_MODEL,
        trust_remote_code=True  # required for all Qwen3 models
        # Device picks itself (mps on Apple Silicon, cpu otherwise).
    )
    print("🔍  Computing embeddings …")
    X = embed_sentences(qwen, df["sentence"])
    y = df["label_id"].values

    # 3. Train/test split ------------------------------------------------------
    X_train, X_test, y_train, y_test = train_test_split(
        X.cpu().numpy(), y, test_size=0.25, random_state=42, stratify=y
    )

    # 4. Head: simple L2‑regularised logistic regression ----------------------
    clf = LogisticRegression(max_iter=1_000, n_jobs=-1)
    clf.fit(X_train, y_train)

    acc = clf.score(X_test, y_test)
    print(f"✅  Held‑out accuracy: {acc:.3f}")

    # 5. Persist the head ------------------------------------------------------
    joblib.dump(clf, args.out_head)
    print(f"💾  Saved head to {args.out_head}")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--tsv", required=True, help="Input TSV with passive|active columns")
    p.add_argument("--out_head", required=True, help="Path to save scikit‑learn head")
    p.add_argument("--csv", help="Optional flat CSV (one sentence per row)")
    p.add_argument("--frac", type=float, default=0.01,
                   help="Fraction of TSV rows to keep (0 < frac ≤ 1).")

    main(p.parse_args())
