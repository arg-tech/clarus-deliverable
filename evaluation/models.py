"""Pydantic models for LLM evaluation framework."""

from pydantic import BaseModel
from typing import List
from enum import Enum


class ModelSource(str, Enum):
    LOCAL = "local"    # Qwen3-4B via vllm-1.amfws.arg.tech
    REMOTE = "remote"  # Gemini via generativelanguage.googleapis.com


class IndicatorType(str, Enum):
    CONTEXTUAL_FRAMING = "contextual_framing"
    DOUBLE_ENTENDRES = "double_entendres"
    OVERSIMPLIFIED_COMPARISON = "oversimplified_comparison"
    REFERENTIAL_AMBIGUITY = "referential_ambiguity"
    SUBORDINATE_CLAUSES = "subordinate_clauses"
    TAG_QUESTIONS = "tag_questions"


class LanguageCode(str, Enum):
    ENGLISH = "en"
    CZECH = "cs"
    GREEK = "el"
    PORTUGUESE = "pt"
    FINNISH = "fi"


class Sample(BaseModel):
    text: str
    expected: List[str]


class DatasetBatch(BaseModel):
    samples: List[Sample]


class Dataset(BaseModel):
    indicator: IndicatorType
    language: LanguageCode
    samples: List[Sample]


class EvaluationResult(BaseModel):
    sample_index: int
    text: str
    expected: List[str]
    detected: List[str]
    true_positives: int
    false_positives: int
    false_negatives: int


class IndicatorMetrics(BaseModel):
    indicator: str
    language: str
    model: str = "remote"
    total_samples: int
    total_tp: int
    total_fp: int
    total_fn: int
    precision: float
    recall: float
    weighted_accuracy: float
    errors: int = 0


class AggregatedResults(BaseModel):
    language: str
    indicators: List[IndicatorMetrics]
    macro_precision: float
    macro_recall: float
    macro_weighted_accuracy: float
    micro_precision: float
    micro_recall: float
    micro_weighted_accuracy: float
