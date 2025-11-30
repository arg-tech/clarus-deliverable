from .adapter import StanzaAdapter
from typing import Protocol, List, Optional, Dict, Any
import re

class StanzaProtocol(Protocol):
    def find_phrases_in_text(self, text: str, pattern_lemmas: List[str], patterns: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        ...


class Stanza:
    def __init__(self, language: str):
        self.adapter = StanzaAdapter(language=language)
        self._lemmatization_cache: dict[str, list[dict]] = {}
    
    def find_phrases_in_text(self, text: str, pattern_lemmas: list[str], patterns: Optional[list[str]] = None) -> list[Dict[str, Any]]:
        regex_matches = []
        if patterns:
            sorted_patterns = sorted(patterns, key=lambda x: len(x), reverse=True)
            
            for pattern_str in sorted_patterns:
                try:
                    compiled_pattern = re.compile(pattern_str, re.IGNORECASE)
                except re.error as e:
                    print(f"Warning: Failed to compile pattern '{pattern_str}': {e}")
                    continue
                
                for match in compiled_pattern.finditer(text):
                    matched_text = match.group()
                    regex_matches.append({
                        "phrase": matched_text.lower(),
                        "pattern": pattern_str,
                        "start": match.start(),
                        "end": match.end() - 1,
                    })
        
        if text not in self._lemmatization_cache:
            self._lemmatization_cache[text] = self.adapter.lemmatize_text(text)
        lemma_results = self._lemmatization_cache[text]
        lemmas = [result["lemma"] for result in lemma_results]
        stanza_matches = []
        sorted_pattern_lemmas = sorted(pattern_lemmas, key=lambda x: len(x.split(" ")), reverse=True)  # handle multi-word patterns
        for pattern_lemma in sorted_pattern_lemmas:
            pattern_parts = pattern_lemma.split(" ")
            pattern_length = len(pattern_parts)

            for i in range(len(lemmas) - pattern_length + 1):
                window = lemmas[i:i+pattern_length]
                if window == pattern_parts:
                    start = lemma_results[i]["start"]
                    end = lemma_results[i+pattern_length-1]["end"] - 1
                    matched_text = text[start:end+1]
                    stanza_matches.append({
                        "phrase": matched_text.lower(),
                        "pattern": pattern_lemma,
                        "start": start,
                        "end": end,
                    })
        
        all_matches = regex_matches + stanza_matches
        all_matches.sort(key=lambda x: (x['start'], -len(x['phrase'])))
        filtered_matches = []
        
        for match in all_matches:
            overlaps = False
            for accepted in filtered_matches:
                if not (match['end'] < accepted['start'] or match['start'] > accepted['end']):
                    overlaps = True
                    break
            
            if not overlaps:
                filtered_matches.append(match)
        
        filtered_matches.sort(key=lambda x: x['start'])
        
        return filtered_matches
    
    def clear_cache(self):
        self._lemmatization_cache.clear()
    