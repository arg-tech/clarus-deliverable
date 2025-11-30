#!/usr/bin/env python
"""
Download SRQ, WikiQA, IAC and SARC; create:
  1) rhetorical_questions.csv   (sentence, is_rq)
  2) sarcasm.csv                (sentence, is_sarcastic)

Run:
    python build_datasets.py --out_dir data

Optional args:
    --rq_frac 1.0        # subsample SRQ (positives)
    --neg_frac 1.0       # subsample WikiQA (negatives)
    --sarc_frac 1.0      # subsample SARC (for speed)
"""

import argparse, os, io, zipfile, bz2, json, csv, glob, random, shutil, tarfile
from pathlib import Path
import requests
import pandas as pd
from tqdm import tqdm
from datasets import load_dataset  # 🤗 datasets

# ------------------------- CONSTANT URLS ------------------------- #
SRQ_ZIP_URL   = "https://github.com/soraby/sarcasm-rq/archive/refs/heads/master.zip"
IAC_ZIP_URL   = "https://nlds.soe.ucsc.edu/sites/default/files/iac/iac_v1.0.zip"  # fallback guess; adjust if 404
SARC_BASE     = "https://nlp.cs.princeton.edu/old/SARC/2.0"
SARC_MAIN     = f"{SARC_BASE}/main"
SARC_FILES    = {
    "train_bal": f"{SARC_MAIN}/train-balanced.csv.bz2",
    "test_bal":  f"{SARC_MAIN}/test-balanced.csv.bz2",
    "comments":  f"{SARC_MAIN}/comments.json.bz2",
}

# ------------------------- HELPERS ------------------------- #
def download(url, dest):
    dest = Path(dest)
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        with open(dest, "wb") as f, tqdm(total=total, unit="B", unit_scale=True, desc=dest.name) as pbar:
            for chunk in r.iter_content(chunk_size=1 << 16):
                if chunk:
                    f.write(chunk)
                    pbar.update(len(chunk))
    return dest

def unzip(zip_path, out_dir):
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(out_dir)
    return Path(out_dir)

def bunzip2(path_bz2, out_path=None):
    path_bz2 = Path(path_bz2)
    if out_path is None:
        out_path = path_bz2.with_suffix("")  # drop .bz2
    if Path(out_path).exists():
        return Path(out_path)
    with bz2.open(path_bz2, "rb") as f_in, open(out_path, "wb") as f_out:
        shutil.copyfileobj(f_in, f_out)
    return Path(out_path)

def find_first_col(df, candidates):
    for c in candidates:
        if c in df.columns:
            return c
    return df.columns[0]

# ------------------------- SRQ ------------------------- #
def load_srq_texts(root_dir, frac=1.0, seed=42):
    """Return a list of rhetorical question strings from SRQ repo."""
    random.seed(seed)
    csvs = glob.glob(str(Path(root_dir) / "**/*.csv"), recursive=True)
    all_texts = []
    for f in csvs:
        try:
            df = pd.read_csv(f)
        except Exception:
            continue
        col = find_first_col(df, ["rq", "RQ", "question", "text", "utterance"])
        texts = df[col].dropna().astype(str).tolist()
        all_texts.extend(texts)
    # subsample
    if 0 < frac < 1.0:
        k = int(len(all_texts) * frac)
        all_texts = random.sample(all_texts, max(k, 1))
    return all_texts

# ------------------------- WikiQA ------------------------- #
def load_wikiqa_questions(frac=1.0, seed=42):
    ds = load_dataset("microsoft/wiki_qa", split="train")
    q = pd.Series(ds["question"]).astype(str)
    q = q[q.str.strip().str.endswith("?")]  # ensure they look like questions
    q = q.sample(frac=frac, random_state=seed)
    return q.tolist()

# ------------------------- IAC (optional negatives) ------------------------- #
def load_iac_questions(iac_dir, max_samples=50000, seed=42):
    """
    Very loose heuristic: scan JSON files for posts that end with '?' and treat as non-RQ.
    If parsing fails, return [] silently.
    """
    random.seed(seed)
    texts = []
    for jf in glob.glob(str(Path(iac_dir) / "**/*.json"), recursive=True):
        try:
            with open(jf, "r") as f:
                data = json.load(f)
            if isinstance(data, dict):
                iterable = data.values()
            else:
                iterable = data
            for item in iterable:
                if isinstance(item, dict):
                    txt = item.get("text") or item.get("body") or ""
                    if isinstance(txt, str) and txt.strip().endswith("?"):
                        texts.append(txt)
        except Exception:
            continue
        if len(texts) >= max_samples:
            break
    return texts

# ------------------------- SARC ------------------------- #
def load_sarc_comments(raw_dir, frac=1.0, seed=42):
    """
    Parse train/test balanced files + comments.json to produce (text, label).
    Labels are after the third '|' field; 1 = sarcastic.
    """
    random.seed(seed)
    # ensure files are decompressed
    tb = bunzip2(Path(raw_dir) / "train-balanced.csv.bz2")
    te = bunzip2(Path(raw_dir) / "test-balanced.csv.bz2")
    comments_path = bunzip2(Path(raw_dir) / "comments.json.bz2")
    with open(comments_path) as f:
        comments = json.load(f)

    def parse_seq_file(path):
        rows = []
        with bz2.open(str(path) + ".bz2", "rt") if str(path).endswith(".bz2") else open(path, "r") as f:
            reader = csv.reader(f)
            for line in reader:
                if not line:
                    continue
                parts = line[0].split("|")
                if len(parts) != 3:
                    continue
                _, responses_str, labels_str = parts
                resp_ids = responses_str.split()
                labels = labels_str.split()
                for rid, lab in zip(resp_ids, labels):
                    txt = comments.get(rid, {}).get("text", "")
                    if txt:
                        rows.append((txt, int(lab)))
        return rows

    rows = parse_seq_file(tb) + parse_seq_file(te)
    if 0 < frac < 1.0:
        k = int(len(rows) * frac)
        rows = random.sample(rows, max(k, 1))
    return rows

# ------------------------- MAIN ------------------------- #
def main(args):
    out_dir = Path(args.out_dir)
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    # 1) Download & extract SRQ
    print("==> Downloading SRQ …")
    srq_zip = download(SRQ_ZIP_URL, raw_dir / "srq.zip")
    srq_root = unzip(srq_zip, raw_dir / "srq_extracted")

    # 2) Download WikiQA via HF (no file saving needed)
    print("==> Loading WikiQA (HF) …")

    # 3) Download IAC
    print("==> Downloading IAC (optional)…")
    try:
        iac_zip = download(IAC_ZIP_URL, raw_dir / "iac.zip")
        iac_root = unzip(iac_zip, raw_dir / "iac_extracted")
    except Exception as e:
        print(f"[WARN] IAC download failed ({e}). Continuing without it.")
        iac_root = None

    # 4) Download SARC files
    print("==> Downloading SARC …")
    sarc_dir = raw_dir / "sarc"
    sarc_dir.mkdir(exist_ok=True)
    for name, url in SARC_FILES.items():
        try:
            download(url, sarc_dir / Path(url).name)
        except Exception as e:
            print(f"[WARN] Failed to get {name}: {e}")

    # ----------------- Build RQ dataset ----------------- #
    print("==> Building RQ dataset …")
    rq_pos = load_srq_texts(srq_root, frac=args.rq_frac, seed=args.seed)

    rq_neg = load_wikiqa_questions(frac=args.neg_frac, seed=args.seed)
    if iac_root:
        extra_neg = load_iac_questions(iac_root, max_samples=20000, seed=args.seed)
        rq_neg.extend(extra_neg)

    rq_df = pd.DataFrame(
        {"sentence": rq_pos + rq_neg,
         "is_rq":     [1]*len(rq_pos) + [0]*len(rq_neg)}
    ).drop_duplicates(subset="sentence").sample(frac=1.0, random_state=args.seed)
    rq_df.to_csv(out_dir / "rhetorical_questions.csv", index=False)
    print(f"Saved RQ dataset: {len(rq_df)} rows")

    # ----------------- Build Sarcasm dataset ----------------- #
    print("==> Building Sarcasm dataset …")
    sarc_rows = load_sarc_comments(sarc_dir, frac=args.sarc_frac, seed=args.seed)
    sarc_df = pd.DataFrame(sarc_rows, columns=["sentence", "is_sarcastic"])
    sarc_df = sarc_df.drop_duplicates(subset="sentence").sample(frac=1.0, random_state=args.seed)
    sarc_df.to_csv(out_dir / "sarcasm.csv", index=False)
    print(f"Saved Sarcasm dataset: {len(sarc_df)} rows")

    print("✅ Done.")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out_dir", default="data", help="Where to store raw & processed files")
    ap.add_argument("--rq_frac", type=float, default=1.0, help="Keep this fraction of SRQ positives")
    ap.add_argument("--neg_frac", type=float, default=1.0, help="Keep this fraction of WikiQA negatives")
    ap.add_argument("--sarc_frac", type=float, default=1.0, help="Keep this fraction of SARC rows")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    main(args)
