import os
from fastapi import APIRouter
from pydantic import BaseModel
from nlp_manager import check_model_exists, get_nlp

router = APIRouter()

class SpacyModelStatusRequest(BaseModel):
    lang_code: str

class SpacyModelLoadRequest(BaseModel):
    language: str

@router.post("/api/settings/check-model")
def check_spacy_model(req: SpacyModelStatusRequest):
    """
    Checks if a model is downloaded and accessible for a given language code.
    Returns status: exists.
    """
    exists = check_model_exists(req.lang_code)
    return {
        "lang_code": req.lang_code,
        "exists": exists
    }

@router.post("/api/nlp/load")
def load_nlp_model(req: SpacyModelLoadRequest):
    """
    Initiates the download and loading of the NLP model for the given language.
    Returns status: loaded.
    """
    nlp = get_nlp(req.language)
    return {
        "language": req.language,
        "status": "loaded"
    }
