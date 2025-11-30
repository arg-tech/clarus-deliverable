from fastapi import FastAPI
from fastapi.responses import JSONResponse
import logging
from pydantic import BaseModel, Field
import re, time, os, json
import asyncio
from typing import TypedDict, List, Any
from pathlib import Path
from openai import AsyncOpenAI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

LLM_URL = os.getenv('LLM_URL', 'http://localhost:8000')
LLM_API_KEY = Path('/run/secrets/LLM_API_KEY.txt').read_text().strip() if Path('/run/secrets/LLM_API_KEY.txt').exists() else None
GEMINI_API_KEY = Path('/run/secrets/GEMINI_API_KEY.txt').read_text().strip() if Path('/run/secrets/GEMINI_API_KEY.txt').exists() else None

# Configure OpenAI clients
local_client = None
if LLM_API_KEY:
    local_client = AsyncOpenAI(
        base_url=f"{LLM_URL}/v1",
        api_key=LLM_API_KEY
    )

gemini_client = None
if GEMINI_API_KEY:
    gemini_client = AsyncOpenAI(
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        api_key=GEMINI_API_KEY
    )

class AnalyseRequest(BaseModel):
    text: str = Field(
        description="The text to analyze for bias indicators",
        examples=["awful decision leads to disgusting outcome for local residents."]
    )
    language: str = Field(
        default="en",
        description="The language of the text (ISO 639-1 code)",
        examples=["en"]
    )
    model_to_use: str = Field(
        default="local",
        description="The model to use for analysis",
        examples=["local", "hosted"]
    )

class BiasIndicatorResult(TypedDict):
    bias_indicator_key: str
    detected_phrase: str

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]

class TextAnalysisRequest(BaseModel):
    text: str
    language: str = Field(
        default="en",
        description="The language of the text (ISO 639-1 code)",
        examples=["en"]
    )
    model_to_use: str = Field(
        default="local",
        description="The model to use for analysis",
        examples=["local", "gemini-2.0-flash-exp", "gemini-1.5-flash"]
    )

async def analyze_text_with_llm(prompt: str, model_to_use: str = "local") -> dict[str, Any]:
    """
    Generic helper for LLM-based text analysis.
    """
    try:
        response_content = await call_llm([Message(role="user", content=prompt)], model_to_use=model_to_use)
        extracted_phrases = extract_json_from_response(response_content.get("llm_response", ""))

        return {
            "phrases": extracted_phrases,
            "model_used": response_content.get("model_used", ""),
            "is_fallback": response_content.get("model_used", "") != model_to_use
        }
    except Exception as e:
        logger.error(f"Error in LLM analysis: {str(e)}")
        # Re-raise the original exception to preserve error details
        raise

async def call_llm(messages: List[Message], model_to_use: str = "local") -> dict[str, str]:
    
    # Remote models always have local fallback
    models_to_try = [model_to_use]
    if model_to_use != "local":
        models_to_try.append("local")

    model_map: Any = {
        "local": ("Qwen/Qwen3-4B", local_client, "local"),
        "remote": ("gemini-2.5-flash", gemini_client, "remote")
    }

    last_error = None
    for model_choice in models_to_try:
        if model_choice in model_map:
            model_name, client, client_name = model_map[model_choice] 
        else:
            logger.error(f"Unknown model_to_use: {model_choice}")
            continue
        
        try:
            logger.info(f"Using {client_name} with model {model_name}")
            start_time = time.time()
            
            response = await client.chat.completions.create(
                model=model_name,
                messages=[{"role": msg.role, "content": msg.content} for msg in messages],
                timeout=60.0
            )
            
            processing_time = time.time() - start_time
            logger.info(f"{client_name} response received in {processing_time:.4f}s")
            
            content = response.choices[0].message.content
            
            if content is None:
                raise ValueError(f"{client_name} returned empty response")
            
            return {
                "llm_response": content,
                "model_used": client_name,
            }
            
        except Exception as e:
            last_error = e
            logger.error(f"Error calling {client_name}: {str(e)}")
            if len(models_to_try) > 1:
                logger.info(f"Will try next available client...")
            continue
    
    # Re-raise the last error to preserve error details (e.g., context length)
    if last_error:
        raise last_error
    raise ValueError(f"All LLM services failed")
    
def extract_json_from_response(response_content: str) -> List[str]:
    """
    Extract JSON list from the LLM response content.
    """
    # First try: Check for JSON in markdown code blocks
    json_match = re.search(r'```json\s*(.*?)\s*```', response_content, re.DOTALL)
    if json_match:
        json_str = json_match.group(1)
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            logger.error("Failed to parse JSON from LLM response markdown block")
            # Continue to other methods
    
    # Second try: Look for any JSON array or object pattern in the text
    json_pattern = re.search(r'(\[.*\]|\{.*\})', response_content, re.DOTALL)
    if json_pattern:
        try:
            return json.loads(json_pattern.group(1))
        except json.JSONDecodeError:
            logger.error("Found JSON-like pattern but failed to parse")
            # Continue to direct parsing
    
    # Last try: Direct JSON parsing of the entire content
    try:
        return json.loads(response_content)
    except json.JSONDecodeError:
        logger.error("Failed to parse response as JSON")
        return []

@app.post("/analyze_oversimplified_comparison")
async def analyze_oversimplified_comparison(request: TextAnalysisRequest) -> dict[str, Any]:
    llm_response = await analyze_text_with_llm(f"""/no_think Analyze the following paragraph and return a JSON list of phrases that use oversimplified comparisons.
                                            Instructions:
                                            All phrases returned must be found in the text. If none are found, return an empty JSON array. Only include phrases that definitely fit the criteria.
                                            Identify: Locate phrases that use analogies or comparisons that oversimplify complex situations by ignoring important nuances.
                                            Example: "a dog in the manger" - this describes a complex person's actions in a way that ignores underlying reasons.
                                            Keywords: Look for idiomatic expressions, animal comparisons, or object analogies that may signal bias by oversimplifying.
                                            Format: The final output must be a single JSON array containing only the extracted phrases (not full sentences) as string elements.
                                            Paragraph: {request.text}
                                        """, model_to_use=request.model_to_use)
    return {
        "bias_indicators": [
            BiasIndicatorResult(
                bias_indicator_key="oversimplifiedComparison",
                detected_phrase=phrase,
            ) for phrase in llm_response["phrases"]],
        "model_used": llm_response["model_used"],
        "is_fallback": llm_response.get("is_fallback", False)
    }

@app.post("/analyze_referential_ambiguity")
async def analyze_referential_ambiguity(request: TextAnalysisRequest) -> dict[str, Any]:
    llm_response = await analyze_text_with_llm(f"""/no_think Analyze the following paragraph and return a JSON list of phrases that use vague references (e.g., 'those people') that can signal bias.
                                            Instructions:
                                            All phrases returned must be found in the text. If none are found, return an empty JSON array. Only include phrases that definitely fit the criteria.
                                            Identify: Locate phrases that use vague references (e.g., 'those people') that can signal bias.
                                            Example: "Those people never cooperate with the process." In this example, "Those people" is vague and could signal bias.
                                            Keywords: Look for general pronouns like Those, Their, They that make the identity vague.
                                            Format: The final output must be a single JSON array containing only the extracted phrases (not full sentences) as string elements.
                                            Paragraph: {request.text}
                                        """, model_to_use=request.model_to_use)
    return {
        "bias_indicators": [
            BiasIndicatorResult(
                bias_indicator_key="referentialAmbiguity",
                detected_phrase=sentence,
            ) for sentence in llm_response["phrases"]],
        "model_used": llm_response["model_used"],
        "is_fallback": llm_response.get("is_fallback", False)
    }

@app.post("/analyze_subordinate_clauses")
async def analyze_subordinate_clauses(request: TextAnalysisRequest) -> dict[str, Any]:
    llm_response = await analyze_text_with_llm(f"""/no_think Analyze the following paragraph and return a JSON list of sentences that contain a subordinate clause used to diminish a main clause within the same sentence.
                                            Instructions:
                                            All phrases returned must be found in the text. If none are found, return an empty JSON array. Only include phrases that definitely fit the criteria.
                                            Identify: Locate sentences where a subordinate clause downplays, minimizes, or contrasts with the primary idea of the main clause.
                                            Do not include: Sentences where subordinate clauses simply add information without diminishing the main clause.
                                            Example: "Although the weather was poor, we had a fantastic time." In this example, "Although the weather was poor" diminishes the potential negative impact of the main clause, "we had a fantastic time."
                                            Keywords: Sentences with this structure often include words like although, even though, while, despite, and in spite of.
                                            Format: The final output must be a single JSON array containing only the extracted sentences as string elements.
                                            Paragraph: {request.text}
                                        """, model_to_use=request.model_to_use)
    return {
        "bias_indicators": [
            BiasIndicatorResult(
                bias_indicator_key="subordinateClauses",
                detected_phrase=sentence,
            ) for sentence in llm_response["phrases"]],
        "model_used": llm_response["model_used"],
        "is_fallback": llm_response.get("is_fallback", False)
    }

@app.post("/analyze_double_entendres")
async def analyze_double_entendres(request: TextAnalysisRequest) -> dict[str, Any]:
    if request.language.upper() == "FI":
        return {"bias_indicators": [], "model_used": ""}
    
    llm_response = await analyze_text_with_llm(f"""/no_think Analyze the following paragraph and return a JSON list of phrases that use Double Entendres (phrases with two meanings, where one is literal and the other figurative, and the figurative meaning could signal bias by implying judgment, violence, or moral failing).
                                            Instructions:
                                            All phrases returned must be found in the text. If none are found, return an empty JSON array. Only include phrases that definitely fit the criteria.
                                            Identify: Locate phrases that are true double entendres - words or short phrases with dual interpretations, one innocent/figurative and one potentially biased/literal.
                                            Do NOT include: Simple metaphors, idioms without dual meanings, or phrases that are only figurative.
                                            Example: "The defendant made a killing in the weeks before the crime." "Made a killing" means earned money (figurative) or literally killed (biased literal).
                                            2nd example: "The investigation revealed the victim was no angel." "No angel" means not innocent (figurative) or literally not an angel (biased implication of moral failing).
                                            3rd example: "The defendant was dying to get rid of the evidence." "Dying" means eager (figurative) or literally dying (biased implication).
                                            Greek example: "ένοχος σαν διάβολο" - "guilty as the devil" means morally guilty (figurative) or literally devil-like (biased).
                                            Another Greek example: "σφάξει την αξιοπιστία" - "butcher the credibility" means destroy (figurative) or literally slaughter (biased violence implication).
                                            Keywords: Look for puns, metaphors with literal undertones that could imply bias (e.g., guilt, death, evil).
                                            Format: The final output must be a single JSON array containing only the extracted phrases (not full sentences) as string elements.
                                            Paragraph: {request.text}
                                            """, model_to_use=request.model_to_use)
    return {
        "bias_indicators": [
            BiasIndicatorResult(
                bias_indicator_key="doubleEntendres",
                detected_phrase=sentence,
            ) for sentence in llm_response["phrases"]],
        "model_used": llm_response["model_used"],
        "is_fallback": llm_response.get("is_fallback", False)
    }

@app.post("/analyze_tag_questions")
async def analyze_tag_questions(request: TextAnalysisRequest) -> dict[str, Any]:    
    llm_response = await analyze_text_with_llm(f"""/no_think Analyze the following paragraph and return a JSON list of sentences that contain tag questions used to nudge the reader towards a conclusion and imply agreement.
                                          Instructions:
                                            All phrases returned must be found in the text. If none are found, return an empty JSON array. Only include phrases that definitely fit the criteria.
                                            Identify: Locate phrases that use tag questions (short questions at the end that seek confirmation or imply agreement) to bias the reader by suggesting shared understanding.
                                            Example: "The suspect was acting strangely, wasn't he?" This implies agreement that the suspect was acting strangely.
                                            Another example: "This was clearly the right decision, don't you think?" This nudges the reader to agree it was the right decision.
                                            Keywords: Look for tag questions like "isn't it?", "don't you?", "wasn't he?", etc., typically at the end of a statement. Tag questions always end in a question mark.
                                            Format: The final output must be a single JSON array containing only the extracted tag questions (not entire sentences) as string elements.
                                            Paragraph: {request.text}
                                        """, model_to_use=request.model_to_use)
    
    # Filter out any questions that do not end with a question mark
    llm_response["phrases"] = [phrase for phrase in llm_response["phrases"] if phrase.strip().endswith("?")]

    return {
        "bias_indicators": [
            BiasIndicatorResult(
                bias_indicator_key="tagQuestions",
                detected_phrase=phrase,
            ) for phrase in llm_response["phrases"]],
        "model_used": llm_response["model_used"],
        "is_fallback": llm_response.get("is_fallback", False)
    }

@app.post("/analyze_contextual_framing")
async def analyze_contextual_framing(request: TextAnalysisRequest) -> dict[str, Any]:
    llm_response = await analyze_text_with_llm(f"""/no_think Analyze the following paragraph and return a JSON list of sentences that use contextual framing to bias the narrative.
Instructions:
All phrases returned must be found in the text. If none are found, return an empty JSON array. Only include phrases that definitely fit the criteria.
Identify: Locate sentences that frame the context in a way that biases the interpretation, often presenting certain premises as justifying or inevitable conclusions.
Example: "Given the suspect's history of violence, the confrontation was inevitable." This frames the suspect's history as making the confrontation unavoidable.
Another example: "After multiple robberies in the area, it's clear this neighborhood is becoming dangerous." This frames the robberies as evidence that the neighborhood is inherently dangerous.
Keywords: Look for phrases like 'given', 'in light of', 'after', 'with such', 'considering', etc.
Format: The final output must be a single JSON array containing only the extracted sentences as string elements.
Paragraph: {request.text}
""", model_to_use=request.model_to_use)
    return {
        "bias_indicators": [
            BiasIndicatorResult(
                bias_indicator_key="contextualFraming",
                detected_phrase=sentence,
            ) for sentence in llm_response["phrases"]],
        "model_used": llm_response["model_used"],
        "is_fallback": llm_response.get("is_fallback", False)
    }

@app.post("/analyze_all")
async def analyze_all(request: TextAnalysisRequest) -> dict[str, Any]:
    results: List[BiasIndicatorResult] = []
    # todo: clean up magic strings for remote/local models
    model_used: str = "remote"
    is_fallback_used: bool = False
    
    analyzers = [
        analyze_oversimplified_comparison,
        analyze_referential_ambiguity,
        analyze_subordinate_clauses,
        analyze_double_entendres,
        analyze_tag_questions,
        analyze_contextual_framing
    ]
    
    # Run LLM tasks concurrently to make use of vLLM optimisations
    tasks = [analyzer(request) for analyzer in analyzers]
    results_lists = await asyncio.gather(*tasks, return_exceptions=True)
    
    successful_count = 0
    context_length_error = False
    for analyzer, result in zip(analyzers, results_lists):
        if isinstance(result, Exception):
            logger.error(f"Error in {analyzer.__name__}: {str(result)}")
            # Check if it's a context length error
            error_str = str(result)
            print(error_str)
            if "maximum context length" in error_str.lower() or "context length is" in error_str.lower():
                context_length_error = True
        else:
            successful_count += 1
            results.extend(result["bias_indicators"])  # type: ignore
            if result.get("model_used") and result.get("model_used") == "local":  # type: ignore
                model_used = "local"  # type: ignore
            if result.get("is_fallback"):  # type: ignore
                is_fallback_used = True

    if successful_count == 0:
        if context_length_error:
            return JSONResponse(
                content={"error": "context_length_exceeded"},
                status_code=400
            )
        else:
            return JSONResponse(
                content={"error": "all_analysis_methods_failed"},
                status_code=500
            )
    
    # Note: for model_used, returns "local" if any of the calls used local model; same for is_fallback_used
    return {
        "bias_indicators": results,
        "model_used": model_used,
        "is_fallback": is_fallback_used
    }
