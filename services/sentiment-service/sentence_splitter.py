import re

import pysbd

PYSBD_LANGUAGE_MAP: dict[str, str] = {
    "en": "en",
    "pt": "en",
    "el": "el",
    "fi": "en",
    "cs": "en",
}

DEFAULT_MIN_WORDS = 3
DEFAULT_CONTEXT_WINDOW_SIZE = 1

QUOTE_PAIRS = [
    ("\u201c", "\u201d"),  # "…" curly double quotes
    ("\u00ab", "\u00bb"),  # «…» guillemets (Portuguese/French)
    ('"', '"'),  # "…" straight double quotes (checked last — ambiguous open/close)
]


def _split_quoted_sentences(sentence: str, segmenter: pysbd.Segmenter) -> list[str]:
    """Split a sentence that contains a multi-sentence quote into parts.

    If the sentence contains a quoted region with multiple sentences inside,
    re-segment the inner text with pysbd and distribute prefix/suffix text.
    """
    for open_q, close_q in QUOTE_PAIRS:
        open_pos = sentence.find(open_q)
        if open_pos == -1:
            continue

        if open_q == close_q:
            # Straight quotes: find second occurrence
            close_pos = sentence.find(close_q, open_pos + 1)
        else:
            close_pos = sentence.rfind(close_q)

        if close_pos <= open_pos:
            continue

        inner = sentence[open_pos + 1 : close_pos]
        inner_sentences = [s.strip() for s in segmenter.segment(inner) if s.strip()]

        if len(inner_sentences) <= 1:
            return [sentence]

        prefix = sentence[:open_pos]
        suffix = sentence[close_pos + 1 :]

        result = []
        for idx, s in enumerate(inner_sentences):
            if idx == 0:
                result.append(prefix + open_q + s)
            elif idx == len(inner_sentences) - 1:
                result.append(s + close_q + suffix)
            else:
                result.append(s)
        return result

    return [sentence]


def segment_sentences(
    text: str,
    language: str = "en",
    min_words: int = DEFAULT_MIN_WORDS,
) -> list[str]:
    if not text or not text.strip():
        return []

    pysbd_lang = PYSBD_LANGUAGE_MAP.get(language, "en")
    segmenter = pysbd.Segmenter(language=pysbd_lang, clean=False)
    raw_sentences = segmenter.segment(text)

    sentences = []
    for s in raw_sentences:
        sentences.extend(_split_quoted_sentences(s.strip(), segmenter))

    return [s for s in sentences if len(s.split()) >= min_words]


def split_context_blocks(text: str) -> list[str]:
    """Split text into newline-delimited blocks for context boundaries."""
    if not text or not text.strip():
        return []

    return [block.strip() for block in re.split(r"\n+", text) if block.strip()]


def build_context_window(
    sentences: list[str],
    index: int,
    window_size: int = DEFAULT_CONTEXT_WINDOW_SIZE,
) -> str:
    """Build a context string ending at sentences[index].

    With window_size=1, includes 1 sentence before the current sentence.
    """
    start = max(0, index - window_size)
    end = index + 1
    return " ".join(sentences[start:end])
