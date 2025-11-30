
import re, logging
from models import BiasIndicatorResult, CharacterPositions
from typing import List

logger = logging.getLogger(__name__)

def analyse(text: str) -> list[BiasIndicatorResult]:
    results: List[BiasIndicatorResult] = []
    
    for match in re.finditer(r'\b[A-Z][A-Z\s]*[A-Z]\b', text):
        phrase = match.group()
        start_pos = match.start()
        end_pos = match.end()

        if len(phrase) < 5:
            continue
        
        results.append(
            BiasIndicatorResult(
                bias_indicator_key="capitalisation",
                detected_phrase=phrase,
                character_positions=CharacterPositions(
                    start=start_pos,
                    end=end_pos
                )
            )
        )

    total_chars_detected = sum(len(result.get("detected_phrase", "")) for result in results)
    if total_chars_detected > len(text) * 0.3:
        logger.warning(f"Capitalisation detection exceeded 30% threshold. Returning empty list.")
        return []
    
    return results