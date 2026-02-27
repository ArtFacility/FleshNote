"""
Configuration mapping supported languages to their respective spaCy model packages.
If a language does not have a comprehensive model (e.g. Arabic or Hungarian), 
set it to None so the application falls back to spacy.blank(lang_code).
"""

SPACY_MODELS = {
    # English
    "en": "en_core_web_sm",
    
    # Polish
    "pl": "pl_core_news_sm",
    
    # Hungarian - We use huspacy
    "hu": "huspacy",
    
    # Arabic - No official pipeline model, we'll use blank tokenization
    "ar": None,
    
    # Example for expanding in the future:
    # "es": "es_core_news_sm",
    # "fr": "fr_core_news_sm",
    # "de": "de_core_news_sm",
}
