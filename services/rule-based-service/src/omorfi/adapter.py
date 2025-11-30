from typing import List, Dict, Any
import itertools
from uralicNLP import uralicApi
import re
from itertools import product

class OmorfiAdapter:
    def tokenize(self, text: str) -> List[str]:
        return re.findall(r"\w+|[^\w\s]", text, re.UNICODE)
    
    def analyze_text(self, text: str) -> List[Dict[str, Any]]:
        tokens = self.tokenize(text)
        results = []
        cursor = 0

        for token in tokens:
            start = text.find(token, cursor)
            end = start + len(token)
            cursor = end

            analyses = uralicApi.analyze(token, "fin") or []
            lemmas_for_token = []
            for analysis, _ in analyses:
                lemma = analysis.split("+")[0]
                lemmas_for_token.append(lemma)
            
            # default to surface form if not found
            if not lemmas_for_token:
                lemmas_for_token = [token.lower()]
            
            results.append({
                "surface": token,
                "lemmas": lemmas_for_token,
                "start": start,
                "end": end,
            })
        
        return results

    def lemmatize_text(self, text: str) -> List[List[str]]:
        results = self.analyze_text(text)
        return [result["lemmas"] for result in results]

    def lemmatize_phrase(self, text: str) -> List[str]:
        all_lemmas = self.lemmatize_text(text)
        if not all_lemmas:
            return [text.lower()]
        
        combinations = product(*all_lemmas)
        result = [" ".join(combo) for combo in combinations]
        return sorted(set(result))
