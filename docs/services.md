# Services Reference

The platform is composed of specialised services, each responsible for detecting different types of bias indicators. This document describes what each service does and how they work together.

## Overview

The platform uses three different approaches to bias detection:

- **Rule-based detection** uses curated lexicons of words and phrases known to indicate bias, with morphological analysis to handle different word forms across languages.
- **Machine learning detection** uses neural network classifiers trained on labelled datasets to identify patterns that are difficult to capture with simple word matching.
- **LLM-based detection** uses large language models to understand context and identify sophisticated bias patterns that require reasoning about meaning.

Each approach has its strengths. Rule-based detection is fast, transparent, and works across all supported languages. ML detection can identify subtle patterns like sarcasm that don't rely on specific words. LLM detection can understand context and catch nuanced bias that requires reading comprehension.

---

## Frontend

The web interface allows users to paste or upload text for analysis. Results are displayed with bias indicators highlighted directly in the text, making it easy to see exactly where potential bias was detected.

The interface supports five languages (English, Portuguese, Czech, Finnish, Greek) and automatically detects the language of the input text. Users can also upload PDF files for analysis.

A sentiment analysis chart provides an overview of the emotional tone across the document, helping users understand the overall balance of positive, negative, and neutral language.

---

## Gateway

The gateway serves as the central routing layer. When a user submits text for analysis, the gateway forwards the request to all relevant processing services in parallel and aggregates their responses.

If any individual service fails or times out, the gateway returns partial results from the services that succeeded. This ensures users still receive useful analysis even if one component is temporarily unavailable.

---

## Rule-Based Service

The rule-based service detects bias using curated lexicons - collections of words and phrases that linguistic experts have identified as potential bias indicators. This is the most transparent form of detection, as each match can be traced back to a specific entry in the lexicon.

To handle the complexity of natural language, the service uses morphological analysis. For example, in Czech, the word "vždy" (always) might appear in different grammatical cases. The service uses MorphoDiTa for Czech, Stanza for Greek, and UralicNLP for Finnish to recognise all forms of a word.

### Bias Categories

The service detects 17 categories of bias indicators:

| Category | What It Detects |
|----------|-----------------|
| Absolute Terms | Words like "always", "never", "impossible" that leave no room for nuance |
| Capitalisation | Unusual EMPHASIS through capitalisation |
| Charged Semantic Fields | Words from emotionally loaded topic areas |
| Concessive Connectives | Words like "however" and "although" used to dismiss preceding points |
| Dysphemisms | Deliberately negative or derogatory word choices |
| Ellipses | Omitted information that may suggest bias through what's left unsaid |
| Emotionally Charged Adjectives | Adjectives with strong positive or negative connotations |
| Euphemisms | Softened language that may hide negative aspects |
| Event Labeling | Biased labels for events (e.g., "riot" vs "protest") |
| Exclamation/Question Marks | Excessive punctuation suggesting editorial opinion |
| Framing By Time | Temporal framing that biases interpretation |
| Historically Derogatory Terms | Terms with discriminatory origins or usage |
| Intensifying Adverbs | Adverbs that exaggerate (extremely, totally, absolutely) |
| Italics/Boldface | Emphasis that may suggest editorial bias |
| Mitigators | Language that downplays the severity of issues |
| Overgeneralizations | Sweeping statements about groups |
| Oversimplified Group Labels | Reductive labels that flatten complex identities |

All 17 categories are supported across all five languages.

---

## Machine Learning Services

Four services use machine learning classifiers to detect bias patterns that are difficult to capture with word matching alone.

### Passive Voice Service

Detects passive voice constructions that may obscure who is responsible for an action. For example, "mistakes were made" hides the agent compared to "the minister made mistakes."

### Rhetorical Questions Service

Identifies questions that are not genuine inquiries but rhetorical devices used to imply a conclusion. For example, "How could anyone support such a policy?" is not asking for information but implying that support is unreasonable.

### Sarcasm Service

Detects sarcastic statements where the literal meaning differs from the intended meaning. Sarcasm can be a subtle form of bias, expressing disapproval while maintaining plausible deniability.

### Sentiment Service

Analyses the emotional tone of text, classifying sentences as positive, negative, or neutral. While sentiment itself isn't bias, understanding the emotional balance of a document helps identify whether coverage is slanted.

These ML services currently support English. They use sentence embeddings to understand meaning beyond individual words, allowing them to detect patterns based on how ideas are expressed rather than specific vocabulary.

---

## LLM Caller Service

The LLM service detects sophisticated bias patterns that require understanding context and reasoning about meaning. It uses a large language model to analyse text and identify six advanced bias patterns:

| Pattern | What It Detects |
|---------|-----------------|
| Oversimplified Comparisons | Analogies that ignore important nuances to make a point |
| Referential Ambiguity | Vague references like "those people" that can signal bias |
| Subordinate Clauses | Clauses that diminish or dismiss main points |
| Double Entendres | Phrases with secondary meanings that imply bias |
| Tag Questions | Questions like "isn't it?" that assume agreement |
| Contextual Framing | Framing that biases interpretation of events |

By default, the service uses a self-hosted Qwen3-4B model, ensuring all analysis happens on-premises with no data leaving the infrastructure. Users can optionally choose to use a cloud-hosted model (Gemini 2.5 Flash) for potentially better performance, with the understanding that their text will be processed by Google's servers.

If the remote model fails or is unavailable, the service automatically falls back to the local model.

---

## Bias Indicators by Language

The following tables summarise which indicators are available in which languages.

### Rule-Based Indicators

All 17 rule-based indicators support all five languages: Czech (CS), Greek (EL), English (EN), Finnish (FI), and Portuguese (PT).

### ML-Based Indicators

| Indicator | Languages |
|-----------|-----------|
| Passive Voice | EN |
| Rhetorical Questions | EN |
| Sarcasm | EN |
| Sentiment | EN |

### LLM-Based Indicators

| Indicator | Languages |
|-----------|-----------|
| Oversimplified Comparisons | CS, EL, EN, FI, PT |
| Referential Ambiguity | CS, EL, EN, FI, PT |
| Subordinate Clauses | CS, EL, EN, FI, PT |
| Double Entendres | CS, EL, EN, PT |
| Tag Questions | CS, EL, EN, FI, PT |
| Contextual Framing | CS, EL, EN, FI, PT |
