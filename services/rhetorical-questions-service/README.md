# Rhetorical Questions Detection Service

Binary classifier for detecting rhetorical questions using Qwen3-Embedding-0.6B embeddings with a logistic regression head.

## Training

### 1. Prepare Dataset

Download and prepare datasets (SRQ for positives, WikiQA for negatives):

```bash
uv sync
uv run python build_datasets.py --out_dir data
```

This creates `data/rhetorical_questions.csv` with columns: `sentence`, `is_rq`

### 2. Train Model

```bash
uv run python train_qwen_binary_classifier.py \
  --csv data/rhetorical_questions.csv \
  --label_col is_rq \
  --out_head models/rq_head.joblib \
  --frac 1.0
```

Parameters:
- `--csv`: Path to training CSV
- `--label_col`: Name of the label column
- `--out_head`: Path to save the trained model head
- `--frac`: Fraction of data to use (1.0 = 100%)
- Internal: `max_words=256`, `test_size=0.25`, `seed=42`

## Evaluation

```bash
cd ../../evaluation
uv run python evaluate_rhetorical_questions.py
```

See `evaluation/README.md` for details on:
- Test dataset (101 samples, ~3-4 seconds)
- Aggregating results across all ML services

