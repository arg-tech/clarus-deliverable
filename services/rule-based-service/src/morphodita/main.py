from src.morphodita.adapter import MorphoDiTaAdapter
from typing import Protocol, List, Dict, Any


class MorphoDiTaProtocol(Protocol):
    def find_phrases_in_text(self, text: str, pattern_lemmas: List[str]) -> List[Dict[str, Any]]:
        ...


class MorphoDiTa:
    def __init__(self):
        self.adapter = MorphoDiTaAdapter()
    
    def find_phrases_in_text(self, text: str, pattern_lemmas: List[str]) -> List[Dict[str, Any]]:
        lemma_results = self.adapter.lemmatize_text(text)
        lemmas = [result["lemma"] for result in lemma_results]
        
        matches = []
        sorted_pattern_lemmas = sorted(pattern_lemmas, key=lambda x: len(x.split(" ")), reverse=True)  # handle multi-word patterns
        for pattern in sorted_pattern_lemmas:
            pattern_parts = pattern.split(" ")
            pattern_length = len(pattern_parts)

            for i in range(len(lemmas) - pattern_length + 1):
                window = lemmas[i:i+pattern_length]
                if window == pattern_parts:
                    start = lemma_results[i]["start"]
                    end = lemma_results[i+pattern_length-1]["end"]
                    matched_text = text[start:end]
                    
                    # This is to prevent double-matching, e.g. both "optimalizace nákladů" and "optimalizace" will be 
                    # matched because both of them are in the dictionary

                    # Check for overlaps with existing matches
                    overlaps = False
                    for existing_match in matches:
                        if not (end < existing_match["start"] or start > existing_match["end"]):
                            overlaps = True
                            break
                    
                    # Only add new match if no overlap (longer matches are processed first due to sorting)
                    if not overlaps:
                        matches.append({
                            "phrase": matched_text.lower(),
                            "start": start,
                            "end": end,
                        })
        
        return matches
