"""Build Hungarian lexicons for FleshNote (Task C).

Covers all 18 kinds with migrated constants from routes/hun_janitor.py
plus expanded literary vocabulary meeting/exceeding all targets.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, ".."))
LEXICONS_DIR = os.path.join(BACKEND, "lexicons", "hu")
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from nlp_manager import get_nlp  # noqa: E402
from routes import hun_janitor as H  # noqa: E402

nlp = get_nlp("hu")
for p in ["parser", "ner", "senter"]:
    if p in nlp.pipe_names:
        nlp.disable_pipe(p)

_cache = {}


def norm_lemma(w: str) -> str:
    w_clean = w.lower().strip()
    if w_clean in _cache:
        return _cache[w_clean]
    doc = nlp(w_clean)
    res = doc[0].lemma_.lower() if len(doc) == 1 else w_clean
    _cache[w_clean] = res
    return res


def make_id(kind_short: str, term: str) -> str:
    clean_term = re.sub(r"[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ_]+", "_", term.lower().strip()).strip("_")
    return f"hu.{kind_short}.{clean_term}"


def build_hu_lexicons():
    os.makedirs(LEXICONS_DIR, exist_ok=True)
    all_created_ids = set()

    # -------------------------------------------------------------
    # 1. EMOTION_LABEL (Target: 250+)
    # -------------------------------------------------------------
    emo_labels = []

    # Migrated from EMOTION_LEXICON_HU (30 words) - exact hand-curated tuples
    MIGRATED_EMO_LABELS_HU = [
        ("dühös", "dühös", [], ["ADJ"], -0.8, 0.8, {"anger": 0.9}, "strong", None),
        ("mérges", "mérges", [], ["ADJ"], -0.75, 0.75, {"anger": 0.85}, "strong", None),
        ("szomorú", "szomorú", [], ["ADJ"], -0.8, 0.35, {"sadness": 0.85}, "strong", None),
        ("boldog", "boldog", [], ["ADJ"], 0.85, 0.65, {"joy": 0.9}, "strong", None),
        ("félős", "félős", [], ["ADJ"], -0.65, 0.55, {"fear": 0.8}, "strong", None),
        ("ijedt", "ijedt", [], ["ADJ"], -0.75, 0.8, {"fear": 0.85}, "strong", None),
        ("aggódó", "aggódó", [], ["ADJ"], -0.55, 0.6, {"fear": 0.75}, "strong", None),
        ("ideges", "ideges", [], ["ADJ"], -0.6, 0.7, {"fear": 0.6, "anger": 0.6}, "strong", None),
        ("féltékeny", "féltékeny", [], ["ADJ"], -0.7, 0.65, {"disgust": 0.7, "anger": 0.6}, "strong", None),
        ("izgatott", "izgatott", [], ["ADJ"], 0.7, 0.85, {"anticipation": 0.8, "joy": 0.7}, "strong", None),
        ("lehangolt", "lehangolt", [], ["ADJ"], -0.75, 0.3, {"sadness": 0.85}, "strong", None),
        ("magányos", "magányos", [], ["ADJ"], -0.75, 0.3, {"sadness": 0.85}, "strong", None),
        ("kétségbeesett", "kétségbeesett", [], ["ADJ"], -0.9, 0.85, {"fear": 0.85, "sadness": 0.85}, "strong", None),
        ("reménykedő", "reménykedő", [], ["ADJ"], 0.7, 0.55, {"anticipation": 0.8, "joy": 0.6}, "strong", None),
        ("büszke", "büszke", [], ["ADJ"], 0.7, 0.6, {"joy": 0.7, "trust": 0.6}, "strong", None),
        ("csalódott", "csalódott", [], ["ADJ"], -0.7, 0.4, {"sadness": 0.8}, "strong", None),
        ("zavart", "zavart", [], ["ADJ"], -0.4, 0.5, {"surprise": 0.6, "fear": 0.5}, "weak", "fizikai zavarosság vs lelki zavarodottság"),
        ("szégyenlős", "szégyenlős", [], ["ADJ"], -0.5, 0.45, {"fear": 0.6, "sadness": 0.5}, "strong", None),
        ("undorodó", "undorodó", [], ["ADJ"], -0.8, 0.7, {"disgust": 0.85}, "strong", None),
        ("elkeseredett", "elkeseredett", ["elkeseredik"], ["ADJ"], -0.8, 0.6, {"sadness": 0.85}, "strong", None),
        ("szorongó", "szorongó", [], ["ADJ"], -0.75, 0.75, {"fear": 0.85}, "strong", None),
        ("rettegő", "rettegő", [], ["ADJ"], -0.95, 0.95, {"fear": 0.95}, "strong", None),
        ("bosszús", "bosszús", [], ["ADJ"], -0.65, 0.65, {"anger": 0.75}, "strong", None),
        ("elégedett", "elégedett", [], ["ADJ"], 0.7, 0.3, {"joy": 0.7}, "strong", None),
        ("bűntudatos", "bűntudatos", [], ["ADJ"], -0.7, 0.5, {"sadness": 0.8}, "strong", None),
        ("borús", "borús", [], ["ADJ"], -0.55, 0.3, {"sadness": 0.7}, "weak", "időjárás / égbolt vs borús hangulat"),
        ("boldogtalan", "boldogtalan", [], ["ADJ"], -0.85, 0.4, {"sadness": 0.9}, "strong", None),
        ("nyugtalan", "nyugtalan", [], ["ADJ"], -0.65, 0.7, {"fear": 0.75}, "strong", None),
        ("reménytelen", "reménytelen", [], ["ADJ"], -0.95, 0.35, {"sadness": 0.95}, "strong", None),
        ("megtört", "megtört", [], ["ADJ"], -0.8, 0.4, {"sadness": 0.85}, "weak", "fizikai törés vs megtört lélek"),
    ]

    for orig_w, lem, alts, pos, val, aro, emos, strength, note in MIGRATED_EMO_LABELS_HU:
        eid = make_id("emo", lem)
        all_created_ids.add(eid)
        entry = {
            "id": eid,
            "lemma": lem,
            "pos": pos,
            "kind": "emotion_label",
            "strength": strength,
            "valence": val,
            "arousal": aro,
            "emotions": emos,
            "source": "migrated:hun_janitor.py",
            "version": 1,
        }
        if alts:
            entry["alt_lemmas"] = alts
            entry["lemma_evidence"] = "carrier"
        if note:
            entry["note"] = note
        emo_labels.append(entry)

    extra_labels = [
        ("haragos", "anger", -0.8, 0.8, "strong", None),
        ("dühöngő", "anger", -0.9, 0.9, "strong", None),
        ("tajtékzó", "anger", -0.9, 0.9, "weak", "tajtékzó hullámok vs dühöngő ember"),
        ("bőszült", "anger", -0.8, 0.8, "strong", None),
        ("felbőszült", "anger", -0.8, 0.8, "strong", None),
        ("ingerült", "anger", -0.6, 0.7, "strong", None),
        ("ingerlékeny", "anger", -0.5, 0.6, "strong", None),
        ("feszült", "fear", -0.5, 0.7, "weak", "feszült húr vs idegi feszültség"),
        ("frusztrált", "anger", -0.6, 0.6, "strong", None),
        ("keserű", "anger", -0.6, 0.5, "weak", "keserű íz vs keserű csalódottság"),
        ("epés", "disgust", -0.6, 0.5, "strong", None),
        ("maró", "disgust", -0.5, 0.5, "weak", "maró vegyszer vs maró gúny"),
        ("gúnyos", "disgust", -0.6, 0.6, "strong", None),
        ("gőgös", "disgust", -0.6, 0.5, "strong", None),
        ("kevély", "disgust", -0.6, 0.5, "strong", None),
        ("rátarti", "disgust", -0.5, 0.4, "strong", None),
        ("önhitt", "disgust", -0.6, 0.5, "strong", None),
        ("felfuvalkodott", "disgust", -0.6, 0.5, "strong", None),
        ("öntelt", "disgust", -0.5, 0.4, "strong", None),
        ("megvető", "disgust", -0.7, 0.6, "strong", None),
        ("lekicsinylő", "disgust", -0.6, 0.5, "strong", None),
        ("ellenséges", "anger", -0.7, 0.7, "strong", None),
        ("rosszindulatú", "disgust", -0.8, 0.6, "weak", "rosszindulatú daganat vs rosszindulatú ember"),
        ("gonosz", "disgust", -0.8, 0.7, "strong", None),
        ("kegyetlen", "disgust", -0.8, 0.7, "strong", None),
        ("irigy", "disgust", -0.7, 0.6, "strong", None),
        ("gyűlölködő", "disgust", -0.9, 0.8, "strong", None),
        ("bosszúszomjas", "anger", -0.8, 0.8, "strong", None),
        ("engeszteletlen", "anger", -0.7, 0.6, "strong", None),
        ("megbántott", "sadness", -0.6, 0.5, "strong", None),
        ("sértett", "anger", -0.6, 0.5, "weak", "sértett jogi fél vs sértett büszkeség"),
        ("sértődött", "anger", -0.5, 0.5, "strong", None),
        ("megalázott", "sadness", -0.8, 0.6, "strong", None),
        ("megszégyenült", "sadness", -0.8, 0.6, "strong", None),
        ("szégyenkező", "sadness", -0.6, 0.4, "strong", None),
        ("feszengő", "fear", -0.4, 0.5, "strong", None),
        ("félénk", "fear", -0.4, 0.4, "strong", None),
        ("megilletődött", "surprise", 0.1, 0.4, "strong", None),
        ("bizonytalan", "fear", -0.3, 0.4, "weak", "bizonytalan kimenetel vs bizonytalan személyiség"),
        ("gyáva", "fear", -0.6, 0.4, "strong", None),
        ("kishitű", "sadness", -0.5, 0.3, "strong", None),
        ("ijedős", "fear", -0.5, 0.5, "strong", None),
        ("rémült", "fear", -0.8, 0.8, "strong", None),
        ("megrémült", "fear", -0.8, 0.8, "strong", None),
        ("megdermedt", "fear", -0.7, 0.7, "weak", "megdermedt zsír vs megdermedt félelem"),
        ("vigasztalhatatlan", "sadness", -0.9, 0.6, "strong", None),
        ("bánatos", "sadness", -0.8, 0.4, "strong", None),
        ("bús", "sadness", -0.7, 0.3, "strong", None),
        ("búskomor", "sadness", -0.7, 0.3, "strong", None),
        ("melankolikus", "sadness", -0.6, 0.3, "strong", None),
        ("kedvetlen", "sadness", -0.5, 0.3, "strong", None),
        ("levert", "sadness", -0.6, 0.3, "weak", "levert vakolat vs levert hangulat"),
        ("csüggedt", "sadness", -0.7, 0.3, "strong", None),
        ("elcsüggedt", "sadness", -0.7, 0.3, "strong", None),
        ("fásult", None, -0.4, 0.2, "strong", None),
        ("közömbös", None, 0.0, 0.1, "strong", None),
        ("érzéketlen", "disgust", -0.5, 0.3, "weak", "érzéketlen végtag vs érzéketlen szív"),
        ("rideg", "disgust", -0.4, 0.3, "weak", "rideg marhatartás / hideg fal vs rideg fogadtatás"),
        ("hűvös", None, -0.2, 0.2, "weak", "hűvös időjárás vs hűvös modor"),
        ("fagyos", "disgust", -0.4, 0.3, "weak", "fagyos szél vs fagyos tekintet"),
        ("zárkózott", None, -0.2, 0.2, "strong", None),
        ("gátlásos", "fear", -0.4, 0.4, "strong", None),
        ("vidám", "joy", 0.8, 0.6, "strong", None),
        ("jókedvű", "joy", 0.8, 0.6, "strong", None),
        ("derűs", "joy", 0.7, 0.5, "weak", "derűs égbolt vs derűs kedély"),
        ("ujjongó", "joy", 0.9, 0.8, "strong", None),
        ("mámoros", "joy", 0.8, 0.8, "weak", "alkoholtól mámoros vs mámoros boldogság"),
        ("elragadtatott", "joy", 0.8, 0.7, "strong", None),
        ("lelkes", "anticipation", 0.8, 0.7, "strong", None),
        ("lelkesült", "anticipation", 0.8, 0.7, "strong", None),
        ("buzgó", "anticipation", 0.6, 0.6, "strong", None),
        ("elszánt", "anticipation", 0.6, 0.7, "strong", None),
        ("magabiztos", "trust", 0.8, 0.6, "strong", None),
        ("hálás", "trust", 0.8, 0.4, "strong", None),
        ("bizakodó", "anticipation", 0.7, 0.5, "strong", None),
        ("reményteli", "anticipation", 0.7, 0.5, "strong", None),
        ("nyugodt", "trust", 0.7, 0.2, "strong", None),
        ("békés", "trust", 0.7, 0.2, "strong", None),
        ("megbékélt", "trust", 0.6, 0.2, "strong", None),
        ("kiegyensúlyozott", "trust", 0.7, 0.3, "weak", "kiegyensúlyozott költségvetés vs lelki egyensúly"),
        ("szelíd", "trust", 0.7, 0.3, "strong", None),
        ("jámbor", "trust", 0.6, 0.2, "strong", None),
        ("meghatott", "joy", 0.7, 0.5, "strong", None),
        ("érzelmes", "joy", 0.5, 0.4, "strong", None),
        ("gyengéd", "joy", 0.8, 0.3, "strong", None),
        ("szerető", "joy", 0.9, 0.5, "weak", "szerető partner vs szerető gondoskodás"),
        ("rajongó", "joy", 0.8, 0.7, "strong", None),
        ("hűséges", "trust", 0.8, 0.4, "strong", None),
        ("odaadó", "trust", 0.8, 0.5, "strong", None),
        ("csodálkozó", "surprise", 0.4, 0.6, "strong", None),
        ("ámuló", "surprise", 0.6, 0.7, "strong", None),
        ("bámuló", "surprise", 0.3, 0.5, "strong", None),
        ("döbbent", "surprise", -0.3, 0.7, "strong", None),
        ("megdöbbent", "surprise", -0.4, 0.7, "strong", None),
        ("meghökkent", "surprise", -0.2, 0.6, "strong", None),
        ("elképedt", "surprise", -0.2, 0.6, "strong", None),
        ("megbotránkozott", "disgust", -0.7, 0.7, "strong", None),
        ("megrökönyödött", "surprise", -0.3, 0.6, "strong", None),
        ("tanácstalan", "fear", -0.4, 0.4, "strong", None),
        ("elbizonytalanodott", "fear", -0.4, 0.4, "strong", None),
        ("meghasonlott", "sadness", -0.7, 0.5, "strong", None),
        ("kétségekkel teli", "fear", -0.5, 0.5, "strong", None),
        ("rettegett", "fear", -0.8, 0.8, "strong", None),
        ("pánikba esett", "fear", -0.8, 0.9, "strong", None),
        ("halálra rémült", "fear", -0.9, 0.9, "strong", None),
        ("dermedt", "fear", -0.7, 0.7, "weak", "hidegtől megdermedt vs félelemtől dermedt"),
        ("reszkető", "fear", -0.6, 0.7, "weak", "hidegtől reszkető vs félelemtől reszkető"),
        ("remegő", "fear", -0.6, 0.7, "weak", "mechanikai rezgés vs izgalomtól remegő"),
        ("vacogó", "fear", -0.5, 0.6, "weak", "hidegtől vacogó vs félelemtől vacogó"),
        ("sápadt", "fear", -0.5, 0.5, "weak", "bőrszín vs ijedtségtől sápadt"),
        ("fellelkesült", "anticipation", 0.8, 0.8, "strong", None),
        ("lázas", "anticipation", 0.3, 0.8, "weak", "orvosi láz vs lázas izgalom"),
        ("türelmetlen", "anticipation", -0.3, 0.7, "strong", None),
        ("nyugtalanító", "fear", -0.6, 0.6, "strong", None),
        ("aggasztó", "fear", -0.6, 0.6, "strong", None),
        ("ijesztő", "fear", -0.7, 0.7, "strong", None),
        ("félelmetes", "fear", -0.8, 0.8, "strong", None),
        ("szörnyű", "fear", -0.8, 0.8, "strong", None),
        ("rettenetes", "fear", -0.9, 0.8, "strong", None),
        ("irtózatos", "fear", -0.9, 0.8, "strong", None),
        ("iszonyatos", "fear", -0.9, 0.8, "strong", None),
        ("gyászos", "sadness", -0.8, 0.3, "weak", "gyászszertartás vs gyászos hangulat"),
        ("gyötrelmes", "sadness", -0.8, 0.7, "strong", None),
        ("sanyarú", "sadness", -0.7, 0.3, "strong", None),
        ("nyomorult", "sadness", -0.8, 0.3, "strong", None),
        ("szánandó", "sadness", -0.5, 0.3, "strong", None),
        ("szánalmas", "disgust", -0.6, 0.4, "strong", None),
        ("megvetendő", "disgust", -0.8, 0.6, "strong", None),
        ("alantas", "disgust", -0.7, 0.5, "strong", None),
        ("aljas", "disgust", -0.8, 0.7, "strong", None),
        ("hitvány", "disgust", -0.7, 0.5, "strong", None),
        ("gyalázatos", "disgust", -0.8, 0.7, "strong", None),
        ("szégyenteljes", "sadness", -0.7, 0.5, "strong", None),
        ("szégyenletes", "sadness", -0.7, 0.5, "strong", None),
        ("égő", "sadness", -0.5, 0.6, "weak", "égő tűz vs égő szégyen"),
        ("forró", "joy", 0.6, 0.7, "weak", "forró tea vs forró szeretet / szenvedély"),
        ("hideg", "disgust", -0.4, 0.2, "weak", "hideg idő vs hideg közöny"),
        ("boldog", "joy", 0.9, 0.7, "strong", None),
        ("boldogtalan", "sadness", -0.8, 0.5, "strong", None),
        ("örömteli", "joy", 0.8, 0.6, "strong", None),
        ("örömtelen", "sadness", -0.7, 0.3, "strong", None),
        ("vidám", "joy", 0.8, 0.6, "strong", None),
        ("jókedvű", "joy", 0.75, 0.55, "strong", None),
        ("derűs", "joy", 0.75, 0.45, "weak", "derűs égbolt vs derűs ember"),
        ("mosolygós", "joy", 0.7, 0.5, "strong", None),
        ("kacagó", "joy", 0.8, 0.7, "strong", None),
        ("ujjongó", "joy", 0.9, 0.85, "strong", None),
        ("lelkendező", "joy", 0.85, 0.8, "strong", None),
        ("diadalmas", "joy", 0.85, 0.75, "strong", None),
        ("győzedelmes", "joy", 0.85, 0.75, "strong", None),
        ("büszke", "joy", 0.7, 0.6, "strong", None),
        ("gőgösködő", "disgust", -0.6, 0.55, "strong", None),
        ("elbizakodott", "disgust", -0.5, 0.5, "strong", None),
        ("öntetszelgő", "disgust", -0.6, 0.5, "strong", None),
        ("szerény", "trust", 0.6, 0.25, "strong", None),
        ("alázatos", "trust", 0.65, 0.3, "strong", None),
        ("meghunyászkodó", "fear", -0.5, 0.4, "strong", None),
        ("szelíd", "trust", 0.7, 0.2, "strong", None),
        ("jámbor", "trust", 0.65, 0.2, "strong", None),
        ("békés", "trust", 0.75, 0.15, "strong", None),
        ("nyugodt", "trust", 0.7, 0.15, "strong", None),
        ("higgadt", "trust", 0.65, 0.2, "strong", None),
        ("méltóságteljes", "trust", 0.75, 0.4, "strong", None),
        ("tiszteletteljes", "trust", 0.75, 0.35, "strong", None),
        ("hűséges", "trust", 0.85, 0.4, "strong", None),
        ("odaadó", "trust", 0.8, 0.45, "strong", None),
        ("szerető", "joy", 0.85, 0.5, "strong", None),
        ("gyengéd", "joy", 0.8, 0.3, "strong", None),
        ("figyelmes", "trust", 0.7, 0.35, "strong", None),
        ("jóságos", "trust", 0.8, 0.3, "strong", None),
        ("kegyes", "trust", 0.75, 0.35, "strong", None),
        ("irgalmas", "trust", 0.8, 0.35, "strong", None),
        ("könyörületes", "trust", 0.75, 0.35, "strong", None),
        ("szánakozó", "sadness", -0.4, 0.35, "strong", None),
        ("részvétteljes", "trust", 0.65, 0.35, "strong", None),
        ("együttérző", "trust", 0.75, 0.35, "strong", None),
        ("segítőkész", "trust", 0.7, 0.4, "strong", None),
        ("bizakodó", "anticipation", 0.7, 0.5, "strong", None),
        ("reményteli", "anticipation", 0.75, 0.55, "strong", None),
        ("reményvesztett", "sadness", -0.85, 0.4, "strong", None),
        ("kétségbeesett", "sadness", -0.9, 0.8, "strong", None),
        ("csalódott", "sadness", -0.7, 0.45, "strong", None),
        ("kiábrándult", "sadness", -0.7, 0.35, "strong", None),
        ("megtört", "sadness", -0.85, 0.3, "weak", "megtört ág vs megtört lélek"),
        ("elhagyatott", "sadness", -0.8, 0.3, "weak", "elhagyatott ház vs elhagyatott ember"),
        ("magányos", "sadness", -0.7, 0.35, "strong", None),
        ("elhagyott", "sadness", -0.75, 0.35, "weak", "elhagyott tárgy vs elhagyott kedves"),
        ("szomorú", "sadness", -0.75, 0.35, "strong", None),
        ("siralmas", "sadness", -0.7, 0.4, "strong", None),
        ("könnyes", "sadness", -0.65, 0.45, "weak", "könnyes szem vs szomorúság"),
        ("zokogó", "sadness", -0.85, 0.75, "strong", None),
        ("kesergő", "sadness", -0.7, 0.4, "strong", None),
        ("bánkódó", "sadness", -0.7, 0.4, "strong", None),
        ("búbánatos", "sadness", -0.8, 0.35, "strong", None),
        ("töprengő", "anticipation", 0.0, 0.3, "strong", None),
        ("gondterhelt", "fear", -0.55, 0.45, "strong", None),
        ("aggódó", "fear", -0.65, 0.6, "strong", None),
        ("nyugtalan", "fear", -0.6, 0.65, "strong", None),
        ("izgatott", "anticipation", 0.2, 0.75, "weak", "idegileg izgatott vs várakozástól izgatott"),
        ("kíváncsi", "anticipation", 0.45, 0.5, "strong", None),
        ("tudásszomjas", "anticipation", 0.6, 0.6, "strong", None),
        ("érdeklődő", "anticipation", 0.5, 0.45, "strong", None),
        ("ámuló", "surprise", 0.6, 0.65, "strong", None),
        ("csodálkozó", "surprise", 0.5, 0.55, "strong", None),
        ("bámuló", "surprise", 0.2, 0.5, "weak", "bámulja a tájat vs csodálkozva bámul"),
        ("meglepett", "surprise", 0.2, 0.6, "strong", None),
        ("meghökkent", "surprise", -0.2, 0.65, "strong", None),
        ("elképedt", "surprise", -0.3, 0.75, "strong", None),
        ("döbbent", "surprise", -0.4, 0.8, "strong", None),
        ("megdöbbent", "surprise", -0.4, 0.8, "strong", None),
        ("leforrázott", "surprise", -0.5, 0.6, "weak", "forró vízzel leforrázott vs megszégyenült döbbenet"),
        ("ijedt", "fear", -0.65, 0.7, "strong", None),
        ("megijedt", "fear", -0.65, 0.7, "strong", None),
        ("rémüldöző", "fear", -0.8, 0.8, "strong", None),
        ("rettegő", "fear", -0.9, 0.85, "strong", None),
        ("borzongó", "fear", -0.5, 0.6, "weak", "hidegtől borzongó vs félelemtől borzongó"),
        ("reszketeg", "fear", -0.6, 0.65, "weak", "reszketeg láb vs reszketeg félelem"),
        ("dühös", "anger", -0.8, 0.85, "strong", None),
        ("mérges", "anger", -0.7, 0.75, "weak", "mérges gomba vs mérges ember"),
        ("felháborodott", "anger", -0.75, 0.8, "strong", None),
        ("bosszús", "anger", -0.6, 0.65, "strong", None),
        ("zsémbes", "anger", -0.5, 0.5, "strong", None),
        ("mogorva", "anger", -0.55, 0.45, "strong", None),
        ("morcos", "anger", -0.5, 0.5, "strong", None),
        ("durcás", "anger", -0.45, 0.5, "strong", None),
        ("dacos", "anger", -0.4, 0.65, "strong", None),
        ("ellenszenves", "disgust", -0.65, 0.5, "strong", None),
        ("undorító", "disgust", -0.85, 0.7, "strong", None),
        ("visszataszító", "disgust", -0.8, 0.65, "strong", None),
        ("gyomorforgató", "disgust", -0.9, 0.75, "strong", None),
        ("bámész", "surprise", 0.1, 0.4, "strong", None),
        ("ittas", "joy", 0.5, 0.5, "weak", "alkoholtól ittas vs örömmámor"),
        ("részeg", "joy", 0.5, 0.6, "weak", "részeg ember vs mámorosan részeg"),
        ("bódult", "sadness", -0.4, 0.3, "weak", "bódult állapot vs szomorúan bódult"),
        ("kábult", "sadness", -0.4, 0.3, "strong", None),
        ("tántorgó", "fear", -0.5, 0.5, "weak", "tántorgó léptek vs megrendült lélek"),
        ("tétovázó", "fear", -0.4, 0.4, "strong", None),
        ("habozó", "fear", -0.3, 0.4, "strong", None),
        ("bizonytalankodó", "fear", -0.4, 0.4, "strong", None),
        ("kedveszegett", "sadness", -0.7, 0.35, "strong", None),
        ("rosszkedvű", "sadness", -0.65, 0.4, "strong", None),
        ("morózus", "anger", -0.6, 0.45, "strong", None),
        ("pokróc", "disgust", -0.5, 0.4, "weak", "gyapjú pokróc vs pokróc modor"),
        ("barátságtalan", "disgust", -0.55, 0.4, "strong", None),
        ("hidegfejű", "trust", 0.5, 0.2, "strong", None),
        ("szívtelen", "disgust", -0.8, 0.5, "strong", None),
        ("kőszívű", "disgust", -0.85, 0.5, "strong", None),
        ("irgalmatlan", "disgust", -0.85, 0.7, "strong", None),
        ("kegyetlenkedő", "disgust", -0.9, 0.75, "strong", None),
        ("vérszomjas", "anger", -0.85, 0.85, "strong", None),
        ("vérengző", "anger", -0.9, 0.9, "strong", None),
        ("harcias", "anger", -0.4, 0.75, "strong", None),
        ("vakmerő", "anticipation", 0.4, 0.8, "strong", None),
        ("merész", "trust", 0.7, 0.7, "strong", None),
        ("bátor", "trust", 0.8, 0.65, "strong", None),
        ("hősies", "trust", 0.9, 0.75, "strong", None),
        ("lovagias", "trust", 0.85, 0.5, "strong", None),
        ("nemeslelkű", "trust", 0.9, 0.4, "strong", None),
        ("nagylelkű", "trust", 0.85, 0.4, "strong", None),
        ("önfeláldozó", "trust", 0.85, 0.5, "strong", None),
        ("megbízható", "trust", 0.85, 0.3, "strong", None),
        ("őszinte", "trust", 0.85, 0.35, "strong", None),
        ("igazmondó", "trust", 0.8, 0.3, "strong", None),
        ("lelkiismeretes", "trust", 0.8, 0.35, "strong", None),
        ("kötelességtudó", "trust", 0.75, 0.4, "strong", None),
    ]

    for item in extra_labels:
        term, emo, val, aro, strength, note = item
        if " " in term:
            phrase = [norm_lemma(w) for w in term.split()]
            eid = make_id("emo", "_".join(phrase))
            if eid in all_created_ids:
                continue
            all_created_ids.add(eid)
            emo_labels.append({
                "id": eid,
                "phrase": phrase,
                "kind": "emotion_label",
                "strength": strength,
                "valence": val,
                "arousal": aro,
                "emotions": {emo: 0.9} if emo else None,
                "source": "curated:gemini-2026-09",
                "version": 1,
            })
        else:
            lem = norm_lemma(term)
            eid = make_id("emo", lem)
            if eid in all_created_ids:
                continue
            all_created_ids.add(eid)
            entry = {
                "id": eid,
                "lemma": lem,
                "pos": ["ADJ"],
                "kind": "emotion_label",
                "strength": strength,
                "valence": val,
                "arousal": aro,
                "emotions": {emo: 0.9} if emo else None,
                "source": "curated:gemini-2026-09",
                "version": 1,
            }
            if note:
                entry["note"] = note
            emo_labels.append(entry)

    with open(os.path.join(LEXICONS_DIR, "emotion_label.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "emotion_label", "version": 1, "entries": emo_labels}, f, indent=1)
    print(f"HU emotion_label: {len(emo_labels)} entries")

    # -------------------------------------------------------------
    # 2. EMOTION_NOUN (Target: 120+)
    # -------------------------------------------------------------
    emo_nouns = []
    noun_data = [
        ("düh", "anger", -0.9, 0.9), ("harag", "anger", -0.8, 0.8), ("méreg", "anger", -0.7, 0.7),
        ("bánat", "sadness", -0.8, 0.4), ("szomorúság", "sadness", -0.8, 0.3), ("gyász", "sadness", -0.9, 0.5),
        ("öröm", "joy", 0.9, 0.7), ("boldogság", "joy", 0.9, 0.6), ("vidámság", "joy", 0.8, 0.6),
        ("félelem", "fear", -0.8, 0.8), ("rettegés", "fear", -0.9, 0.9), ("ijedség", "fear", -0.7, 0.7),
        ("pánik", "fear", -0.8, 0.9), ("rémület", "fear", -0.9, 0.9), ("iszony", "fear", -0.8, 0.8),
        ("irtózat", "fear", -0.8, 0.8), ("undor", "disgust", -0.8, 0.6), ("utálat", "disgust", -0.8, 0.7),
        ("gyűlölet", "disgust", -0.9, 0.8), ("megvetés", "disgust", -0.8, 0.6), ("lenézés", "disgust", -0.7, 0.5),
        ("gúny", "disgust", -0.6, 0.6), ("szégyen", "sadness", -0.7, 0.5), ("gyalázat", "sadness", -0.8, 0.6),
        ("bűntudat", "sadness", -0.7, 0.5), ("lelkifurdalás", "sadness", -0.7, 0.5), ("megbánás", "sadness", -0.6, 0.4),
        ("kétségbeesés", "sadness", -0.9, 0.8), ("csalódás", "sadness", -0.7, 0.4), ("kiábrándulás", "sadness", -0.7, 0.3),
        ("keserűség", "anger", -0.6, 0.5), ("bosszúság", "anger", -0.6, 0.6), ("ingerültség", "anger", -0.6, 0.6),
        ("felháborodás", "anger", -0.8, 0.7), ("lázongás", "anger", -0.6, 0.7), ("irigység", "disgust", -0.7, 0.6),
        ("féltékenység", "disgust", -0.7, 0.7), ("magány", "sadness", -0.7, 0.3), ("elhagyatottság", "sadness", -0.8, 0.3),
        ("árvaság", "sadness", -0.7, 0.3), ("szorongás", "fear", -0.7, 0.7), ("nyugtalanság", "fear", -0.6, 0.6),
        ("idegesség", "fear", -0.5, 0.6), ("aggodalom", "fear", -0.6, 0.6), ("aggály", "fear", -0.4, 0.4),
        ("remény", "anticipation", 0.8, 0.5), ("reménykedés", "anticipation", 0.7, 0.5), ("bizalom", "trust", 0.8, 0.4),
        ("hit", "trust", 0.8, 0.4), ("lelkesedés", "anticipation", 0.8, 0.7), ("rajongás", "joy", 0.8, 0.7),
        ("szeretet", "joy", 0.9, 0.4), ("szerelem", "joy", 0.9, 0.8), ("gyengédség", "joy", 0.8, 0.3),
        ("hála", "trust", 0.8, 0.4), ("elismerés", "trust", 0.7, 0.4), ("tisztelet", "trust", 0.8, 0.4),
        ("csodálat", "surprise", 0.7, 0.6), ("ámulat", "surprise", 0.7, 0.7), ("döbbenet", "surprise", -0.3, 0.7),
        ("meglepetés", "surprise", 0.3, 0.6), ("bámulat", "surprise", 0.5, 0.5), ("kíváncsiság", "anticipation", 0.5, 0.5),
        ("türelmetlenség", "anticipation", -0.3, 0.7), ("vágy", "anticipation", 0.6, 0.7), ("sóvárgás", "anticipation", 0.3, 0.6),
        ("áhítat", "trust", 0.8, 0.4), ("nyugalom", "trust", 0.8, 0.2), ("békesség", "trust", 0.8, 0.2),
        ("megkönnyebbülés", "joy", 0.8, 0.3), ("elégedettség", "joy", 0.7, 0.3), ("büszkeség", "joy", 0.7, 0.6),
        ("gőg", "disgust", -0.6, 0.5), ("kevélység", "disgust", -0.6, 0.5), ("önhittség", "disgust", -0.6, 0.5),
        ("közöny", None, 0.0, 0.1), ("fásultság", None, -0.4, 0.2), ("unalom", "sadness", -0.4, 0.1),
        ("együttérzés", "trust", 0.7, 0.3), ("szánalom", "sadness", -0.4, 0.3), ("részvét", "trust", 0.6, 0.3),
        ("könyörület", "trust", 0.7, 0.3), ("irgalom", "trust", 0.8, 0.3), ("megbocsátás", "trust", 0.8, 0.3),
        ("megindultság", "joy", 0.7, 0.5), ("meghatottság", "joy", 0.7, 0.5), ("zaklatottság", "fear", -0.6, 0.7),
        ("bátorság", "trust", 0.8, 0.7), ("vakmerőség", "anticipation", 0.4, 0.8), ("elbizakodottság", "disgust", -0.4, 0.5),
        ("félszegség", "fear", -0.3, 0.3), ("zavarodottság", "surprise", -0.3, 0.5), ("tanácstalanság", "fear", -0.4, 0.4),
        ("megalázottság", "sadness", -0.8, 0.6), ("kiszolgáltatottság", "fear", -0.7, 0.6), ("megtörtség", "sadness", -0.8, 0.3),
        ("kétség", "fear", -0.5, 0.5), ("gyötrelem", "sadness", -0.8, 0.7), ("szenvedés", "sadness", -0.8, 0.6),
        ("kín", "sadness", -0.9, 0.7), ("fájdalom", "sadness", -0.7, 0.5), ("sérelem", "anger", -0.6, 0.5),
        ("ellenszenv", "disgust", -0.6, 0.4), ("rokonszenv", "joy", 0.7, 0.4), ("vonzalom", "joy", 0.7, 0.5),
        ("ellenségeskedés", "anger", -0.7, 0.7), ("haragtartás", "anger", -0.6, 0.4), ("bosszúvágy", "anger", -0.8, 0.8),
        ("megvetés", "disgust", -0.7, 0.5), ("utálat", "disgust", -0.8, 0.6), ("undor", "disgust", -0.8, 0.7),
        ("szomorúság", "sadness", -0.7, 0.3), ("bánat", "sadness", -0.7, 0.3), ("boldogság", "joy", 0.9, 0.7),
        ("vidámság", "joy", 0.8, 0.6), ("derű", "joy", 0.8, 0.4), ("jókedv", "joy", 0.7, 0.5),
        ("ijedség", "fear", -0.6, 0.7), ("rettegés", "fear", -0.9, 0.9), ("szorongás", "fear", -0.7, 0.7),
        ("izgalom", "anticipation", 0.2, 0.8), ("reménykedés", "anticipation", 0.7, 0.5), ("csalódás", "sadness", -0.7, 0.5),
        ("kétségbeesés", "sadness", -0.9, 0.8), ("bizalom", "trust", 0.8, 0.4), ("gyanakvás", "fear", -0.5, 0.5),
        ("bizalmatlanság", "fear", -0.6, 0.5), ("meghökkenés", "surprise", -0.2, 0.6), ("ámulat", "surprise", 0.7, 0.6),
        ("csodálkozás", "surprise", 0.5, 0.5), ("meglepetés", "surprise", 0.3, 0.6), ("megkönnyebbülés", "joy", 0.75, 0.3),
        ("iszonyat", "fear", -0.9, 0.85), ("borzadály", "fear", -0.85, 0.8), ("utálkozás", "disgust", -0.8, 0.6),
        ("dühöngés", "anger", -0.9, 0.9), ("tombolás", "anger", -0.9, 0.9), ("bőszültség", "anger", -0.85, 0.85),
        ("haragvás", "anger", -0.75, 0.7), ("bosszankodás", "anger", -0.6, 0.55), ("kesergés", "sadness", -0.7, 0.4),
        ("bánkódás", "sadness", -0.7, 0.4),
    ]

    for term, emo, val, aro in noun_data:
        lem = norm_lemma(term)
        eid = make_id("emonoun", lem)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        emo_nouns.append({
            "id": eid,
            "lemma": lem,
            "pos": ["NOUN"],
            "kind": "emotion_noun",
            "strength": "strong",
            "valence": val,
            "arousal": aro,
            "emotions": {emo: 0.8} if emo else None,
            "source": "curated:gemini-2026-09",
            "version": 1,
        })

    with open(os.path.join(LEXICONS_DIR, "emotion_noun.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "emotion_noun", "version": 1, "entries": emo_nouns}, f, indent=1)
    print(f"HU emotion_noun: {len(emo_nouns)} entries")

    # -------------------------------------------------------------
    # 3. EMOTION_VERB (Target: 80+)
    # -------------------------------------------------------------
    emo_verbs = []
    verb_data = [
        ("dühöng", "anger", -0.9, 0.9), ("haragszik", "anger", -0.8, 0.7), ("mérgelődik", "anger", -0.6, 0.6),
        ("bosszankodik", "anger", -0.5, 0.5), ("búsul", "sadness", -0.7, 0.3), ("szomorkodik", "sadness", -0.7, 0.3),
        ("bánkódik", "sadness", -0.7, 0.3), ("kesereg", "sadness", -0.7, 0.4), ("siránkozik", "sadness", -0.6, 0.4),
        ("zokog", "sadness", -0.8, 0.7), ("könnyezik", "sadness", -0.6, 0.4), ("gyászol", "sadness", -0.9, 0.5),
        ("retteg", "fear", -0.9, 0.9), ("fél", "fear", -0.8, 0.7), ("ijedezik", "fear", -0.6, 0.6),
        ("reszket", "fear", -0.6, 0.7), ("borzong", "fear", -0.5, 0.6), ("iszonyodik", "fear", -0.8, 0.7),
        ("undorodik", "disgust", -0.8, 0.6), ("utál", "disgust", -0.8, 0.7), ("gyűlöl", "disgust", -0.9, 0.8),
        ("megvet", "disgust", -0.8, 0.6), ("lenéz", "disgust", -0.7, 0.5), ("gúnyol", "disgust", -0.6, 0.6),
        ("gúnyolódik", "disgust", -0.6, 0.6), ("csúfol", "disgust", -0.6, 0.5), ("szégyenkezik", "sadness", -0.6, 0.4),
        ("pirul", "fear", -0.3, 0.5), ("szorong", "fear", -0.7, 0.7), ("aggódik", "fear", -0.6, 0.6),
        ("nyugtalankodik", "fear", -0.5, 0.6), ("kétségbeesik", "sadness", -0.9, 0.8), ("csügged", "sadness", -0.7, 0.3),
        ("örül", "joy", 0.8, 0.6), ("örvendezik", "joy", 0.9, 0.7), ("ujjong", "joy", 0.9, 0.8),
        ("vigad", "joy", 0.8, 0.7), ("kacag", "joy", 0.8, 0.6), ("nevetgél", "joy", 0.7, 0.5),
        ("mosolyog", "joy", 0.7, 0.4), ("mosolygás", "joy", 0.7, 0.4), ("lelkesedik", "anticipation", 0.8, 0.7),
        ("rajong", "joy", 0.8, 0.7), ("szeret", "joy", 0.9, 0.4), ("imád", "joy", 0.9, 0.7),
        ("áhítozik", "anticipation", 0.6, 0.6), ("vágyakozik", "anticipation", 0.5, 0.6), ("sóvárog", "anticipation", 0.4, 0.6),
        ("remél", "anticipation", 0.7, 0.5), ("bízik", "trust", 0.8, 0.4), ("megnyugszik", "trust", 0.7, 0.2),
        ("csodál", "surprise", 0.7, 0.6), ("ámul", "surprise", 0.7, 0.7), ("bámul", "surprise", 0.4, 0.5),
        ("elképed", "surprise", -0.2, 0.6), ("megdöbben", "surprise", -0.3, 0.7), ("döbben", "surprise", -0.3, 0.7),
        ("meghökken", "surprise", -0.2, 0.6), ("hőköl", "fear", -0.4, 0.6), ("visszahőköl", "fear", -0.5, 0.6),
        ("riad", "fear", -0.6, 0.7), ("megriad", "fear", -0.7, 0.7), ("összerezzen", "fear", -0.5, 0.6),
        ("fájlal", "sadness", -0.6, 0.4), ("sajnál", "sadness", -0.5, 0.3), ("szán", "sadness", -0.5, 0.3),
        ("könyörül", "trust", 0.7, 0.3), ("megbocsát", "trust", 0.8, 0.3), ("engesztel", "trust", 0.6, 0.4),
        ("engesztelődik", "trust", 0.6, 0.3), ("enyhül", "trust", 0.5, 0.2), ("megbékél", "trust", 0.7, 0.2),
        ("irigyel", "disgust", -0.7, 0.6), ("féltékenykedik", "disgust", -0.7, 0.7), ("felfuvalkodik", "disgust", -0.6, 0.5),
        ("henceg", "disgust", -0.5, 0.5), ("kérkedik", "disgust", -0.5, 0.5), ("dicsekszik", "disgust", -0.4, 0.5),
        ("megvetést érez", "disgust", -0.8, 0.6), ("ellenszenvet táplál", "disgust", -0.7, 0.5),
        ("felháborodik", "anger", -0.8, 0.7), ("lázadozik", "anger", -0.6, 0.6), ("duzzog", "anger", -0.5, 0.4),
    ]

    for item in verb_data:
        term = item[0]
        emo, val, aro = item[1], item[2], item[3]
        if " " in term:
            phrase = [norm_lemma(w) for w in term.split()]
            eid = make_id("emoverb", "_".join(phrase))
            if eid in all_created_ids:
                continue
            all_created_ids.add(eid)
            emo_verbs.append({
                "id": eid,
                "phrase": phrase,
                "kind": "emotion_verb",
                "strength": "strong",
                "valence": val,
                "arousal": aro,
                "emotions": {emo: 0.8} if emo else None,
                "source": "curated:gemini-2026-09",
                "version": 1,
            })
        else:
            lem = norm_lemma(term)
            eid = make_id("emoverb", lem)
            if eid in all_created_ids:
                continue
            all_created_ids.add(eid)
            emo_verbs.append({
                "id": eid,
                "lemma": lem,
                "pos": ["VERB"],
                "kind": "emotion_verb",
                "strength": "strong",
                "valence": val,
                "arousal": aro,
                "emotions": {emo: 0.8} if emo else None,
                "source": "curated:gemini-2026-09",
                "version": 1,
            })

    with open(os.path.join(LEXICONS_DIR, "emotion_verb.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "emotion_verb", "version": 1, "entries": emo_verbs}, f, indent=1)
    print(f"HU emotion_verb: {len(emo_verbs)} entries")

    # -------------------------------------------------------------
    # 4. TELLING_CUE (Target: 40+)
    # -------------------------------------------------------------
    telling_cues = []
    cues_data = [
        ("arckifejezés", "anticipation", 0.0, 0.4), ("tekintet", "anticipation", 0.0, 0.4),
        ("hanghordozás", "anticipation", 0.0, 0.4), ("hangszín", "anticipation", 0.0, 0.4),
        ("hangulat", "anticipation", 0.0, 0.4), ("érzés", "anticipation", 0.0, 0.4),
        ("érzelem", "anticipation", 0.0, 0.4), ("lelkiállapot", "anticipation", 0.0, 0.4),
        ("kedély", "anticipation", 0.0, 0.4), ("arckifejezéssel", "anticipation", 0.0, 0.4),
        ("hangon", "anticipation", 0.0, 0.4), ("pillantással", "anticipation", 0.0, 0.4),
        ("mosollyal", "joy", 0.6, 0.4), ("fintorral", "disgust", -0.5, 0.4),
        ("sóhajjal", "sadness", -0.3, 0.3), ("könnyekkel", "sadness", -0.6, 0.5),
        ("könnyes szemmel", "sadness", -0.7, 0.5), ("remegő hangon", "fear", -0.6, 0.6),
        ("fojtott hangon", "fear", -0.5, 0.5), ("suttogva", "trust", 0.2, 0.2),
        ("elcsukló hangon", "sadness", -0.7, 0.6), ("haragos pillantás", "anger", -0.7, 0.7),
        ("gúnyos mosoly", "disgust", -0.6, 0.5), ("kesernyés mosoly", "sadness", -0.4, 0.3),
        ("megvető pillantás", "disgust", -0.7, 0.6), ("hideg tekintet", "disgust", -0.5, 0.3),
        ("meleg mosoly", "joy", 0.8, 0.4), ("ijedt tekintet", "fear", -0.7, 0.7),
        ("rémült pillantás", "fear", -0.8, 0.8), ("kétségbeesett pillantás", "fear", -0.8, 0.8),
        ("bánatos tekintet", "sadness", -0.7, 0.3), ("szomorú pillantás", "sadness", -0.7, 0.3),
        ("vidám tekintet", "joy", 0.7, 0.5), ("kíváncsi pillantás", "anticipation", 0.4, 0.5),
        ("dühös tekintet", "anger", -0.8, 0.8), ("vad pillantás", "anger", -0.7, 0.7),
        ("sötét tekintet", "anger", -0.6, 0.5), ("villámló tekintet", "anger", -0.8, 0.8),
        ("merev tekintet", "fear", -0.4, 0.4), ("kérdő tekintet", "anticipation", 0.1, 0.4),
        ("értetlen tekintet", "surprise", -0.2, 0.4), ("zavart tekintet", "surprise", -0.3, 0.5),
        ("gyengéd tekintet", "joy", 0.8, 0.3), ("szerető tekintet", "joy", 0.9, 0.4),
        ("hálás pillantás", "trust", 0.8, 0.4),
    ]

    for phrase_str, emo, val, aro in cues_data:
        phrase_words = phrase_str.split()
        if len(phrase_words) > 1:
            norm_phrase = [norm_lemma(w) for w in phrase_words]
            eid = make_id("cue", "_".join(norm_phrase))
            if eid in all_created_ids:
                continue
            all_created_ids.add(eid)
            telling_cues.append({
                "id": eid,
                "phrase": norm_phrase,
                "kind": "telling_cue",
                "strength": "strong",
                "valence": val,
                "arousal": aro,
                "emotions": {emo: 0.9} if emo else None,
                "source": "curated:gemini-2026-09",
                "version": 1,
            })
        else:
            lem = norm_lemma(phrase_str)
            eid = make_id("cue", lem)
            if eid in all_created_ids:
                continue
            all_created_ids.add(eid)
            telling_cues.append({
                "id": eid,
                "lemma": lem,
                "pos": ["NOUN"],
                "kind": "telling_cue",
                "strength": "strong",
                "valence": val,
                "arousal": aro,
                "emotions": {emo: 0.9} if emo else None,
                "source": "curated:gemini-2026-09",
                "version": 1,
            })

    with open(os.path.join(LEXICONS_DIR, "telling_cue.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "telling_cue", "version": 1, "entries": telling_cues}, f, indent=1)
    print(f"HU telling_cue: {len(telling_cues)} entries")

    # -------------------------------------------------------------
    # 5. EMOTION_ADVERB (Target: 40+)
    # Migrated from EMOTION_ADVERBS_HU (12 adverbs) - store dictionary adverb lemma, alt_lemmas: [adj]
    # -------------------------------------------------------------
    emo_adverbs = []

    MIGRATED_EMO_ADVERBS_HU = [
        ("dühösen", "dühös", -0.8, 0.8, {"anger": 0.85}),
        ("szomorúan", "szomorú", -0.75, 0.35, {"sadness": 0.8}),
        ("boldogan", "boldog", 0.85, 0.65, {"joy": 0.85}),
        ("idegesen", "ideges", -0.6, 0.7, {"fear": 0.6, "anger": 0.6}),
        ("szorongva", "szorong", -0.75, 0.75, {"fear": 0.85}),
        ("keserűen", "keserű", -0.7, 0.55, {"anger": 0.7, "sadness": 0.5}),
        ("féltékenyen", "féltékeny", -0.7, 0.65, {"disgust": 0.7, "anger": 0.6}),
        ("kétségbeesetten", "kétségbeesett", -0.9, 0.85, {"fear": 0.85, "sadness": 0.85}),
        ("büszkén", "büszke", 0.7, 0.6, {"joy": 0.7, "trust": 0.6}),
        ("haragosan", "haragos", -0.85, 0.85, {"anger": 0.9}),
        ("örömmel", "öröm", 0.85, 0.7, {"joy": 0.85}),
        ("nyomorultul", "nyomorult", -0.85, 0.35, {"sadness": 0.85}),
    ]

    for adv_w, adj_alt, val, aro, emos in MIGRATED_EMO_ADVERBS_HU:
        eid = make_id("emoadv", adv_w)
        all_created_ids.add(eid)
        emo_adverbs.append({
            "id": eid,
            "lemma": adv_w,
            "alt_lemmas": [adj_alt],
            "pos": ["ADV"],
            "kind": "emotion_adverb",
            "strength": "strong",
            "valence": val,
            "arousal": aro,
            "emotions": emos,
            "lemma_evidence": "carrier",
            "source": "migrated:hun_janitor.py",
            "version": 1,
        })

    extra_advs = [
        ("vidáman", "vidám", "joy", 0.8, 0.6), ("ujjongva", "ujjong", "joy", 0.9, 0.8), ("bánatosan", "bánatos", "sadness", -0.75, 0.4),
        ("búsan", "bús", "sadness", -0.7, 0.3), ("rémülten", "rémült", "fear", -0.8, 0.8), ("ijedten", "ijedt", "fear", -0.75, 0.75),
        ("rettegve", "retteg", "fear", -0.9, 0.9), ("félve", "fél", "fear", -0.65, 0.5), ("reszketve", "reszket", "fear", -0.7, 0.7),
        ("gyűlölettel", "gyűlölet", "disgust", -0.9, 0.8), ("megvetően", "megvető", "disgust", -0.8, 0.6), ("gúnyosan", "gúnyos", "disgust", -0.65, 0.6),
        ("ingerülten", "ingerült", "anger", -0.65, 0.7), ("bosszúsan", "bosszús", "anger", -0.6, 0.6), ("lehangoltan", "lehangolt", "sadness", -0.7, 0.3),
        ("csüggedten", "csüggedt", "sadness", -0.7, 0.3), ("lelkesen", "lelkes", "anticipation", 0.8, 0.7), ("hálásan", "hálás", "trust", 0.8, 0.4),
        ("bizakodva", "bizakodó", "anticipation", 0.7, 0.5), ("nyugodtan", "nyugodt", "trust", 0.7, 0.2), ("békésen", "békés", "trust", 0.7, 0.2),
        ("szelíden", "szelíd", "trust", 0.7, 0.3), ("meghatottan", "meghatott", "joy", 0.7, 0.5), ("gyengéden", "gyengéd", "joy", 0.8, 0.3),
        ("szeretettel", "szeretet", "joy", 0.9, 0.4), ("rajongva", "rajong", "joy", 0.8, 0.7), ("csodálkozva", "csodálkozó", "surprise", 0.4, 0.6),
        ("ámulva", "ámuló", "surprise", 0.6, 0.7), ("bámulva", "bámuló", "surprise", 0.3, 0.5), ("döbbenten", "döbbent", "surprise", -0.3, 0.7),
        ("kíváncsian", "kíváncsi", "anticipation", 0.5, 0.5), ("türelmetlenül", "türelmetlen", "anticipation", -0.3, 0.7),
    ]

    for adv_w, adj_alt, emo, val, aro in extra_advs:
        eid = make_id("emoadv", adv_w)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        emo_adverbs.append({
            "id": eid,
            "lemma": adv_w,
            "alt_lemmas": [adj_alt],
            "pos": ["ADV"],
            "kind": "emotion_adverb",
            "strength": "strong",
            "valence": val,
            "arousal": aro,
            "emotions": {emo: 0.8},
            "lemma_evidence": "carrier",
            "source": "curated:gemini-2026-09",
            "version": 1,
        })

    with open(os.path.join(LEXICONS_DIR, "emotion_adverb.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "emotion_adverb", "version": 1, "entries": emo_adverbs}, f, indent=1)
    print(f"HU emotion_adverb: {len(emo_adverbs)} entries")

    # -------------------------------------------------------------
    # 6. REALIZE_VERB (Cognition verbs, weak/not SDT)
    # Migrated from REALIZE_VERBS_HU (4 verbs)
    # -------------------------------------------------------------
    realize_verbs = []
    migrated_realize = [
        ("rájön", [], 0.1, 0.4, {"anticipation": 0.4}),
        ("megért", ["megér", "megérteni"], 0.2, 0.3, {"trust": 0.4}),
        ("felismer", [], 0.1, 0.35, {"anticipation": 0.4}),
        ("belát", [], 0.1, 0.25, {"trust": 0.4}),
    ]
    for term, alts, val, aro, emos in migrated_realize:
        eid = make_id("realize", term)
        all_created_ids.add(eid)
        entry = {
            "id": eid,
            "lemma": term,
            "pos": ["VERB"],
            "kind": "realize_verb",
            "strength": "weak",
            "valence": val,
            "arousal": aro,
            "emotions": emos,
            "source": "migrated:hun_janitor.py",
            "version": 1,
        }
        if alts:
            entry["alt_lemmas"] = alts
            entry["lemma_evidence"] = "carrier"
        realize_verbs.append(entry)

    extra_realize = [
        ("észrevesz", 0.1, 0.35), ("megsejt", 0.05, 0.3), ("ráeszmél", 0.15, 0.4),
        ("felfog", 0.1, 0.3), ("megtud", 0.15, 0.35), ("kitotóz", 0.1, 0.25),
        ("felfedez", 0.2, 0.45)
    ]
    for term, val, aro in extra_realize:
        lem = norm_lemma(term)
        eid = make_id("realize", lem)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        realize_verbs.append({
            "id": eid,
            "lemma": lem,
            "pos": ["VERB"],
            "kind": "realize_verb",
            "strength": "weak",
            "valence": val,
            "arousal": aro,
            "emotions": {"anticipation": 0.3},
            "source": "curated:gemini-2026-09",
            "version": 1,
        })

    with open(os.path.join(LEXICONS_DIR, "realize_verb.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "realize_verb", "version": 1, "entries": realize_verbs}, f, indent=1)
    print(f"HU realize_verb: {len(realize_verbs)} entries")

    # -------------------------------------------------------------
    # 7. FILTER_VERB (Perception filter verbs, weak/not SDT)
    # Migrated from FILTER_VERBS_HU (7 verbs)
    # -------------------------------------------------------------
    filter_verbs = []
    migrated_filter = [
        ("lát", 0.0, 0.15), ("hall", 0.0, 0.15), ("érez", 0.0, 0.25),
        ("észrevesz", 0.05, 0.35), ("figyel", 0.0, 0.30), ("megfigyel", 0.0, 0.20),
        ("szagol", 0.0, 0.15)
    ]
    for term, val, aro in migrated_filter:
        lem = norm_lemma(term)
        eid = make_id("filter", lem)
        all_created_ids.add(eid)
        filter_verbs.append({
            "id": eid,
            "lemma": lem,
            "pos": ["VERB"],
            "kind": "filter_verb",
            "strength": "weak",
            "valence": val,
            "arousal": aro,
            "emotions": {"anticipation": 0.3},
            "source": "migrated:hun_janitor.py",
            "version": 1,
        })

    extra_filter = [
        ("megpillant", 0.05, 0.35), ("szemlél", 0.0, 0.25), ("kémlel", 0.0, 0.30),
        ("hallgatózik", 0.0, 0.35), ("les", 0.0, 0.30)
    ]
    for term, val, aro in extra_filter:
        lem = norm_lemma(term)
        eid = make_id("filter", lem)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        filter_verbs.append({
            "id": eid,
            "lemma": lem,
            "pos": ["VERB"],
            "kind": "filter_verb",
            "strength": "weak",
            "valence": val,
            "arousal": aro,
            "emotions": {"anticipation": 0.3},
            "source": "curated:gemini-2026-09",
            "version": 1,
        })

    with open(os.path.join(LEXICONS_DIR, "filter_verb.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "filter_verb", "version": 1, "entries": filter_verbs}, f, indent=1)
    print(f"HU filter_verb: {len(filter_verbs)} entries")

    # -------------------------------------------------------------
    # 8. ACTION_VIOLENT (Target: 150+)
    # Individual per-entry valence / arousal across severity tiers
    # -------------------------------------------------------------
    violent_verbs = []
    viol_list = [
        # Mild physical clash (arousal 0.40 - 0.55, valence -0.35 to -0.50)
        ("meglök", -0.40, 0.45, {"anger": 0.5}, "strong", None),
        ("taszít", -0.40, 0.45, {"anger": 0.5}, "weak", "taszító viselkedés vs fizikai taszítás"),
        ("pofoz", -0.50, 0.55, {"anger": 0.6}, "strong", None),
        ("felpofoz", -0.55, 0.60, {"anger": 0.65}, "strong", None),
        ("elgáncsol", -0.40, 0.45, {"anger": 0.5}, "strong", None),
        ("tülekedik", -0.35, 0.45, {"anger": 0.4}, "strong", None),
        ("viaskodik", -0.50, 0.55, {"anger": 0.5}, "strong", None),
        ("birkózik", -0.45, 0.55, {"anger": 0.5}, "weak", "birkózik a feladattal vs fizikai birkózás"),
        ("verekszik", -0.55, 0.60, {"anger": 0.65}, "strong", None),
        ("párbajozik", -0.55, 0.65, {"anger": 0.6}, "strong", None),

        # Moderate violence & striking (arousal 0.60 - 0.75, valence -0.60 to -0.75)
        ("üt", -0.60, 0.65, {"anger": 0.7}, "weak", "üt az óra vs embert megüt"),
        ("ver", -0.65, 0.70, {"anger": 0.75}, "weak", "dobverés / szívverés vs megver valakit"),
        ("csap", -0.60, 0.65, {"anger": 0.7}, "weak", "csap az ajtó vs fejbe csap"),
        ("rugdos", -0.65, 0.70, {"anger": 0.7}, "strong", None),
        ("megrugdos", -0.70, 0.75, {"anger": 0.75}, "strong", None),
        ("harap", -0.60, 0.65, {"anger": 0.6}, "weak", "harap ételt vs haragjában harap"),
        ("sújt", -0.75, 0.75, {"anger": 0.8}, "weak", "sorscsapás sújt vs karddal lesújt"),
        ("ostoroz", -0.75, 0.75, {"anger": 0.8}, "weak", "hibát ostoroz vs korbáccsal ostoroz"),
        ("korbácsol", -0.75, 0.80, {"anger": 0.8}, "strong", None),
        ("ütlegel", -0.70, 0.75, {"anger": 0.75}, "strong", None),
        ("bántalmaz", -0.70, 0.70, {"anger": 0.75}, "strong", None),
        ("megver", -0.70, 0.75, {"anger": 0.75}, "strong", None),
        ("kardlapoz", -0.60, 0.65, {"anger": 0.65}, "strong", None),
        ("küzd", -0.50, 0.65, {"anger": 0.5}, "weak", "küzd a célért vs ellenséggel küzd"),
        ("harcol", -0.60, 0.70, {"anger": 0.65}, "weak", "harcol az igazságért vs csatában harcol"),
        ("hadakozik", -0.55, 0.65, {"anger": 0.6}, "strong", None),
        ("csatázik", -0.65, 0.70, {"anger": 0.7}, "strong", None),
        ("kicsavar", -0.55, 0.60, {"anger": 0.6}, "weak", "ruhát kicsavar vs fegyvert kicsavar"),
        ("kiteker", -0.60, 0.65, {"anger": 0.65}, "weak", "csavart kiteker vs nyakat kiteker"),
        ("szorongat", -0.65, 0.70, {"fear": 0.7, "anger": 0.6}, "weak", "szorongatja a kezét vs torkát szorongatja"),
        ("agyonnyom", -0.75, 0.75, {"fear": 0.8}, "strong", None),
        ("összetör", -0.70, 0.70, {"anger": 0.7}, "weak", "tányért összetör vs lelkileg összetör"),
        ("összezúz", -0.75, 0.75, {"anger": 0.75}, "strong", None),
        ("szétzúz", -0.80, 0.80, {"anger": 0.8}, "strong", None),
        ("széttör", -0.75, 0.75, {"anger": 0.75}, "strong", None),
        ("eltipor", -0.80, 0.80, {"anger": 0.85, "fear": 0.75}, "strong", None),
        ("letapos", -0.75, 0.75, {"anger": 0.8}, "strong", None),
        ("elgázol", -0.80, 0.80, {"fear": 0.85}, "strong", None),
        ("tapos", -0.70, 0.70, {"anger": 0.75}, "weak", "szőlőt tapos vs embert tapos"),

        # Heavy weapons, cutting, piercing, throttling (arousal 0.80 - 0.88, valence -0.80 to -0.90)
        ("vág", -0.70, 0.70, {"anger": 0.7}, "weak", "kenyeret vág vs karddal vág"),
        ("szúr", -0.80, 0.80, {"anger": 0.75, "fear": 0.75}, "weak", "szúr a szeme vs tőrrel szúr"),
        ("döf", -0.85, 0.85, {"anger": 0.8, "fear": 0.8}, "strong", None),
        ("hasít", -0.75, 0.75, {"anger": 0.75}, "weak", "fát hasít vs karddal hasít"),
        ("szaggat", -0.75, 0.75, {"anger": 0.75}, "weak", "szaggat a feje vs húst szaggat"),
        ("tép", -0.75, 0.75, {"anger": 0.75}, "weak", "papírt tép vs hajat tép"),
        ("kitép", -0.75, 0.75, {"anger": 0.8}, "strong", None),
        ("széttép", -0.85, 0.85, {"anger": 0.85, "fear": 0.8}, "strong", None),
        ("elvág", -0.80, 0.80, {"anger": 0.8}, "weak", "fonalat elvág vs torkot elvág"),
        ("átvág", -0.80, 0.80, {"anger": 0.8}, "weak", "erdőn átvág vs torkot átvág"),
        ("kettévág", -0.85, 0.85, {"anger": 0.85}, "strong", None),
        ("leszúr", -0.85, 0.85, {"anger": 0.85, "fear": 0.85}, "strong", None),
        ("ledöf", -0.85, 0.85, {"anger": 0.85, "fear": 0.85}, "strong", None),
        ("fojt", -0.85, 0.85, {"fear": 0.9, "anger": 0.8}, "weak", "fojtja a szót vs embert fojtogat"),
        ("megfojt", -0.90, 0.90, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("megfullaszt", -0.90, 0.90, {"fear": 0.9}, "strong", None),
        ("akaszt", -0.85, 0.85, {"fear": 0.85}, "weak", "kabátot akaszt vs bitóra akaszt"),
        ("akasztat", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("éget", -0.70, 0.75, {"fear": 0.75}, "weak", "ég a gyertya vs máglyán éget"),
        ("perzsel", -0.65, 0.70, {"fear": 0.65}, "weak", "napsütés perzsel vs láng perzsel"),
        ("felgyújt", -0.80, 0.80, {"anger": 0.8, "fear": 0.8}, "strong", None),
        ("lő", -0.75, 0.75, {"fear": 0.8}, "weak", "gólt lő vs puskával lő"),
        ("lelő", -0.85, 0.85, {"fear": 0.85, "anger": 0.8}, "strong", None),
        ("szétlő", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("sebez", -0.70, 0.65, {"fear": 0.7}, "strong", None),
        ("megsebesít", -0.75, 0.70, {"fear": 0.75}, "strong", None),
        ("kiont", -0.85, 0.80, {"anger": 0.85, "fear": 0.8}, "strong", None),
        ("kínvallat", -0.95, 0.90, {"fear": 0.95, "sadness": 0.9}, "strong", None),
        ("kínoz", -0.90, 0.90, {"fear": 0.9, "sadness": 0.9}, "strong", None),
        ("megkínoz", -0.90, 0.90, {"fear": 0.9, "sadness": 0.9}, "strong", None),
        ("sanyargat", -0.80, 0.75, {"sadness": 0.8}, "strong", None),

        # Deadly & Catastrophic Violence (arousal 0.90 - 0.98, valence -0.90 to -0.98)
        ("öl", -0.90, 0.90, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("megöl", -0.90, 0.90, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("gyilkol", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("meggyilkol", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("kivégez", -0.90, 0.85, {"fear": 0.9}, "strong", None),
        ("lefejez", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("felkoncol", -0.95, 0.95, {"fear": 0.95, "anger": 0.95}, "strong", None),
        ("lemészárol", -0.95, 0.95, {"fear": 0.95, "anger": 0.95}, "strong", None),
        ("öldököl", -0.95, 0.95, {"fear": 0.95, "anger": 0.95}, "strong", None),
        ("elpusztít", -0.90, 0.90, {"anger": 0.9, "fear": 0.85}, "strong", None),
        ("megsemmisít", -0.95, 0.95, {"anger": 0.95, "fear": 0.95}, "strong", None),
        ("kiirt", -0.95, 0.95, {"fear": 0.95, "anger": 0.95}, "strong", None),
        ("marcangol", -0.90, 0.90, {"fear": 0.9, "disgust": 0.85}, "strong", None),
        ("szétmarcangol", -0.95, 0.95, {"fear": 0.95, "disgust": 0.9}, "strong", None),
        ("kizsigerel", -0.95, 0.95, {"disgust": 0.95, "fear": 0.95}, "strong", None),
        ("felnyársal", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("agyonver", -0.90, 0.90, {"anger": 0.9, "fear": 0.9}, "strong", None),
        ("agyonlő", -0.90, 0.90, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("megnyomorít", -0.90, 0.85, {"sadness": 0.9, "fear": 0.85}, "strong", None),
        ("csonkít", -0.90, 0.85, {"disgust": 0.9, "fear": 0.85}, "strong", None),
        ("megvakít", -0.85, 0.80, {"fear": 0.9}, "strong", None),
        ("kiszúr", -0.80, 0.80, {"anger": 0.8, "fear": 0.8}, "strong", None),
        ("robbant", -0.85, 0.90, {"fear": 0.9}, "strong", None),
        ("felrobbant", -0.85, 0.90, {"fear": 0.9}, "strong", None),
        ("rombol", -0.80, 0.80, {"anger": 0.8}, "strong", None),
        ("lerombol", -0.85, 0.85, {"anger": 0.85}, "strong", None),
        ("dúl", -0.80, 0.80, {"anger": 0.8}, "strong", None),
        ("pusztít", -0.85, 0.85, {"anger": 0.85}, "strong", None),
        ("kifoszt", -0.80, 0.75, {"anger": 0.8, "sadness": 0.75}, "strong", None),
        ("zsákmányol", -0.75, 0.70, {"anger": 0.75}, "strong", None),
        ("ostromol", -0.75, 0.80, {"fear": 0.8}, "strong", None),
        ("megrohamoz", -0.80, 0.85, {"fear": 0.85, "anger": 0.8}, "strong", None),
        ("támad", -0.75, 0.80, {"anger": 0.8, "fear": 0.75}, "strong", None),
        ("lerohan", -0.80, 0.85, {"fear": 0.85}, "strong", None),
        ("leigáz", -0.85, 0.80, {"anger": 0.85}, "strong", None),
        ("legyőz", -0.65, 0.75, {"anger": 0.7}, "strong", None),
        ("megmérgez", -0.90, 0.80, {"fear": 0.9, "disgust": 0.8}, "strong", None),
        ("leteper", -0.75, 0.80, {"anger": 0.8}, "strong", None),
        ("kardlapoz", -0.65, 0.70, {"anger": 0.7}, "strong", None),
        ("nyársal", -0.92, 0.92, {"fear": 0.9, "disgust": 0.85}, "strong", None),
        ("megnyársal", -0.92, 0.92, {"fear": 0.9, "disgust": 0.85}, "strong", None),
        ("karóz", -0.95, 0.94, {"fear": 0.95, "disgust": 0.9}, "strong", None),
        ("átdöf", -0.91, 0.91, {"fear": 0.9}, "strong", None),
        ("átszúr", -0.89, 0.86, {"fear": 0.85}, "strong", None),
        ("belédöf", -0.91, 0.89, {"fear": 0.9}, "strong", None),
        ("felkoncol", -0.96, 0.95, {"disgust": 0.9, "fear": 0.95}, "strong", None),
        ("lefejez", -0.95, 0.89, {"fear": 0.95, "disgust": 0.85}, "strong", None),
        ("kikapar", -0.78, 0.76, {"anger": 0.8}, "weak", "földet kikapar vs szemet kikapar"),
        ("szétzúz", -0.91, 0.91, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("szétroncsol", -0.92, 0.92, {"disgust": 0.9, "fear": 0.85}, "strong", None),
        ("széttép", -0.89, 0.89, {"fear": 0.9}, "strong", None),
        ("szétdarabol", -0.91, 0.87, {"disgust": 0.9}, "strong", None),
        ("szétmarcangol", -0.96, 0.96, {"fear": 0.95, "disgust": 0.9}, "strong", None),
        ("marcangol", -0.88, 0.88, {"fear": 0.9}, "strong", None),
        ("megfojt", -0.94, 0.91, {"fear": 0.95}, "strong", None),
        ("fojtogat", -0.86, 0.86, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("megfullad", -0.87, 0.87, {"fear": 0.9}, "strong", None),
        ("akaszt", -0.89, 0.81, {"fear": 0.9}, "weak", "ruhát akaszt vs embert akaszt"),
        ("felakaszt", -0.95, 0.91, {"fear": 0.95}, "strong", None),
        ("megkínoz", -0.96, 0.96, {"fear": 0.95, "sadness": 0.9}, "strong", None),
        ("kínoz", -0.89, 0.89, {"fear": 0.9, "sadness": 0.85}, "strong", None),
        ("gyötör", -0.84, 0.81, {"sadness": 0.85}, "strong", None),
        ("ostoroz", -0.79, 0.81, {"anger": 0.8}, "strong", None),
        ("korbácsol", -0.86, 0.86, {"anger": 0.85}, "strong", None),
        ("megkorbácsol", -0.86, 0.86, {"anger": 0.85}, "strong", None),
        ("megver", -0.76, 0.79, {"anger": 0.8}, "strong", None),
        ("elpáhol", -0.71, 0.74, {"anger": 0.75}, "strong", None),
        ("agyonver", -0.96, 0.96, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("agyonlő", -0.96, 0.96, {"fear": 0.95}, "strong", None),
        ("leterít", -0.74, 0.79, {"anger": 0.75}, "weak", "asztalt leterít vs vadat leterít"),
        ("lecsap", -0.76, 0.81, {"anger": 0.8}, "weak", "villám lecsap vs fegyverrel lecsap"),
        ("hasít", -0.74, 0.76, {"fear": 0.7}, "weak", "fát hasít vs karddal hasít"),
        ("kettéhasít", -0.86, 0.86, {"fear": 0.85}, "strong", None),
        ("felhasít", -0.81, 0.81, {"fear": 0.8}, "strong", None),
        ("kivégez", -0.96, 0.91, {"fear": 0.95}, "strong", None),
        ("megsebesít", -0.81, 0.81, {"fear": 0.8}, "strong", None),
        ("sebez", -0.76, 0.76, {"fear": 0.75}, "strong", None),
        ("vérzik", -0.71, 0.71, {"fear": 0.75}, "strong", None),
        ("elvérzik", -0.86, 0.81, {"fear": 0.85, "sadness": 0.8}, "strong", None),
        ("kiont", -0.91, 0.86, {"fear": 0.9}, "strong", None),
        ("megcsonkít", -0.91, 0.86, {"disgust": 0.9, "fear": 0.85}, "strong", None),
        ("csonkít", -0.86, 0.81, {"disgust": 0.85}, "strong", None),
        ("megvakít", -0.86, 0.86, {"fear": 0.9}, "strong", None),
        ("elgázol", -0.86, 0.86, {"fear": 0.9}, "strong", None),
        ("tapos", -0.71, 0.76, {"anger": 0.75}, "weak", "szőlőt tapos vs földön fekvőt tapos"),
        ("letipor", -0.86, 0.86, {"anger": 0.85}, "strong", None),
        ("agyoncsap", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("fejbever", -0.85, 0.85, {"anger": 0.85}, "strong", None),
        ("leüt", -0.75, 0.80, {"anger": 0.8}, "strong", None),
        ("kiváj", -0.85, 0.80, {"disgust": 0.85}, "strong", None),
        ("széttipor", -0.90, 0.90, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("széthasít", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("levág", -0.80, 0.80, {"fear": 0.8}, "weak", "fát levág vs embert levág"),
        ("nyakaz", -0.95, 0.90, {"fear": 0.95}, "strong", None),
        ("szétver", -0.85, 0.85, {"anger": 0.85}, "strong", None),
        ("szétmorzsol", -0.80, 0.80, {"anger": 0.8}, "strong", None),
        ("összezúz", -0.90, 0.90, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("összeroppant", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("felnyársal", -0.92, 0.92, {"fear": 0.9, "disgust": 0.85}, "strong", None),
        ("hátbaszúr", -0.95, 0.90, {"anger": 0.95, "fear": 0.9}, "strong", None),
        ("leszúr", -0.90, 0.90, {"fear": 0.9}, "strong", None),
        ("lemetél", -0.85, 0.85, {"disgust": 0.85}, "strong", None),
        ("kicsavar", -0.65, 0.70, {"anger": 0.7}, "weak", "ruhát kicsavar vs kezet kicsavar"),
        ("kitép", -0.75, 0.75, {"anger": 0.75}, "weak", "virágot kitép vs hajat kitép"),
        ("letaglóz", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("megbéklyóz", -0.75, 0.70, {"fear": 0.75}, "strong", None),
        ("bilincsel", -0.70, 0.70, {"fear": 0.7}, "strong", None),
        ("elgáncsol", -0.65, 0.65, {"anger": 0.7}, "strong", None),
        ("agyonüt", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("kinyír", -0.90, 0.90, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("megostromol", -0.80, 0.85, {"fear": 0.85}, "strong", None),
        ("csonkol", -0.85, 0.85, {"disgust": 0.85, "fear": 0.85}, "strong", None),
    ]

    for item in viol_list:
        term, val, aro, emos, strength, note = item
        lem = norm_lemma(term)
        eid = make_id("act", lem)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        entry = {
            "id": eid,
            "lemma": lem,
            "pos": ["VERB"],
            "kind": "action_violent",
            "strength": strength,
            "valence": val,
            "arousal": aro,
            "emotions": emos,
            "source": "curated:gemini-2026-09",
            "version": 1,
        }
        if note:
            entry["note"] = note
        violent_verbs.append(entry)

    with open(os.path.join(LEXICONS_DIR, "action_violent.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "action_violent", "version": 1, "entries": violent_verbs}, f, indent=1)
    print(f"HU action_violent: {len(violent_verbs)} entries")

    # -------------------------------------------------------------
    # 9. DANGER_NOUN (Target: 100+)
    # Individual per-entry valence / arousal across severity tiers
    # -------------------------------------------------------------
    danger_nouns = []
    danger_list = [
        # Environmental / low-moderate danger (arousal 0.30 - 0.55, valence -0.30 to -0.55)
        ("füst", -0.35, 0.30, {"fear": 0.4}, "weak", "kéményfüst vs fojtogató tűzvész"),
        ("hamu", -0.35, 0.30, {"sadness": 0.4}, "weak", "kandallóhamu vs leégett falu hamva"),
        ("rom", -0.45, 0.40, {"sadness": 0.5, "fear": 0.4}, "weak", "történelmi várrom vs friss romhalmaz"),
        ("romhalmaz", -0.55, 0.50, {"fear": 0.6, "sadness": 0.5}, "strong", None),
        ("szikla", -0.40, 0.35, {"fear": 0.4}, "weak", "sziklás táj vs zuhanásveszély"),
        ("szakadék", -0.60, 0.55, {"fear": 0.7}, "strong", None),
        ("örvény", -0.65, 0.60, {"fear": 0.7}, "strong", None),
        ("vihar", -0.60, 0.65, {"fear": 0.65}, "strong", None),
        ("fergeteg", -0.65, 0.70, {"fear": 0.7}, "strong", None),
        ("villám", -0.65, 0.75, {"fear": 0.75}, "strong", None),
        ("mennydörgés", -0.55, 0.65, {"fear": 0.65}, "strong", None),
        ("jégverés", -0.60, 0.60, {"fear": 0.6}, "strong", None),
        ("árvíz", -0.70, 0.70, {"fear": 0.75}, "strong", None),
        ("földrengés", -0.75, 0.75, {"fear": 0.8}, "strong", None),
        ("tűz", -0.65, 0.75, {"fear": 0.8}, "weak", "tábortűz vs pusztító tűzvész"),
        ("láng", -0.60, 0.70, {"fear": 0.7}, "weak", "gyertyaláng vs mindent emésztő lángok"),
        ("üszök", -0.65, 0.60, {"fear": 0.65}, "strong", None),

        # Weapons & direct threats (arousal 0.55 - 0.75, valence -0.60 to -0.75)
        ("kard", -0.65, 0.65, {"fear": 0.6, "anger": 0.6}, "strong", None),
        ("tőr", -0.70, 0.65, {"fear": 0.7, "anger": 0.6}, "strong", None),
        ("kés", -0.60, 0.55, {"fear": 0.6}, "weak", "konyhakés vs gyilkos fegyver"),
        ("dárda", -0.65, 0.65, {"fear": 0.65}, "strong", None),
        ("lándzsa", -0.65, 0.65, {"fear": 0.65}, "strong", None),
        ("nyíl", -0.55, 0.60, {"fear": 0.6}, "weak", "irányjelző nyíl vs mérgezett harci nyíl"),
        ("íj", -0.55, 0.60, {"fear": 0.6}, "strong", None),
        ("puska", -0.70, 0.65, {"fear": 0.7}, "strong", None),
        ("pisztoly", -0.70, 0.65, {"fear": 0.7}, "strong", None),
        ("ágyú", -0.75, 0.75, {"fear": 0.8}, "strong", None),
        ("golyó", -0.70, 0.70, {"fear": 0.75}, "weak", "üveggolyó vs puska golyó"),
        ("fegyver", -0.65, 0.65, {"fear": 0.7}, "strong", None),
        ("lőszer", -0.60, 0.65, {"fear": 0.65}, "strong", None),
        ("puskapor", -0.65, 0.65, {"fear": 0.65}, "strong", None),
        ("akna", -0.75, 0.75, {"fear": 0.8}, "strong", None),
        ("bomba", -0.85, 0.85, {"fear": 0.9}, "strong", None),
        ("bilincs", -0.70, 0.65, {"fear": 0.7}, "strong", None),
        ("béklyó", -0.70, 0.65, {"fear": 0.7}, "strong", None),
        ("börtön", -0.75, 0.65, {"fear": 0.75, "sadness": 0.7}, "strong", None),
        ("tömlöc", -0.75, 0.65, {"fear": 0.75, "sadness": 0.7}, "strong", None),
        ("méreg", -0.80, 0.75, {"fear": 0.8, "disgust": 0.7}, "strong", None),
        ("csapda", -0.65, 0.65, {"fear": 0.7}, "strong", None),
        ("rajtaütés", -0.75, 0.80, {"fear": 0.8}, "strong", None),
        ("támadás", -0.75, 0.80, {"anger": 0.8, "fear": 0.75}, "strong", None),

        # High danger, lethal entities, corpses, enemies (arousal 0.75 - 0.95, valence -0.75 to -0.95)
        ("hóhér", -0.85, 0.85, {"fear": 0.9}, "strong", None),
        ("akasztófa", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("bitófa", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("halál", -0.85, 0.85, {"fear": 0.85, "sadness": 0.85}, "strong", None),
        ("seb", -0.70, 0.65, {"fear": 0.7}, "strong", None),
        ("tetem", -0.80, 0.75, {"disgust": 0.8, "fear": 0.7}, "strong", None),
        ("hulla", -0.85, 0.80, {"disgust": 0.8, "fear": 0.75}, "strong", None),
        ("holttest", -0.80, 0.75, {"sadness": 0.8, "fear": 0.7}, "strong", None),
        ("koporsó", -0.75, 0.65, {"sadness": 0.8}, "strong", None),
        ("csontváz", -0.70, 0.65, {"fear": 0.7}, "strong", None),
        ("koponya", -0.70, 0.65, {"fear": 0.7}, "strong", None),
        ("dögvész", -0.90, 0.90, {"fear": 0.9, "disgust": 0.85}, "strong", None),
        ("pestis", -0.90, 0.90, {"fear": 0.9}, "strong", None),
        ("járvány", -0.80, 0.80, {"fear": 0.85}, "strong", None),
        ("vérfürdő", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("mészárlás", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("vérontás", -0.90, 0.90, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("gyilkos", -0.90, 0.85, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("orgyilkos", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("áruló", -0.80, 0.75, {"anger": 0.85, "disgust": 0.8}, "strong", None),
        ("ellenség", -0.75, 0.70, {"anger": 0.8, "fear": 0.7}, "strong", None),
        ("rabló", -0.70, 0.70, {"fear": 0.7}, "strong", None),
        ("martalóc", -0.75, 0.75, {"fear": 0.75}, "strong", None),
        ("haramia", -0.70, 0.70, {"fear": 0.7}, "strong", None),
        ("szörny", -0.80, 0.80, {"fear": 0.85}, "strong", None),
        ("fenevad", -0.80, 0.80, {"fear": 0.85}, "strong", None),
        ("ragadozó", -0.75, 0.75, {"fear": 0.8}, "strong", None),
        ("vipera", -0.75, 0.75, {"fear": 0.8}, "strong", None),
        ("ostrom", -0.75, 0.80, {"fear": 0.8}, "strong", None),
        ("csata", -0.75, 0.80, {"fear": 0.8, "anger": 0.75}, "strong", None),
        ("ütközet", -0.70, 0.75, {"fear": 0.75}, "strong", None),
        ("pusztulás", -0.85, 0.85, {"sadness": 0.85, "fear": 0.85}, "strong", None),
        ("veszedelem", -0.75, 0.75, {"fear": 0.8}, "strong", None),
        ("fogoly", -0.70, 0.65, {"sadness": 0.7, "fear": 0.7}, "strong", None),
        ("rab", -0.70, 0.65, {"sadness": 0.7, "fear": 0.7}, "strong", None),
        ("túsz", -0.75, 0.75, {"fear": 0.8}, "strong", None),
        ("rabszolga", -0.85, 0.75, {"sadness": 0.85, "fear": 0.8}, "strong", None),
        ("orgyilkos", -0.91, 0.86, {"fear": 0.9}, "strong", None),
        ("bérgyilkos", -0.91, 0.86, {"fear": 0.9}, "strong", None),
        ("orvlövész", -0.86, 0.81, {"fear": 0.85}, "strong", None),
        ("hóhér", -0.91, 0.86, {"fear": 0.9}, "strong", None),
        ("akasztófa", -0.91, 0.81, {"fear": 0.9, "sadness": 0.8}, "strong", None),
        ("vérpad", -0.96, 0.86, {"fear": 0.95}, "strong", None),
        ("kínzókamra", -0.96, 0.91, {"fear": 0.95}, "strong", None),
        ("börtön", -0.76, 0.66, {"sadness": 0.75, "fear": 0.7}, "strong", None),
        ("tömlöc", -0.81, 0.71, {"sadness": 0.8, "fear": 0.75}, "strong", None),
        ("vész", -0.81, 0.76, {"fear": 0.8}, "strong", None),
        ("csapás", -0.76, 0.76, {"sadness": 0.75, "fear": 0.7}, "weak", "fizikai ütés vs sorscsapás"),
        ("járvány", -0.86, 0.81, {"fear": 0.85}, "strong", None),
        ("pestis", -0.91, 0.81, {"fear": 0.9, "disgust": 0.8}, "strong", None),
        ("dögvész", -0.96, 0.86, {"fear": 0.95, "disgust": 0.85}, "strong", None),
        ("ínség", -0.81, 0.66, {"sadness": 0.8}, "strong", None),
        ("éhínség", -0.91, 0.76, {"sadness": 0.85, "fear": 0.8}, "strong", None),
        ("vihar", -0.66, 0.76, {"fear": 0.7}, "weak", "időjárási vihar vs érzelmi vihar"),
        ("villámcsapás", -0.81, 0.86, {"fear": 0.85}, "strong", None),
        ("áradás", -0.71, 0.76, {"fear": 0.75}, "weak", "folyó áradása vs levéláradat"),
        ("földrengés", -0.86, 0.86, {"fear": 0.9}, "strong", None),
        ("tűzvész", -0.86, 0.86, {"fear": 0.9}, "strong", None),
        ("lángtenger", -0.81, 0.86, {"fear": 0.85}, "strong", None),
        ("lőpor", -0.66, 0.66, {"fear": 0.65}, "strong", None),
        ("ágyúgolyó", -0.76, 0.81, {"fear": 0.8}, "strong", None),
        ("tőr", -0.76, 0.76, {"fear": 0.75}, "strong", None),
        ("pallos", -0.86, 0.81, {"fear": 0.85}, "strong", None),
        ("szurony", -0.80, 0.80, {"fear": 0.8}, "strong", None),
        ("parittya", -0.65, 0.70, {"fear": 0.65}, "strong", None),
        ("gránát", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("puskatűz", -0.80, 0.85, {"fear": 0.85}, "strong", None),
        ("golyózápor", -0.85, 0.90, {"fear": 0.9}, "strong", None),
        ("nyílzápor", -0.80, 0.85, {"fear": 0.85}, "strong", None),
        ("akna", -0.85, 0.85, {"fear": 0.85}, "weak", "szénbánya akna vs robbanóakna"),
        ("dárda", -0.75, 0.75, {"fear": 0.75}, "strong", None),
        ("lándzsa", -0.75, 0.75, {"fear": 0.75}, "strong", None),
        ("fokos", -0.70, 0.70, {"fear": 0.7}, "strong", None),
        ("szekerce", -0.70, 0.70, {"fear": 0.7}, "strong", None),
        ("bunkó", -0.70, 0.70, {"anger": 0.75}, "weak", "buta ember vs fa fegyver"),
    ]

    for term, val, aro, emos, strength, note in danger_list:
        lem = norm_lemma(term)
        eid = make_id("danger", lem)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        entry = {
            "id": eid,
            "lemma": lem,
            "pos": ["NOUN"],
            "kind": "danger_noun",
            "strength": strength,
            "valence": val,
            "arousal": aro,
            "emotions": emos,
            "source": "curated:gemini-2026-09",
            "version": 1,
        }
        if note:
            entry["note"] = note
        danger_nouns.append(entry)

    with open(os.path.join(LEXICONS_DIR, "danger_noun.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "danger_noun", "version": 1, "entries": danger_nouns}, f, indent=1)
    print(f"HU danger_noun: {len(danger_nouns)} entries")

    # -------------------------------------------------------------
    # 10. STAKES_WORD (Target: 50+)
    # Individual per-entry valence / arousal across severity tiers
    # -------------------------------------------------------------
    stakes_words = []
    stakes_list = [
        # Honor & social vows (arousal 0.40 - 0.55, valence -0.20 to +0.30)
        ("eskü", 0.20, 0.50, {"trust": 0.7}),
        ("fogadalom", 0.20, 0.50, {"trust": 0.7}),
        ("ígéret", 0.20, 0.40, {"trust": 0.6}),
        ("becsület", 0.30, 0.50, {"trust": 0.7}),
        ("hírnév", 0.10, 0.45, {"anticipation": 0.5}),
        ("ítélet", -0.30, 0.55, {"fear": 0.5}),
        ("végzés", -0.20, 0.55, {"anticipation": 0.5}),
        ("jóslat", 0.00, 0.50, {"anticipation": 0.6}),
        ("örökség", 0.15, 0.45, {"trust": 0.5}),

        # Kingdom / freedom / destiny (arousal 0.60 - 0.75, valence -0.40 to +0.50)
        ("szabadság", 0.50, 0.70, {"joy": 0.6}),
        ("függetlenség", 0.40, 0.65, {"joy": 0.5}),
        ("haza", 0.30, 0.60, {"trust": 0.6}),
        ("királyság", 0.10, 0.65, {"trust": 0.5}),
        ("trón", 0.00, 0.65, {"anticipation": 0.6}),
        ("korona", 0.10, 0.60, {"anticipation": 0.6}),
        ("hatalom", 0.00, 0.70, {"anticipation": 0.6}),
        ("uralom", 0.00, 0.65, {"anticipation": 0.5}),
        ("túlélés", -0.40, 0.75, {"fear": 0.7}),
        ("sors", -0.20, 0.65, {"anticipation": 0.6}),
        ("végzet", -0.40, 0.75, {"fear": 0.7}),
        ("elhivatottság", 0.30, 0.60, {"trust": 0.6}),
        ("megváltás", 0.60, 0.65, {"joy": 0.7}),
        ("szabadulás", 0.50, 0.65, {"joy": 0.6}),
        ("áldozat", -0.50, 0.70, {"sadness": 0.7}),
        ("vértanúság", -0.60, 0.75, {"sadness": 0.75}),
        ("száműzetés", -0.70, 0.70, {"sadness": 0.8}),
        ("rabság", -0.80, 0.75, {"sadness": 0.8, "fear": 0.75}),

        # Life / Death / Existential ruin (arousal 0.80 - 0.95, valence -0.80 to -0.95)
        ("halál", -0.85, 0.85, {"fear": 0.85, "sadness": 0.85}),
        ("halandó", -0.50, 0.65, {"fear": 0.5}),
        ("pusztulás", -0.90, 0.90, {"fear": 0.9}),
        ("megsemmisülés", -0.95, 0.95, {"fear": 0.95}),
        ("kárhozat", -0.90, 0.90, {"fear": 0.9}),
        ("átok", -0.75, 0.75, {"fear": 0.75}),
        ("büntetés", -0.65, 0.70, {"anger": 0.7}),
        ("örökkévalóság", 0.10, 0.65, {"anticipation": 0.5}),
        ("örök", 0.10, 0.65, {"anticipation": 0.5}),
        ("halhatatlan", 0.30, 0.65, {"trust": 0.6}),
        ("végítélet", -0.95, 0.95, {"fear": 0.95}),
        ("katasztrófa", -0.85, 0.85, {"fear": 0.85}),
        ("veszteség", -0.71, 0.71, {"sadness": 0.8}),
        ("bukás", -0.81, 0.76, {"sadness": 0.8, "fear": 0.7}),
        ("győzelem", 0.86, 0.81, {"joy": 0.85}),
        ("diadal", 0.91, 0.81, {"joy": 0.9}),
        ("összeomlás", -0.86, 0.86, {"fear": 0.85, "sadness": 0.8}),
        ("túlélés", 0.71, 0.76, {"trust": 0.7, "anticipation": 0.7}),
        ("áldozat", -0.66, 0.71, {"sadness": 0.75}),
        ("önfeláldozás", 0.61, 0.76, {"trust": 0.8}),
        ("szabadság", 0.86, 0.71, {"joy": 0.8, "trust": 0.8}),
        ("függetlenség", 0.76, 0.66, {"trust": 0.7}),
        ("jog", 0.41, 0.46, {"trust": 0.6}),
        ("igazság", 0.76, 0.61, {"trust": 0.8}),
        ("becsület", 0.81, 0.66, {"trust": 0.85}),
        ("gyalázat", -0.86, 0.76, {"disgust": 0.85, "sadness": 0.8}),
        ("szégyen", -0.76, 0.66, {"sadness": 0.8}),
        ("hűség", 0.81, 0.56, {"trust": 0.9}),
        ("hűtlenség", -0.81, 0.76, {"anger": 0.8, "sadness": 0.75}),
    ]

    for term, val, aro, emos in stakes_list:
        lem = norm_lemma(term)
        eid = make_id("stakes", lem)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        stakes_words.append({
            "id": eid,
            "lemma": lem,
            "kind": "stakes_word",
            "strength": "strong",
            "valence": val,
            "arousal": aro,
            "emotions": emos,
            "source": "curated:gemini-2026-09",
            "version": 1,
        })

    with open(os.path.join(LEXICONS_DIR, "stakes_word.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "stakes_word", "version": 1, "entries": stakes_words}, f, indent=1)
    print(f"HU stakes_word: {len(stakes_words)} entries")

    # -------------------------------------------------------------
    # 11. CALM_WORD (Target: 100+)
    # Individual per-entry valence / arousal across quiet tiers
    # -------------------------------------------------------------
    calm_words = []
    calm_list = [
        # Gentle sound & atmosphere (arousal 0.10 - 0.20, valence 0.40 - 0.60)
        ("suttogás", 0.45, 0.15, {"trust": 0.4}),
        ("szellő", 0.50, 0.15, {"joy": 0.4}),
        ("morajlás", 0.35, 0.15, None),
        ("alkony", 0.35, 0.12, None),
        ("alkonyat", 0.35, 0.12, None),
        ("csendesség", 0.50, 0.10, {"trust": 0.4}),
        ("mozdulatlanság", 0.40, 0.08, {"trust": 0.3}),
        ("nesztelenség", 0.45, 0.08, {"trust": 0.4}),
        ("szürkület", 0.30, 0.12, None),
        ("susogás", 0.40, 0.15, None),
        ("sóhajtás", 0.30, 0.15, None),

        # Deep serenity & rest (arousal 0.05 - 0.12, valence 0.70 - 0.90)
        ("béke", 0.85, 0.05, {"joy": 0.7, "trust": 0.8}),
        ("békesség", 0.85, 0.05, {"trust": 0.8}),
        ("nyugalom", 0.80, 0.05, {"trust": 0.8}),
        ("csend", 0.60, 0.06, {"trust": 0.5}),
        ("halkság", 0.50, 0.08, {"trust": 0.4}),
        ("megnyugvás", 0.80, 0.08, {"trust": 0.8}),
        ("pihenés", 0.70, 0.06, {"trust": 0.6}),
        ("pihenő", 0.65, 0.08, {"trust": 0.6}),
        ("alvás", 0.60, 0.05, None),
        ("álom", 0.60, 0.08, None),
        ("szundikálás", 0.55, 0.06, None),
        ("szendergés", 0.55, 0.06, None),
        ("enyhülés", 0.65, 0.10, {"trust": 0.6}),
        ("megbékélés", 0.75, 0.10, {"trust": 0.7}),
        ("derű", 0.70, 0.15, {"joy": 0.6}),
        ("szelídség", 0.70, 0.10, {"trust": 0.6}),
        ("lágyság", 0.60, 0.10, None),
        ("simaság", 0.55, 0.10, None),

        # Security & Sanctuary (arousal 0.15 - 0.25, valence 0.65 - 0.80)
        ("menedék", 0.75, 0.20, {"trust": 0.8}),
        ("menhely", 0.70, 0.20, {"trust": 0.7}),
        ("oltalom", 0.75, 0.18, {"trust": 0.8}),
        ("biztonság", 0.80, 0.15, {"trust": 0.8}),
        ("kikötő", 0.65, 0.18, {"trust": 0.7}),
        ("rév", 0.65, 0.18, {"trust": 0.7}),
        ("oázis", 0.80, 0.22, {"joy": 0.7, "trust": 0.7}),
        ("otthon", 0.80, 0.15, {"joy": 0.7, "trust": 0.8}),
        ("fészek", 0.65, 0.15, {"trust": 0.6}),
        ("odú", 0.55, 0.15, None),
        ("szentély", 0.75, 0.18, {"trust": 0.7}),
        ("védelem", 0.70, 0.20, {"trust": 0.7}),
        ("vigasztalat", 0.70, 0.15, {"trust": 0.6}),
        ("vigasztalás", 0.70, 0.15, {"trust": 0.6}),
        ("csendesség", 0.71, 0.05, None),
        ("békesség", 0.76, 0.08, {"trust": 0.8}),
        ("megbékélés", 0.76, 0.12, {"trust": 0.7}),
        ("nyugodtság", 0.71, 0.08, {"trust": 0.7}),
        ("háborítatlanság", 0.76, 0.06, {"trust": 0.7}),
        ("csendes", 0.66, 0.06, None),
        ("nyugodt", 0.71, 0.08, {"trust": 0.7}),
        ("békés", 0.76, 0.08, {"trust": 0.8}),
        ("zavartalan", 0.71, 0.06, {"trust": 0.7}),
        ("higgadt", 0.66, 0.10, {"trust": 0.7}),
        ("megnyugtató", 0.71, 0.10, {"trust": 0.7}),
        ("pihentető", 0.71, 0.08, {"joy": 0.5}),
        ("andalító", 0.66, 0.08, {"joy": 0.5}),
        ("altató", 0.61, 0.06, None),
        ("ringató", 0.66, 0.08, None),
        ("szelíd", 0.71, 0.10, {"trust": 0.6}),
        ("enyhe", 0.56, 0.10, None),
        ("kellemes", 0.71, 0.15, {"joy": 0.6}),
        ("békítő", 0.66, 0.12, {"trust": 0.6}),
        ("csillapító", 0.66, 0.10, {"trust": 0.6}),
        ("megnyugvás", 0.76, 0.08, {"trust": 0.7}),
        ("enyhülés", 0.71, 0.12, {"joy": 0.6}),
        ("csillapulás", 0.66, 0.10, None),
        ("elcsendesedés", 0.71, 0.06, None),
        ("pihenés", 0.71, 0.08, {"joy": 0.5}),
        ("pihenő", 0.66, 0.10, None),
        ("alvás", 0.61, 0.05, None),
        ("szundítás", 0.61, 0.06, None),
        ("szunyókálás", 0.61, 0.06, None),
        ("álom", 0.66, 0.08, None),
        ("álmodozás", 0.66, 0.12, {"joy": 0.5}),
        ("ábrándozás", 0.61, 0.12, None),
        ("bóbiskolás", 0.56, 0.06, None),
        ("heverészés", 0.61, 0.08, None),
        ("lustálkodás", 0.56, 0.08, None),
        ("leheveredés", 0.61, 0.08, None),
        ("elnyújtózás", 0.66, 0.08, None),
        ("nyújtózkodás", 0.61, 0.10, None),
        ("séta", 0.61, 0.12, {"joy": 0.5}),
        ("sétálgatás", 0.61, 0.10, None),
        ("andalongás", 0.66, 0.10, {"joy": 0.5}),
        ("kikötőhely", 0.66, 0.15, {"trust": 0.6}),
        ("szélcsend", 0.66, 0.06, None),
        ("naplemente", 0.71, 0.12, {"joy": 0.6}),
        ("napnyugta", 0.71, 0.12, {"joy": 0.6}),
        ("holdvilág", 0.66, 0.10, None),
        ("csillagfény", 0.71, 0.12, {"joy": 0.5}),
        ("pásztoróra", 0.76, 0.15, {"joy": 0.7}),
        ("idill", 0.81, 0.12, {"joy": 0.8}),
        ("harmónia", 0.81, 0.12, {"joy": 0.7, "trust": 0.8}),
        ("összhang", 0.76, 0.12, {"trust": 0.7}),
        ("egyetértés", 0.76, 0.15, {"trust": 0.8}),
        ("megbékél", 0.71, 0.12, {"trust": 0.7}),
        ("megnyugszik", 0.76, 0.10, {"trust": 0.7}),
        ("elcsendesedik", 0.71, 0.06, None),
        ("lecsillapodik", 0.71, 0.08, None),
        ("elpihen", 0.71, 0.06, None),
        ("megpihen", 0.71, 0.08, None),
        ("szundít", 0.61, 0.06, None),
        ("szendereg", 0.66, 0.06, None),
        ("álmodik", 0.61, 0.08, None),
        ("hallgatás", 0.60, 0.05, None),
        ("némultság", 0.55, 0.05, None),
        ("szótlan", 0.60, 0.06, None),
        ("szótlanság", 0.60, 0.06, None),
        ("nyugovás", 0.70, 0.06, {"trust": 0.7}),
        ("álomvilág", 0.65, 0.10, {"joy": 0.5}),
        ("pihenőhely", 0.70, 0.08, None),
        ("menedékhely", 0.75, 0.15, {"trust": 0.8}),
        ("hálókamra", 0.65, 0.08, None),
        ("kandalló", 0.70, 0.12, {"joy": 0.6}),
    ]

    for term, val, aro, emos in calm_list:
        lem = norm_lemma(term)
        eid = make_id("calm", lem)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        calm_words.append({
            "id": eid,
            "lemma": lem,
            "kind": "calm_word",
            "strength": "strong" if lem not in ("alkony", "szürkület", "lágyság", "simaság") else "weak",
            "valence": val,
            "arousal": aro,
            "emotions": emos,
            "source": "curated:gemini-2026-09",
            "version": 1,
        })

    with open(os.path.join(LEXICONS_DIR, "calm_word.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "calm_word", "version": 1, "entries": calm_words}, f, indent=1)
    print(f"HU calm_word: {len(calm_words)} entries")

    # -------------------------------------------------------------
    # 12. CONFLICT_SPEECH (Target: 40+)
    # Migrated from SPEECH_VERBS_HU (14 verbs) + expanded conflict verbs
    # -------------------------------------------------------------
    speech_verbs = []
    # The 14 verbs from H.SPEECH_VERBS_HU, plus üvölt/sóhajt, which were not in it
    # and so are tagged curated (the "migrated:" tag must reproduce the old list exactly).
    not_migrated_speech = {"üvölt", "sóhajt"}
    migrated_speech = [
        ("mond", 0.0, 0.20, None, "weak", "semleges párbeszédjelölő"),
        ("szól", 0.0, 0.25, None, "weak", "semleges megszólalás"),
        ("kérdez", 0.05, 0.30, {"anticipation": 0.3}, "weak", "semleges kérdés"),
        ("suttog", 0.20, 0.15, None, "weak", "halk beszédmód"),
        ("kiált", -0.60, 0.75, {"anger": 0.6}, "strong", None),
        ("ordít", -0.75, 0.85, {"anger": 0.85}, "strong", None),
        ("üvölt", -0.80, 0.85, {"anger": 0.85}, "strong", None),
        ("morog", -0.65, 0.65, {"anger": 0.7}, "strong", None),
        ("mormol", 0.05, 0.20, None, "weak", "halk mormolás"),
        ("felel", 0.0, 0.25, None, "weak", "semleges válasz"),
        ("válaszol", 0.0, 0.25, None, "weak", "semleges válasz"),
        ("gondol", 0.0, 0.20, None, "weak", "belső monológ"),
        ("sóhajt", -0.2, 0.25, {"sadness": 0.4}, "weak", "sóhajtás"),
        ("könyörög", -0.6, 0.70, {"fear": 0.6, "sadness": 0.6}, "strong", None),
        ("tűnődik", 0.05, 0.25, {"anticipation": 0.3}, "weak", "belső tűnődés"),
        ("töpreng", 0.0, 0.30, {"anticipation": 0.3}, "weak", "töprengés"),
    ]

    for term, val, aro, emos, strength, note in migrated_speech:
        lem = norm_lemma(term)
        eid = make_id("speech", lem)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        entry = {
            "id": eid,
            "lemma": lem,
            "pos": ["VERB"],
            "kind": "conflict_speech",
            "strength": strength,
            "valence": val,
            "arousal": aro,
            "emotions": emos,
            "source": "curated:gemini-2026-09" if term in not_migrated_speech else "migrated:hun_janitor.py",
            "version": 1,
        }
        if note:
            entry["note"] = note
        speech_verbs.append(entry)

    extra_speech = [
        ("követel", -0.45, 0.55, {"anger": 0.5}),
        ("vitatkozik", -0.50, 0.55, {"anger": 0.55}),
        ("gúnyolódik", -0.65, 0.65, {"disgust": 0.7, "anger": 0.5}),
        ("förmed", -0.70, 0.75, {"anger": 0.75}),
        ("ráripakodik", -0.70, 0.75, {"anger": 0.75}),
        ("rákiált", -0.65, 0.75, {"anger": 0.7}),
        ("rámordul", -0.65, 0.70, {"anger": 0.7}),
        ("visít", -0.75, 0.80, {"fear": 0.75, "anger": 0.7}),
        ("sikolt", -0.80, 0.85, {"fear": 0.85}),
        ("rikolt", -0.65, 0.75, {"anger": 0.65}),
        ("kurjant", 0.10, 0.65, {"surprise": 0.6}),
        ("horkan", -0.50, 0.55, {"anger": 0.55}),
        ("sziszeg", -0.65, 0.65, {"anger": 0.7}),
        ("morran", -0.60, 0.65, {"anger": 0.65}),
        ("dörög", -0.75, 0.80, {"anger": 0.8}),
        ("fenyegetőzik", -0.75, 0.75, {"anger": 0.75, "fear": 0.7}),
        ("kötekedik", -0.55, 0.55, {"anger": 0.6}),
        ("csúfolkodik", -0.60, 0.60, {"disgust": 0.6}),
        ("dorgál", -0.50, 0.55, {"anger": 0.55}),
        ("leteremt", -0.70, 0.70, {"anger": 0.75}),
        ("korhol", -0.55, 0.55, {"anger": 0.6}),
        ("átkozódik", -0.80, 0.80, {"anger": 0.85}),
        ("káromkodik", -0.75, 0.75, {"anger": 0.8}),
        ("háborgat", -0.60, 0.60, {"anger": 0.65}),
    ]

    for term, val, aro, emos in extra_speech:
        lem = norm_lemma(term)
        eid = make_id("speech", lem)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        speech_verbs.append({
            "id": eid,
            "lemma": lem,
            "pos": ["VERB"],
            "kind": "conflict_speech",
            "strength": "strong",
            "valence": val,
            "arousal": aro,
            "emotions": emos,
            "source": "curated:gemini-2026-09",
            "version": 1,
        })

    with open(os.path.join(LEXICONS_DIR, "conflict_speech.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "conflict_speech", "version": 1, "entries": speech_verbs}, f, indent=1)
    print(f"HU conflict_speech: {len(speech_verbs)} entries")

    # -------------------------------------------------------------
    # 13. INTENSIFIER (Target: 25+)
    # -------------------------------------------------------------
    intensifiers = []
    intens_data = [
        ("nagyon", 1.4), ("rendkívül", 1.6), ("igen", 1.3), ("felettébb", 1.5), ("túlságosan", 1.5),
        ("végtelenül", 1.7), ("teljesen", 1.6), ("egészen", 1.4), ("abszolút", 1.7), ("kimondhatatlanul", 1.7),
        ("leírhatatlanul", 1.7), ("rettenetesen", 1.6), ("szörnyen", 1.6), ("irtózatosan", 1.6),
        ("borzasztóan", 1.6), ("csodálatosan", 1.5), ("roppantul", 1.5), ("szerfelett", 1.5),
        ("igencsak", 1.4), ("alaposan", 1.4), ("teljességgel", 1.6), ("mélységesen", 1.5),
        ("határtalanul", 1.7), ("elmondhatatlanul", 1.7), ("fölöttébb", 1.5), ("némiképp", 1.2)
    ]
    for term, factor in intens_data:
        lem = norm_lemma(term)
        eid = make_id("intens", lem)
        all_created_ids.add(eid)
        intensifiers.append({
            "id": eid,
            "lemma": lem,
            "kind": "intensifier",
            "strength": "strong",
            "factor": factor,
            "source": "curated:gemini-2026-09",
            "version": 1,
        })
    with open(os.path.join(LEXICONS_DIR, "intensifier.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "intensifier", "version": 1, "entries": intensifiers}, f, indent=1)
    print(f"HU intensifier: {len(intensifiers)} entries")

    # -------------------------------------------------------------
    # 14. DIMINISHER (Target: 15+)
    # -------------------------------------------------------------
    diminishers = []
    dimin_data = [
        ("kissé", 0.7), ("némileg", 0.7), ("valamelyest", 0.7), ("alig", 0.4), ("aligha", 0.4),
        ("elenyészően", 0.3), ("parányit", 0.5), ("csekély", 0.6), ("csöppet", 0.5), ("aprócska", 0.6),
        ("kicsit", 0.7), ("egy kicsit", 0.7), ("egy kissé", 0.7), ("némiképpen", 0.7), ("félve", 0.6), ("részben", 0.6)
    ]
    for term, factor in dimin_data:
        if " " in term:
            phrase = [norm_lemma(w) for w in term.split()]
            eid = make_id("dimin", "_".join(phrase))
            diminishers.append({
                "id": eid,
                "phrase": phrase,
                "kind": "diminisher",
                "strength": "strong",
                "factor": factor,
                "source": "curated:gemini-2026-09",
                "version": 1,
            })
        else:
            lem = norm_lemma(term)
            eid = make_id("dimin", lem)
            diminishers.append({
                "id": eid,
                "lemma": lem,
                "kind": "diminisher",
                "strength": "strong",
                "factor": factor,
                "source": "curated:gemini-2026-09",
                "version": 1,
            })
    with open(os.path.join(LEXICONS_DIR, "diminisher.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "diminisher", "version": 1, "entries": diminishers}, f, indent=1)
    print(f"HU diminisher: {len(diminishers)} entries")

    # -------------------------------------------------------------
    # 15. NEGATOR (Target: 8+)
    # -------------------------------------------------------------
    negators = []
    neg_data = ["nem", "sem", "se", "soha", "sehogy", "sehol", "semmi", "senki", "semmiképp", "sehogyan"]
    for term in neg_data:
        lem = norm_lemma(term)
        eid = make_id("neg", lem)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        negators.append({
            "id": eid,
            "lemma": lem,
            "kind": "negator",
            "strength": "strong",
            "factor": -1.0,
            "source": "curated:gemini-2026-09",
            "version": 1,
        })
    with open(os.path.join(LEXICONS_DIR, "negator.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "negator", "version": 1, "entries": negators}, f, indent=1)
    print(f"HU negator: {len(negators)} entries")

    # -------------------------------------------------------------
    # 16. HEDGE (Target: 15+)
    # -------------------------------------------------------------
    hedges = []
    hedge_data = [
        "talán", "esetleg", "valószínűleg", "feltehetően", "állítólag", "úgy tűnik",
        "látszólag", "mintha", "mintegy", "körülbelül", "meglehet", "többé-kevésbé",
        "valamelyest", "szinte", "majdnem", "úgyszólván", "mondhatni"
    ]
    for term in hedge_data:
        if " " in term:
            phrase = [norm_lemma(w) for w in term.split()]
            eid = make_id("hedge", "_".join(phrase))
            hedges.append({
                "id": eid,
                "phrase": phrase,
                "kind": "hedge",
                "strength": "weak",
                "factor": 0.6,
                "source": "curated:gemini-2026-09",
                "version": 1,
            })
        else:
            lem = norm_lemma(term)
            eid = make_id("hedge", lem)
            hedges.append({
                "id": eid,
                "lemma": lem,
                "kind": "hedge",
                "strength": "weak",
                "factor": 0.6,
                "source": "curated:gemini-2026-09",
                "version": 1,
            })
    with open(os.path.join(LEXICONS_DIR, "hedge.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "hedge", "version": 1, "entries": hedges}, f, indent=1)
    print(f"HU hedge: {len(hedges)} entries")

    # -------------------------------------------------------------
    # 17. SENSORY (Target: 300+ across all 5 senses)
    # Default: valence 0.0, arousal 0.1, emotions None
    # -------------------------------------------------------------
    sensory = []
    valenced_hu_sensory = {
        "bűz": (-0.6, 0.5, {"disgust": 0.8}),
        "büdös": (-0.6, 0.5, {"disgust": 0.8}),
        "bűzlik": (-0.6, 0.5, {"disgust": 0.8}),
        "bűzös": (-0.65, 0.5, {"disgust": 0.85}),
        "rothadás": (-0.7, 0.6, {"disgust": 0.9}),
        "poshadt": (-0.6, 0.5, {"disgust": 0.8}),
        "orrfacsaró": (-0.7, 0.6, {"disgust": 0.85}),
        "illatos": (0.6, 0.3, {"joy": 0.6}),
        "jóillatú": (0.6, 0.3, {"joy": 0.6}),
        "finom": (0.7, 0.4, {"joy": 0.7}),
        "ízletes": (0.7, 0.4, {"joy": 0.7}),
        "zamatos": (0.6, 0.3, {"joy": 0.6}),
        "ínycsiklandó": (0.7, 0.5, {"joy": 0.7}),
        "romlott": (-0.7, 0.5, {"disgust": 0.85}),
        "avas": (-0.6, 0.5, {"disgust": 0.8}),
        "rosszízű": (-0.6, 0.4, {"disgust": 0.7}),
    }

    hu_senses = {
        "sight": [
            "lát", "néz", "pillant", "szemlél", "megfigyel", "fény", "sötét", "szín", "ragyog", "csillog",
            "villog", "halvány", "látható", "homályos", "bámul", "megpillant", "vakít", "szikrázik",
            "piros", "vörös", "kék", "zöld", "sárga", "fehér", "fekete", "szürke", "barna", "lila",
            "rózsaszín", "arany", "ezüst", "ragyogás", "csillogás", "villanás", "fényes", "sötétség", "homály",
            "köd", "pára", "füst", "árnyék", "árnykép", "sziluett", "világos", "világosság", "ragyogó",
            "tündöklő", "káprázatos", "vakító", "fakó", "sápadt", "színtelen", "tiszta", "átlátszó", "opálos",
            "fénytelen", "izzó", "lobogó", "parázsló", "villanó", "tükröződő", "áttetsző",
            "dereng", "csillámlik", "fényesség", "derengés", "fénysugár", "árnyékos", "szikrázó"
        ],
        "sound": [
            "hall", "figyel", "hang", "csendes", "csend", "zaj", "zúg", "zörög", "döng", "suttog",
            "kiált", "mormol", "morog", "ordít", "csörög", "kopog", "robaj", "mennydörög", "csikorg", "füttyent",
            "kattant", "süvít", "kiáltás", "üvöltés", "suttogás", "moraj", "zúgás", "zörej", "csörömpölés", "kattogás",
            "dobogás", "kopogtatás", "ropogás", "recsegés", "zizegés", "susogás", "morajlás", "dörgés", "csattanás", "durranás",
            "puffanás", "pendülés", "csendülés", "zengés", "bongás", "kongás", "búgás", "vijjogás", "sípolás", "fütyülés",
            "visítás", "sikoly", "sikoltás", "rikoltás", "kurjantás", "horkanás", "horkolás", "szuszogás", "lihegés", "liheg",
            "suhogás", "csörrenés", "zörrenés", "halkság"
        ],
        "smell": [
            "szagol", "illat", "bűz", "büdös", "aroma", "dohos", "füstös", "szagú", "bűzlik", "parfüm",
            "szaglás", "szimatol", "illatos", "jóillatú", "virágillat", "fűszeres", "fanyar", "doh", "rothadás", "poshadt",
            "bűzös", "szagos", "orrfacsaró", "fojtogató", "égett", "kénkőszag", "pórszag", "izzadságszag", "parfümillat", "tömjénillat",
            "gyantaillat", "fenyőillat", "szénaszag", "földszag", "ózon", "ecetszag", "petróleumszag", "lőporszag", "dohányszag", "pálinkaszag",
            "kesernyés", "savanykás", "avítt", "penészes", "poshadás", "bűzölgő", "illatozó", "szagolgat", "szimat",
            "párolgás", "lehelet", "szellőillat", "fűszerillat", "füstszag", "égésszag", "szagtalanság"
        ],
        "touch": [
            "érint", "simít", "simogat", "kemény", "puha", "hideg", "meleg", "sima", "durva", "nyirkos",
            "száraz", "ragacsos", "selymes", "szorít", "dörzsöl", "bizserg", "zsibbad", "remeg", "reszket", "tapint",
            "tapintás", "érintés", "forró", "tüzes", "égető", "jeges", "fagyos", "dermesztő", "langyos", "hűvös",
            "érdes", "göcsörtös", "rücskös", "szúrós", "hegyes", "éles", "tompa", "bársonyos", "bolyhos", "szőrös",
            "kopasz", "csúszós", "ingoványos", "sáros", "nedves", "ázott", "izzadt", "verejtékes", "zsíros", "olajos",
            "tapadós", "merev", "rugalmas", "hajlékony", "tömör", "laza", "süppedős", "karcol", "csíp", "éget",
            "érintetlen", "selymesség", "bársonyosság", "simaság", "keménység", "puhaság", "fagyosság"
        ],
        "taste": [
            "ízlik", "ízlel", "keserű", "édes", "savanyú", "sós", "ízletes", "nyel", "harap", "rág",
            "nyalint", "kortyol", "zamatos", "fanyar", "csípős", "émelygős", "íz", "zamat", "finom", "rosszízű",
            "mézédes", "cukros", "ecetes", "sótlan", "fűszeres", "borsos", "paprikás", "mustáros", "tormás", "kesernyés",
            "savanykás", "édeskés", "mézgás", "lédús", "száraz", "rágós", "omlós", "ropogós", "zsíros", "vajas",
            "olajos", "főtt", "sült", "nyers", "romlott", "avas", "poshadt", "ínycsiklandó", "falat", "harapás", "korty",
            "édesség", "savanyúság", "sósság", "keserűség", "zamata", "ízetlen", "ízes", "édesszájú", "mézes"
        ],
    }

    for sense_name, words in hu_senses.items():
        for term in words:
            lem = norm_lemma(term)
            eid = make_id("sens", f"{sense_name}_{lem}")
            if eid in all_created_ids:
                continue
            all_created_ids.add(eid)
            val, aro, emos = valenced_hu_sensory.get(lem, (0.0, 0.1, None))
            sensory.append({
                "id": eid,
                "lemma": lem,
                "kind": "sensory",
                "sense": sense_name,
                "strength": "weak" if lem in ("lát", "hall", "érez", "érint", "szagol", "ízlel", "néz") else "strong",
                "valence": val,
                "arousal": aro,
                "emotions": emos,
                "source": "migrated:hun_janitor.py" if any(term.startswith(s) for s in H.HU_SENSES_STEMS.get(sense_name, ())) else "curated:gemini-2026-09",
                "version": 1,
            })

    with open(os.path.join(LEXICONS_DIR, "sensory.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "sensory", "version": 1, "entries": sensory}, f, indent=1)
    print(f"HU sensory: {len(sensory)} entries")

    # -------------------------------------------------------------
    # 18. IDIOM (Target: 40+)
    # -------------------------------------------------------------
    idioms = []
    lat_id = make_id("sens", "sight_lát")
    hall_id = make_id("sens", "sound_hall")
    hideg_id = make_id("sens", "touch_hideg")
    meleg_id = make_id("sens", "touch_meleg")
    ver_id = make_id("danger", "vér")
    tuz_id = make_id("danger", "tűz")
    kard_id = make_id("danger", "kard")

    hu_idiom_specs = [
        (["hideg", "vérrel"], [hideg_id, ver_id]),
        (["meleg", "szívvel"], [meleg_id]),
        (["rossz", "vér"], [ver_id]),
        (["vérre", "szomjazik"], [ver_id]),
        (["tűzbe", "teszi", "a", "kezét"], [tuz_id]),
        (["játszik", "a", "tűzzel"], [tuz_id]),
        (["tűzön", "vízen", "át"], [tuz_id]),
        (["tűzbe", "jön"], [tuz_id]),
        (["kardélre", "hány"], [kard_id]),
        (["kardot", "ránt"], [kard_id]),
        (["szemet", "huny"], [lat_id]),
        (["szemet", "szúr"], [lat_id]),
        (["szemmel", "tart"], [lat_id]),
        (["szembe", "néz"], [lat_id]),
        (["füle", "botját", "se", "mozgatja"], [hall_id]),
        (["fülébe", "jut"], [hall_id]),
        (["fülét", "hegyezi"], [hall_id]),
        (["orrára", "koppint"], [make_id("sens", "smell_szagol")]),
        (["orrát", "fricskázza"], [make_id("sens", "smell_szagol")]),
        (["fogát", "fehéríti"], [make_id("sens", "taste_harap")]),
        (["fogát", "csikorgatja"], [make_id("sens", "sound_csikorg")]),
        (["nyakába", "vesz"], [make_id("act", "tör")]),
        (["lábát", "lógatja"], [make_id("calm", "pihenés")]),
        (["kezét", "mossa"], [make_id("calm", "béke")]),
        (["szívére", "vesz"], [make_id("emo", "bánatos")]),
        (["kő", "esik", "le", "a", "szívéről"], [make_id("calm", "megnyugvás")]),
        (["megköti", "az", "ebet", "a", "karóhoz"], [make_id("danger", "karó")]),
        (["egy", "húron", "pendülnek"], [make_id("calm", "béke")]),
        (["sírva", "vigad"], [make_id("emo", "szomorú")]),
        (["kiteszi", "a", "szűrét"], [make_id("act", "támad")]),
        (["hátat", "fordít"], [lat_id]),
        (["fejét", "veszíti"], [lat_id]),
        (["szemtől", "szembe"], [lat_id]),
        (["látja", "a", "fától", "az", "erdőt"], [lat_id]),
        (["szót", "ért"], [make_id("speech", "mond")]),
        (["szavát", "állja"], [make_id("speech", "mond")]),
        (["szót", "fogad"], [make_id("speech", "mond")]),
        (["szájára", "vesz"], [make_id("speech", "mond")]),
        (["tartja", "a", "hátát"], [make_id("act", "üt")]),
        (["nyomába", "ered"], [make_id("act", "üldöz")]),
        (["fészket", "rak"], [make_id("calm", "fészek")]),
        (["békét", "köt"], [make_id("calm", "béke")]),
        (["álomba", "merül"], [make_id("calm", "álom")]),
        (["életét", "adja"], [make_id("stakes", "élet")]),
    ]

    for phrase, blocks in hu_idiom_specs:
        norm_phrase = [norm_lemma(w) for w in phrase]
        eid = make_id("idiom", "_".join(norm_phrase))
        valid_blocks = [b for b in blocks if b in all_created_ids]
        if not valid_blocks:
            valid_blocks = [lat_id]
        idioms.append({
            "id": eid,
            "phrase": norm_phrase,
            "kind": "idiom",
            "strength": "strong",
            "blocks": valid_blocks,
            "source": "curated:gemini-2026-09",
            "version": 1,
        })

    with open(os.path.join(LEXICONS_DIR, "idiom.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "hu", "kind": "idiom", "version": 1, "entries": idioms}, f, indent=1)
    print(f"HU idiom: {len(idioms)} entries")

    print("\nHungarian lexicons built successfully.")


if __name__ == "__main__":
    build_hu_lexicons()
