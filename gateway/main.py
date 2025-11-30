import os
from typing import Any, Dict
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

RULE_BASED_URL = os.getenv("RULE_BASED_SERVICE_URL", "http://localhost:8001")
PASSIVE_VOICE_SERVICE_URL = os.getenv("PASSIVE_VOICE_SERVICE_URL")
RHETORICAL_QUESTIONS_SERVICE_URL = os.getenv("RHETORICAL_QUESTIONS_SERVICE_URL")
SARCASM_SERVICE_URL = os.getenv("SARCASM_SERVICE_URL", "http://localhost:8002")
SENTIMENT_SERVICE_URL = os.getenv("SENTIMENT_SERVICE_URL", "http://localhost:8003")
LLM_CALLER_SERVICE_URL = os.getenv("LLM_CALLER_SERVICE_URL", "http://localhost:8004")

@app.get("/health")
async def health_check():
    """Health check endpoint for the gateway"""
    return {"status": "healthy", "service": "api-gateway"}

@app.post("/get-sentiment")
async def get_sentiment(request: Request):
    """
    Endpoint that forwards POST requests to the sentiment service
    and returns sentiment analysis results
    """
    try:
        body = await request.body()
        headers_to_forward = {
            key: value for key, value in request.headers.items()
            if key.lower() not in ['host', 'content-length', 'connection']
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Call sentiment service
            logger.info(f"Forwarding request to sentiment service")
            sentiment_response = await client.post(
                f"{SENTIMENT_SERVICE_URL}/analyse",
                content=body,
                headers=headers_to_forward,
                params=dict(request.query_params)
            )
            
            # Return sentiment results if successful
            if sentiment_response.status_code == 200:
                sentiment_results = sentiment_response.json()
                logger.info(f"Received sentiment analysis results: {len(sentiment_results) if isinstance(sentiment_results, list) else 'non-list response'}")
                return JSONResponse(
                    content=sentiment_results,
                    status_code=200,
                    headers={"content-type": "application/json"}
                )
            else:
                logger.error(f"Sentiment service returned status code {sentiment_response.status_code}")
                return JSONResponse(
                    content={"error": "Sentiment service returned an error"},
                    status_code=sentiment_response.status_code
                )
            
    except httpx.TimeoutException:
        logger.error("Sentiment service timeout")
        raise HTTPException(status_code=504, detail="Sentiment service timeout")
    except httpx.ConnectError:
        logger.error("Unable to connect to sentiment service")
        raise HTTPException(status_code=503, detail="Sentiment service unavailable")
    except Exception as e:
        logger.error(f"Error forwarding request to sentiment service: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/analyse")
async def analyse_proxy(request: Request):
    """
    Proxy endpoint that forwards POST requests to both rule-based and passive voice services,
    then combines the results
    """
    try:
        body = await request.body()
        headers_to_forward = {
            key: value for key, value in request.headers.items()
            if key.lower() not in ['host', 'content-length', 'connection']
        }
        
        # Initialize results list
        combined_results = []
        
        async with httpx.AsyncClient(timeout=45.0) as client:
            # Call rule-based service
            logger.info(f"Forwarding request to rule-based service")
            rule_based_response = await client.post(
                f"{RULE_BASED_URL}/analyse",
                content=body,
                headers=headers_to_forward,
                params=dict(request.query_params)
            )
            
            # Add rule-based results to combined results if successful
            if rule_based_response.status_code == 200:
                rule_based_results = rule_based_response.json()
                if isinstance(rule_based_results, list):
                    combined_results.extend(rule_based_results)
                    logger.info(f"Added {len(rule_based_results)} results from rule-based service")
            
            # Call passive voice service if URL is configured
            if PASSIVE_VOICE_SERVICE_URL:
                passive_voice_url = f"{PASSIVE_VOICE_SERVICE_URL}/analyse"
                logger.info(f"Forwarding request to passive voice service: {passive_voice_url}")
                
                try:
                    passive_voice_response = await client.post(
                        passive_voice_url,
                        content=body,
                        headers=headers_to_forward,
                        params=dict(request.query_params)
                    )
                    
                    # Add passive voice results to combined results if successful
                    if passive_voice_response.status_code == 200:
                        passive_voice_results = passive_voice_response.json()
                        if isinstance(passive_voice_results, list):
                            combined_results.extend(passive_voice_results)
                            logger.info(f"Added {len(passive_voice_results)} results from passive voice service")
                except Exception as e:
                    logger.error(f"Error calling passive voice service: {str(e)}")
            
            # Call rhetorical questions service if URL is configured
            if RHETORICAL_QUESTIONS_SERVICE_URL:
                rhetorical_questions_url = f"{RHETORICAL_QUESTIONS_SERVICE_URL}/analyse"
                logger.info(f"Forwarding request to rhetorical questions service: {rhetorical_questions_url}")
                
                try:
                    rhetorical_response = await client.post(
                        rhetorical_questions_url,
                        content=body,
                        headers=headers_to_forward,
                        params=dict(request.query_params)
                    )
                    
                    # Add rhetorical questions results to combined results if successful
                    if rhetorical_response.status_code == 200:
                        rhetorical_results = rhetorical_response.json()
                        if isinstance(rhetorical_results, list):
                            combined_results.extend(rhetorical_results)
                            logger.info(f"Added {len(rhetorical_results)} results from rhetorical questions service")
                except Exception as e:
                    logger.error(f"Error calling rhetorical questions service: {str(e)}")

            # Call sarcasm service
            try:
                sarcasm_response = await client.post(
                    f"{SARCASM_SERVICE_URL}/analyse",
                    content=body,
                    headers=headers_to_forward,
                    params=dict(request.query_params)
                )
                
                if sarcasm_response.status_code == 200:
                    sarcasm_results = sarcasm_response.json()
                    if isinstance(sarcasm_results, list):
                        combined_results.extend(sarcasm_results)
                        logger.info(f"Added {len(sarcasm_results)} results from sarcasm service")
            except Exception as e:
                logger.error(f"Error calling sarcasm service: {str(e)}")
            
            return JSONResponse(
                content=combined_results,
                status_code=200,
                headers={"content-type": "application/json"}
            )
            
    except httpx.TimeoutException:
        logger.error("Backend service timeout")
        raise HTTPException(status_code=504, detail="Backend service timeout")
    except httpx.ConnectError:
        logger.error("Unable to connect to backend service")
        raise HTTPException(status_code=503, detail="Backend service unavailable")
    except Exception as e:
        logger.error(f"Error forwarding request: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    
@app.post("/llm-analyse")
async def llm_analyse_proxy(request: Request):
    """
    Proxy endpoint that forwards POST requests to the LLM caller service
    and returns its results
    """
    try:
        body = await request.body()
        headers_to_forward = {
            key: value for key, value in request.headers.items()
            if key.lower() not in ['host', 'content-length', 'connection']
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            logger.info(f"Forwarding request to LLM caller service")
            llm_response = await client.post(
                f"{LLM_CALLER_SERVICE_URL}/analyze_all",
                content=body,
                headers=headers_to_forward,
                params=dict(request.query_params)
            )
            
            if llm_response.status_code == 200:
                llm_results = llm_response.json()
                return JSONResponse(
                    content=llm_results,
                    status_code=200,
                    headers={"content-type": "application/json"}
                )
            else:
                logger.error(f"LLM caller service returned status code {llm_response.status_code}")
                try:
                    error_response = llm_response.json()
                    # Forward the error response from the LLM service directly
                    return JSONResponse(
                        content=error_response,
                        status_code=llm_response.status_code
                    )
                except Exception:
                    # Fallback if response is not valid JSON
                    return JSONResponse(
                        content={"error": "LLM caller service returned an error"},
                        status_code=llm_response.status_code
                    )
            
    except httpx.TimeoutException:
        logger.error("LLM caller service timeout")
        raise HTTPException(status_code=504, detail="LLM caller service timeout")
    except httpx.ConnectError:
        logger.error("Unable to connect to LLM caller service")
        raise HTTPException(status_code=503, detail="LLM caller service unavailable")
    except Exception as e:
        logger.error(f"Error forwarding request to LLM caller service: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/get-lexicon-terms")
async def get_lexicon_terms(request: Request):
    """
    Endpoint that forwards POST requests to the rule-based service
    to extract lexicon terms from the text
    """
    try:
        body = await request.body()
        headers_to_forward = {
            key: value for key, value in request.headers.items()
            if key.lower() not in ['host', 'content-length', 'connection']
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            logger.info(f"Forwarding request to rule-based service for lexicon terms")
            lexicon_response = await client.post(
                f"{RULE_BASED_URL}/get-lexicon-terms",
                content=body,
                headers=headers_to_forward,
                params=dict(request.query_params)
            )
            
            if lexicon_response.status_code == 200:
                lexicon_results = lexicon_response.json()
                logger.info(f"Received lexicon terms: {len(lexicon_results) if isinstance(lexicon_results, list) else 'non-list response'}")
                return JSONResponse(
                    content=lexicon_results,
                    status_code=200,
                    headers={"content-type": "application/json"}
                )
            else:
                logger.error(f"Rule-based service returned status code {lexicon_response.status_code}")
                return JSONResponse(
                    content={"error": "Rule-based service returned an error"},
                    status_code=lexicon_response.status_code
                )
            
    except httpx.TimeoutException:
        logger.error("Rule-based service timeout")
        raise HTTPException(status_code=504, detail="Rule-based service timeout")
    except httpx.ConnectError:
        logger.error("Unable to connect to rule-based service")
        raise HTTPException(status_code=503, detail="Rule-based service unavailable")
    except Exception as e:
        logger.error(f"Error forwarding request to rule-based service: {str(e)}")
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