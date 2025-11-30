from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from models import BiasIndicatorResult, LexiconTerm
import logging
from emotionally_charged_adjectives import emotionally_charged_adjectives
from intensifying_adverbs import intensifying_adverbs
from italics_boldface import italics_boldface
from ellipses import ellipses
from exclamation_question_marks import exclamation_question_marks
from capitalisation import capitalisation
from historically_derogatory_terms import historically_derogatory_terms
from mitigators import mitigators
from oversimplified_group_labels import oversimplified_group_labels
from euphemisms import euphemisms
from dysphemisms import dysphemisms
from event_labeling import event_labeling
from absolute_terms import absolute_terms
from concessive_connectives import concessive_connectives
from charged_semantic_fields import charged_semantic_fields
from framing_by_time import framing_by_time
from overgeneralizations import overgeneralizations
from lexicon import lexicon
from src.morphodita import MorphoDiTa
from src.omorfi import Omorfi
from src.stanza import Stanza
from uralicNLP import uralicApi

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

morphodita_instance = None
omorfi_instance = None
stanza_instance = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global morphodita_instance, omorfi_instance, stanza_instance
    try:
        logger.info("Loading MorphoDiTa model...")
        morphodita_instance = MorphoDiTa()
        logger.info("✓ MorphoDiTa model loaded successfully")
    except Exception as e:
        logger.error(f"✗ Failed to load MorphoDiTa model: {e}")
        morphodita_instance = None
    
    try:
        logger.info("Loading Omorfi model...")
        if not uralicApi.is_language_installed("fin"):
            uralicApi.download("fin")
        omorfi_instance = Omorfi()
        logger.info("✓ Omorfi model loaded successfully")
    except Exception as e:
        logger.error(f"✗ Failed to load Omorfi model: {e}")
        omorfi_instance = None

    try:
        logger.info("Loading Stanza model...")
        stanza_instance = Stanza(language="el")
        logger.info("✓ Stanza model loaded successfully")
    except Exception as e:
        logger.error(f"✗ Failed to load Stanza model: {e}")
        stanza_instance = None
    
    yield
    
    if morphodita_instance:
        logger.info("Shutting down MorphoDiTa model...")
        morphodita_instance = None
    if omorfi_instance:
        logger.info("Shutting down Omorfi model...")
        omorfi_instance = None
    if stanza_instance:
        logger.info("Shutting down Stanza model...")
        stanza_instance = None

app = FastAPI(lifespan=lifespan)

def get_morphodita():
    """Get the global MorphoDiTa instance"""
    return morphodita_instance

def get_omorfi():
    """Get the global Omorfi instance"""
    return omorfi_instance

def get_stanza():
    """Get the global Stanza instance"""
    return stanza_instance


@app.get("/health")
async def health_check():
    """Health check endpoint for the gateway"""
    return {"status": "healthy", "service": "api-gateway"}

class AnalyseRequest(BaseModel):
    text: str = Field(
        description="The text to analyze for bias indicators",
        examples=["awful decision leads to disgusting outcome for local residents."]
    )
    richText: str = Field(
        default="",
        description="The rich text version of the input, including formatting like bold and italics",
        examples=["<p>awful decision leads to <strong>disgusting</strong> outcome for local residents.</p>"]
    )
    language: str = Field(
        default="en",
        description="The language of the text (ISO 639-1 code)",
        examples=["en"]
    )

@app.post("/analyse") 
async def analyse_text(request: AnalyseRequest) -> list[BiasIndicatorResult]:
    """
    Endpoint to run all rule-based analysis on the text.
    """
    try:
        morphodita = get_morphodita()
        omorfi = get_omorfi()
        stanza = get_stanza()
        
        if stanza:
            stanza.clear_cache()
        
        # todo: separate the services so that exception thrown by one service does not affect the others
        return (
            emotionally_charged_adjectives.analyse(request.text, request.language, morphodita, omorfi, stanza) +
            intensifying_adverbs.analyse(request.text, request.language, morphodita, omorfi, stanza) +
            italics_boldface.analyse(request.richText) +
            ellipses.analyse(request.text) +
            exclamation_question_marks.analyse(request.text) +
            capitalisation.analyse(request.text) +
            historically_derogatory_terms.analyse(request.text, request.language, stanza) + 
            mitigators.analyse(request.text, request.language, morphodita, omorfi, stanza) + 
            oversimplified_group_labels.analyse(request.text, request.language, morphodita, omorfi, stanza) +
            euphemisms.analyse(request.text, request.language, morphodita, omorfi, stanza) +
            dysphemisms.analyse(request.text, request.language, morphodita, omorfi, stanza) +
            event_labeling.analyse(request.text, request.language, morphodita, omorfi, stanza) +
            absolute_terms.analyse(request.text, request.language, morphodita, omorfi, stanza) +
            concessive_connectives.analyse(request.text, request.language, morphodita, omorfi, stanza) +
            charged_semantic_fields.analyse(request.text, request.language, morphodita, omorfi, stanza) +
            framing_by_time.analyse(request.text, request.language, morphodita, omorfi, stanza) + 
            overgeneralizations.analyse(request.text, request.language, morphodita, omorfi, stanza)
        )
    except Exception as e:
        logger.error(f"Error analysing text: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/get-lexicon-terms")
async def get_lexicon_terms(request: AnalyseRequest) -> list[LexiconTerm]:
    """
    Endpoint to extract lexicon terms from the text.
    """
    try:
        return lexicon.analyse(request.text, request.language)
    except Exception as e:
        logger.error(f"Error extracting lexicon terms: {str(e)}")
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