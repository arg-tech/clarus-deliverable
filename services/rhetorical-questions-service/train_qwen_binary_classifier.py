#!/usr/bin/env python
"""
Generic binary classifier trainer on top of Qwen3-Embedding.

Examples
--------
# Rhetorical questions
python train_qwen_binary_classifier.py \
  --csv data/rhetorical_questions.csv \
  --label_col is_rq \
  --out_head models/rq_head.joblib

# Sarcasm (trim long Reddit comments & smaller batch)
python train_qwen_binary_classifier.py \
  --csv data/sarcasm.csv \
  --label_col is_sarcastic \
  --out_head models/sarcasm_head.joblib \
  --max_words 256 \
  --batch_size 16 \
  --frac 1.0
"""
import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"  # silence HF warning

import argparse, joblib, pandas as pd, torch
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sentence_transformers import SentenceTransformer

EMBED_MODEL = "Qwen/Qwen3-Embedding-0.6B"

def trim_texts(series: pd.Series, max_words: int):
    if max_words <= 0:
        return series
    return series.astype(str).apply(lambda s: " ".join(s.split()[:max_words]))

def load_csv(csv_path, text_col, label_col, frac, seed, max_words):
    df = pd.read_csv(csv_path)
    if text_col not in df or label_col not in df:
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
    return df[["sentence", "label_id"]].dropna()

def embed_sentences(model, sentences, batch_size):
    embs = model.encode(
        list(sentences),
        batch_size=batch_size,
        convert_to_tensor=True,
        normalize_embeddings=False,
        show_progress_bar=True
    )
    return embs

def main(args):
    os.makedirs(os.path.dirname(args.out_head), exist_ok=True)

    # 1. Load
    df = load_csv(args.csv, args.text_col, args.label_col,
                  args.frac, args.seed, args.max_words)
    if args.save_csv:
        df.to_csv(args.save_csv, index=False)

    # 2. Embed
    print(f"⏳  Loading {EMBED_MODEL} …")
    model = SentenceTransformer(EMBED_MODEL, trust_remote_code=True)
    print("🔍  Computing embeddings …")
    X = embed_sentences(model, df["sentence"], args.batch_size)
    y = df["label_id"].values

    # 3. Split
    X_tr, X_te, y_tr, y_te = train_test_split(
        X.cpu().numpy(), y,
        test_size=args.test_size,
        random_state=args.seed,
        stratify=y
    )

    # 4. Train head
    clf = LogisticRegression(max_iter=1000, n_jobs=-1)
    clf.fit(X_tr, y_tr)

    # 5. Eval
    y_pred = clf.predict(X_te)
    print("✅  Report (test):")
    print(classification_report(y_te, y_pred, digits=3))

    # 6. Save
    joblib.dump(clf, args.out_head)
    print(f"💾  Saved head to {args.out_head}")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--csv", required=True)
    p.add_argument("--text_col", default="sentence")
    p.add_argument("--label_col", required=True)
    p.add_argument("--out_head", required=True)
    p.add_argument("--save_csv", help="Write the (subsampled/trimmed) df to disk")
    p.add_argument("--frac", type=float, default=1.0)
    p.add_argument("--test_size", type=float, default=0.25)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--max_words", type=int, default=256, help="Trim each text to N words (0 = no trim)")
    p.add_argument("--batch_size", type=int, default=32, help="Embedding batch size")
    args = p.parse_args()
    main(args)
