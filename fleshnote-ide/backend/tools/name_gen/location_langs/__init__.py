from typing import Dict, Type
from .en import EnglishLocationStrategy
from .hu import HungarianLocationStrategy
from .pl import PolishLocationStrategy

STRATEGIES = {
    "en": EnglishLocationStrategy,
    "hu": HungarianLocationStrategy,
    "pl": PolishLocationStrategy,
}

def get_strategy(lang: str):
    return STRATEGIES.get(lang, EnglishLocationStrategy)()
