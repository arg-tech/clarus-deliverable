from fastapi import FastAPI, HTTPException
import logging
from infer_sentiment_scores import load_model, run_inference
from pydantic import BaseModel, Field
import re, time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

class AnalyseRequest(BaseModel):
    text: str = Field(
        description="The text to analyze for bias indicators",
        example="awful decision leads to disgusting outcome for local residents."
    ),
    language: str = Field(
        default="en",
        description="The language of the text (ISO 639-1 code)",
        example="en"
    )

class SentimentAnalysisResult(BaseModel):
    sentence: str = Field(description="The analyzed sentence")
    sentiment: str = Field(description="The detected sentiment (e.g., 'sarcasm', 'neutral')")
    confidence: float = Field(description="Confidence score for the sentiment classification")

@app.post("/analyse")
async def analyse_text(request: AnalyseRequest) -> list[SentimentAnalysisResult]:
    """
    Endpoint to run analysis on the text.
    """
    try:
        logger.info(f"Received text for analysis: {len(request.text.split())} words, language={request.language}")

        if request.language != "en" and request.language != "pt":
            logger.warning(f"Unsupported language '{request.language}'")
            return []

        # Todo: rethink the sentence splitting logic, especially with nested quotes (see Bruno test for example)
        sentences = re.findall(r'[^.!?\n]+[.!?]?', request.text)
        # run inference on each sentence
        results: list[SentimentAnalysisResult] = []
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            start_time = time.time()
            label, prob = run_inference(sentence)

            results.append(
                SentimentAnalysisResult(
                    sentence=sentence,
                    sentiment=label,
                    confidence=prob
                )
            )
            
            logger.info(f"Processed sentence: {len(sentence.split())} words ⇒ {label} (p={prob:.2%}) [processing time: {(time.time() - start_time):.4f}s]")
        
        return results
    except Exception as e:
        logger.error(f"Error analysing text: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    
# Display message on startup
@app.on_event("startup")
async def startup_event():
    logger.info("Sentiment Service is starting up...")
    try:
        load_model() 
        logger.info("Model loaded successfully.")
        pass
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )