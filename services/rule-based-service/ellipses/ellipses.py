
import re, logging
from models import BiasIndicatorResult, CharacterPositions

logger = logging.getLogger(__name__)

def analyse(text: str) -> list[BiasIndicatorResult]:
    results = []
    
    for match in re.finditer(r'\.\.\.', text):
        phrase = match.group().lower()
        start_pos = match.start()
        end_pos = match.end()
        
        results.append(
            BiasIndicatorResult(
                bias_indicator_key="ellipses",
                detected_phrase=phrase,
                character_positions=CharacterPositions(
                    start=start_pos,
                    end=end_pos
                )
            )
        )
    
    return results
