from fastapi import FastAPI, HTTPException
import logging
import time
from infer_sentiment_scores import load_model, run_inference
from sentence_splitter import (
    build_context_window,
    segment_sentences,
    split_context_blocks,
)
from translation import LANGUAGES_REQUIRING_TRANSLATION, translate_text
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SHORT_SENTENCE_CONTEXT_THRESHOLD = 7

app = FastAPI()


class AnalyseRequest(BaseModel):
    text: str = (
        Field(
            description="The text to analyze for bias indicators",
            example="awful decision leads to disgusting outcome for local residents.",
        ),
    )
    language: str = Field(
        default="en",
        description="The language of the text (ISO 639-1 code)",
        example="en",
    )
    model_to_use: str = Field(
        default="local",
        description="LLM backend for translation: 'local' or 'remote'",
        example="local",
    )


class SentimentAnalysisResult(BaseModel):
    sentence: str = Field(description="The analyzed sentence")
    sentiment: str = Field(
        description="The detected sentiment (e.g., 'sarcasm', 'neutral')"
    )
    confidence: float = Field(
        description="Confidence score for the sentiment classification"
    )


@app.post("/analyse")
async def analyse_text(request: AnalyseRequest) -> list[SentimentAnalysisResult]:
    """
    Endpoint to run analysis on the text.
    """
    try:
        request_start = time.time()
        logger.info(
            f"Received text for analysis: {len(request.text.split())} words, language={request.language}"
        )

        if request.language in LANGUAGES_REQUIRING_TRANSLATION:
            translated_text = await translate_text(
                request.text, request.language, request.model_to_use
            )
            if translated_text is None:
                logger.error("Translation failed entirely, returning empty results")
                return []
            text_to_analyse = translated_text
            inference_language = "en"
        else:
            text_to_analyse = request.text
            inference_language = request.language

        sentence_blocks = [
            segment_sentences(block, inference_language)
            for block in split_context_blocks(text_to_analyse)
        ]
        sentence_blocks = [block for block in sentence_blocks if block]
        total_sentences = sum(len(block) for block in sentence_blocks)
        results: list[SentimentAnalysisResult] = []

        sentence_index = 0
        for sentences in sentence_blocks:
            for i, sentence in enumerate(sentences):
                sentence_index += 1
                # Short sentences are often underspecified, so include the previous
                # sentence as context when staying within the same newline block;
                # longer sentences and block-start sentences are scored on their own.
                use_context = (
                    len(sentence.split()) <= SHORT_SENTENCE_CONTEXT_THRESHOLD and i > 0
                )
                text_for_inference = (
                    build_context_window(sentences, i) if use_context else sentence
                )
                label, prob, raw_label = run_inference(
                    text_for_inference, inference_language
                )

                logger.info(
                    "Sentence %s/%s mode=%s raw=%s final=%s (p=%.2f%%)",
                    sentence_index,
                    total_sentences,
                    "context" if use_context else "direct",
                    raw_label,
                    label,
                    prob * 100,
                )

                results.append(
                    SentimentAnalysisResult(
                        sentence=sentence, sentiment=label, confidence=prob
                    )
                )

        logger.info(
            f"Request completed: {len(results)} sentences in {time.time() - request_start:.2f}s"
        )
        return results
    except Exception as e:
        logger.error(f"Error analysing text: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.on_event("startup")
async def startup_event():
    logger.info("Sentiment Service is starting up...")
    try:
        load_model()
        logger.info("Model loaded successfully.")
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
