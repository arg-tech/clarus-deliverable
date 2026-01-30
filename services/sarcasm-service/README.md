# Sarcasm Detection Service

Binary classifier for detecting sarcasm in text using Qwen3-Embedding-0.6B embeddings with a logistic regression head.

## Training

### 1. Prepare Dataset

The training dataset is at `data/sarcasm.csv` with columns:
- `sentence`: The text to classify
- `is_sarcastic`: Binary label (0 or 1)

### 2. Train Model

```bash
uv run python train_qwen_binary_classifier.py \
  --csv data/sarcasm.csv \
  --label_col is_sarcastic \
  --out_head models/sarcasm_head.joblib \
  --max_words 123 \
  --batch_size 8 \
  --frac 0.1
```

Parameters:
- `--csv`: Path to training CSV
- `--label_col`: Name of the label column
- `--out_head`: Path to save the trained model head
- `--frac`: Fraction of data to use (0.1 = 10%)
- `--max_words`: Truncate text to N words (123)
- Internal: `test_size=0.25` (25% held out for validation), `seed=42`

## Evaluation

```bash
cd ../../evaluation
uv run python evaluate_sarcasm.py
```

See `evaluation/README.md` for details on:
- Using default test datasets (103 samples, ~3-4 seconds)
- Using full test datasets (7,826 samples, comprehensive)
- Aggregating results across all ML services
