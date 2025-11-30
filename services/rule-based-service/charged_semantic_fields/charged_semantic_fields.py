import json, os, logging
from models import BiasIndicatorResult, CharacterPositions
from src.helpers import find_phrases_in_text, enhanced_find_phrases_in_text, load_phrases_from_json_data
from src.morphodita import MorphoDiTaProtocol
from src.omorfi import OmorfiProtocol
from src.stanza import StanzaProtocol

logger = logging.getLogger(__name__)

def analyse(text: str, language: str = "en", morphodita: MorphoDiTaProtocol | None = None, omorfi: OmorfiProtocol | None = None, stanza: StanzaProtocol | None = None) -> list[BiasIndicatorResult]:
    language_map = {
        "en": "charged_semantic_fields_en.json",
        "fi": "charged_semantic_fields_fi_lemmas.json",
        "fi_fallback": "charged_semantic_fields_fi.json",
        "cs": "charged_semantic_fields_cs_lemmas.json",
        "cs_fallback": "charged_semantic_fields_cs.json",
        "pt": "charged_semantic_fields_pt_patterns.json",
        "el": "charged_semantic_fields_el_lemmas.json",
        "el_patterns": "charged_semantic_fields_el_patterns.json",
        "el_fallback": "charged_semantic_fields_el.json",
    }
    filename = language_map.get(language)
    if not filename:
        logger.warning(f"No file found for language '{language}', returning empty results")
        return []
    
    with open(os.path.join(os.path.dirname(__file__), filename), "r") as f:
        data = json.load(f)
        charged_semantic_fields = load_phrases_from_json_data(data)

    found_phrases = []
    try:
        if language == "cs" and morphodita:
            found_phrases = morphodita.find_phrases_in_text(text, list(charged_semantic_fields))
        elif language == "pt":
            found_phrases = enhanced_find_phrases_in_text(text, list(charged_semantic_fields))
        elif language == "fi" and omorfi:
            found_phrases = omorfi.find_phrases_in_text(text, list(charged_semantic_fields))
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
            found_phrases = stanza.find_phrases_in_text(text, list(charged_semantic_fields), patterns)
        else:
            found_phrases = find_phrases_in_text(text, list(charged_semantic_fields))
    except Exception as e:
        logger.warning(f"Lemmatization failed for {language} text, falling back to simple matching: {e}")
        default_filename = language_map.get(f"{language}_fallback")
        if not default_filename:
            logger.warning(f"No fallback file found for {language} text, returning empty results")
            return []
        with open(os.path.join(os.path.dirname(__file__), default_filename), "r") as f:
            data = json.load(f)
            charged_semantic_fields = load_phrases_from_json_data(data)
        found_phrases = find_phrases_in_text(text, list(charged_semantic_fields))

    return [
        BiasIndicatorResult(
            bias_indicator_key="chargedSemanticFields",
            detected_phrase=match["phrase"],
            character_positions=CharacterPositions(
                start=match["start"],
                end=match["end"]
            )
        ) for match in found_phrases
    ]