# API Reference

The platform exposes a REST API through the gateway service. All endpoints accept and return JSON.

## Base URL

When running locally: `http://localhost:7021`

## Authentication

The API does not require authentication. If you're exposing the service publicly, consider adding authentication at the reverse proxy level.

---

## Endpoints

### Analyse Text

Analyses text for bias indicators using rule-based detection and ML models (passive voice, rhetorical questions, sarcasm).

```
POST /analyse
```

**Request Body**

```json
{
  "text": "The decision was made by officials, which was absolutely devastating for residents.",
  "richText": "<p>The decision was made by officials, which was <strong>absolutely</strong> devastating for residents.</p>",
  "language": "en"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Plain text to analyse |
| `richText` | string | No | HTML-formatted text (used to detect italics/boldface emphasis) |
| `language` | string | No | ISO 639-1 language code. Default: `en`. Supported: `en`, `pt`, `cs`, `fi`, `el` |

**Response**

Returns an array of detected bias indicators:

```json
[
  {
    "bias_indicator_key": "absoluteTerms",
    "detected_phrase": "absolutely",
    "character_positions": {
      "start": 52,
      "end": 62
    }
  },
  {
    "bias_indicator_key": "passiveVoice",
    "detected_phrase": "The decision was made by officials",
    "confidence": "87.32%"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `bias_indicator_key` | string | Identifier for the type of bias detected |
| `detected_phrase` | string | The text that triggered the detection |
| `character_positions` | object | Start and end positions in the original text (rule-based only) |
| `confidence` | string | Confidence score (ML services only) |

**Bias Indicator Keys**

Rule-based indicators: `absoluteTerms`, `capitalisation`, `chargedSemanticFields`, `concessiveConnectives`, `dysphemisms`, `ellipses`, `emotionallyChargedAdjectives`, `euphemisms`, `eventLabeling`, `exclamationQuestionMarks`, `framingByTime`, `historicallyDerogatoryTerms`, `intensifyingAdverbs`, `italicsBoldface`, `mitigators`, `overgeneralizations`, `oversimplifiedGroupLabels`

ML indicators: `passiveVoice`, `rhetoricalQuestion`, `sarcasm`

---

### LLM Analysis

Analyses text using a large language model to detect advanced bias patterns that require contextual understanding.

```
POST /llm-analyse
```

**Request Body**

```json
{
  "text": "Given the suspect's history, the outcome was inevitable, wasn't it?",
  "language": "en",
  "model_to_use": "local"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Text to analyse |
| `language` | string | No | ISO 639-1 language code. Default: `en` |
| `model_to_use` | string | No | `local` (Qwen3-4B, private) or `remote` (Gemini 2.5 Flash). Default: `local` |

**Response**

```json
{
  "bias_indicators": [
    {
      "bias_indicator_key": "contextualFraming",
      "detected_phrase": "Given the suspect's history, the outcome was inevitable"
    },
    {
      "bias_indicator_key": "tagQuestions",
      "detected_phrase": "wasn't it?"
    }
  ],
  "model_used": "local",
  "is_fallback": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `bias_indicators` | array | List of detected bias indicators |
| `model_used` | string | Which model was actually used (`local` or `remote`) |
| `is_fallback` | boolean | True if the requested model failed and fallback was used |

**LLM Bias Indicator Keys**

`contextualFraming`, `doubleEntendres`, `oversimplifiedComparison`, `referentialAmbiguity`, `subordinateClauses`, `tagQuestions`

---

### Sentiment Analysis

Analyses the emotional tone of text, classifying each sentence as positive, negative, or neutral.

```
POST /get-sentiment
```

**Request Body**

```json
{
  "text": "The team delivered excellent results. However, the timeline was disappointing.",
  "language": "en"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Text to analyse |
| `language` | string | No | ISO 639-1 language code. Default: `en`. Supported: `en`, `pt` |

**Response**

Returns sentiment analysis for each sentence:

```json
[
  {
    "sentence": "The team delivered excellent results.",
    "sentiment": "POSITIVE",
    "confidence": 0.94
  },
  {
    "sentence": "However, the timeline was disappointing.",
    "sentiment": "NEGATIVE",
    "confidence": 0.87
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `sentence` | string | The analysed sentence |
| `sentiment` | string | `POSITIVE`, `NEGATIVE`, or `NEUTRAL` |
| `confidence` | number | Confidence score between 0 and 1 |

---

### Get Lexicon Terms

Extracts and explains bias-related terms found in the text, providing definitions and usage examples.

```
POST /get-lexicon-terms
```

**Request Body**

```json
{
  "text": "The politician's remarks were considered inflammatory by critics.",
  "language": "en"
}
```

**Response**

```json
[
  {
    "word": "inflammatory",
    "definition": "Language intended to arouse strong emotions, especially anger",
    "usage_example": "The inflammatory rhetoric divided the community.",
    "character_positions": {
      "start": 35,
      "end": 47
    }
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `word` | string | The detected term |
| `definition` | string | Explanation of why this term may indicate bias |
| `usage_example` | string | Example of the term in context |
| `character_positions` | object | Location in the original text |

---

## Error Responses

The API uses standard HTTP status codes:

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Bad request (e.g., context length exceeded for LLM) |
| 500 | Internal server error |
| 503 | Service unavailable (backend service not running) |
| 504 | Gateway timeout (backend service took too long) |

**Error Response Format**

```json
{
  "error": "context_length_exceeded"
}
```

Or for HTTP exceptions:

```json
{
  "detail": "Backend service timeout"
}
```
