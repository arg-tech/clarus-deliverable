from fastapi import FastAPI, HTTPException
import logging
from models import BiasIndicatorResult
from infer_qwen_rhetorical_questions import load_model, run_inference
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

@app.post("/analyse")
async def analyse_text(request: AnalyseRequest) -> list[BiasIndicatorResult]:
    """
    Endpoint to run analysis on the text.
    """
    try:
        logger.info(f"Received text for analysis: {request.text}")

        if request.language != "en":
            logger.warning(f"Unsupported language '{request.language}', returning empty results")
            return []

        # Todo: rethink the sentence splitting logic, especially with nested quotes (see Bruno test for example)
        sentences = re.findall(r'[^.!?\n]+[.!?]?', request.text)
        sentences = [s for s in sentences if re.search(r'\?\s*$', s)]
        logger.info(f"Identified {len(sentences)} sentences ending with a question mark for analysis")

        # run inference on each sentence
        results = []
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            start_time = time.time()
            label, prob = run_inference(sentence)
            
            if label == "rhetorical":
                result = BiasIndicatorResult(
                    bias_indicator_key="rhetoricalQuestion",
                    detected_phrase=sentence,
                    confidence=f"{prob:.2%}"
                )
                results.append(result)
            logger.info(f"Processed sentence: {sentence} ⇒ {label} (p={prob:.2%}) [processing time: {(time.time() - start_time):.4f}s]")
        
        return results
    except Exception as e:
        logger.error(f"Error analysing text: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    
# Display message on startup
@app.on_event("startup")
async def startup_event():
    logger.info("Rhetorical Question Service is starting up...")
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