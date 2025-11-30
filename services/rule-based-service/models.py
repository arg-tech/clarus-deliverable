from typing import TypedDict, Optional

class CharacterPositions(TypedDict):
    start: int
    end: int

class BiasIndicatorResult(TypedDict, total=False):
    bias_indicator_key: str
    detected_phrase: str
    character_positions: Optional[CharacterPositions]

class LexiconTerm(TypedDict):
    word: str
    definition: str
    usage_example: str
    character_positions: CharacterPositions