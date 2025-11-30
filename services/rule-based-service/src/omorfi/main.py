from src.omorfi.adapter import OmorfiAdapter
from typing import Protocol, List, Dict, Any

class OmorfiProtocol(Protocol):
    def find_phrases_in_text(self, text: str, pattern_lemmas: List[str]) -> List[Dict[str, Any]]:
        ...

class Omorfi:    
    def __init__(self):
        self.adapter = OmorfiAdapter()

    def find_phrases_in_text(self, text: str, pattern_lemmas: List[str]) -> List[Dict[str, Any]]:
        analyzed = self.adapter.analyze_text(text)
        tokens_lemmas = [entry["lemmas"] for entry in analyzed]

        # since one word can have multiple lemmas, multiple matches are possible
        # track unique matches by position to avoid duplicates
        unique_matches = {}
        patterns = sorted(pattern_lemmas, key=lambda p: len(p.split()), reverse=True)

        for pattern in patterns:
            parts = pattern.split()
            p_len = len(parts)

            for i in range(len(tokens_lemmas) - p_len + 1):
                window = tokens_lemmas[i:i + p_len]

                is_match = True
                for j, lemma_candidate in enumerate(parts):
                    if lemma_candidate not in window[j]:
                        is_match = False
                        break
                
                if is_match:
                    start = analyzed[i]["start"]
                    end = analyzed[i + p_len - 1]["end"]
                    position_key = (start, end)
                    
                    # only add if we haven't seen this exact position before
                    # (patterns are sorted longest-first, so first match is most specific)
                    if position_key not in unique_matches:
                        matched_text = text[start:end]
                        unique_matches[position_key] = {
                            "phrase": matched_text.lower(),
                            "start": start,
                            "end": end,
                        }

        return list(unique_matches.values())