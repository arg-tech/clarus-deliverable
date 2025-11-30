import stanza


class StanzaAdapter:
    def __init__(self, language: str):
        self.language = language
        self.nlp = None
        self._initialize_model()
    
    def _initialize_model(self):
        try:
            stanza.download(self.language, verbose=True)
            self.nlp = stanza.Pipeline(
                lang=self.language,
                processors='tokenize,mwt,pos,lemma',
                verbose=False,
                use_gpu=False
            )
        except Exception as e:
            print(f"✗ Error initializing Stanza model for '{self.language}': {e}")
            raise

    def lemmatize_text(self, text: str) -> list[dict]:
        if not self.nlp:
            raise RuntimeError("Stanza model not initialized")

        doc = self.nlp(text)
        results = []

        for sentence in doc.sentences: # type: ignore
            for word in sentence.words:
                results.append({
                    "surface": word.text,
                    "lemma": word.lemma.lower(),
                    "start": word.start_char,
                    "end": word.end_char,
                })

        return results

