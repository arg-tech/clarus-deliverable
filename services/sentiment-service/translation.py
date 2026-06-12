import os
import logging
import asyncio
import time
from pathlib import Path

import pysbd
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# --- Client setup (same env vars / secret paths as llm-caller-service) ---
LLM_URL = os.getenv("LLM_URL", "http://localhost:8000")

_llm_api_key = (
    Path("/run/secrets/LLM_API_KEY.txt").read_text().strip()
    if Path("/run/secrets/LLM_API_KEY.txt").exists()
    else None
)
_gemini_api_key = (
    Path("/run/secrets/GEMINI_API_KEY.txt").read_text().strip()
    if Path("/run/secrets/GEMINI_API_KEY.txt").exists()
    else None
)

local_client: AsyncOpenAI | None = None
if _llm_api_key:
    local_client = AsyncOpenAI(base_url=f"{LLM_URL}/v1", api_key=_llm_api_key)

gemini_client: AsyncOpenAI | None = None
if _gemini_api_key:
    gemini_client = AsyncOpenAI(
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        api_key=_gemini_api_key,
    )

MODEL_MAP: dict[str, tuple[str, AsyncOpenAI | None, str]] = {
    "local": ("Qwen/Qwen3-4B", local_client, "local"),
    "remote": ("gemini-2.5-flash", gemini_client, "remote"),
}

LANGUAGES_REQUIRING_TRANSLATION = {"cs", "fi", "el"}
LANGUAGE_NAMES = {"cs": "Czech", "fi": "Finnish", "el": "Greek"}

PYSBD_LANGUAGE_MAP: dict[str, str] = {
    "cs": "en",
    "fi": "en",
    "el": "el",
}

TRANSLATION_PROMPT_TEMPLATE = """/no_think Translate the following {source_lang} text into English. Preserve the tone and emotional intensity exactly. Output ONLY the translation, nothing else.

{text}"""


def _chunk_text_by_sentences(
    text: str, language: str, max_words: int = 200
) -> list[str]:
    """Split text into chunks of complete sentences, each up to max_words."""
    pysbd_lang = PYSBD_LANGUAGE_MAP.get(language, "en")
    segmenter = pysbd.Segmenter(language=pysbd_lang, clean=False)
    sentences = [s.strip() for s in segmenter.segment(text) if s.strip()]

    if not sentences:
        return []

    chunks: list[str] = []
    current_sentences: list[str] = []
    current_words = 0

    for sentence in sentences:
        word_count = len(sentence.split())
        if current_sentences and current_words + word_count > max_words:
            chunks.append(" ".join(current_sentences))
            current_sentences = []
            current_words = 0
        current_sentences.append(sentence)
        current_words += word_count

    if current_sentences:
        chunks.append(" ".join(current_sentences))

    return chunks


async def _translate_chunk(
    text: str,
    source_language: str,
    model_to_use: str = "local",
) -> str | None:
    """Translate a plain text chunk to English. Falls back to local if remote fails."""
    source_lang = LANGUAGE_NAMES.get(source_language, source_language)

    models_to_try = [model_to_use]
    if model_to_use != "local":
        models_to_try.append("local")

    prompt = TRANSLATION_PROMPT_TEMPLATE.format(
        source_lang=source_lang,
        text=text,
    )

    for model_choice in models_to_try:
        model_name, client, client_label = MODEL_MAP.get(
            model_choice, MODEL_MAP["local"]
        )
        if client is None:
            logger.warning(f"No client available for {model_choice}, skipping")
            continue

        for attempt in range(2):
            try:
                response = await client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    timeout=30.0,
                )
                content = response.choices[0].message.content
                if not content or not content.strip():
                    logger.warning(
                        f"Attempt {attempt + 1} ({client_label}): empty response"
                    )
                    continue
                return content.strip()

            except Exception as e:
                logger.error(
                    f"Attempt {attempt + 1} ({client_label}): translation error: {e}"
                )
                continue

        if len(models_to_try) > 1:
            logger.info(f"{client_label} failed, trying next model...")

    logger.error(f"Translation failed for chunk ({len(text.split())} words)")
    return None


async def translate_text(
    text: str,
    source_language: str,
    model_to_use: str = "local",
) -> str | None:
    """Translate full text to English, chunked by word count.

    Returns the translated English text, or None if all chunks fail.
    """
    if not text or not text.strip():
        return None

    chunks = _chunk_text_by_sentences(text, source_language)
    if not chunks:
        return None

    total_start = time.time()
    results = await asyncio.gather(*[_translate_chunk(c, source_language, model_to_use) for c in chunks])
    total_elapsed = time.time() - total_start

    translated = [r for r in results if r is not None]
    if not translated:
        logger.error(f"Translation failed: all {len(chunks)} chunks failed in {total_elapsed:.2f}s")
        return None

    total_words = sum(len(c.split()) for c in chunks)
    logger.info(f"Translation completed: {len(translated)}/{len(chunks)} chunks, {total_words} words in {total_elapsed:.2f}s")
    return "\n\n".join(translated)
