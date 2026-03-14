"""
FleshNote API — Synonym Lookup Routes
NLTK WordNet-based synonym lookup for the editor.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from nltk_manager import get_synonyms, check_wordnet_exists, ensure_wordnet_available

router = APIRouter()


class SynonymRequest(BaseModel):
    word: str
    lang: str = "eng"


@router.post("/api/synonyms/lookup")
def synonym_lookup(req: SynonymRequest):
    """Look up synonyms for a word using WordNet."""
    word = req.word.strip()
    if not word:
        return {"status": "ok", "word": word, "groups": []}

    results = get_synonyms(word, req.lang)
    return {"status": "ok", "word": word, "groups": results}


@router.post("/api/synonyms/check-data")
def check_synonym_data():
    """Check if WordNet data is available."""
    return {"exists": check_wordnet_exists()}


@router.post("/api/synonyms/ensure-data")
def ensure_synonym_data():
    """Trigger WordNet data download if not present."""
    ensure_wordnet_available()
    return {"status": "ok"}
