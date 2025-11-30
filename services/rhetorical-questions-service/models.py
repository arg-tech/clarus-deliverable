from typing import TypedDict

class BiasIndicatorResult(TypedDict, total=False):
    bias_indicator_key: str
    detected_phrase: str
    confidence: str
