# Sentiment Analysis Service

Multilingual sentiment classifier using the pre-trained `tabularisai/multilingual-sentiment-analysis` model. Classifies text into 5 sentiment categories.

## Model

- **Model:** `tabularisai/multilingual-sentiment-analysis`
- **Framework:** Hugging Face Transformers
- **Labels:** VERY NEGATIVE, NEGATIVE, NEUTRAL, POSITIVE, VERY POSITIVE

## Inference

Single sentence:

```bash
uv run python infer_sentiment_scores.py --sent "That is brilliant and great"
```

Example output:
```
=> That is brilliant and great
   => VERY POSITIVE  (p=95.23%)
```

## Evaluation

```bash
cd ../../evaluation
uv run python evaluate_sentiment.py
```

See `evaluation/README.md` for details on:
- Test dataset (122 samples, ~5-6 seconds)
- Aggregating results across all ML services

## Dependencies

Install with UV:

```bash
uv sync
```

Or with pip:

```bash
pip install -r requirements.txt
```
