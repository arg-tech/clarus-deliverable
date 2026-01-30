# Passive Voice Detection Service

Binary classifier for detecting passive vs active voice in sentences using Qwen3-Embedding-0.6B embeddings with a logistic regression head.

## Training

### 1. Prepare Dataset

The training script supports two input formats:

1. **TSV format** (passive | active sentence pairs)
2. **CSV format** (long format with columns: `sentence`, `label`, `label_id`)

### 2. Train Model

With TSV:
```bash
uv run python train_qwen_voice_classifier.py \
  --input data/voice_pairs.tsv \
  --out_head models/voice_head.joblib \
  --out_csv voice_dataset.csv \
  --frac 0.3
```

With CSV:
```bash
uv run python train_qwen_voice_classifier.py \
  --input voice_dataset.csv \
  --out_head models/voice_head.joblib \
  --frac 0.3
```

Parameters:
- `--input`: Input file (.tsv for pairs, .csv for long format)
- `--out_head`: Path to save the trained model head
- `--out_csv`: Optional, save processed dataset as CSV
- `--frac`: Fraction of data to use (default: 1.0, use all data)
- Internal: `test_size=0.25` (25% held out for validation), `seed=42`

## Evaluation

Model evaluation has been moved to the centralized evaluation framework:

```bash
cd ../../evaluation
uv run python evaluate_passive_voice.py
```

See `evaluation/README.md` for details on:
- Using default test datasets (100 samples, ~3-4 seconds)
- Using full test datasets (710 samples, comprehensive)
- Aggregating results across all ML services
