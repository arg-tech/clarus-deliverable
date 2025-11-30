
import json, os, logging, re
from models import LexiconTerm

logger = logging.getLogger(__name__)

def analyse(text: str, language: str = "en") -> list[LexiconTerm]:
    terms_map = {
        "en": "lexicon_terms_en.json"
    }

    filename = terms_map.get(language)
    if not filename:
        logger.warning(f"No file found for language '{language}', returning empty results")
        return []
    
    with open(os.path.join(os.path.dirname(__file__), filename), "r") as f:
        data = json.load(f)

    results: list[LexiconTerm] = []
    for entry in data:
        pattern = entry["word_regex"]
        definition = entry["definition"]
        usage_example = entry["usage_example"]
        
        # Add word boundaries to ensure we match whole words only
        # For patterns with alternation (|), wrap each alternative with word boundaries
        if '|' in pattern:
            alternatives = pattern.split('|')
            regex_pattern = '|'.join(r'\b' + alt.strip() + r'\b' for alt in alternatives)
        else:
            regex_pattern = r'\b' + pattern + r'\b'
        
        for match in re.finditer(regex_pattern, text, re.IGNORECASE):
            matched_text = match.group()
            results.append(LexiconTerm(
                word=matched_text,
                definition=definition,
                usage_example=usage_example,
                character_positions={"start": match.start(), "end": match.end()}
            ))
    
    # Sort results by ending position
    results.sort(key=lambda term: term["character_positions"]["end"])
    return results