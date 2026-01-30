# Evaluation Framework

Scripts for measuring the accuracy of bias detection services across supported languages.

## Setup

Install dependencies:

```bash
cd evaluation
uv sync
```

---

## Rule-Based Service

Evaluates the lexicon-based bias detection across all 5 languages.

### Prerequisites

Start the rule-based service:

```bash
docker compose up -d rule-based-service
```

### Run Evaluation

```bash
# Evaluate all languages
uv run python evaluate_rule_based.py

# Evaluate a single language
uv run python evaluate_rule_based.py --language cs

# Limit samples per language
uv run python evaluate_rule_based.py --samples 50
```

### Output

- All languages: `reports/rule-based/summary.md`
- Single language: `reports/rule-based/{language}.md`

---

## LLM Service

Evaluates the LLM-based bias detection for advanced patterns like contextual framing and tag questions.

### Prerequisites

1. Configure API keys:
   ```bash
   # For remote (Gemini) evaluation
   echo "your-gemini-key" > ../.secrets/GEMINI_API_KEY.txt

   # For local (Qwen) evaluation
   echo "your-vllm-key" > ../.secrets/LLM_API_KEY.txt
   ```

2. Start the LLM service:
   ```bash
   docker compose up -d llm-caller-service
   ```

### Run Evaluation

```bash
# Evaluate with remote model (Gemini)
uv run python evaluate_llm.py --indicator all --language en --model remote

# Evaluate with local model (Qwen3-4B)
uv run python evaluate_llm.py --indicator all --language en --model local

# Evaluate a specific indicator
uv run python evaluate_llm.py --indicator contextual_framing --language en

# Limit samples for quick testing
uv run python evaluate_llm.py --indicator all --language en --samples 10
```

### Output

`reports/llm/{language}_{model}.md`

---

## ML Services

The following sections cover evaluation of the ML-based classifiers: passive voice, sarcasm, rhetorical questions, and sentiment.

### Compute Requirements

These evaluations load PyTorch models and run inference locally. An NVIDIA GPU is recommended but not required — models fall back to CPU if no GPU is available.

| Service | Model | GPU Memory |
|---------|-------|------------|
| Passive Voice | Qwen3-Embedding-0.6B + sklearn | ~2 GB |
| Sarcasm | Qwen3-Embedding-0.6B + sklearn | ~2 GB |
| Rhetorical Questions | Qwen3-Embedding-0.6B + sklearn | ~2 GB |
| Sentiment | multilingual-sentiment-analysis | ~1 GB |

Models are loaded from their respective service directories (`services/{service}/models/`). The sentiment model downloads automatically on first run.

### Test Datasets

Each ML service has default and full test datasets:

| Service | Default | Full |
|---------|---------|------|
| Passive Voice | 100 samples | 710 samples |
| Sarcasm | 103 samples | 7,826 samples |
| Rhetorical Questions | 101 samples | — |
| Sentiment | 122 samples | — |

The evaluation scripts use the default (smaller) datasets, which complete in seconds and provide reliable accuracy estimates. Full datasets are available for passive voice and sarcasm if comprehensive benchmarking is needed, but evaluation may take significantly longer.

---

## Passive Voice Service

Evaluates the ML model for detecting passive voice constructions.

### Run Evaluation

```bash
uv run python evaluate_passive_voice.py
```

### Output

`reports/ml/passive_voice_results.json`

---

## Sarcasm Service

Evaluates the ML model for detecting sarcastic statements.

### Run Evaluation

```bash
uv run python evaluate_sarcasm.py
```

### Output

`reports/ml/sarcasm_results.json`

---

## Rhetorical Questions Service

Evaluates the ML model for detecting rhetorical questions.

### Run Evaluation

```bash
uv run python evaluate_rhetorical_questions.py
```

### Output

`reports/ml/rhetorical_questions_results.json`

---

## Sentiment Service

Evaluates the sentiment analysis model.

### Run Evaluation

```bash
uv run python evaluate_sentiment.py
```

### Output

`reports/ml/sentiment_results.json`

---

## Aggregate Results

Generate summary reports across all evaluations:

```bash
# Aggregate all evaluation types
uv run python aggregate_results.py --type all

# Aggregate by type
uv run python aggregate_results.py --type llm
uv run python aggregate_results.py --type rules
uv run python aggregate_results.py --type ml
```

### Output

- `reports/llm/summary_{model}.md`
- `reports/rule-based/summary.md`
- `reports/ml/summary.md`
