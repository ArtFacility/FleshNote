"""Build English lexicons for FleshNote (Task C).

Covers all 18 kinds with migrated constants from routes/janitor.py
plus expanded literary vocabulary meeting/exceeding all targets.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, ".."))
LEXICONS_DIR = os.path.join(BACKEND, "lexicons", "en")
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from nlp_manager import get_nlp  # noqa: E402
from routes import janitor as J  # noqa: E402

nlp = get_nlp("en")


def norm_lemma(w: str) -> str:
    doc = nlp(w)
    return doc[0].lemma_.lower() if len(doc) == 1 else w.lower()


def make_id(kind_short: str, term: str) -> str:
    clean_term = re.sub(r"[^a-z0-9_]+", "_", term.lower().strip()).strip("_")
    return f"en.{kind_short}.{clean_term}"


def build_en_lexicons():
    os.makedirs(LEXICONS_DIR, exist_ok=True)
    all_created_ids = set()

    # -------------------------------------------------------------
    # 1. EMOTION_LABEL (Target: 250+)
    # -------------------------------------------------------------
    emo_labels = []

    # Migrated from EMOTION_LEXICON_EN (40 items) - exact hand-curated tuples
    # Dictionary lemmas preserved; spaCy isolated verb lemmas placed in alt_lemmas
    MIGRATED_EMO_LABELS_EN = [
        ("angry", "angry", [], ["ADJ"], -0.8, 0.8, {"anger": 0.9}, "strong", None),
        ("sad", "sad", [], ["ADJ"], -0.8, 0.35, {"sadness": 0.85}, "strong", None),
        ("happy", "happy", [], ["ADJ"], 0.85, 0.65, {"joy": 0.9}, "strong", None),
        ("afraid", "afraid", [], ["ADJ"], -0.75, 0.75, {"fear": 0.85}, "strong", None),
        ("scared", "scared", ["scare", "scar"], ["ADJ"], -0.8, 0.8, {"fear": 0.85}, "strong", None),
        ("anxious", "anxious", [], ["ADJ"], -0.65, 0.7, {"fear": 0.75, "anticipation": 0.4}, "strong", None),
        ("nervous", "nervous", [], ["ADJ"], -0.55, 0.6, {"fear": 0.7}, "strong", None),
        ("furious", "furious", [], ["ADJ"], -0.9, 0.95, {"anger": 0.95}, "strong", None),
        ("jealous", "jealous", [], ["ADJ"], -0.7, 0.65, {"disgust": 0.7, "anger": 0.6}, "strong", None),
        ("excited", "excited", ["excite"], ["ADJ"], 0.75, 0.85, {"anticipation": 0.8, "joy": 0.7}, "strong", None),
        ("depressed", "depressed", ["depress"], ["ADJ"], -0.85, 0.2, {"sadness": 0.9}, "strong", None),
        ("miserable", "miserable", [], ["ADJ"], -0.8, 0.35, {"sadness": 0.85}, "strong", None),
        ("terrified", "terrified", ["terrify"], ["ADJ"], -0.9, 0.95, {"fear": 0.95}, "strong", None),
        ("embarrassed", "embarrassed", ["embarrass"], ["ADJ"], -0.6, 0.6, {"fear": 0.5, "sadness": 0.5}, "strong", None),
        ("ashamed", "ashamed", ["ashame"], ["ADJ"], -0.75, 0.5, {"sadness": 0.7, "disgust": 0.6}, "strong", None),
        ("frustrated", "frustrated", ["frustrate"], ["ADJ"], -0.7, 0.7, {"anger": 0.8}, "strong", None),
        ("annoyed", "annoyed", ["annoy"], ["ADJ"], -0.5, 0.5, {"anger": 0.6}, "strong", None),
        ("irritated", "irritated", ["irritate"], ["ADJ"], -0.6, 0.6, {"anger": 0.7}, "strong", None),
        ("disgusted", "disgusted", ["disgust"], ["ADJ"], -0.85, 0.7, {"disgust": 0.9}, "strong", None),
        ("lonely", "lonely", [], ["ADJ"], -0.7, 0.3, {"sadness": 0.8}, "strong", None),
        ("desperate", "desperate", [], ["ADJ"], -0.8, 0.8, {"fear": 0.7, "sadness": 0.7}, "strong", None),
        ("hopeful", "hopeful", [], ["ADJ"], 0.7, 0.5, {"anticipation": 0.8, "joy": 0.6}, "strong", None),
        ("relieved", "relieved", ["relieve"], ["ADJ"], 0.65, 0.4, {"joy": 0.75}, "strong", None),
        ("proud", "proud", [], ["ADJ"], 0.7, 0.6, {"joy": 0.7, "trust": 0.6}, "strong", None),
        ("heartbroken", "heartbroken", [], ["ADJ"], -0.9, 0.5, {"sadness": 0.95}, "strong", None),
        ("devastated", "devastated", ["devastate"], ["ADJ"], -0.9, 0.7, {"sadness": 0.95}, "strong", None),
        ("elated", "elated", ["elate"], ["ADJ"], 0.9, 0.85, {"joy": 0.95}, "strong", None),
        ("content", "content", [], ["ADJ"], 0.6, 0.2, {"joy": 0.6}, "weak", "non-emotional: table of contents, content of container; emotional needs predicative/manner reading"),
        ("resentful", "resentful", [], ["ADJ"], -0.7, 0.6, {"anger": 0.8}, "strong", None),
        ("bitter", "bitter", [], ["ADJ"], -0.65, 0.55, {"anger": 0.7, "disgust": 0.5}, "weak", "taste (bitter herbs) vs emotional resentment"),
        ("gloomy", "gloomy", [], ["ADJ"], -0.6, 0.3, {"sadness": 0.7}, "weak", "lighting/weather (gloomy sky) vs emotional mood"),
        ("ecstatic", "ecstatic", [], ["ADJ"], 0.95, 0.95, {"joy": 0.95}, "strong", None),
        ("remorseful", "remorseful", [], ["ADJ"], -0.7, 0.45, {"sadness": 0.8}, "strong", None),
        ("surprised", "surprised", ["surprise"], ["ADJ"], 0.2, 0.7, {"surprise": 0.85}, "strong", None),
        ("guilty", "guilty", [], ["ADJ"], -0.7, 0.5, {"sadness": 0.75}, "strong", None),
        ("worried", "worried", ["worry"], ["ADJ"], -0.65, 0.65, {"fear": 0.75}, "strong", None),
        ("upset", "upset", [], ["ADJ"], -0.65, 0.65, {"sadness": 0.7, "anger": 0.5}, "weak", "physical overturn (upset the cart) vs emotional distress"),
        ("confused", "confused", ["confuse"], ["ADJ"], -0.4, 0.5, {"surprise": 0.6, "fear": 0.4}, "strong", None),
        ("shocked", "shocked", ["shock"], ["ADJ"], -0.6, 0.85, {"surprise": 0.8, "fear": 0.7}, "strong", None),
        ("horrified", "horrified", ["horrify"], ["ADJ"], -0.9, 0.85, {"fear": 0.9, "disgust": 0.7}, "strong", None),
    ]

    for orig_word, lem, alts, pos, val, aro, emos, strength, note in MIGRATED_EMO_LABELS_EN:
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
            "source": "migrated:janitor.py",
            "version": 1,
        }
        if alts:
            entry["alt_lemmas"] = alts
            entry["lemma_evidence"] = "carrier"
        if note:
            entry["note"] = note
        emo_labels.append(entry)

    # Expanded adjectives / participles with proper sign rules and weak notes
    extra_emo_labels = [
        ("astonished", ["astound"], "surprise", 0.3, 0.8, "strong", None),
        ("enraged", ["enrage"], "anger", -0.9, 0.9, "strong", None),
        ("indignant", [], "anger", -0.7, 0.7, "strong", None),
        ("appalled", ["appall"], "disgust", -0.8, 0.8, "strong", None),
        ("disheartened", ["dishearten"], "sadness", -0.6, 0.4, "strong", None),
        ("dismayed", ["dismay"], "fear", -0.6, 0.6, "strong", None),
        ("exasperated", ["exasperate"], "anger", -0.6, 0.7, "strong", None),
        ("frightened", ["frighten"], "fear", -0.7, 0.8, "strong", None),
        ("aghast", [], "fear", -0.8, 0.8, "strong", None),
        ("crestfallen", [], "sadness", -0.7, 0.3, "strong", None),
        ("dejected", [], "sadness", -0.7, 0.3, "strong", None),
        ("despondent", [], "sadness", -0.8, 0.2, "strong", None),
        ("jubilant", [], "joy", 0.9, 0.8, "strong", None),
        ("euphoric", [], "joy", 0.9, 0.9, "strong", None),
        ("delighted", ["delight"], "joy", 0.8, 0.7, "strong", None),
        ("fearful", [], "fear", -0.7, 0.7, "strong", None),
        ("spiteful", [], "anger", -0.7, 0.6, "strong", None),
        ("vindictive", [], "anger", -0.8, 0.7, "strong", None),
        ("scornful", [], "disgust", -0.7, 0.6, "strong", None),
        ("disdainful", [], "disgust", -0.7, 0.5, "strong", None),
        ("contrite", [], "sadness", -0.5, 0.4, "strong", None),
        ("panicked", ["panic"], "fear", -0.8, 0.9, "strong", None),
        ("alarmed", ["alarm"], "fear", -0.6, 0.7, "strong", None),
        ("distressed", ["distress"], "fear", -0.7, 0.7, "strong", None),
        ("tormented", ["torment"], "sadness", -0.8, 0.8, "strong", None),
        ("anguished", ["anguish"], "sadness", -0.9, 0.8, "strong", None),
        ("woeful", [], "sadness", -0.8, 0.3, "strong", None),
        ("mournful", [], "sadness", -0.7, 0.4, "strong", None),
        ("melancholy", [], "sadness", -0.6, 0.3, "strong", None),
        ("glum", [], "sadness", -0.5, 0.3, "strong", None),
        ("morose", [], "sadness", -0.6, 0.3, "strong", None),
        ("sullen", [], "anger", -0.6, 0.4, "strong", None),
        ("sulky", [], "anger", -0.5, 0.4, "strong", None),
        ("petulant", [], "anger", -0.5, 0.5, "strong", None),
        ("peevish", [], "anger", -0.5, 0.5, "strong", None),
        ("querulous", [], "anger", -0.5, 0.5, "strong", None),
        ("wrathful", [], "anger", -0.9, 0.9, "strong", None),
        ("livid", [], "anger", -0.9, 0.9, "strong", None),
        ("infuriated", ["infuriate"], "anger", -0.9, 0.9, "strong", None),
        ("incensed", ["incense"], "anger", -0.8, 0.8, "strong", None),
        ("irate", [], "anger", -0.8, 0.8, "strong", None),
        ("choleric", [], "anger", -0.7, 0.7, "strong", None),
        ("cross", [], "anger", -0.4, 0.5, "weak", "spatial/geometric (cross the road) vs angry demeanor"),
        ("touchy", [], "anger", -0.4, 0.5, "weak", "tactile sensitivity vs easily offended/irritable"),
        ("crabby", [], "anger", -0.5, 0.5, "strong", None),
        ("grumpy", [], "anger", -0.5, 0.4, "strong", None),
        ("cantankerous", [], "anger", -0.6, 0.5, "strong", None),
        ("apprehensive", [], "fear", -0.5, 0.6, "strong", None),
        ("dreadful", [], "fear", -0.7, 0.7, "strong", None),
        ("timid", [], "fear", -0.3, 0.4, "strong", None),
        ("timorous", [], "fear", -0.4, 0.4, "strong", None),
        ("cowed", ["cow"], "fear", -0.6, 0.5, "strong", None),
        ("daunted", ["daunt"], "fear", -0.5, 0.5, "strong", None),
        ("rattled", ["rattle"], "fear", -0.5, 0.6, "strong", None),
        ("flustered", ["fluster"], "surprise", -0.4, 0.6, "strong", None),
        ("perplexed", ["perplex"], "surprise", -0.2, 0.5, "strong", None),
        ("bewildered", ["bewilder"], "surprise", -0.3, 0.6, "strong", None),
        ("baffled", ["baffle"], "surprise", -0.2, 0.5, "strong", None),
        ("mystified", ["mystify"], "surprise", 0.0, 0.5, "strong", None),
        ("nonplussed", [], "surprise", -0.2, 0.5, "strong", None),
        ("dumbfounded", ["dumbfound"], "surprise", -0.2, 0.7, "strong", None),
        ("flabbergasted", ["flabbergast"], "surprise", 0.0, 0.8, "strong", None),
        ("stupefied", ["stupefy"], "surprise", -0.3, 0.6, "strong", None),
        ("awestruck", [], "surprise", 0.6, 0.8, "strong", None),
        ("wonderstruck", [], "surprise", 0.7, 0.8, "strong", None),
        ("enchanted", ["enchant"], "joy", 0.8, 0.7, "strong", None),
        ("enthralled", ["enthral", "enthrall"], "joy", 0.8, 0.7, "strong", None),
        ("rapturous", [], "joy", 0.9, 0.8, "strong", None),
        ("blissful", [], "joy", 0.9, 0.5, "strong", None),
        ("serene", [], "trust", 0.7, 0.2, "strong", None),
        ("placid", [], "trust", 0.6, 0.2, "strong", None),
        ("cheerful", [], "joy", 0.7, 0.6, "strong", None),
        ("buoyant", [], "joy", 0.7, 0.6, "strong", None),
        ("lighthearted", [], "joy", 0.7, 0.5, "strong", None),
        ("gleeful", [], "joy", 0.8, 0.7, "strong", None),
        ("jovial", [], "joy", 0.7, 0.6, "strong", None),
        ("mirthful", [], "joy", 0.7, 0.6, "strong", None),
        ("merry", [], "joy", 0.7, 0.6, "strong", None),
        ("exultant", [], "joy", 0.8, 0.8, "strong", None),
        ("triumphant", [], "joy", 0.8, 0.8, "strong", None),
        ("confident", [], "trust", 0.7, 0.6, "strong", None),
        ("sanguine", [], "trust", 0.6, 0.5, "strong", None),
        ("optimistic", [], "anticipation", 0.7, 0.5, "strong", None),
        ("trusting", ["trust"], "trust", 0.7, 0.4, "strong", None),
        ("affectionate", [], "joy", 0.8, 0.5, "strong", None),
        ("fond", [], "joy", 0.6, 0.4, "strong", None),
        ("tender", [], "joy", 0.7, 0.3, "weak", "meat tenderness vs gentle affection"),
        ("loving", ["love"], "joy", 0.9, 0.6, "strong", None),
        ("devoted", ["devote"], "trust", 0.8, 0.5, "strong", None),
        ("adoring", ["adore"], "joy", 0.9, 0.7, "strong", None),
        ("sympathetic", [], "trust", 0.6, 0.4, "strong", None),
        ("compassionate", [], "trust", 0.7, 0.4, "strong", None),
        ("pitiful", [], "sadness", -0.5, 0.4, "strong", None),
        ("envious", [], "disgust", -0.7, 0.6, "strong", None),
        ("covetous", [], "anticipation", -0.5, 0.6, "strong", None),
        ("begrudging", ["begrudge"], "anger", -0.6, 0.5, "strong", None),
        ("malicious", [], "disgust", -0.8, 0.7, "strong", None),
        ("hateful", [], "disgust", -0.9, 0.8, "strong", None),
        ("loathsome", [], "disgust", -0.8, 0.7, "strong", None),
        ("abhorrent", [], "disgust", -0.9, 0.8, "strong", None),
        ("repulsed", ["repulse"], "disgust", -0.8, 0.7, "strong", None),
        ("revolted", ["revolt"], "disgust", -0.8, 0.8, "strong", None),
        ("nauseated", ["nauseate"], "disgust", -0.8, 0.6, "strong", None),
        ("displeased", ["displease"], "anger", -0.5, 0.4, "strong", None),
        ("dissatisfied", [], "sadness", -0.5, 0.4, "strong", None),
        ("disillusioned", ["disillusion"], "sadness", -0.6, 0.3, "strong", None),
        ("cynical", [], "disgust", -0.5, 0.4, "strong", None),
        ("weary", [], "sadness", -0.4, 0.2, "strong", None),
        ("exhausted", ["exhaust"], "sadness", -0.4, 0.3, "strong", None),
        ("drained", ["drain"], "sadness", -0.5, 0.2, "strong", None),
        ("listless", [], "sadness", -0.4, 0.2, "strong", None),
        ("apathetic", [], None, -0.3, 0.1, "strong", None),
        ("indifferent", [], None, 0.0, 0.1, "strong", None),
        ("curious", [], "anticipation", 0.5, 0.5, "strong", None),
        ("inquisitive", [], "anticipation", 0.4, 0.5, "strong", None),
        ("eager", [], "anticipation", 0.7, 0.7, "strong", None),
        ("avid", [], "anticipation", 0.6, 0.7, "strong", None),
        ("impatient", [], "anticipation", -0.3, 0.7, "strong", None),
        ("restless", [], "anticipation", -0.3, 0.6, "strong", None),
        ("agitated", ["agitate"], "fear", -0.6, 0.8, "strong", None),
        ("tense", [], "fear", -0.5, 0.7, "weak", "physical tension (tense muscle) vs emotional nervousness"),
        ("jumpy", [], "fear", -0.4, 0.7, "strong", None),
        ("edgy", [], "fear", -0.4, 0.6, "strong", None),
        ("frantic", [], "fear", -0.7, 0.9, "strong", None),
        ("frenzied", [], "anger", -0.6, 0.9, "strong", None),
        ("hysterical", [], "fear", -0.8, 0.9, "strong", None),
        ("feverish", [], "anticipation", 0.1, 0.8, "weak", "medical fever vs excited emotion"),
        ("thrilled", ["thrill"], "joy", 0.8, 0.8, "strong", None),
        ("exhilarated", ["exhilarate"], "joy", 0.8, 0.9, "strong", None),
        ("electrified", ["electrify"], "surprise", 0.6, 0.9, "weak", "physical electrical current vs electric excitement"),
        ("overjoyed", [], "joy", 0.9, 0.8, "strong", None),
        ("entranced", ["entrance"], "joy", 0.7, 0.6, "strong", None),
        ("spellbound", [], "surprise", 0.7, 0.7, "strong", None),
        ("fascinated", ["fascinate"], "anticipation", 0.7, 0.6, "strong", None),
        ("captivated", ["captivate"], "joy", 0.8, 0.6, "strong", None),
        ("charmed", ["charm"], "joy", 0.7, 0.5, "strong", None),
        ("bewitched", ["bewitch"], "surprise", 0.6, 0.6, "strong", None),
        ("humbled", ["humble"], "trust", 0.4, 0.3, "strong", None),
        ("mortified", ["mortify"], "fear", -0.8, 0.7, "strong", None),
        ("chagrined", [], "anger", -0.5, 0.5, "strong", None),
        ("humiliated", ["humiliate"], "sadness", -0.8, 0.7, "strong", None),
        ("disgraced", ["disgrace"], "sadness", -0.8, 0.6, "strong", None),
        ("scandalized", ["scandalize"], "disgust", -0.7, 0.7, "strong", None),
        ("offended", ["offend"], "anger", -0.6, 0.6, "strong", None),
        ("aggrieved", ["aggrieve"], "sadness", -0.6, 0.5, "strong", None),
        ("afflicted", ["afflict"], "sadness", -0.7, 0.5, "strong", None),
        ("grief-stricken", [], "sadness", -0.9, 0.7, "strong", None),
        ("sorrowful", [], "sadness", -0.8, 0.4, "strong", None),
        ("crushed", ["crush"], "sadness", -0.8, 0.5, "weak", "physical compression vs heartbroken"),
        ("shattered", ["shatter"], "sadness", -0.8, 0.7, "weak", "broken physical object vs devastated emotionally"),
        ("broken", ["break"], "sadness", -0.7, 0.4, "weak", "fractured item vs broken spirit"),
        ("hopeless", [], "sadness", -0.9, 0.2, "strong", None),
        ("despairing", ["despair"], "sadness", -0.9, 0.5, "strong", None),
        ("forlorn", [], "sadness", -0.7, 0.3, "strong", None),
        ("isolated", ["isolate"], "sadness", -0.5, 0.2, "weak", "physical separation vs emotional loneliness"),
        ("alienated", ["alienate"], "sadness", -0.6, 0.4, "strong", None),
        ("abandoned", ["abandon"], "sadness", -0.8, 0.5, "weak", "deserted place vs abandoned emotionally"),
        ("forsaken", ["forsake"], "sadness", -0.8, 0.4, "strong", None),
        ("bereft", [], "sadness", -0.8, 0.4, "strong", None),
        ("disconsolate", [], "sadness", -0.8, 0.3, "strong", None),
        ("inconsolable", [], "sadness", -0.9, 0.6, "strong", None),
        ("cheerless", [], "sadness", -0.6, 0.2, "strong", None),
        ("grim", [], "anger", -0.6, 0.5, "strong", None),
        ("bleak", [], "sadness", -0.6, 0.2, "weak", "landscape vs gloomy emotion"),
        ("somber", [], "sadness", -0.5, 0.3, "weak", "dark colors vs somber demeanor"),
        ("doleful", [], "sadness", -0.7, 0.3, "strong", None),
        ("funereal", [], "sadness", -0.7, 0.2, "strong", None),
        ("lugubrious", [], "sadness", -0.6, 0.3, "strong", None),
        ("sepulchral", [], "fear", -0.6, 0.3, "strong", None),
        ("ghastly", [], "fear", -0.8, 0.7, "strong", None),
        ("macabre", [], "fear", -0.7, 0.6, "strong", None),
        ("sinister", [], "fear", -0.8, 0.7, "strong", None),
        ("menacing", ["menace"], "anger", -0.7, 0.7, "strong", None),
        ("threatening", ["threaten"], "anger", -0.7, 0.7, "strong", None),
        ("hostile", [], "anger", -0.7, 0.7, "strong", None),
        ("belligerent", [], "anger", -0.7, 0.8, "strong", None),
        ("pugnacious", [], "anger", -0.6, 0.7, "strong", None),
        ("truculent", [], "anger", -0.7, 0.7, "strong", None),
        ("antagonistic", [], "anger", -0.6, 0.6, "strong", None),
        ("combative", [], "anger", -0.5, 0.7, "strong", None),
        ("defiant", [], "anger", -0.4, 0.7, "strong", None),
        ("rebellious", [], "anger", -0.4, 0.7, "strong", None),
        ("insolent", [], "anger", -0.6, 0.6, "strong", None),
        ("brazen", [], "anger", -0.4, 0.6, "strong", None),
        ("arrogant", [], "disgust", -0.6, 0.5, "strong", None),
        ("haughty", [], "disgust", -0.6, 0.4, "strong", None),
        ("conceited", [], "disgust", -0.5, 0.4, "strong", None),
        ("pompous", [], "disgust", -0.5, 0.4, "strong", None),
        ("vain", [], "disgust", -0.4, 0.4, "weak", "vain effort vs conceited person"),
        ("smug", [], "disgust", -0.4, 0.4, "strong", None),
        ("complacent", [], None, 0.1, 0.2, "strong", None),
        ("self-satisfied", [], "disgust", -0.3, 0.3, "strong", None),
        ("supercilious", [], "disgust", -0.6, 0.4, "strong", None),
        ("condescending", ["condescend"], "disgust", -0.6, 0.4, "strong", None),
        ("patronizing", ["patronize"], "disgust", -0.6, 0.4, "strong", None),
        ("imperious", [], "anger", -0.5, 0.6, "strong", None),
        ("domineering", ["domineer"], "anger", -0.6, 0.6, "strong", None),
        ("tyrannical", [], "anger", -0.8, 0.7, "strong", None),
        ("oppressive", [], "sadness", -0.7, 0.5, "weak", "weather humidity vs oppressive demeanor"),
        ("overbearing", [], "anger", -0.6, 0.6, "strong", None),
        ("stubborn", [], "anger", -0.3, 0.5, "strong", None),
        ("obstinate", [], "anger", -0.4, 0.5, "strong", None),
        ("intractable", [], "anger", -0.4, 0.5, "strong", None),
        ("relentless", [], "anger", -0.3, 0.7, "strong", None),
        ("unyielding", [], "anger", -0.2, 0.6, "weak", "solid surface vs unyielding attitude"),
        ("ruthless", [], "disgust", -0.8, 0.7, "strong", None),
        ("merciless", [], "disgust", -0.8, 0.7, "strong", None),
        ("pitiless", [], "disgust", -0.8, 0.6, "strong", None),
        ("callous", [], "disgust", -0.7, 0.4, "weak", "hard skin vs unfeeling callousness"),
        ("heartless", [], "disgust", -0.8, 0.5, "strong", None),
        ("unfeeling", [], "disgust", -0.6, 0.3, "weak", "loss of sensation vs callous emotion"),
        ("cold", [], "disgust", -0.4, 0.3, "weak", "physical temperature vs aloof demeanor"),
        ("aloof", [], None, -0.2, 0.2, "strong", None),
        ("distant", [], None, -0.2, 0.2, "weak", "spatial distance vs reserved demeanor"),
        ("detached", ["detach"], None, 0.0, 0.1, "weak", "unfastened vs emotionally neutral"),
        ("dispassionate", [], None, 0.1, 0.1, "strong", None),
        ("stoic", [], "trust", 0.2, 0.2, "strong", None),
        ("resigned", ["resign"], "sadness", -0.4, 0.2, "weak", "quit job vs resigned to fate"),
        ("submissive", [], "fear", -0.4, 0.3, "strong", None),
        ("meek", [], "fear", -0.2, 0.3, "strong", None),
        ("docile", [], "trust", 0.2, 0.2, "strong", None),
        ("obedient", [], "trust", 0.3, 0.3, "strong", None),
        ("servile", [], "disgust", -0.6, 0.3, "strong", None),
        ("fawning", ["fawn"], "disgust", -0.6, 0.4, "strong", None),
        ("sycophantic", [], "disgust", -0.7, 0.4, "strong", None),
        ("obsequious", [], "disgust", -0.7, 0.4, "strong", None),
        ("ingratiating", ["ingratiate"], "disgust", -0.5, 0.4, "strong", None),
        ("suspicious", [], "fear", -0.5, 0.6, "strong", None),
        ("distrustful", [], "fear", -0.6, 0.5, "strong", None),
        ("wary", [], "anticipation", -0.3, 0.5, "strong", None),
        ("cautious", [], "anticipation", 0.1, 0.4, "strong", None),
        ("guarded", ["guard"], "anticipation", -0.2, 0.4, "weak", "physically guarded vs emotionally reserved"),
        ("skeptical", [], "disgust", -0.3, 0.4, "strong", None),
        ("incredulous", [], "surprise", -0.2, 0.6, "strong", None),
        ("disbelieving", ["disbelieve"], "surprise", -0.3, 0.5, "strong", None),
        ("derisive", [], "disgust", -0.7, 0.6, "strong", None),
        ("mocking", ["mock"], "disgust", -0.6, 0.6, "strong", None),
        ("sarcastic", [], "disgust", -0.5, 0.5, "strong", None),
        ("ironic", [], "surprise", 0.1, 0.4, "strong", None),
        ("wry", [], "joy", 0.2, 0.3, "strong", None),
        ("bemused", [], "surprise", 0.1, 0.4, "strong", None),
        ("amused", ["amuse"], "joy", 0.6, 0.5, "strong", None),
        ("entertained", ["entertain"], "joy", 0.6, 0.5, "strong", None),
        ("exuberant", [], "joy", 0.8, 0.8, "strong", None),
        ("ebullient", [], "joy", 0.8, 0.8, "strong", None),
        ("effervescent", [], "joy", 0.8, 0.7, "weak", "carbonated bubbles vs bubbly personality"),
        ("vivacious", [], "joy", 0.7, 0.7, "strong", None),
        ("spirited", [], "anticipation", 0.6, 0.7, "weak", "spirit/ghost vs lively emotion"),
        ("zealous", [], "anticipation", 0.5, 0.8, "strong", None),
        ("fervent", [], "anticipation", 0.6, 0.8, "strong", None),
        ("ardent", [], "anticipation", 0.7, 0.8, "strong", None),
        ("impassioned", [], "anticipation", 0.6, 0.8, "strong", None),
        ("vehement", [], "anger", -0.4, 0.8, "strong", None),
        ("violent", [], "anger", -0.8, 0.9, "weak", "physical assault vs violent emotion"),
        ("tempestuous", [], "anger", -0.6, 0.8, "weak", "weather storm vs stormy emotions"),
        ("turbulent", [], "fear", -0.5, 0.7, "weak", "fluid flow vs emotional turmoil"),
        ("fuming", ["fume"], "anger", -0.8, 0.8, "weak", "emitting fumes vs fuming mad"),
        ("seething", ["seethe"], "anger", -0.8, 0.8, "weak", "boiling liquid vs seething rage"),
        ("boiling", ["boil"], "anger", -0.8, 0.8, "weak", "temperature 100C vs boiling mad"),
        ("smoldering", ["smolder"], "anger", -0.6, 0.6, "weak", "burning without flame vs smoldering look"),
        ("grudging", ["grudge"], "anger", -0.5, 0.5, "strong", None),
        ("sour", [], "disgust", -0.5, 0.4, "weak", "lemon taste vs sour attitude"),
        ("curmudgeonly", [], "anger", -0.5, 0.4, "strong", None),
        ("grouchy", [], "anger", -0.5, 0.4, "strong", None),
        ("tearful", [], "sadness", -0.7, 0.5, "strong", None),
        ("weepy", [], "sadness", -0.6, 0.4, "strong", None),
        ("sobbing", ["sob"], "sadness", -0.8, 0.7, "strong", None),
        ("wailing", ["wail"], "sadness", -0.8, 0.8, "strong", None),
        ("bewailing", ["bewail"], "sadness", -0.7, 0.6, "strong", None),
        ("lamenting", ["lament"], "sadness", -0.7, 0.5, "strong", None),
        ("rueful", [], "sadness", -0.4, 0.3, "strong", None),
        ("regretful", [], "sadness", -0.5, 0.4, "strong", None),
        ("penitent", [], "sadness", -0.4, 0.4, "strong", None),
        ("shamefaced", [], "sadness", -0.6, 0.4, "strong", None),
        ("sheepish", [], "sadness", -0.3, 0.3, "strong", None),
        ("culpable", [], "sadness", -0.5, 0.4, "strong", None),
        ("panicky", [], "fear", -0.8, 0.9, "strong", None),
        ("trembling", ["tremble"], "fear", -0.7, 0.8, "weak", "physical vibration/cold vs fear/anticipation"),
        ("shivering", ["shiver"], "fear", -0.5, 0.6, "weak", "cold sensation vs fear/dread"),
        ("quaking", ["quake"], "fear", -0.7, 0.8, "weak", "earthquake vs trembling with fear"),
        ("shuddering", ["shudder"], "fear", -0.7, 0.7, "weak", "engine shudder vs body shuddering in horror"),
        ("petrified", ["petrify"], "fear", -0.9, 0.9, "weak", "fossilized wood vs paralyzed by fear"),
        ("paralyzed", ["paralyze"], "fear", -0.8, 0.8, "weak", "medical paralysis vs frozen with fear"),
        ("frozen", ["freeze"], "fear", -0.6, 0.6, "weak", "ice temperature vs frozen in terror"),
        ("startled", ["startle"], "surprise", -0.1, 0.7, "strong", None),
        ("jolted", ["jolt"], "surprise", -0.2, 0.7, "weak", "mechanical jerk vs surprise jolt"),
        ("delirious", [], "joy", 0.6, 0.9, "weak", "medical delirium vs deliriously happy"),
        ("manic", [], "anticipation", 0.3, 0.9, "strong", None),
        ("moved", ["move"], "joy", 0.6, 0.5, "weak", "spatial motion (moved house) vs emotionally touched"),
        ("struck", ["strike"], "surprise", 0.4, 0.7, "weak", "physical blow vs struck with awe"),
        ("blue", [], "sadness", -0.5, 0.3, "weak", "color vs melancholy emotion"),
        ("low", [], "sadness", -0.4, 0.2, "weak", "height/volume vs feeling low/dejected"),
        ("pale", [], "fear", -0.5, 0.6, "weak", "light color shade vs pale with fear"),
        ("numb", [], "sadness", -0.5, 0.2, "weak", "physical loss of sensation vs emotional shock"),
    ]

    for term, alts, emo, val, aro, strength, note in extra_emo_labels:
        eid = make_id("emo", term)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        entry = {
            "id": eid,
            "lemma": term,
            "pos": ["ADJ"],
            "kind": "emotion_label",
            "strength": strength,
            "valence": val,
            "arousal": aro,
            "emotions": {emo: 0.9} if emo else None,
            "source": "curated:gemini-2026-09",
            "version": 1,
        }
        if alts:
            entry["alt_lemmas"] = alts
            entry["lemma_evidence"] = "carrier"
        if note:
            entry["note"] = note
        emo_labels.append(entry)

    with open(os.path.join(LEXICONS_DIR, "emotion_label.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "en", "kind": "emotion_label", "version": 1, "entries": emo_labels}, f, indent=1)
    print(f"EN emotion_label: {len(emo_labels)} entries")

    # -------------------------------------------------------------
    # 2. EMOTION_NOUN (Target: 120+)
    # -------------------------------------------------------------
    emo_nouns = []
    noun_data = [
        ("scorn", "disgust", -0.8, 0.6, "strong", None),
        ("dread", "fear", -0.9, 0.8, "strong", None),
        ("pity", "sadness", -0.4, 0.4, "strong", None),
        ("indignation", "anger", -0.8, 0.7, "strong", None),
        ("envy", "disgust", -0.7, 0.6, "strong", None),
        ("wrath", "anger", -0.9, 0.9, "strong", None),
        ("fury", "anger", -0.9, 0.9, "strong", None),
        ("rage", "anger", -0.9, 0.9, "strong", None),
        ("gloom", "sadness", -0.7, 0.3, "weak", "dark lighting vs emotional gloom"),
        ("terror", "fear", -0.9, 0.9, "strong", None),
        ("horror", "fear", -0.9, 0.9, "strong", None),
        ("agony", "sadness", -0.9, 0.8, "weak", "physical pain vs mental agony"),
        ("ecstasy", "joy", 0.9, 0.9, "strong", None),
        ("bliss", "joy", 0.9, 0.6, "strong", None),
        ("delight", "joy", 0.8, 0.7, "strong", None),
        ("sorrow", "sadness", -0.8, 0.4, "strong", None),
        ("grief", "sadness", -0.9, 0.6, "strong", None),
        ("anguish", "sadness", -0.9, 0.8, "strong", None),
        ("remorse", "sadness", -0.7, 0.5, "strong", None),
        ("shame", "sadness", -0.7, 0.5, "strong", None),
        ("guilt", "sadness", -0.7, 0.5, "strong", None),
        ("jealousy", "disgust", -0.7, 0.7, "strong", None),
        ("disdain", "disgust", -0.7, 0.5, "strong", None),
        ("contempt", "disgust", -0.8, 0.6, "strong", None),
        ("hatred", "disgust", -0.9, 0.8, "strong", None),
        ("loathing", "disgust", -0.9, 0.8, "strong", None),
        ("abhorrence", "disgust", -0.9, 0.8, "strong", None),
        ("disgust", "disgust", -0.8, 0.6, "strong", None),
        ("revulsion", "disgust", -0.8, 0.7, "strong", None),
        ("trepidation", "fear", -0.6, 0.6, "strong", None),
        ("anxiety", "fear", -0.6, 0.7, "strong", None),
        ("panic", "fear", -0.8, 0.9, "strong", None),
        ("alarm", "fear", -0.6, 0.7, "weak", "clock alarm / warning siren vs emotional alarm"),
        ("consternation", "fear", -0.6, 0.6, "strong", None),
        ("wonderment", "surprise", 0.7, 0.7, "strong", None),
        ("astonishment", "surprise", 0.5, 0.8, "strong", None),
        ("amazement", "surprise", 0.6, 0.7, "strong", None),
        ("stupefaction", "surprise", -0.2, 0.6, "strong", None),
        ("admiration", "trust", 0.8, 0.5, "strong", None),
        ("reverence", "trust", 0.8, 0.5, "strong", None),
        ("awe", "surprise", 0.6, 0.7, "strong", None),
        ("gratitude", "trust", 0.8, 0.4, "strong", None),
        ("tenderness", "joy", 0.8, 0.3, "weak", "physical tenderness to touch vs tender affection"),
        ("affection", "joy", 0.8, 0.4, "strong", None),
        ("compassion", "trust", 0.8, 0.4, "strong", None),
        ("sympathy", "trust", 0.6, 0.3, "strong", None),
        ("mercy", "trust", 0.7, 0.4, "strong", None),
        ("pride", "joy", 0.6, 0.6, "weak", "pride of lions vs character pride"),
        ("vanity", "disgust", -0.4, 0.4, "weak", "vanity table vs conceited attitude"),
        ("hubris", "anger", -0.6, 0.6, "strong", None),
        ("spite", "anger", -0.7, 0.6, "strong", None),
        ("malice", "anger", -0.8, 0.7, "strong", None),
        ("resentment", "anger", -0.7, 0.6, "strong", None),
        ("bitterness", "anger", -0.7, 0.6, "weak", "taste quality vs bitter attitude"),
        ("rancor", "anger", -0.8, 0.7, "strong", None),
        ("animosity", "anger", -0.7, 0.7, "strong", None),
        ("hostility", "anger", -0.7, 0.7, "strong", None),
        ("enmity", "anger", -0.7, 0.7, "strong", None),
        ("irritation", "anger", -0.5, 0.5, "weak", "skin irritation vs mental annoyance"),
        ("vexation", "anger", -0.5, 0.5, "strong", None),
        ("frustration", "anger", -0.6, 0.6, "strong", None),
        ("impatience", "anticipation", -0.4, 0.6, "strong", None),
        ("eagerness", "anticipation", 0.7, 0.7, "strong", None),
        ("yearning", "anticipation", 0.4, 0.6, "strong", None),
        ("longing", "anticipation", 0.3, 0.5, "strong", None),
        ("craving", "anticipation", 0.2, 0.6, "weak", "craving food vs emotional desire"),
        ("melancholia", "sadness", -0.7, 0.3, "strong", None),
        ("despondency", "sadness", -0.8, 0.3, "strong", None),
        ("dejection", "sadness", -0.7, 0.3, "strong", None),
        ("despair", "sadness", -0.9, 0.5, "strong", None),
        ("hopelessness", "sadness", -0.9, 0.3, "strong", None),
        ("misery", "sadness", -0.8, 0.5, "strong", None),
        ("wretchedness", "sadness", -0.8, 0.4, "strong", None),
        ("humiliation", "sadness", -0.8, 0.7, "strong", None),
        ("mortification", "fear", -0.8, 0.7, "strong", None),
        ("chagrin", "anger", -0.5, 0.5, "strong", None),
        ("embarrassment", "fear", -0.5, 0.5, "strong", None),
        ("jubilation", "joy", 0.9, 0.8, "strong", None),
        ("exultation", "joy", 0.9, 0.8, "strong", None),
        ("triumph", "joy", 0.8, 0.8, "strong", None),
        ("glee", "joy", 0.8, 0.7, "strong", None),
        ("mirth", "joy", 0.7, 0.6, "strong", None),
        ("hilarity", "joy", 0.8, 0.7, "strong", None),
        ("cheer", "joy", 0.7, 0.5, "strong", None),
        ("serenity", "trust", 0.8, 0.2, "strong", None),
        ("tranquility", "trust", 0.8, 0.2, "strong", None),
        ("peace", "trust", 0.8, 0.2, "weak", "peace treaty vs inner peacefulness"),
        ("contentment", "joy", 0.7, 0.3, "strong", None),
        ("satisfaction", "joy", 0.7, 0.4, "strong", None),
        ("relief", "joy", 0.8, 0.4, "weak", "geographic relief / aid relief vs emotional relief"),
        ("solace", "trust", 0.7, 0.3, "strong", None),
        ("comfort", "trust", 0.7, 0.3, "weak", "physical bed comfort vs emotional comfort"),
        ("enthusiasm", "anticipation", 0.8, 0.7, "strong", None),
        ("zeal", "anticipation", 0.6, 0.7, "strong", None),
        ("ardor", "anticipation", 0.7, 0.7, "strong", None),
        ("passion", "anticipation", 0.7, 0.8, "weak", "the Passion of Christ vs emotional passion"),
        ("infatuation", "joy", 0.6, 0.7, "strong", None),
        ("fervor", "anticipation", 0.6, 0.7, "strong", None),
        ("frenzy", "anger", -0.6, 0.9, "strong", None),
        ("hysteria", "fear", -0.8, 0.9, "strong", None),
        ("delirium", "surprise", 0.0, 0.8, "weak", "fever delirium vs wild emotional state"),
        ("cravenness", "fear", -0.7, 0.4, "strong", None),
        ("cowardice", "fear", -0.7, 0.4, "strong", None),
        ("bravery", "trust", 0.8, 0.7, "strong", None),
        ("courage", "trust", 0.8, 0.7, "strong", None),
        ("valor", "trust", 0.8, 0.7, "strong", None),
        ("dauntlessness", "trust", 0.8, 0.7, "strong", None),
        ("intrepidity", "trust", 0.8, 0.7, "strong", None),
        ("fearlessness", "trust", 0.8, 0.6, "strong", None),
        ("indifference", None, 0.0, 0.1, "strong", None),
        ("apathy", None, -0.3, 0.1, "strong", None),
        ("resignation", "sadness", -0.4, 0.2, "weak", "letter of resignation vs resigned emotion"),
        ("distrust", "fear", -0.6, 0.5, "strong", None),
        ("suspicion", "fear", -0.5, 0.6, "strong", None),
        ("wariness", "anticipation", -0.3, 0.5, "strong", None),
        ("caution", "anticipation", 0.2, 0.4, "strong", None),
        ("skepticism", "disgust", -0.2, 0.4, "strong", None),
        ("bewilderment", "surprise", -0.2, 0.6, "strong", None),
        ("perplexity", "surprise", -0.2, 0.5, "strong", None),
        ("confusion", "surprise", -0.3, 0.5, "strong", None),
        ("disarray", "fear", -0.4, 0.6, "weak", "messy clothes vs confused mind"),
        ("turmoil", "fear", -0.6, 0.7, "strong", None),
        ("agitation", "fear", -0.6, 0.7, "weak", "fluid agitation vs emotional agitation"),
        ("perturbation", "fear", -0.5, 0.6, "weak", "orbital perturbation vs emotional distress"),
        ("restlessness", "anticipation", -0.3, 0.6, "strong", None),
        ("boredom", "sadness", -0.4, 0.1, "strong", None),
        ("tedium", "sadness", -0.4, 0.1, "strong", None),
        ("ennui", "sadness", -0.5, 0.1, "strong", None),
        ("loneliness", "sadness", -0.7, 0.3, "strong", None),
        ("isolation", "sadness", -0.5, 0.3, "weak", "electrical isolation vs loneliness"),
        ("alienation", "sadness", -0.6, 0.4, "strong", None),
        ("heartache", "sadness", -0.8, 0.5, "strong", None),
        ("woe", "sadness", -0.8, 0.4, "strong", None),
        ("mourning", "sadness", -0.8, 0.4, "weak", "black clothes vs feeling of grief"),
        ("lamentation", "sadness", -0.8, 0.5, "strong", None),
    ]

    for term, emo, val, aro, strength, note in noun_data:
        eid = make_id("emonoun", term)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        entry = {
            "id": eid,
            "lemma": term,
            "pos": ["NOUN"],
            "kind": "emotion_noun",
            "strength": strength,
            "valence": val,
            "arousal": aro,
            "emotions": {emo: 0.8} if emo else None,
            "source": "curated:gemini-2026-09",
            "version": 1,
        }
        if note:
            entry["note"] = note
        emo_nouns.append(entry)

    with open(os.path.join(LEXICONS_DIR, "emotion_noun.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "en", "kind": "emotion_noun", "version": 1, "entries": emo_nouns}, f, indent=1)
    print(f"EN emotion_noun: {len(emo_nouns)} entries")

    # -------------------------------------------------------------
    # 3. EMOTION_VERB (Target: 80+)
    # -------------------------------------------------------------
    emo_verbs = []
    verb_data = [
        ("envy", "disgust", -0.7, 0.6, "strong", None),
        ("dread", "fear", -0.9, 0.8, "strong", None),
        ("fear", "fear", -0.8, 0.8, "strong", None),
        ("pity", "sadness", -0.4, 0.4, "strong", None),
        ("loathe", "disgust", -0.9, 0.8, "strong", None),
        ("mourn", "sadness", -0.8, 0.5, "strong", None),
        ("grieve", "sadness", -0.8, 0.5, "strong", None),
        ("rejoice", "joy", 0.9, 0.8, "strong", None),
        ("exult", "joy", 0.8, 0.8, "strong", None),
        ("despair", "sadness", -0.9, 0.6, "strong", None),
        ("lament", "sadness", -0.7, 0.5, "strong", None),
        ("weep", "sadness", -0.7, 0.6, "strong", None),
        ("sob", "sadness", -0.8, 0.7, "strong", None),
        ("fret", "fear", -0.5, 0.6, "weak", "guitar fret vs worrying"),
        ("worry", "fear", -0.6, 0.6, "weak", "dog worrying a bone vs mental anxiety"),
        ("despise", "disgust", -0.8, 0.7, "strong", None),
        ("detest", "disgust", -0.8, 0.7, "strong", None),
        ("abhor", "disgust", -0.9, 0.8, "strong", None),
        ("adore", "joy", 0.9, 0.7, "strong", None),
        ("cherish", "joy", 0.8, 0.5, "strong", None),
        ("treasure", "joy", 0.8, 0.5, "weak", "buried treasure vs cherish feeling"),
        ("idolize", "joy", 0.8, 0.7, "strong", None),
        ("worship", "trust", 0.8, 0.6, "weak", "church ritual vs emotional reverence"),
        ("resent", "anger", -0.7, 0.6, "strong", None),
        ("begrudge", "anger", -0.6, 0.5, "strong", None),
        ("seethe", "anger", -0.8, 0.8, "weak", "boiling liquid vs rage"),
        ("fume", "anger", -0.8, 0.8, "weak", "emitting chemical fumes vs fuming anger"),
        ("rage", "anger", -0.9, 0.9, "weak", "storm raging vs character raging"),
        ("yearn", "anticipation", 0.4, 0.6, "strong", None),
        ("crave", "anticipation", 0.3, 0.6, "strong", None),
        ("long", "anticipation", 0.4, 0.5, "weak", "spatial length vs emotional longing"),
        ("pine", "sadness", -0.6, 0.4, "weak", "pine tree vs pining away"),
        ("revere", "trust", 0.8, 0.5, "strong", None),
        ("venerate", "trust", 0.8, 0.5, "strong", None),
        ("distrust", "fear", -0.6, 0.5, "strong", None),
        ("suspect", "fear", -0.4, 0.5, "weak", "police suspect vs suspecting ill"),
        ("shudder", "fear", -0.7, 0.7, "weak", "mechanical shudder vs horror shudder"),
        ("quiver", "fear", -0.5, 0.6, "weak", "arrow quiver vs quivering lip"),
        ("tremble", "fear", -0.6, 0.7, "weak", "physical vibration vs emotional trembling"),
        ("cower", "fear", -0.7, 0.6, "strong", None),
        ("flinch", "fear", -0.5, 0.6, "weak", "physical dodge vs emotional flinch"),
        ("cringe", "fear", -0.6, 0.6, "strong", None),
        ("wince", "sadness", -0.5, 0.5, "weak", "physical pain wince vs emotional wince"),
        ("blush", "fear", -0.3, 0.6, "weak", "physical blood flush vs embarrassed blush"),
        ("chuckle", "joy", 0.7, 0.5, "strong", None),
        ("giggle", "joy", 0.7, 0.6, "strong", None),
        ("beam", "joy", 0.8, 0.6, "weak", "wooden beam / light beam vs smiling beamingly"),
        ("glow", "joy", 0.7, 0.4, "weak", "incandescent lamp vs warm inner glow"),
        ("marvel", "surprise", 0.7, 0.7, "strong", None),
        ("wonder", "surprise", 0.5, 0.5, "strong", None),
        ("bask", "joy", 0.8, 0.3, "weak", "basking in sun vs basking in approval"),
        ("relish", "joy", 0.8, 0.5, "weak", "pickle relish vs relishing a moment"),
        ("savor", "joy", 0.8, 0.4, "weak", "tasting food vs savoring joy"),
        ("brood", "sadness", -0.6, 0.4, "weak", "brood of chicks vs brooding gloomily"),
        ("mull", "anticipation", 0.0, 0.3, "weak", "mulled wine vs mulling over"),
        ("agonize", "sadness", -0.8, 0.7, "strong", None),
        ("suffer", "sadness", -0.8, 0.6, "weak", "suffer injury vs suffer grief"),
        ("endure", "trust", 0.1, 0.5, "strong", None),
        ("persevere", "trust", 0.6, 0.6, "strong", None),
        ("delight", "joy", 0.8, 0.7, "strong", None),
        ("disdain", "disgust", -0.7, 0.5, "strong", None),
        ("scorn", "disgust", -0.7, 0.6, "strong", None),
        ("mock", "disgust", -0.6, 0.6, "strong", None),
        ("deride", "disgust", -0.7, 0.6, "strong", None),
        ("taunt", "anger", -0.6, 0.7, "strong", None),
        ("chide", "anger", -0.4, 0.4, "strong", None),
        ("reproach", "anger", -0.5, 0.5, "strong", None),
        ("berate", "anger", -0.7, 0.7, "strong", None),
        ("scold", "anger", -0.5, 0.6, "strong", None),
        ("chafe", "anger", -0.5, 0.6, "weak", "skin chafing vs chafing at rules"),
        ("bridle", "anger", -0.5, 0.6, "weak", "horse bridle vs bridling at insult"),
        ("bristle", "anger", -0.6, 0.7, "weak", "brush bristles vs bristling with anger"),
        ("fluster", "fear", -0.4, 0.6, "strong", None),
        ("rattle", "fear", -0.5, 0.6, "weak", "toy rattle vs rattling someone's nerves"),
        ("disconcert", "surprise", -0.4, 0.5, "strong", None),
        ("unnerve", "fear", -0.6, 0.6, "strong", None),
        ("startle", "surprise", -0.1, 0.7, "strong", None),
        ("alarm", "fear", -0.6, 0.7, "weak", "sounding alarm vs feeling alarmed"),
        ("panic", "fear", -0.8, 0.9, "strong", None),
        ("appall", "disgust", -0.8, 0.8, "strong", None),
        ("dismay", "fear", -0.6, 0.6, "strong", None),
        ("afflict", "sadness", -0.7, 0.5, "strong", None),
        ("torment", "sadness", -0.8, 0.8, "strong", None),
        ("plague", "fear", -0.7, 0.6, "weak", "bubonic plague vs plaguing someone with doubts"),
        ("haunt", "fear", -0.6, 0.5, "weak", "ghost haunting house vs memories haunting mind"),
        ("intimidate", "fear", -0.7, 0.7, "strong", None),
        ("terrorize", "fear", -0.9, 0.9, "strong", None),
        ("enrage", "anger", -0.9, 0.9, "strong", None),
        ("infuriate", "anger", -0.9, 0.9, "strong", None),
        ("incense", "anger", -0.8, 0.8, "weak", "burning incense vs incensed with rage"),
        ("provoke", "anger", -0.5, 0.7, "strong", None),
    ]

    for term, emo, val, aro, strength, note in verb_data:
        eid = make_id("emoverb", term)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        entry = {
            "id": eid,
            "lemma": term,
            "pos": ["VERB"],
            "kind": "emotion_verb",
            "strength": strength,
            "valence": val,
            "arousal": aro,
            "emotions": {emo: 0.8} if emo else None,
            "source": "curated:gemini-2026-09",
            "version": 1,
        }
        if note:
            entry["note"] = note
        emo_verbs.append(entry)

    with open(os.path.join(LEXICONS_DIR, "emotion_verb.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "en", "kind": "emotion_verb", "version": 1, "entries": emo_verbs}, f, indent=1)
    print(f"EN emotion_verb: {len(emo_verbs)} entries")

    # -------------------------------------------------------------
    # 4. TELLING_CUE (Target: 40+)
    # -------------------------------------------------------------
    telling_cues = []
    cues_data = [
        ("look of", "fear", -0.5, 0.5), ("wave of", "fear", -0.5, 0.6), ("pang of", "sadness", -0.6, 0.5),
        ("burst of", "anger", -0.5, 0.7), ("flash of", "anger", -0.5, 0.7), ("surge of", "anger", -0.5, 0.7),
        ("fit of", "anger", -0.6, 0.7), ("sense of", "anticipation", 0.0, 0.4), ("feeling of", "anticipation", 0.0, 0.4),
        ("touch of", "sadness", -0.3, 0.3), ("tinge of", "sadness", -0.3, 0.3), ("shade of", "sadness", -0.3, 0.3),
        ("trace of", "surprise", 0.1, 0.4), ("hint of", "surprise", 0.1, 0.4), ("glimmer of", "joy", 0.5, 0.4),
        ("spark of", "joy", 0.5, 0.5), ("ray of", "joy", 0.6, 0.4), ("shadow of", "fear", -0.5, 0.4),
        ("shiver of", "fear", -0.6, 0.6), ("tremor of", "fear", -0.6, 0.6), ("chill of", "fear", -0.6, 0.5),
        ("spasm of", "fear", -0.7, 0.7), ("throb of", "sadness", -0.6, 0.5), ("glow of", "joy", 0.7, 0.4),
        ("flush of", "joy", 0.6, 0.5), ("flood of", "joy", 0.6, 0.6), ("rush of", "anticipation", 0.4, 0.7),
        ("tide of", "sadness", -0.6, 0.5), ("cloud of", "sadness", -0.6, 0.3), ("veil of", "sadness", -0.5, 0.3),
        ("pall of", "sadness", -0.7, 0.3), ("weight of", "sadness", -0.7, 0.4), ("burden of", "sadness", -0.7, 0.4),
        ("mantle of", "sadness", -0.5, 0.3), ("cloak of", "fear", -0.5, 0.4), ("grip of", "fear", -0.8, 0.8),
        ("clutches of", "fear", -0.8, 0.8), ("jaws of", "fear", -0.8, 0.8), ("depths of", "sadness", -0.8, 0.3),
        ("height of", "anger", -0.6, 0.8), ("brink of", "fear", -0.6, 0.7), ("verge of", "fear", -0.5, 0.6),
        ("abyss of", "sadness", -0.9, 0.5), ("sea of", "sadness", -0.7, 0.4), ("gulf of", "sadness", -0.6, 0.3),
    ]

    for phrase_str, emo, val, aro in cues_data:
        phrase_words = phrase_str.split()
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

    with open(os.path.join(LEXICONS_DIR, "telling_cue.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "en", "kind": "telling_cue", "version": 1, "entries": telling_cues}, f, indent=1)
    print(f"EN telling_cue: {len(telling_cues)} entries")

    # -------------------------------------------------------------
    # 5. EMOTION_ADVERB (Target: 40+)
    # -------------------------------------------------------------
    emo_adverbs = []

    # Migrated from EMOTION_ADVERBS_EN (13 adverbs) with exact hand-curated tuples
    MIGRATED_EMO_ADVERBS_EN = [
        ("angrily", -0.8, 0.8, {"anger": 0.9}),
        ("sadly", -0.75, 0.35, {"sadness": 0.85}),
        ("happily", 0.85, 0.65, {"joy": 0.9}),
        ("nervously", -0.55, 0.6, {"fear": 0.7}),
        ("anxiously", -0.65, 0.7, {"fear": 0.75}),
        ("bitterly", -0.7, 0.65, {"anger": 0.7, "disgust": 0.5}),
        ("jealously", -0.7, 0.65, {"disgust": 0.7, "anger": 0.6}),
        ("desperately", -0.8, 0.8, {"fear": 0.7, "sadness": 0.7}),
        ("proudly", 0.7, 0.6, {"joy": 0.7, "trust": 0.6}),
        ("resentfully", -0.7, 0.6, {"anger": 0.8}),
        ("gleefully", 0.8, 0.75, {"joy": 0.85}),
        ("miserably", -0.8, 0.35, {"sadness": 0.85}),
        ("furiously", -0.9, 0.95, {"anger": 0.95}),
    ]

    for w, val, aro, emos in MIGRATED_EMO_ADVERBS_EN:
        lem = norm_lemma(w)
        eid = make_id("emoadv", lem)
        all_created_ids.add(eid)
        emo_adverbs.append({
            "id": eid,
            "lemma": lem,
            "pos": ["ADV"],
            "kind": "emotion_adverb",
            "strength": "strong",
            "valence": val,
            "arousal": aro,
            "emotions": emos,
            "source": "migrated:janitor.py",
            "version": 1,
        })

    extra_advs = [
        ("astonishedly", "surprise", 0.3, 0.7),
        ("scornfully", "disgust", -0.7, 0.6),
        ("disdainfully", "disgust", -0.7, 0.5),
        ("fearfully", "fear", -0.7, 0.7),
        ("timidly", "fear", -0.3, 0.4),
        ("sorrowfully", "sadness", -0.8, 0.4),
        ("mournfully", "sadness", -0.8, 0.4),
        ("jubilantly", "joy", 0.9, 0.8),
        ("indignantly", "anger", -0.8, 0.7),
        ("wrathfully", "anger", -0.9, 0.9),
        ("spitefully", "anger", -0.7, 0.6),
        ("remorsefully", "sadness", -0.7, 0.5),
        ("shamefully", "sadness", -0.7, 0.5),
        ("triumphantly", "joy", 0.8, 0.8),
        ("fondly", "joy", 0.7, 0.4),
        ("tenderly", "joy", 0.8, 0.3),
        ("curiously", "anticipation", 0.4, 0.5),
        ("eagerly", "anticipation", 0.7, 0.7),
        ("impatiently", "anticipation", -0.3, 0.7),
        ("restlessly", "anticipation", -0.4, 0.6),
        ("apprehensively", "fear", -0.5, 0.6),
        ("suspiciously", "fear", -0.5, 0.6),
        ("warily", "anticipation", -0.3, 0.5),
        ("skeptically", "disgust", -0.3, 0.4),
        ("cynically", "disgust", -0.5, 0.4),
        ("mockingly", "disgust", -0.6, 0.6),
        ("derisively", "disgust", -0.7, 0.6),
        ("wryly", "joy", 0.2, 0.3),
        ("somberly", "sadness", -0.5, 0.3),
        ("grimly", "anger", -0.6, 0.5),
        ("haughtily", "disgust", -0.6, 0.5),
        ("arrogantly", "disgust", -0.6, 0.5),
        ("sullenly", "anger", -0.6, 0.4),
    ]

    for term, emo, val, aro in extra_advs:
        lem = norm_lemma(term)
        eid = make_id("emoadv", lem)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        emo_adverbs.append({
            "id": eid,
            "lemma": lem,
            "pos": ["ADV"],
            "kind": "emotion_adverb",
            "strength": "strong",
            "valence": val,
            "arousal": aro,
            "emotions": {emo: 0.8},
            "source": "curated:gemini-2026-09",
            "version": 1,
        })

    with open(os.path.join(LEXICONS_DIR, "emotion_adverb.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "en", "kind": "emotion_adverb", "version": 1, "entries": emo_adverbs}, f, indent=1)
    print(f"EN emotion_adverb: {len(emo_adverbs)} entries")

    # -------------------------------------------------------------
    # 6. REALIZE_VERB (Cognition/realization verbs, weak/not SDT)
    # -------------------------------------------------------------
    realize_verbs = []
    # Migrated: realize, understand, recognize, sense
    migrated_realize = [
        ("realize", 0.1, 0.4, {"anticipation": 0.4}),
        ("understand", 0.2, 0.2, {"trust": 0.4}),
        ("recognize", 0.1, 0.3, {"anticipation": 0.3}),
        ("sense", 0.0, 0.35, {"anticipation": 0.4}),
    ]
    for w, val, aro, emos in migrated_realize:
        lem = norm_lemma(w)
        eid = make_id("realize", lem)
        all_created_ids.add(eid)
        realize_verbs.append({
            "id": eid,
            "lemma": lem,
            "pos": ["VERB"],
            "kind": "realize_verb",
            "strength": "weak",
            "valence": val,
            "arousal": aro,
            "emotions": emos,
            "source": "migrated:janitor.py",
            "version": 1,
        })

    extra_realize = [
        ("discern", 0.1, 0.25), ("comprehend", 0.15, 0.25), ("grasp", 0.1, 0.3),
        ("gather", 0.05, 0.2), ("deduce", 0.1, 0.25), ("infer", 0.05, 0.25),
        ("perceive", 0.0, 0.3), ("fathom", 0.1, 0.25), ("learn", 0.15, 0.3),
        ("discover", 0.2, 0.45), ("conclude", 0.1, 0.3), ("surmise", 0.0, 0.25),
        ("ascertain", 0.1, 0.25)
    ]
    for w, val, aro in extra_realize:
        lem = norm_lemma(w)
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
        json.dump({"lang": "en", "kind": "realize_verb", "version": 1, "entries": realize_verbs}, f, indent=1)
    print(f"EN realize_verb: {len(realize_verbs)} entries")

    # -------------------------------------------------------------
    # 7. FILTER_VERB (Perception filter verbs, weak/not SDT)
    # -------------------------------------------------------------
    filter_verbs = []
    migrated_filter = [
        ("see", 0.0, 0.15), ("hear", 0.0, 0.15), ("feel", 0.0, 0.25),
        ("notice", 0.05, 0.35), ("watch", 0.0, 0.30), ("observe", 0.0, 0.20),
        ("smell", 0.0, 0.15), ("taste", 0.0, 0.15)
    ]
    for w, val, aro in migrated_filter:
        lem = norm_lemma(w)
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
            "source": "migrated:janitor.py",
            "version": 1,
        })

    extra_filter = [
        ("glimpse", 0.05, 0.35), ("spot", 0.05, 0.40), ("glance", 0.0, 0.25),
        ("peer", 0.0, 0.30), ("stare", -0.1, 0.35), ("gaze", 0.1, 0.25),
        ("behold", 0.2, 0.45), ("listen", 0.0, 0.20), ("overhear", 0.0, 0.40)
    ]
    for w, val, aro in extra_filter:
        lem = norm_lemma(w)
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
        json.dump({"lang": "en", "kind": "filter_verb", "version": 1, "entries": filter_verbs}, f, indent=1)
    print(f"EN filter_verb: {len(filter_verbs)} entries")

    # -------------------------------------------------------------
    # 8. ACTION_VIOLENT (Target: 150+)
    # Individual per-entry valence / arousal across severity tiers
    # -------------------------------------------------------------
    violent_verbs = []
    viol_tuples = [
        # Mild / impact / contact actions (arousal 0.40 - 0.55, valence -0.35 to -0.50)
        ("shove", -0.40, 0.45, {"anger": 0.5}, "strong", None),
        ("push", -0.35, 0.40, {"anger": 0.4}, "weak", "push door vs push person"),
        ("jostle", -0.35, 0.40, {"anger": 0.4}, "strong", None),
        ("trip", -0.40, 0.45, {"anger": 0.5}, "weak", "vacation trip vs tripping someone"),
        ("grapple", -0.50, 0.55, {"anger": 0.6}, "strong", None),
        ("wrestle", -0.45, 0.55, {"anger": 0.5}, "strong", None),
        ("slap", -0.50, 0.55, {"anger": 0.6}, "strong", None),
        ("clobber", -0.60, 0.65, {"anger": 0.7}, "strong", None),
        ("wallop", -0.60, 0.65, {"anger": 0.7}, "strong", None),
        ("tackle", -0.50, 0.60, {"anger": 0.5}, "weak", "tackle a problem vs tackle opponent"),
        ("brawl", -0.60, 0.65, {"anger": 0.7}, "strong", None),
        ("skirmish", -0.55, 0.60, {"anger": 0.6, "fear": 0.5}, "strong", None),
        ("duel", -0.55, 0.65, {"anger": 0.6}, "strong", None),

        # Moderate violence (arousal 0.60 - 0.75, valence -0.60 to -0.75)
        ("strike", -0.65, 0.70, {"anger": 0.7}, "weak", "clock striking / labor strike vs physical blow"),
        ("hit", -0.60, 0.65, {"anger": 0.7}, "strong", None),
        ("punch", -0.65, 0.70, {"anger": 0.7}, "strong", None),
        ("kick", -0.60, 0.65, {"anger": 0.7}, "strong", None),
        ("beat", -0.70, 0.75, {"anger": 0.8}, "weak", "heart beat / beat music vs beating someone"),
        ("batter", -0.75, 0.75, {"anger": 0.8}, "weak", "pancake batter vs battering someone"),
        ("smash", -0.75, 0.80, {"anger": 0.8}, "strong", None),
        ("whip", -0.75, 0.80, {"anger": 0.8}, "weak", "whipped cream vs whipping person"),
        ("slash", -0.80, 0.80, {"anger": 0.8, "fear": 0.7}, "strong", None),
        ("bludgeon", -0.80, 0.80, {"anger": 0.85}, "strong", None),
        ("thrash", -0.70, 0.75, {"anger": 0.75}, "strong", None),
        ("flog", -0.75, 0.80, {"anger": 0.8}, "strong", None),
        ("scourge", -0.80, 0.80, {"anger": 0.8}, "strong", None),
        ("bite", -0.60, 0.65, {"anger": 0.6}, "weak", "bite food vs bite an enemy"),
        ("claw", -0.65, 0.70, {"anger": 0.7}, "strong", None),
        ("maul", -0.80, 0.80, {"anger": 0.85, "fear": 0.8}, "strong", None),
        ("smite", -0.75, 0.75, {"anger": 0.8}, "strong", None),
        ("cudgel", -0.70, 0.75, {"anger": 0.75}, "strong", None),
        ("crush", -0.75, 0.80, {"anger": 0.8}, "weak", "crush ice vs crush enemy"),
        ("fracture", -0.70, 0.65, {"fear": 0.7}, "weak", "rock fracture vs bone fracture"),
        ("snap", -0.60, 0.65, {"anger": 0.6}, "weak", "snap fingers vs snap a bone"),
        ("splinter", -0.60, 0.60, {"fear": 0.5}, "weak", "wood splinter vs bone splinter"),
        ("dislocate", -0.70, 0.65, {"fear": 0.7}, "strong", None),
        ("pulverize", -0.80, 0.80, {"anger": 0.8}, "strong", None),
        ("flatten", -0.60, 0.65, {"anger": 0.6}, "weak", "flatten dough vs flatten foe"),
        ("squash", -0.60, 0.65, {"anger": 0.6}, "weak", "vegetable squash vs squash rebellion"),
        ("shred", -0.70, 0.70, {"anger": 0.7}, "weak", "paper shred vs shredding flesh"),

        # Heavy weapons & acute bodily harm (arousal 0.80 - 0.88, valence -0.80 to -0.90)
        ("stab", -0.85, 0.85, {"anger": 0.8, "fear": 0.8}, "strong", None),
        ("pierce", -0.75, 0.75, {"anger": 0.7, "fear": 0.7}, "weak", "ear piercing vs body piercing weapon"),
        ("cleave", -0.85, 0.85, {"anger": 0.8}, "strong", None),
        ("hack", -0.80, 0.80, {"anger": 0.8}, "weak", "hack computer / cough vs hack with blade"),
        ("hew", -0.75, 0.75, {"anger": 0.7}, "weak", "hew wood vs hew enemy"),
        ("sever", -0.85, 0.85, {"anger": 0.8}, "weak", "sever ties vs sever limb"),
        ("gash", -0.75, 0.75, {"fear": 0.7}, "strong", None),
        ("lacerate", -0.80, 0.75, {"fear": 0.75}, "strong", None),
        ("gouge", -0.85, 0.85, {"anger": 0.85, "fear": 0.8}, "weak", "price gouging vs gouge eyes"),
        ("wound", -0.70, 0.65, {"fear": 0.7, "sadness": 0.6}, "strong", None),
        ("injure", -0.65, 0.60, {"fear": 0.6}, "strong", None),
        ("rend", -0.80, 0.80, {"anger": 0.8}, "strong", None),
        ("rip", -0.75, 0.75, {"anger": 0.75}, "weak", "rip paper vs rip flesh"),
        ("tear", -0.75, 0.75, {"anger": 0.75}, "weak", "crying tear vs tear apart"),
        ("choke", -0.85, 0.85, {"fear": 0.9, "anger": 0.8}, "weak", "choke on food vs choke a person"),
        ("throttle", -0.85, 0.85, {"anger": 0.85, "fear": 0.85}, "strong", None),
        ("strangle", -0.90, 0.90, {"anger": 0.9, "fear": 0.9}, "strong", None),
        ("suffocate", -0.85, 0.85, {"fear": 0.9}, "strong", None),
        ("smother", -0.80, 0.80, {"fear": 0.85}, "weak", "smother in sauce vs smother a victim"),
        ("drown", -0.85, 0.85, {"fear": 0.9}, "weak", "drown in work vs drown in water"),
        ("hang", -0.85, 0.85, {"fear": 0.85}, "weak", "hang picture vs hang a criminal"),
        ("garrote", -0.90, 0.90, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("garrotte", -0.90, 0.90, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("skewer", -0.80, 0.80, {"anger": 0.8}, "weak", "skewer meat vs skewer enemy"),
        ("impale", -0.90, 0.90, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("spear", -0.80, 0.80, {"anger": 0.8}, "strong", None),
        ("bayonet", -0.85, 0.85, {"anger": 0.85, "fear": 0.85}, "strong", None),
        ("bleed", -0.65, 0.60, {"fear": 0.7}, "weak", "medical bleeding vs violent infliction"),
        ("burn", -0.70, 0.75, {"fear": 0.8}, "weak", "combustion vs violent arson or bodily burning"),
        ("scorch", -0.65, 0.70, {"fear": 0.6}, "weak", "scorch cloth vs scorch earth"),
        ("sear", -0.65, 0.70, {"fear": 0.6}, "weak", "sear steak vs searing pain"),
        ("scald", -0.70, 0.70, {"fear": 0.7}, "weak", "scald milk vs scalding water attack"),
        ("char", -0.65, 0.65, {"fear": 0.6}, "weak", "char wood vs char bodies"),
        ("singe", -0.50, 0.50, {"fear": 0.5}, "weak", "singe hair vs violent fire"),
        ("ignite", -0.60, 0.70, {"fear": 0.6}, "weak", "ignite engine vs ignite firebomb"),
        ("poison", -0.85, 0.80, {"fear": 0.85, "disgust": 0.7}, "weak", "poisonous substance vs poisoning a victim"),
        ("asphyxiate", -0.85, 0.85, {"fear": 0.9}, "strong", None),
        ("paralyze", -0.80, 0.80, {"fear": 0.85}, "weak", "medical paralysis vs paralyzing toxin"),
        ("blind", -0.80, 0.80, {"fear": 0.85}, "weak", "window blind vs blinding someone"),
        ("deafen", -0.70, 0.70, {"fear": 0.7}, "strong", None),

        # Deadly & Catastrophic Violence (arousal 0.90 - 0.98, valence -0.90 to -0.98)
        ("massacre", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("slaughter", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("butcher", -0.95, 0.95, {"disgust": 0.9, "anger": 0.9}, "weak", "meat butcher profession vs butchering people"),
        ("slay", -0.90, 0.90, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("execute", -0.85, 0.85, {"fear": 0.85}, "weak", "execute program vs execute prisoner"),
        ("assassinate", -0.90, 0.90, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("behead", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("decapitate", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("mutilate", -0.95, 0.95, {"disgust": 0.95, "fear": 0.9}, "strong", None),
        ("maim", -0.90, 0.85, {"fear": 0.9}, "strong", None),
        ("disembowel", -0.95, 0.95, {"disgust": 0.95, "fear": 0.95}, "strong", None),
        ("eviscerate", -0.95, 0.95, {"disgust": 0.95, "fear": 0.95}, "strong", None),
        ("gut", -0.90, 0.90, {"disgust": 0.9}, "weak", "gut feeling / fish gutting vs gutting enemy"),
        ("flay", -0.95, 0.95, {"disgust": 0.95, "fear": 0.95}, "strong", None),
        ("skin", -0.85, 0.85, {"disgust": 0.85}, "weak", "human skin vs skinning alive"),
        ("scalp", -0.90, 0.90, {"fear": 0.9, "disgust": 0.9}, "weak", "head scalp vs scalping enemy"),
        ("annihilate", -0.95, 0.95, {"fear": 0.95, "anger": 0.95}, "strong", None),
        ("exterminate", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("eradicate", -0.90, 0.90, {"anger": 0.9}, "strong", None),
        ("decimate", -0.90, 0.90, {"fear": 0.9}, "strong", None),
        ("lynch", -0.95, 0.95, {"fear": 0.95, "anger": 0.95}, "strong", None),
        ("crucify", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("immolate", -0.95, 0.95, {"fear": 0.95}, "strong", None),
        ("incinerate", -0.90, 0.90, {"fear": 0.9}, "strong", None),
        ("cremate", -0.75, 0.65, {"sadness": 0.8}, "weak", "peaceful funeral cremation vs fiery death"),
        ("devour", -0.75, 0.75, {"fear": 0.75}, "weak", "devour a meal vs beast devouring person"),
        ("ravage", -0.85, 0.85, {"fear": 0.85, "anger": 0.8}, "strong", None),
        ("pillage", -0.85, 0.85, {"anger": 0.85, "fear": 0.85}, "strong", None),
        ("plunder", -0.80, 0.80, {"anger": 0.8}, "strong", None),
        ("sack", -0.80, 0.80, {"anger": 0.8}, "weak", "burlap sack vs sacking a city"),
        ("destroy", -0.85, 0.85, {"anger": 0.85}, "strong", None),
        ("demolish", -0.80, 0.80, {"anger": 0.8}, "strong", None),
        ("wreck", -0.75, 0.75, {"anger": 0.7}, "strong", None),
        ("ruin", -0.75, 0.70, {"sadness": 0.8}, "weak", "ancient ruins vs ruining someone"),
        ("raze", -0.85, 0.85, {"anger": 0.85}, "strong", None),
        ("bomb", -0.85, 0.90, {"fear": 0.9}, "strong", None),
        ("blast", -0.80, 0.85, {"fear": 0.85}, "weak", "having a blast vs explosive blast"),
        ("detonate", -0.85, 0.90, {"fear": 0.9}, "strong", None),
        ("explode", -0.80, 0.85, {"fear": 0.85}, "weak", "temper exploding vs bomb exploding"),
        ("shatter", -0.75, 0.80, {"fear": 0.8}, "weak", "shattering glass vs shattering morale"),
        ("torpedo", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("cannonade", -0.80, 0.85, {"fear": 0.85}, "strong", None),
        ("bombard", -0.80, 0.85, {"fear": 0.85}, "weak", "bombard with questions vs artillery bombardment"),
        ("besiege", -0.75, 0.75, {"fear": 0.75}, "strong", None),
        ("ambush", -0.80, 0.85, {"fear": 0.85}, "strong", None),
        ("charge", -0.55, 0.75, {"anger": 0.7}, "weak", "battery charge / legal charge vs cavalry charge"),
        ("assault", -0.85, 0.85, {"anger": 0.85, "fear": 0.85}, "strong", None),
        ("storm", -0.65, 0.75, {"anger": 0.7}, "weak", "weather storm vs storming a fortress"),
        ("invade", -0.80, 0.80, {"fear": 0.8, "anger": 0.8}, "strong", None),
        ("overrun", -0.75, 0.75, {"fear": 0.8}, "strong", None),
        ("subdue", -0.60, 0.65, {"anger": 0.6}, "strong", None),
        ("conquer", -0.50, 0.70, {"anger": 0.7}, "weak", "conquer fears vs violent conquest"),
        ("vanquish", -0.65, 0.75, {"anger": 0.8}, "strong", None),
        ("overpower", -0.70, 0.75, {"fear": 0.7}, "strong", None),
        ("trample", -0.75, 0.75, {"anger": 0.75, "fear": 0.75}, "strong", None),
        ("subjugate", -0.80, 0.75, {"anger": 0.8}, "strong", None),
        ("clash", -0.60, 0.70, {"anger": 0.65}, "weak", "color clash vs clashing swords"),
        ("mangle", -0.85, 0.85, {"disgust": 0.85, "fear": 0.8}, "strong", None),
        ("torture", -0.95, 0.95, {"fear": 0.95, "sadness": 0.9}, "strong", None),
        ("torment", -0.85, 0.85, {"sadness": 0.85}, "strong", None),
        ("martyr", -0.80, 0.80, {"sadness": 0.85}, "strong", None),
        ("impale", -0.92, 0.92, {"fear": 0.9, "disgust": 0.85}, "strong", None),
        ("eviscerate", -0.96, 0.96, {"disgust": 0.95, "fear": 0.9}, "strong", None),
        ("flay", -0.94, 0.94, {"disgust": 0.9, "fear": 0.95}, "strong", None),
        ("throttle", -0.86, 0.86, {"anger": 0.85, "fear": 0.85}, "strong", None),
        ("garrote", -0.91, 0.91, {"fear": 0.9}, "strong", None),
        ("lynch", -0.95, 0.89, {"anger": 0.9, "fear": 0.9}, "strong", None),
        ("maim", -0.89, 0.84, {"fear": 0.85, "sadness": 0.8}, "strong", None),
        ("crucify", -0.94, 0.88, {"sadness": 0.85, "fear": 0.9}, "weak", "metaphorical criticism vs literal execution"),
        ("disembowel", -0.96, 0.95, {"disgust": 0.95, "fear": 0.9}, "strong", None),
        ("behead", -0.95, 0.88, {"fear": 0.9, "disgust": 0.85}, "strong", None),
        ("strangle", -0.91, 0.87, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("asphyxiate", -0.89, 0.86, {"fear": 0.9}, "strong", None),
        ("smother", -0.84, 0.79, {"fear": 0.85}, "weak", "smother with affection vs asphyxiation"),
        ("scourge", -0.83, 0.84, {"anger": 0.8, "sadness": 0.75}, "strong", None),
        ("pummel", -0.76, 0.81, {"anger": 0.8}, "strong", None),
        ("bludgeon", -0.87, 0.86, {"anger": 0.85, "fear": 0.85}, "strong", None),
        ("truncheon", -0.77, 0.76, {"fear": 0.75}, "strong", None),
        ("ambush", -0.74, 0.86, {"fear": 0.85, "anticipation": 0.7}, "strong", None),
        ("cosh", -0.78, 0.77, {"anger": 0.8}, "strong", None),
        ("disfigure", -0.88, 0.82, {"disgust": 0.85, "fear": 0.8}, "strong", None),
        ("electrocute", -0.92, 0.89, {"fear": 0.95}, "strong", None),
        ("strafe", -0.83, 0.87, {"fear": 0.85}, "strong", None),
        ("vaporize", -0.93, 0.91, {"fear": 0.9}, "strong", None),
        ("defenestrate", -0.86, 0.88, {"fear": 0.85}, "strong", None),
        ("sandbag", -0.72, 0.74, {"anger": 0.75}, "weak", "flood sandbag vs blunt strike"),
        ("manhandle", -0.68, 0.73, {"anger": 0.75}, "strong", None),
        ("waylay", -0.73, 0.78, {"fear": 0.75}, "strong", None),
        ("bushwhack", -0.76, 0.81, {"fear": 0.8}, "strong", None),
        ("hogtie", -0.79, 0.76, {"fear": 0.75}, "strong", None),
        ("fetter", -0.71, 0.69, {"fear": 0.7}, "strong", None),
        ("cauterize", -0.77, 0.78, {"fear": 0.8}, "weak", "medical procedure vs painful burning wound"),
        ("amputate", -0.82, 0.79, {"fear": 0.85, "disgust": 0.8}, "weak", "surgical operation vs forced amputation"),
    ]

    for term, val, aro, emos, strength, note in viol_tuples:
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
        json.dump({"lang": "en", "kind": "action_violent", "version": 1, "entries": violent_verbs}, f, indent=1)
    print(f"EN action_violent: {len(violent_verbs)} entries")

    # -------------------------------------------------------------
    # 9. DANGER_NOUN (Target: 100+)
    # Individual per-entry valence / arousal across severity tiers
    # -------------------------------------------------------------
    danger_nouns = []
    danger_tuples = [
        # Environmental / low-moderate danger (arousal 0.30 - 0.55, valence -0.30 to -0.55)
        ("smoke", -0.35, 0.30, {"fear": 0.4}, "weak", "fireplace/tobacco smoke vs fire peril"),
        ("shadow", -0.30, 0.30, {"fear": 0.3}, "weak", "shade from sun vs menacing presence"),
        ("debris", -0.40, 0.35, {"fear": 0.4}, "weak", "lawn debris vs post-blast debris"),
        ("rubble", -0.40, 0.35, {"fear": 0.4}, "weak", "construction rubble vs earthquake rubble"),
        ("pit", -0.45, 0.40, {"fear": 0.5}, "weak", "fruit pit vs dangerous pit trap"),
        ("ruin", -0.45, 0.45, {"sadness": 0.5, "fear": 0.4}, "strong", None),
        ("wreckage", -0.55, 0.50, {"fear": 0.6, "sadness": 0.5}, "strong", None),
        ("chasm", -0.55, 0.50, {"fear": 0.6}, "strong", None),
        ("cliff", -0.45, 0.45, {"fear": 0.5}, "weak", "scenic cliff view vs falling peril"),
        ("precipice", -0.60, 0.55, {"fear": 0.65}, "strong", None),
        ("abyss", -0.65, 0.60, {"fear": 0.7}, "strong", None),
        ("quicksand", -0.65, 0.60, {"fear": 0.7}, "strong", None),
        ("whirlpool", -0.65, 0.65, {"fear": 0.7}, "strong", None),
        ("tempest", -0.60, 0.65, {"fear": 0.65}, "strong", None),
        ("hurricane", -0.70, 0.70, {"fear": 0.75}, "strong", None),
        ("typhoon", -0.70, 0.70, {"fear": 0.75}, "strong", None),
        ("avalanche", -0.75, 0.75, {"fear": 0.8}, "strong", None),
        ("earthquake", -0.75, 0.75, {"fear": 0.8}, "strong", None),
        ("volcano", -0.70, 0.75, {"fear": 0.75}, "strong", None),
        ("conflagration", -0.80, 0.80, {"fear": 0.85}, "strong", None),
        ("inferno", -0.85, 0.85, {"fear": 0.85}, "strong", None),

        # Weapons & Immediate threats (arousal 0.55 - 0.75, valence -0.60 to -0.75)
        ("blade", -0.65, 0.60, {"fear": 0.6, "anger": 0.5}, "weak", "grass blade / razor vs dangerous weapon"),
        ("knife", -0.60, 0.55, {"fear": 0.6}, "weak", "butter knife vs combat weapon"),
        ("dagger", -0.70, 0.65, {"fear": 0.7, "anger": 0.6}, "strong", None),
        ("sword", -0.65, 0.65, {"fear": 0.6, "anger": 0.6}, "strong", None),
        ("axe", -0.65, 0.65, {"fear": 0.6}, "weak", "woodcutter axe vs battle axe"),
        ("spear", -0.70, 0.70, {"fear": 0.7}, "strong", None),
        ("arrow", -0.55, 0.60, {"fear": 0.6}, "weak", "directional arrow vs deadly projectile"),
        ("bullet", -0.75, 0.70, {"fear": 0.8}, "strong", None),
        ("rifle", -0.70, 0.65, {"fear": 0.7}, "strong", None),
        ("pistol", -0.70, 0.65, {"fear": 0.7}, "strong", None),
        ("cannon", -0.75, 0.75, {"fear": 0.8}, "strong", None),
        ("bayonet", -0.75, 0.75, {"fear": 0.75}, "strong", None),
        ("harpoon", -0.65, 0.70, {"fear": 0.65}, "strong", None),
        ("scythe", -0.65, 0.65, {"fear": 0.7}, "weak", "harvest tool vs grim reaper scythe"),
        ("shackle", -0.70, 0.65, {"fear": 0.7}, "strong", None),
        ("dungeon", -0.70, 0.60, {"fear": 0.7}, "strong", None),
        ("trap", -0.65, 0.65, {"fear": 0.7}, "strong", None),
        ("ambush", -0.75, 0.75, {"fear": 0.8}, "strong", None),
        ("mine", -0.70, 0.70, {"fear": 0.75}, "weak", "coal mine / possessive pronoun vs explosive landmine"),
        ("fuse", -0.40, 0.50, {"fear": 0.5}, "weak", "electrical fuse vs bomb fuse"),
        ("trigger", -0.50, 0.55, {"fear": 0.5}, "weak", "camera trigger vs gun trigger"),
        ("poison", -0.80, 0.75, {"fear": 0.8, "disgust": 0.6}, "strong", None),
        ("venom", -0.80, 0.75, {"fear": 0.8}, "strong", None),
        ("toxin", -0.75, 0.70, {"fear": 0.75}, "strong", None),
        ("arsenic", -0.80, 0.75, {"fear": 0.8}, "strong", None),
        ("hemlock", -0.80, 0.75, {"fear": 0.8}, "strong", None),

        # High danger, lethal entities, corpses, catastrophic threats (arousal 0.75 - 0.95, valence -0.75 to -0.95)
        ("noose", -0.85, 0.80, {"fear": 0.85}, "strong", None),
        ("gallows", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("guillotine", -0.90, 0.90, {"fear": 0.9}, "strong", None),
        ("executioner", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("corpse", -0.85, 0.80, {"fear": 0.75, "disgust": 0.7}, "strong", None),
        ("carcass", -0.80, 0.75, {"disgust": 0.8}, "strong", None),
        ("skeleton", -0.65, 0.65, {"fear": 0.65}, "weak", "anatomical skeleton vs terrifying remains"),
        ("skull", -0.65, 0.65, {"fear": 0.65}, "weak", "cranium bone vs poison emblem"),
        ("coffin", -0.75, 0.65, {"sadness": 0.8, "fear": 0.6}, "strong", None),
        ("tomb", -0.65, 0.60, {"sadness": 0.7}, "weak", "ancient historical tomb vs mortal demise"),
        ("sepulcher", -0.70, 0.65, {"fear": 0.7}, "strong", None),
        ("grave", -0.75, 0.65, {"sadness": 0.8}, "weak", "grave mistake vs cemetery burial ground"),
        ("assassin", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("murderer", -0.90, 0.85, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("slayer", -0.80, 0.80, {"fear": 0.8}, "strong", None),
        ("predator", -0.75, 0.75, {"fear": 0.8}, "weak", "biological predator vs menacing stalker"),
        ("monster", -0.80, 0.80, {"fear": 0.85}, "strong", None),
        ("demon", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("fiend", -0.80, 0.80, {"fear": 0.8}, "strong", None),
        ("devil", -0.75, 0.75, {"fear": 0.75}, "weak", "playful little devil vs demonic threat"),
        ("tyrant", -0.80, 0.75, {"anger": 0.8, "fear": 0.75}, "strong", None),
        ("despot", -0.80, 0.75, {"anger": 0.8}, "strong", None),
        ("oppressor", -0.80, 0.75, {"anger": 0.8}, "strong", None),
        ("pestilence", -0.85, 0.85, {"fear": 0.9}, "strong", None),
        ("plague", -0.85, 0.85, {"fear": 0.9}, "strong", None),
        ("contagion", -0.80, 0.80, {"fear": 0.85}, "strong", None),
        ("gangrene", -0.85, 0.75, {"disgust": 0.85}, "strong", None),
        ("famine", -0.85, 0.80, {"sadness": 0.85, "fear": 0.8}, "strong", None),
        ("bomb", -0.85, 0.85, {"fear": 0.9}, "strong", None),
        ("torpedo", -0.80, 0.80, {"fear": 0.85}, "strong", None),
        ("dynamite", -0.80, 0.80, {"fear": 0.85}, "strong", None),
        ("gunpowder", -0.65, 0.65, {"fear": 0.65}, "strong", None),
        ("shrapnel", -0.80, 0.80, {"fear": 0.8}, "strong", None),
        ("catastrophe", -0.85, 0.85, {"fear": 0.85}, "strong", None),
        ("disaster", -0.80, 0.80, {"fear": 0.8}, "strong", None),
        ("calamity", -0.80, 0.80, {"fear": 0.8}, "strong", None),
        ("carnage", -0.95, 0.95, {"fear": 0.95, "disgust": 0.8}, "strong", None),
        ("bloodshed", -0.90, 0.90, {"fear": 0.9, "anger": 0.85}, "strong", None),
        ("slaughter", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("massacre", -0.95, 0.95, {"fear": 0.95, "anger": 0.9}, "strong", None),
        ("hostage", -0.75, 0.75, {"fear": 0.8}, "strong", None),
        ("captive", -0.70, 0.70, {"fear": 0.7, "sadness": 0.7}, "strong", None),
        ("traitor", -0.80, 0.75, {"anger": 0.85, "disgust": 0.8}, "strong", None),
        ("enemy", -0.75, 0.70, {"anger": 0.8, "fear": 0.7}, "strong", None),
        ("foe", -0.70, 0.70, {"anger": 0.75}, "strong", None),
        ("nemesis", -0.75, 0.75, {"anger": 0.8}, "strong", None),
        ("bandit", -0.65, 0.65, {"fear": 0.65}, "strong", None),
        ("pirate", -0.65, 0.65, {"fear": 0.65}, "strong", None),
        ("brigand", -0.65, 0.65, {"fear": 0.65}, "strong", None),
        ("outlaw", -0.62, 0.64, {"fear": 0.6}, "strong", None),
        ("assassin", -0.87, 0.86, {"fear": 0.85}, "strong", None),
        ("sniper", -0.82, 0.84, {"fear": 0.85}, "strong", None),
        ("artillery", -0.74, 0.79, {"fear": 0.8}, "strong", None),
        ("minefield", -0.91, 0.89, {"fear": 0.9}, "strong", None),
        ("quicksand", -0.76, 0.74, {"fear": 0.8}, "strong", None),
        ("blizzard", -0.66, 0.76, {"fear": 0.7}, "weak", "severe storm vs blizzard of paperwork"),
        ("avalanche", -0.86, 0.84, {"fear": 0.85}, "weak", "snow avalanche vs avalanche of mail"),
        ("epidemic", -0.84, 0.79, {"fear": 0.85}, "strong", None),
        ("pestilence", -0.89, 0.81, {"fear": 0.85, "disgust": 0.8}, "strong", None),
        ("famine", -0.91, 0.76, {"fear": 0.85, "sadness": 0.85}, "strong", None),
        ("conflagration", -0.86, 0.86, {"fear": 0.85}, "strong", None),
        ("gallows", -0.91, 0.81, {"fear": 0.9, "sadness": 0.8}, "strong", None),
        ("guillotine", -0.96, 0.91, {"fear": 0.95}, "strong", None),
        ("noose", -0.92, 0.86, {"fear": 0.9}, "strong", None),
    ]

    for term, val, aro, emos, strength, note in danger_tuples:
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
        json.dump({"lang": "en", "kind": "danger_noun", "version": 1, "entries": danger_nouns}, f, indent=1)
    print(f"EN danger_noun: {len(danger_nouns)} entries")

    # -------------------------------------------------------------
    # 10. STAKES_WORD (Target: 50+)
    # Individual per-entry valence / arousal across severity tiers
    # -------------------------------------------------------------
    stakes_words = []
    stakes_tuples = [
        # Honor / vows / social stakes (arousal 0.40 - 0.55, valence -0.20 to +0.30)
        ("bet", -0.10, 0.40, {"anticipation": 0.5}),
        ("promise", 0.20, 0.40, {"trust": 0.6}),
        ("pledge", 0.20, 0.45, {"trust": 0.6}),
        ("reputation", -0.20, 0.45, {"anticipation": 0.5}),
        ("honor", 0.30, 0.50, {"trust": 0.7}),
        ("oath", 0.20, 0.50, {"trust": 0.7}),
        ("vow", 0.20, 0.50, {"trust": 0.7}),
        ("covenant", 0.25, 0.50, {"trust": 0.7}),
        ("heritage", 0.15, 0.45, {"trust": 0.5}),
        ("lineage", 0.10, 0.45, {"trust": 0.5}),
        ("dynasty", 0.05, 0.55, {"anticipation": 0.5}),
        ("judgment", -0.30, 0.55, {"fear": 0.5}),
        ("verdict", -0.25, 0.55, {"anticipation": 0.6}),
        ("reckoning", -0.50, 0.60, {"fear": 0.6}),
        ("prophecy", 0.00, 0.55, {"anticipation": 0.7}),

        # Realm / sovereignty / freedom (arousal 0.60 - 0.75, valence -0.40 to +0.50)
        ("crown", 0.10, 0.60, {"anticipation": 0.6}),
        ("throne", 0.00, 0.65, {"anticipation": 0.6}),
        ("kingdom", 0.10, 0.65, {"trust": 0.5}),
        ("empire", 0.00, 0.65, {"anticipation": 0.6}),
        ("sovereignty", 0.20, 0.65, {"trust": 0.6}),
        ("liberty", 0.50, 0.70, {"joy": 0.6}),
        ("freedom", 0.50, 0.70, {"joy": 0.6}),
        ("survival", -0.40, 0.75, {"fear": 0.7}),
        ("destiny", 0.10, 0.70, {"anticipation": 0.7}),
        ("fate", -0.30, 0.70, {"anticipation": 0.6}),
        ("legacy", 0.20, 0.60, {"trust": 0.6}),
        ("salvation", 0.60, 0.65, {"joy": 0.7}),
        ("redemption", 0.50, 0.65, {"joy": 0.6}),
        ("deliverance", 0.50, 0.65, {"joy": 0.6}),
        ("predestination", 0.00, 0.60, {"anticipation": 0.5}),
        ("inevitable", -0.35, 0.65, {"fear": 0.5}),
        ("irrevocable", -0.40, 0.65, {"fear": 0.5}),
        ("sacrifice", -0.50, 0.70, {"sadness": 0.6}),
        ("martyrdom", -0.60, 0.75, {"sadness": 0.7}),
        ("slavery", -0.85, 0.75, {"sadness": 0.85, "fear": 0.8}),
        ("bondage", -0.80, 0.75, {"sadness": 0.8, "fear": 0.75}),
        ("exile", -0.70, 0.70, {"sadness": 0.8}),
        ("banishment", -0.70, 0.70, {"sadness": 0.75}),

        # Life / Death / Existential ruin (arousal 0.80 - 0.95, valence -0.80 to -0.95)
        ("death", -0.85, 0.85, {"fear": 0.85, "sadness": 0.85}),
        ("mortal", -0.65, 0.75, {"fear": 0.7}),
        ("fatal", -0.85, 0.85, {"fear": 0.85}),
        ("perish", -0.80, 0.80, {"fear": 0.8}),
        ("doom", -0.90, 0.90, {"fear": 0.9}),
        ("annihilation", -0.95, 0.95, {"fear": 0.95}),
        ("extinction", -0.95, 0.95, {"fear": 0.95}),
        ("damnation", -0.90, 0.90, {"fear": 0.9}),
        ("cataclysm", -0.90, 0.90, {"fear": 0.9}),
        ("apocalypse", -0.95, 0.95, {"fear": 0.95}),
        ("retribution", -0.75, 0.80, {"anger": 0.8}),
        ("curse", -0.75, 0.75, {"fear": 0.75}),
        ("ruin", -0.80, 0.80, {"sadness": 0.8}),
        ("finality", -0.50, 0.70, {"sadness": 0.6}),
        ("eternity", 0.10, 0.65, {"anticipation": 0.5}),
        ("eternal", 0.10, 0.65, {"anticipation": 0.5}),
        ("immortal", 0.30, 0.65, {"trust": 0.6}),
        ("forever", 0.00, 0.60, {"anticipation": 0.5}),
    ]

    for term, val, aro, emos in stakes_tuples:
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
        json.dump({"lang": "en", "kind": "stakes_word", "version": 1, "entries": stakes_words}, f, indent=1)
    print(f"EN stakes_word: {len(stakes_words)} entries")

    # -------------------------------------------------------------
    # 11. CALM_WORD (Target: 100+)
    # Individual per-entry valence / arousal across quiet tiers
    # -------------------------------------------------------------
    calm_words = []
    calm_tuples = [
        # Gentle sound & atmosphere (arousal 0.10 - 0.20, valence 0.40 - 0.60)
        ("whisper", 0.45, 0.15, {"trust": 0.4}),
        ("breeze", 0.50, 0.15, {"joy": 0.4}),
        ("murmur", 0.40, 0.15, None),
        ("dusk", 0.35, 0.12, None),
        ("stillness", 0.60, 0.10, {"trust": 0.5}),
        ("lull", 0.50, 0.10, {"trust": 0.4}),
        ("silence", 0.40, 0.08, {"trust": 0.3}),
        ("hush", 0.50, 0.10, {"trust": 0.4}),
        ("twilight", 0.45, 0.12, None),
        ("zephyr", 0.50, 0.15, {"joy": 0.3}),
        ("shadow", 0.20, 0.15, None),
        ("rustle", 0.30, 0.18, None),
        ("sigh", 0.30, 0.15, None),

        # Deep serenity & rest (arousal 0.05 - 0.12, valence 0.70 - 0.90)
        ("peace", 0.85, 0.05, {"joy": 0.7, "trust": 0.8}),
        ("calm", 0.80, 0.05, {"trust": 0.8}),
        ("serenity", 0.90, 0.05, {"joy": 0.8, "trust": 0.8}),
        ("tranquility", 0.85, 0.05, {"trust": 0.8}),
        ("rest", 0.70, 0.06, {"trust": 0.6}),
        ("repose", 0.75, 0.06, {"trust": 0.7}),
        ("solace", 0.75, 0.12, {"joy": 0.6, "trust": 0.7}),
        ("comfort", 0.70, 0.12, {"trust": 0.7}),
        ("ease", 0.65, 0.10, {"trust": 0.6}),
        ("quiet", 0.60, 0.08, {"trust": 0.5}),
        ("slumber", 0.65, 0.05, {"trust": 0.5}),
        ("sleep", 0.60, 0.05, None),
        ("nap", 0.55, 0.06, None),
        ("doze", 0.50, 0.06, None),
        ("respite", 0.65, 0.10, {"trust": 0.6}),
        ("leisure", 0.70, 0.15, {"joy": 0.5}),
        ("unwind", 0.65, 0.10, {"trust": 0.5}),
        ("soothe", 0.75, 0.08, {"trust": 0.7}),
        ("mellow", 0.65, 0.10, {"joy": 0.4}),
        ("gentle", 0.70, 0.12, {"joy": 0.5}),
        ("mild", 0.50, 0.10, None),
        ("balmy", 0.60, 0.12, {"joy": 0.4}),
        ("soft", 0.60, 0.10, None),
        ("smooth", 0.55, 0.10, None),

        # Security & Sanctuary (arousal 0.15 - 0.25, valence 0.65 - 0.80)
        ("haven", 0.75, 0.20, {"trust": 0.8}),
        ("sanctuary", 0.80, 0.20, {"trust": 0.8}),
        ("refuge", 0.75, 0.22, {"trust": 0.8}),
        ("shelter", 0.70, 0.20, {"trust": 0.7}),
        ("harbor", 0.65, 0.18, {"trust": 0.7}),
        ("anchorage", 0.60, 0.18, {"trust": 0.6}),
        ("oasis", 0.80, 0.22, {"joy": 0.7, "trust": 0.7}),
        ("cradle", 0.70, 0.15, {"trust": 0.6}),
        ("hearth", 0.75, 0.18, {"joy": 0.6, "trust": 0.7}),
        ("nest", 0.65, 0.15, {"trust": 0.6}),
        ("burrow", 0.55, 0.15, None),
        ("asylum", 0.60, 0.20, {"trust": 0.6}),
        ("retreat", 0.65, 0.18, {"trust": 0.6}),
        ("safeguard", 0.70, 0.22, {"trust": 0.7}),
        ("shield", 0.65, 0.25, {"trust": 0.7}),
        ("protection", 0.70, 0.20, {"trust": 0.7}),
        ("security", 0.75, 0.18, {"trust": 0.8}),
        ("safety", 0.75, 0.18, {"trust": 0.8}),
        ("relief", 0.75, 0.20, {"joy": 0.7}),
        ("consolation", 0.70, 0.15, {"trust": 0.6}),
        ("hush", 0.52, 0.08, None),
        ("lull", 0.54, 0.08, None),
        ("quietude", 0.66, 0.05, None),
        ("tranquillity", 0.76, 0.06, {"trust": 0.7}),
        ("repose", 0.71, 0.07, None),
        ("serenity", 0.81, 0.06, {"trust": 0.8}),
        ("equanimity", 0.69, 0.08, {"trust": 0.7}),
        ("composure", 0.64, 0.10, {"trust": 0.7}),
        ("calmness", 0.68, 0.08, None),
        ("stillness", 0.62, 0.05, None),
        ("pacific", 0.61, 0.08, None),
        ("unruffled", 0.66, 0.07, None),
        ("untroubled", 0.72, 0.07, {"trust": 0.6}),
        ("peaceable", 0.67, 0.10, {"trust": 0.6}),
        ("gentleness", 0.71, 0.12, {"joy": 0.5}),
        ("mildness", 0.56, 0.10, None),
        ("halcyon", 0.77, 0.10, {"joy": 0.6}),
        ("leisure", 0.66, 0.12, {"joy": 0.5}),
        ("leisurely", 0.62, 0.10, None),
        ("soothing", 0.72, 0.10, {"trust": 0.6}),
        ("assuage", 0.67, 0.12, {"trust": 0.6}),
        ("mollify", 0.58, 0.14, None),
        ("pacify", 0.66, 0.15, {"trust": 0.6}),
        ("appease", 0.54, 0.16, None),
        ("reconcile", 0.68, 0.18, {"trust": 0.6}),
        ("harmony", 0.76, 0.15, {"joy": 0.6, "trust": 0.7}),
        ("harmonious", 0.74, 0.14, {"joy": 0.6}),
        ("concord", 0.72, 0.12, {"trust": 0.7}),
        ("respite", 0.68, 0.14, {"joy": 0.5}),
        ("interlude", 0.52, 0.12, None),
        ("breather", 0.61, 0.12, None),
        ("pause", 0.46, 0.10, None),
        ("intermission", 0.51, 0.12, None),
        ("truce", 0.67, 0.15, {"trust": 0.6}),
        ("armistice", 0.68, 0.16, {"trust": 0.6}),
        ("ceasefire", 0.62, 0.18, {"trust": 0.5}),
        ("slumber", 0.67, 0.05, None),
        ("doze", 0.56, 0.06, None),
        ("drowse", 0.52, 0.05, None),
        ("snooze", 0.57, 0.06, None),
        ("nap", 0.58, 0.07, None),
        ("siesta", 0.63, 0.08, None),
        ("cushion", 0.57, 0.10, None),
        ("pillow", 0.62, 0.08, None),
        ("blanket", 0.61, 0.10, None),
        ("hammock", 0.66, 0.08, None),
        ("pastoral", 0.67, 0.12, {"joy": 0.4}),
        ("bucolic", 0.62, 0.12, None),
        ("idyllic", 0.78, 0.12, {"joy": 0.7}),
        ("meadow", 0.66, 0.12, {"joy": 0.5}),
        ("snug", 0.67, 0.10, {"joy": 0.5}),
        ("cozy", 0.72, 0.10, {"joy": 0.6}),
        ("cosy", 0.72, 0.10, {"joy": 0.6}),
        ("fireside", 0.69, 0.12, {"joy": 0.5}),
        ("alcove", 0.58, 0.10, None),
        ("nook", 0.59, 0.10, None),
        ("bower", 0.64, 0.10, None),
        ("restfulness", 0.73, 0.06, {"trust": 0.7}),
        ("peacefulness", 0.78, 0.06, {"trust": 0.8}),
        ("placidity", 0.67, 0.08, None),
        ("unperturbed", 0.66, 0.07, {"trust": 0.6}),
        ("unshaken", 0.68, 0.10, {"trust": 0.7}),
    ]

    for term, val, aro, emos in calm_tuples:
        lem = norm_lemma(term)
        eid = make_id("calm", lem)
        if eid in all_created_ids:
            continue
        all_created_ids.add(eid)
        calm_words.append({
            "id": eid,
            "lemma": lem,
            "kind": "calm_word",
            "strength": "strong" if lem not in ("shadow", "dusk", "soft", "smooth", "shield") else "weak",
            "valence": val,
            "arousal": aro,
            "emotions": emos,
            "source": "curated:gemini-2026-09",
            "version": 1,
        })

    with open(os.path.join(LEXICONS_DIR, "calm_word.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "en", "kind": "calm_word", "version": 1, "entries": calm_words}, f, indent=1)
    print(f"EN calm_word: {len(calm_words)} entries")

    # -------------------------------------------------------------
    # 12. CONFLICT_SPEECH (Target: 45+)
    # Migrated from SPEECH_VERBS_EN (24 verbs) + expanded conflict verbs
    # -------------------------------------------------------------
    speech_verbs = []
    # All 24 verbs from J.SPEECH_VERBS_EN
    migrated_speech = [
        ("say", 0.0, 0.20, None, "weak", "neutral dialogue tag"),
        ("tell", 0.0, 0.25, None, "weak", "neutral narration tag"),
        ("ask", 0.05, 0.30, {"anticipation": 0.3}, "weak", "neutral question tag"),
        ("whisper", 0.20, 0.15, None, "weak", "quiet manner of speaking"),
        ("shout", -0.60, 0.75, {"anger": 0.6}, "strong", None),
        ("mutter", -0.45, 0.40, {"anger": 0.5}, "strong", None),
        ("reply", 0.0, 0.25, None, "weak", "neutral dialogue response"),
        ("snap", -0.60, 0.65, {"anger": 0.65}, "strong", None),
        ("growl", -0.65, 0.65, {"anger": 0.7}, "strong", None),
        ("hiss", -0.65, 0.65, {"anger": 0.7}, "strong", None),
        ("call", 0.0, 0.40, None, "weak", "calling someone vs loud shouting"),
        ("cry", -0.50, 0.65, {"sadness": 0.6}, "weak", "crying tears vs shouting in surprise"),
        ("exclaim", 0.10, 0.60, {"surprise": 0.6}, "strong", None),
        ("murmur", 0.10, 0.20, None, "weak", "quiet voice"),
        ("stammer", -0.40, 0.55, {"fear": 0.6}, "strong", None),
        ("bark", -0.65, 0.70, {"anger": 0.7}, "weak", "dog barking vs barking an order"),
        ("snarl", -0.75, 0.75, {"anger": 0.8}, "strong", None),
        ("plead", -0.60, 0.70, {"fear": 0.7, "sadness": 0.6}, "strong", None),
        ("demand", -0.45, 0.55, {"anger": 0.5}, "strong", None),
        ("insist", -0.35, 0.45, {"anger": 0.4}, "strong", None),
        ("think", 0.0, 0.20, None, "weak", "mental reflection"),
        ("wonder", 0.20, 0.35, {"surprise": 0.4}, "weak", "mental speculation"),
        ("muse", 0.15, 0.25, None, "weak", "contemplative thinking"),
        ("reflect", 0.10, 0.20, None, "weak", "mirror reflection vs pondering"),
    ]

    for term, val, aro, emos, strength, note in migrated_speech:
        lem = norm_lemma(term)
        eid = make_id("speech", lem)
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
            "source": "migrated:janitor.py",
            "version": 1,
        }
        if note:
            entry["note"] = note
        speech_verbs.append(entry)

    extra_speech = [
        ("yell", -0.65, 0.80, {"anger": 0.7}),
        ("screech", -0.75, 0.80, {"anger": 0.7, "fear": 0.7}),
        ("shriek", -0.80, 0.85, {"fear": 0.8, "anger": 0.7}),
        ("bellow", -0.75, 0.85, {"anger": 0.8}),
        ("roar", -0.80, 0.85, {"anger": 0.85}),
        ("sneer", -0.65, 0.65, {"disgust": 0.7, "anger": 0.5}),
        ("scoff", -0.50, 0.50, {"disgust": 0.5}),
        ("taunt", -0.65, 0.65, {"anger": 0.65}),
        ("jeer", -0.65, 0.65, {"disgust": 0.65}),
        ("mock", -0.60, 0.65, {"disgust": 0.6}),
        ("scold", -0.50, 0.55, {"anger": 0.6}),
        ("chide", -0.40, 0.45, {"anger": 0.5}),
        ("berate", -0.70, 0.70, {"anger": 0.75}),
        ("upbraid", -0.65, 0.65, {"anger": 0.7}),
        ("reproach", -0.50, 0.55, {"anger": 0.55}),
        ("threaten", -0.75, 0.75, {"anger": 0.75, "fear": 0.7}),
        ("intimidate", -0.75, 0.75, {"anger": 0.75}),
        ("challenge", -0.30, 0.60, {"anger": 0.5}),
        ("defy", -0.40, 0.65, {"anger": 0.6}),
        ("protest", -0.45, 0.55, {"anger": 0.5}),
        ("argue", -0.50, 0.55, {"anger": 0.55}),
        ("bicker", -0.50, 0.50, {"anger": 0.5}),
        ("squabble", -0.45, 0.45, {"anger": 0.45}),
        ("curse", -0.80, 0.80, {"anger": 0.85}),
        ("swear", -0.65, 0.70, {"anger": 0.7}),
        ("rage", -0.90, 0.90, {"anger": 0.95}),
        ("howl", -0.75, 0.85, {"sadness": 0.7, "anger": 0.7}),
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
        json.dump({"lang": "en", "kind": "conflict_speech", "version": 1, "entries": speech_verbs}, f, indent=1)
    print(f"EN conflict_speech: {len(speech_verbs)} entries")

    # -------------------------------------------------------------
    # 13. INTENSIFIER (Target: 30+)
    # -------------------------------------------------------------
    intensifiers = []
    intens_data = [
        ("very", 1.3), ("extremely", 1.6), ("incredibly", 1.6), ("deeply", 1.4), ("profoundly", 1.5),
        ("utterly", 1.7), ("completely", 1.6), ("totally", 1.6), ("absolutely", 1.7), ("entirely", 1.5),
        ("immensely", 1.6), ("enormously", 1.6), ("vastly", 1.5), ("tremendously", 1.6), ("intensely", 1.6),
        ("exceedingly", 1.5), ("exceptionally", 1.6), ("extraordinarily", 1.7), ("remarkably", 1.4),
        ("terribly", 1.5), ("awfully", 1.4), ("desperately", 1.5), ("wildly", 1.5), ("fiercely", 1.5),
        ("severely", 1.5), ("drastically", 1.5), ("overwhelmingly", 1.7), ("unbearably", 1.7),
        ("acutely", 1.5), ("bitterly", 1.4), ("thoroughly", 1.4), ("wholly", 1.5), ("purely", 1.3),
        ("unquestionably", 1.4), ("undeniably", 1.4)
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
        json.dump({"lang": "en", "kind": "intensifier", "version": 1, "entries": intensifiers}, f, indent=1)
    print(f"EN intensifier: {len(intensifiers)} entries")

    # -------------------------------------------------------------
    # 14. DIMINISHER (Target: 15+)
    # -------------------------------------------------------------
    diminishers = []
    dimin_data = [
        ("slightly", 0.7), ("somewhat", 0.7), ("barely", 0.4), ("scarcely", 0.4), ("hardly", 0.4),
        ("faintly", 0.5), ("vaguely", 0.5), ("mildly", 0.6), ("a little", 0.7), ("a bit", 0.7),
        ("marginally", 0.8), ("nominally", 0.8), ("partially", 0.6), ("partly", 0.6), ("fractionally", 0.7),
        ("scantily", 0.5), ("subtly", 0.6)
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
        json.dump({"lang": "en", "kind": "diminisher", "version": 1, "entries": diminishers}, f, indent=1)
    print(f"EN diminisher: {len(diminishers)} entries")

    # -------------------------------------------------------------
    # 15. NEGATOR (Target: 8+)
    # -------------------------------------------------------------
    negators = []
    neg_data = ["not", "never", "no", "neither", "nor", "none", "nowhere", "nothing", "hardly"]
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
        json.dump({"lang": "en", "kind": "negator", "version": 1, "entries": negators}, f, indent=1)
    print(f"EN negator: {len(negators)} entries")

    # -------------------------------------------------------------
    # 16. HEDGE (Target: 15+)
    # -------------------------------------------------------------
    hedges = []
    hedge_data = [
        "perhaps", "maybe", "possibly", "probably", "presumably", "apparently", "seemingly",
        "supposedly", "ostensibly", "conceivably", "arguably", "plausibly", "allegedly", "reportedly"
    ]
    for term in hedge_data:
        lem = norm_lemma(term)
        eid = make_id("hedge", lem)
        all_created_ids.add(eid)
        hedges.append({
            "id": eid,
            "lemma": lem,
            "kind": "hedge",
            "strength": "weak",
            "factor": 0.6,
            "source": "curated:gemini-2026-09",
            "version": 1,
        })
    for phrase in [["as", "if"], ["as", "though"], ["sort", "of"], ["kind", "of"]]:
        norm_phrase = [norm_lemma(w) for w in phrase]
        eid = make_id("hedge", "_".join(norm_phrase))
        all_created_ids.add(eid)
        hedges.append({
            "id": eid,
            "phrase": norm_phrase,
            "kind": "hedge",
            "strength": "weak",
            "factor": 0.5,
            "source": "curated:gemini-2026-09",
            "version": 1,
        })
    with open(os.path.join(LEXICONS_DIR, "hedge.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "en", "kind": "hedge", "version": 1, "entries": hedges}, f, indent=1)
    print(f"EN hedge: {len(hedges)} entries")

    # -------------------------------------------------------------
    # 17. SENSORY (Target: 300+ across all 5 senses)
    # Default: valence 0.0, arousal 0.1, emotions None
    # All migrated surface forms mapped to base lemmas with alt_lemmas
    # -------------------------------------------------------------
    sensory = []
    senses_map = {
        "sight": J.SIGHT_WORDS_EN,
        "sound": J.SOUND_WORDS_EN,
        "smell": J.SMELL_WORDS_EN,
        "touch": J.TOUCH_WORDS_EN,
        "taste": J.TASTE_WORDS_EN,
    }

    base_map = {
        "saw": "see", "seen": "see",
        "looks": "look", "looked": "look",
        "watched": "watch",
        "gazed": "gaze", "glanced": "glance", "stared": "stare", "glimpsed": "glimpse", "observed": "observe",
        "glowing": "glow", "blazing": "blaze", "sparkling": "sparkle", "shining": "shine", "shone": "shine",
        "spotted": "spot", "peered": "peer", "peering": "peer", "glittered": "glitter", "glimmered": "glimmer",
        "illuminated": "illuminate", "lit": "light", "dazzling": "dazzle", "dazzled": "dazzle", "squinted": "squint",
        "heard": "hear", "listened": "listen", "sounds": "sound", "noisy": "noise",
        "rang": "ring", "ringing": "ring", "crashed": "crash", "banged": "bang", "whispered": "whisper",
        "shouted": "shout", "roared": "roar", "hummed": "hum", "buzzed": "buzz", "creaked": "creak",
        "rustled": "rustle", "echoed": "echo", "clattered": "clatter", "murmured": "murmur", "rumbled": "rumble",
        "thundered": "thunder", "shrieked": "shriek", "squeaked": "squeak", "groaned": "groan", "whistled": "whistle",
        "snapped": "snap", "thudded": "thud", "clanged": "clang", "clicked": "click", "tapped": "tap",
        "rattled": "rattle", "voices": "voice",
        "smelled": "smell", "smelt": "smell", "smells": "smell", "scented": "scent", "odour": "odor",
        "stank": "stink", "reeked": "reek", "perfumed": "perfume", "sniffed": "sniff", "sniffing": "sniff",
        "feels": "feel", "felt": "feel", "touched": "touch", "touches": "touch", "warmth": "warm",
        "gripped": "grip", "pressed": "press", "squeezed": "squeeze", "stroked": "stroke", "brushed": "brush",
        "grasped": "grasp", "caressed": "caress", "scratched": "scratch", "pricked": "prick", "stung": "sting",
        "tingled": "tingle", "freezing": "freeze", "burning": "burn", "burned": "burn", "burnt": "burn",
        "shivered": "shiver", "trembled": "tremble",
        "tasted": "taste", "tastes": "taste", "flavour": "flavor", "savoury": "savory", "swallowed": "swallow",
        "bitten": "bite", "chewed": "chew", "licked": "lick", "gulped": "gulp", "sipped": "sip",
        "devoured": "devour", "savored": "savor"
    }

    # Inherently valenced sensory words
    valenced_sensory = {
        "stench": (-0.6, 0.5, {"disgust": 0.8}),
        "foul": (-0.65, 0.5, {"disgust": 0.85}),
        "reek": (-0.6, 0.5, {"disgust": 0.8}),
        "putrid": (-0.7, 0.6, {"disgust": 0.9}),
        "stink": (-0.6, 0.5, {"disgust": 0.8}),
        "rot": (-0.6, 0.5, {"disgust": 0.8}),
        "rancid": (-0.65, 0.5, {"disgust": 0.85}),
        "fragrant": (0.6, 0.3, {"joy": 0.6}),
        "fragrance": (0.6, 0.3, {"joy": 0.6}),
        "perfume": (0.5, 0.3, {"joy": 0.5}),
        "delicious": (0.7, 0.4, {"joy": 0.7}),
        "luscious": (0.7, 0.4, {"joy": 0.7}),
        "appetizing": (0.6, 0.4, {"joy": 0.6}),
        "succulent": (0.6, 0.3, {"joy": 0.6}),
        "scalding": (-0.7, 0.7, {"fear": 0.6}),
        "cacophony": (-0.5, 0.6, {"disgust": 0.5}),
        "pandemonium": (-0.6, 0.8, {"fear": 0.6}),
        "fetor": (-0.7, 0.6, {"disgust": 0.85}),
    }

    # Group migrated sense words by sense and base lemma
    migrated_entries = {}
    for sense_name, words in senses_map.items():
        for term in sorted(words):
            base = base_map.get(term, norm_lemma(term))
            key = (sense_name, base)
            if key not in migrated_entries:
                migrated_entries[key] = {"alts": set(), "source": "migrated:janitor.py"}
            if term != base:
                migrated_entries[key]["alts"].add(term)

    for (sense_name, base), info in migrated_entries.items():
        eid = make_id("sens", f"{sense_name}_{base}")
        all_created_ids.add(eid)
        val, aro, emos = valenced_sensory.get(base, (0.0, 0.1, None))
        entry = {
            "id": eid,
            "lemma": base,
            "kind": "sensory",
            "sense": sense_name,
            "strength": "weak" if base in ("see", "look", "hear", "feel", "touch", "taste", "smell", "sound", "light") else "strong",
            "valence": val,
            "arousal": aro,
            "emotions": emos,
            "source": "migrated:janitor.py",
            "version": 1,
        }
        if info["alts"]:
            entry["alt_lemmas"] = sorted(info["alts"])
            entry["lemma_evidence"] = "corpus"
        sensory.append(entry)

    # Extra sensory words to reach target
    extra_sensory = {
        "sight": [
            "crimson", "scarlet", "azure", "emerald", "golden", "silvery", "opaque", "translucent", "glare", "iridescent",
            "radiant", "luster", "murky", "dusk", "crystalline", "gleaming", "flicker", "beam", "flare", "beacon",
            "glint", "twinkle", "luminous", "incandescent", "phosphorescent", "dazzle", "glaze", "sheen", "gloss",
            "hazy", "foggy", "misty", "pitch", "inky", "ebon", "radiance", "iridescence", "gleam"
        ],
        "sound": [
            "cacophony", "din", "clamor", "discord", "symphony", "melody", "resonance", "timbre", "whimper", "drone",
            "clangor", "strident", "jarring", "muffled", "inaudible", "racket", "commotion", "uproar", "hubbub", "pandemonium",
            "peal", "toll", "chime", "clink", "jingle", "thump", "plop", "splash", "swish",
            "fizz", "sizzle", "crackle", "crank", "screech", "squawk", "caw", "hoot", "tinkle", "clatter"
        ],
        "smell": [
            "incense", "myrrh", "ozone", "pine", "cedar", "sulfur", "brimstone", "damp", "musk", "cinnamon",
            "vanilla", "vinegar", "ammonia", "brine", "decay", "pungency", "fetor", "miasma", "mustiness", "mold", "rot",
            "bouquet", "tang", "zest"
        ],
        "touch": [
            "frigid", "scalding", "clammy", "damp", "arid", "granite", "velvet", "sandpaper", "feather", "gelid",
            "searing", "tepid", "slick", "prickly", "satiny", "leathery", "woolen", "silken", "abrasive", "gritty",
            "pebbly", "greasy", "oily", "waxy", "tacky", "crusty", "brittle", "elastic",
            "rubbery", "springy", "pliant", "supple", "yielding", "unyielding", "rigid", "stiff", "limp", "flaccid",
            "silky", "velvety", "fleece"
        ],
        "taste": [
            "piquant", "luscious", "nectar", "briny", "tart", "peppery", "syrupy", "astringent",
            "honeyed", "zesty", "sourish", "sweetish", "appetizing", "succulent", "palatable", "toothsome", "flavorful",
            "sapid", "unpalatable", "distasteful", "unsavory", "spiced", "sweetened"
        ],
    }

    for sense_name, words in extra_sensory.items():
        for term in words:
            lem = norm_lemma(term)
            eid = make_id("sens", f"{sense_name}_{lem}")
            if eid in all_created_ids:
                continue
            all_created_ids.add(eid)
            val, aro, emos = valenced_sensory.get(lem, (0.0, 0.1, None))
            sensory.append({
                "id": eid,
                "lemma": lem,
                "kind": "sensory",
                "sense": sense_name,
                "strength": "strong",
                "valence": val,
                "arousal": aro,
                "emotions": emos,
                "source": "curated:gemini-2026-09",
                "version": 1,
            })

    with open(os.path.join(LEXICONS_DIR, "sensory.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "en", "kind": "sensory", "version": 1, "entries": sensory}, f, indent=1)
    print(f"EN sensory: {len(sensory)} entries")

    # -------------------------------------------------------------
    # 18. IDIOM (Target: 30+)
    # -------------------------------------------------------------
    idioms = [
        {"phrase": ["heart", "sink"], "blocks": [make_id("emo", "sad"), make_id("emonoun", "sorrow")], "valence": -0.7, "arousal": 0.4, "emotions": {"sadness": 0.8}},
        {"phrase": ["blood", "run", "cold"], "blocks": [make_id("emo", "afraid"), make_id("danger", "blood")], "valence": -0.85, "arousal": 0.85, "emotions": {"fear": 0.9}},
        {"phrase": ["beside", "oneself"], "blocks": [], "valence": -0.6, "arousal": 0.8, "emotions": {"anger": 0.6, "fear": 0.6}, "strength": "weak", "note": "spatial proximity vs overcome with emotion"},
        {"phrase": ["at", "wit", "end"], "blocks": [make_id("emo", "desperate")], "valence": -0.7, "arousal": 0.7, "emotions": {"fear": 0.7}},
        {"phrase": ["lump", "in", "throat"], "blocks": [make_id("emonoun", "grief")], "valence": -0.6, "arousal": 0.4, "emotions": {"sadness": 0.7}},
        {"phrase": ["make", "blood", "boil"], "blocks": [make_id("emo", "angry"), make_id("danger", "blood")], "valence": -0.85, "arousal": 0.9, "emotions": {"anger": 0.9}},
        {"phrase": ["fly", "into", "rage"], "blocks": [make_id("emonoun", "rage")], "valence": -0.9, "arousal": 0.9, "emotions": {"anger": 0.95}},
        {"phrase": ["breathe", "sigh", "of", "relief"], "blocks": [make_id("emo", "relieved")], "valence": 0.7, "arousal": 0.3, "emotions": {"joy": 0.7}},
        {"phrase": ["lose", "temper"], "blocks": [make_id("emo", "angry")], "valence": -0.75, "arousal": 0.8, "emotions": {"anger": 0.85}},
        {"phrase": ["on", "cloud", "nine"], "blocks": [make_id("emo", "happy")], "valence": 0.9, "arousal": 0.7, "emotions": {"joy": 0.9}},
        {"phrase": ["down", "in", "dump"], "blocks": [make_id("emo", "sad")], "valence": -0.7, "arousal": 0.3, "emotions": {"sadness": 0.8}},
        {"phrase": ["scared", "to", "death"], "blocks": [make_id("emo", "scared"), make_id("stakes", "death")], "valence": -0.9, "arousal": 0.9, "emotions": {"fear": 0.95}},
        {"phrase": ["grin", "from", "ear", "to", "ear"], "blocks": [make_id("emo", "happy")], "valence": 0.8, "arousal": 0.6, "emotions": {"joy": 0.85}},
        {"phrase": ["tear", "hair", "out"], "blocks": [make_id("emo", "frustrated")], "valence": -0.75, "arousal": 0.85, "emotions": {"anger": 0.8, "fear": 0.7}},
        {"phrase": ["chill", "to", "bone"], "blocks": [make_id("emo", "afraid")], "valence": -0.8, "arousal": 0.8, "emotions": {"fear": 0.85}},
        {"phrase": ["hair", "stand", "on", "end"], "blocks": [make_id("emo", "afraid")], "valence": -0.8, "arousal": 0.8, "emotions": {"fear": 0.85}},
        {"phrase": ["burst", "into", "tear"], "blocks": [make_id("emo", "sad")], "valence": -0.75, "arousal": 0.7, "emotions": {"sadness": 0.85}},
        {"phrase": ["grind", "teeth"], "blocks": [make_id("emo", "angry")], "valence": -0.65, "arousal": 0.7, "emotions": {"anger": 0.75}},
        {"phrase": ["foam", "at", "mouth"], "blocks": [make_id("emo", "furious")], "valence": -0.9, "arousal": 0.9, "emotions": {"anger": 0.95}},
        {"phrase": ["jump", "out", "of", "skin"], "blocks": [make_id("emo", "startled")], "valence": -0.4, "arousal": 0.8, "emotions": {"surprise": 0.8, "fear": 0.7}},
        {"phrase": ["green", "with", "envy"], "blocks": [make_id("emo", "jealous")], "valence": -0.7, "arousal": 0.6, "emotions": {"disgust": 0.7, "anger": 0.6}},
        {"phrase": ["swallow", "pride"], "blocks": [make_id("emonoun", "pride")], "valence": -0.4, "arousal": 0.4, "emotions": {"sadness": 0.5}},
        {"phrase": ["cross", "finger"], "blocks": [make_id("emo", "hopeful")], "valence": 0.5, "arousal": 0.5, "emotions": {"anticipation": 0.7}},
        {"phrase": ["heavy", "heart"], "blocks": [make_id("emo", "sad")], "valence": -0.75, "arousal": 0.3, "emotions": {"sadness": 0.8}},
        {"phrase": ["light", "at", "end", "of", "tunnel"], "blocks": [make_id("emo", "hopeful")], "valence": 0.7, "arousal": 0.5, "emotions": {"anticipation": 0.8, "joy": 0.6}},
        {"phrase": ["heart", "skip", "beat"], "blocks": [make_id("emo", "startled")], "valence": -0.2, "arousal": 0.7, "emotions": {"surprise": 0.8}},
        {"phrase": ["on", "pin", "and", "needle"], "blocks": [make_id("emo", "anxious")], "valence": -0.5, "arousal": 0.7, "emotions": {"anticipation": 0.6, "fear": 0.6}},
        {"phrase": ["in", "seventh", "heaven"], "blocks": [make_id("emo", "happy")], "valence": 0.9, "arousal": 0.7, "emotions": {"joy": 0.9}},
        {"phrase": ["hang", "head"], "blocks": [make_id("emo", "ashamed")], "valence": -0.65, "arousal": 0.3, "emotions": {"sadness": 0.7}},
        {"phrase": ["keep", "chin", "up"], "blocks": [make_id("emo", "hopeful")], "valence": 0.6, "arousal": 0.4, "emotions": {"trust": 0.7}},
        {"phrase": ["sick", "to", "stomach"], "blocks": [make_id("emo", "disgusted")], "valence": -0.8, "arousal": 0.6, "emotions": {"disgust": 0.85}},
        {"phrase": ["take", "breath", "away"], "blocks": [make_id("emo", "astonished")], "valence": 0.7, "arousal": 0.8, "emotions": {"surprise": 0.8, "joy": 0.7}},
        {"phrase": ["bite", "tongue"], "blocks": [make_id("emo", "angry")], "valence": -0.4, "arousal": 0.5, "emotions": {"anger": 0.6}},
        {"phrase": ["keep", "cool"], "blocks": [make_id("calm", "cool")], "valence": 0.5, "arousal": 0.3, "emotions": {"trust": 0.6}},
        {"phrase": ["lose", "cool"], "blocks": [make_id("emo", "angry")], "valence": -0.7, "arousal": 0.8, "emotions": {"anger": 0.8}},
        {"phrase": ["get", "on", "nerve"], "blocks": [make_id("emo", "annoyed")], "valence": -0.6, "arousal": 0.6, "emotions": {"anger": 0.7}},
        {"phrase": ["clench", "fist"], "blocks": [make_id("emo", "angry")], "valence": -0.6, "arousal": 0.7, "emotions": {"anger": 0.8}},
        {"phrase": ["drop", "jaw"], "blocks": [make_id("emo", "surprised")], "valence": 0.0, "arousal": 0.7, "emotions": {"surprise": 0.8}},
        {"phrase": ["turn", "pale"], "blocks": [make_id("emo", "afraid")], "valence": -0.6, "arousal": 0.7, "emotions": {"fear": 0.8}},
        {"phrase": ["cross", "arm"], "blocks": [make_id("emo", "defensive")], "valence": -0.3, "arousal": 0.4, "emotions": {"anger": 0.4}},
        {"phrase": ["raise", "eyebrow"], "blocks": [make_id("emo", "surprised")], "valence": 0.1, "arousal": 0.5, "emotions": {"surprise": 0.6}},
        {"phrase": ["shake", "in", "shoe"], "blocks": [make_id("emo", "afraid")], "valence": -0.8, "arousal": 0.8, "emotions": {"fear": 0.85}},
        {"phrase": ["see", "red"], "blocks": [make_id("emo", "furious")], "valence": -0.85, "arousal": 0.9, "emotions": {"anger": 0.95}},
    ]

    idiom_entries = []
    for idm in idioms:
        phrase = idm["phrase"]
        eid = make_id("idiom", "_".join(phrase))
        all_created_ids.add(eid)
        entry = {
            "id": eid,
            "phrase": phrase,
            "kind": "idiom",
            "strength": idm.get("strength", "strong"),
            "valence": idm["valence"],
            "arousal": idm["arousal"],
            "emotions": idm.get("emotions"),
            "blocks": [b for b in idm.get("blocks", []) if b in all_created_ids],
            "source": "curated:gemini-2026-09",
            "version": 1,
        }
        if "note" in idm:
            entry["note"] = idm["note"]
        idiom_entries.append(entry)

    with open(os.path.join(LEXICONS_DIR, "idiom.json"), "w", encoding="utf-8") as f:
        json.dump({"lang": "en", "kind": "idiom", "version": 1, "entries": idiom_entries}, f, indent=1)
    print(f"EN idiom: {len(idiom_entries)} entries")

    print("\nEnglish lexicons built successfully.")


if __name__ == "__main__":
    build_en_lexicons()
