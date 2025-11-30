from ufal.morphodita import Tagger, TaggedLemmas, Forms, TokenRanges
from typing import List
from pathlib import Path
import sys
import itertools

sys.path.append(str(Path(__file__).parent.parent))


MODEL_PATH = str(Path(__file__).parent.parent / "morphodita" / "models" / "czech-morfflex2.1-pdtc2.0-250909.tagger")

class MorphoDiTaAdapter:
    def __init__(self):
        self.model_path = MODEL_PATH
        self.tagger = None
        self.morpho = None
        self._initialize_model()
    
    def _initialize_model(self):
        try:
            self.tagger = Tagger.load(self.model_path)
            self.morpho = self.tagger.getMorpho()
        except Exception as e:
            print(f"✗ Error initializing MorphoDiTa model from '{self.model_path}': {e}")
            raise
    
    def lemmatize_word(self, word: str) -> List[str]:
        if not self.morpho:
            raise RuntimeError("MorphoDiTa model not initialized")
        
        lemmas = TaggedLemmas()
        self.morpho.analyze(word, False, lemmas)
        return list({tl.lemma for tl in lemmas})

    def lemmatize_phrase(self, phrase: str) -> List[str]:
        if not self.morpho:
            raise RuntimeError("MorphoDiTa model not initialized")
        
        words = phrase.strip().split(" ")
        if len(words) == 1:
            return self.lemmatize_word(words[0])
        
        token_lemma_sets = []
        for word in words:
            token_lemma_sets.append(self.lemmatize_word(word))
        
        all_combinations = list(itertools.product(*token_lemma_sets))
        lemma_phrases = [" ".join(combination) for combination in all_combinations]
        return sorted(set(lemma_phrases))

    def lemmatize_text(self, text: str) -> List[dict]:
        if not self.tagger:
            raise RuntimeError("MorphoDiTa model not initialized")
        
        results = []
        
        forms = Forms()
        lemmas = TaggedLemmas()
        tokens = TokenRanges()

        tokenizer = self.tagger.newTokenizer()
        tokenizer.setText(text)
        while tokenizer.nextSentence(forms, tokens):
            self.tagger.tag(forms, lemmas)
            for i in range(len(lemmas)):
                l = lemmas[i]
                t = tokens[i]
                surface = text[t.start:t.start + t.length]
                results.append({
                    "surface": surface,
                    "lemma": l.lemma,
                    "start": t.start,
                    "end": t.start + t.length,
                })

        return results
