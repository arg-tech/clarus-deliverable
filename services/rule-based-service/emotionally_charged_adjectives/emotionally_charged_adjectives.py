
import json, os, logging
from models import BiasIndicatorResult, CharacterPositions
from src.helpers import find_phrases_in_text, enhanced_find_phrases_in_text, load_phrases_from_json_data
from src.morphodita import MorphoDiTaProtocol
from src.omorfi import OmorfiProtocol
from src.stanza import StanzaProtocol

logger = logging.getLogger(__name__)

def analyse(text: str, language: str = "en", morphodita: MorphoDiTaProtocol | None = None, omorfi: OmorfiProtocol | None = None, stanza: StanzaProtocol | None = None) -> list[BiasIndicatorResult]:
    language_map = {
        "en": "emotionally_charged_adjectives_en.json",
        "el": "emotionally_charged_adjectives_el_lemmas.json",
        "el_patterns": "emotionally_charged_adjectives_el_patterns.json",
        "el_fallback": "emotionally_charged_adjectives_el.json",
        "fi": "emotionally_charged_adjectives_fi_lemmas.json",
        "fi_fallback": "emotionally_charged_adjectives_fi.json",
        "pt": "emotionally_charged_adjectives_pt_patterns.json",
        "cs": "emotionally_charged_adjectives_cs_lemmas.json",
        "cs_fallback": "emotionally_charged_adjectives_cs.json",
    }
    filename = language_map.get(language)
    if not filename:
        logger.warning(f"No file found for language '{language}', returning empty results")
        return []
    
    with open(os.path.join(os.path.dirname(__file__), filename), "r") as f:
        data = json.load(f)
        emotionally_charged_adjectives = load_phrases_from_json_data(data)

    found_adjectives = []
    try:
        if language == "cs" and morphodita:
            found_adjectives = morphodita.find_phrases_in_text(text, list(emotionally_charged_adjectives))
        elif language == "pt":
            found_adjectives = enhanced_find_phrases_in_text(text, list(emotionally_charged_adjectives))
        elif language == "fi" and omorfi:
            found_adjectives = omorfi.find_phrases_in_text(text, list(emotionally_charged_adjectives))
        elif language == "el" and stanza:
            patterns_filename = language_map.get("el_patterns")
            patterns = None
            if patterns_filename:
                try:
                    with open(os.path.join(os.path.dirname(__file__), patterns_filename), "r") as f:
                        patterns_data = json.load(f)
                        patterns = list(load_phrases_from_json_data(patterns_data))
                except FileNotFoundError:
                    logger.warning(f"Patterns file not found: {patterns_filename}, using only lemmas")
            found_adjectives = stanza.find_phrases_in_text(text, list(emotionally_charged_adjectives), patterns)
        else:
            found_adjectives = find_phrases_in_text(text, list(emotionally_charged_adjectives))
    except Exception as e:
        logger.warning(f"Lemmatization failed for {language} text, falling back to simple matching: {e}")
        default_filename = language_map.get(f"{language}_fallback")
        if not default_filename:
            logger.warning(f"No fallback file found for {language} text, returning empty results")
            return []
        with open(os.path.join(os.path.dirname(__file__), default_filename), "r") as f:
            data = json.load(f)
            emotionally_charged_adjectives = load_phrases_from_json_data(data)
        found_adjectives = find_phrases_in_text(text, list(emotionally_charged_adjectives))

    return [
        BiasIndicatorResult(
            bias_indicator_key="emotionallyChargedAdjectives",
            detected_phrase=match["phrase"],
            character_positions=CharacterPositions(
                start=match["start"],
                end=match["end"]
            )
        ) for match in found_adjectives
    ]
