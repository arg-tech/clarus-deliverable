from fastapi import FastAPI, HTTPException
import logging
from models import BiasIndicatorResult
from infer_qwen_voice_classifier import load_model, run_inference
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
        logger.info(f"Received text for analysis: {len(request.text.split())} words, language={request.language}")

        if request.language != "en":
            logger.warning(f"Unsupported language '{request.language}', returning empty results")
            return []

        sentences = re.split(r'[.!?]+|\n+', request.text)
        # run inference on each sentence
        results = []
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            start_time = time.time()
            label, prob = run_inference(sentence)
            
            results.append({
                "detected_phrase": sentence,
                "label": label,
                "confidence": prob
            })

            logger.info(f"Processed sentence: {len(sentence.split())} words ⇒ {label} (p={prob:.2%}) [processing time: {(time.time() - start_time):.4f}s]")

        filtered_results = sorted(
            (r for r in results if r["label"] == "passive" and r["confidence"] > 0.55),
            key=lambda r: r["confidence"],
            reverse=True
        )

        bias_results = [
            BiasIndicatorResult(
                bias_indicator_key="passiveVoice",
                detected_phrase=r["detected_phrase"],
                confidence=f"{r['confidence']:.2%}"
            )
            for r in filtered_results
        ]
        
        return bias_results
    except Exception as e:
        logger.error(f"Error analysing text: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    
# Display message on startup
@app.on_event("startup")
async def startup_event():
    logger.info("Passive Voice Service is starting up...")
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