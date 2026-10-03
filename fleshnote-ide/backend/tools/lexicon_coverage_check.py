"""Lexicon core coverage checker for FleshNote.

Verifies that a fixed battery of ~65 core intensity concepts (violence, urgency,
danger, stakes, conflict speech) have active lexical coverage in EN, HU, and PL.

Translations and concept definitions are sourced from general domain knowledge
of 19th-21st century narrative fiction.

Usage:
    cd backend
    .venv/Scripts/python.exe tools/lexicon_coverage_check.py
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, ".."))
LEXICONS_DIR = os.path.join(BACKEND, "lexicons")

INTENSITY_KINDS = (
    "action_violent",
    "action_urgent",
    "danger_noun",
    "stakes_word",
    "conflict_speech",
)

# Core narrative concepts: concept -> {lang: [acceptable_lemmas]}
CORE_CONCEPTS = {
    # ── Violence ──────────────────────────────────────────
    "kill": {
        "en": ["kill", "slay"],
        "hu": ["megöl", "öl"],
        "pl": ["zabić", "zabijać"],
    },
    "murder": {
        "en": ["murder"],
        "hu": ["gyilkol", "meggyilkol"],
        "pl": ["zamordować", "mordować"],
    },
    "shoot": {
        "en": ["shoot"],
        "hu": ["lő", "lelő", "agyonlő"],
        "pl": ["strzelać", "strzelić", "zastrzelić"],
    },
    "attack": {
        "en": ["attack", "assault"],
        "hu": ["megtámad", "támad", "rátámad"],
        "pl": ["zaatakować", "atakować", "napaść"],
    },
    "fight": {
        "en": ["fight", "battle"],
        "hu": ["harcol", "küzd", "verekszik"],
        "pl": ["walczyć", "bić", "stoczyć"],
    },
    "stab": {
        "en": ["stab"],
        "hu": ["leszúr", "döf", "szúr"],
        "pl": ["dźgnąć", "pchnąć"],
    },
    "strike": {
        "en": ["strike", "hit"],
        "hu": ["üt", "lecsap", "sújt"],
        "pl": ["uderzyć", "bić", "zadać"],
    },
    "wound_verb": {
        "en": ["wound"],
        "hu": ["megsebesít", "sebez"],
        "pl": ["zranić", "ranić"],
    },
    "strangle": {
        "en": ["strangle", "choke"],
        "hu": ["megfojt", "fojt"],
        "pl": ["udusić", "dusić"],
    },
    "drown": {
        "en": ["drown"],
        "hu": ["megfullad", "vízbefullad", "fullad"],
        "pl": ["utopić", "utonąć"],
    },
    "burn_act": {
        "en": ["burn"],
        "hu": ["éget", "megéget"],
        "pl": ["spalić", "palić"],
    },
    "execute": {
        "en": ["execute"],
        "hu": ["kivégez"],
        "pl": ["rozstrzelać", "ściąć"],
    },
    "bleed": {
        "en": ["bleed"],
        "hu": ["vérzik"],
        "pl": ["krwawić"],
    },
    "fall": {
        "en": ["fall"],
        "hu": ["zuhan", "elesik", "leesik"],
        "pl": ["upaść", "padać", "runąć"],
    },

    # ── Danger / Nouns ────────────────────────────────────
    "blood": {
        "en": ["blood"],
        "hu": ["vér"],
        "pl": ["krew"],
    },
    "wound_noun": {
        "en": ["wound"],
        "hu": ["seb", "sebesülés"],
        "pl": ["rana", "rać"],
    },
    "corpse": {
        "en": ["corpse"],
        "hu": ["holttest", "hulla"],
        "pl": ["trup", "trupa", "zwłoki"],
    },
    "danger": {
        "en": ["danger", "peril"],
        "hu": ["veszély", "veszedelem"],
        "pl": ["niebezpieczeństwo"],
    },
    "threat": {
        "en": ["threat"],
        "hu": ["fenyegetés"],
        "pl": ["zagrożenie"],
    },
    "enemy": {
        "en": ["enemy", "foe"],
        "hu": ["ellenség"],
        "pl": ["wróg", "nieprzyjaciel"],
    },
    "weapon": {
        "en": ["weapon"],
        "hu": ["fegyver"],
        "pl": ["broń"],
    },
    "gun": {
        "en": ["gun", "rifle"],
        "hu": ["puska", "karabély"],
        "pl": ["strzelba", "karabin"],
    },
    "pistol": {
        "en": ["pistol", "revolver"],
        "hu": ["pisztoly"],
        "pl": ["pistolet"],
    },
    "sword": {
        "en": ["sword"],
        "hu": ["kard"],
        "pl": ["miecz", "szabla"],
    },
    "blade": {
        "en": ["blade"],
        "hu": ["penge"],
        "pl": ["ostrze"],
    },
    "knife": {
        "en": ["knife", "dagger"],
        "hu": ["kés", "tőr"],
        "pl": ["nóż", "sztylet"],
    },
    "bullet": {
        "en": ["bullet"],
        "hu": ["golyó", "lövedék"],
        "pl": ["kula", "pocisk"],
    },
    "arrow": {
        "en": ["arrow"],
        "hu": ["nyíl"],
        "pl": ["strzała", "strzać"],
    },
    "trap": {
        "en": ["trap", "ambush"],
        "hu": ["csapda", "lesvetés"],
        "pl": ["pułapka", "zasadzka"],
    },
    "poison": {
        "en": ["poison", "venom"],
        "hu": ["méreg"],
        "pl": ["trucizna", "jad"],
    },
    "fire": {
        "en": ["fire"],
        "hu": ["tűz"],
        "pl": ["ogień", "pożar"],
    },
    "flame": {
        "en": ["flame"],
        "hu": ["láng"],
        "pl": ["płomień"],
    },
    "monster": {
        "en": ["monster", "beast"],
        "hu": ["szörnyeteg", "fenevad"],
        "pl": ["potwór", "bestia"],
    },
    "abyss": {
        "en": ["abyss", "chasm"],
        "hu": ["szakadék", "örvény"],
        "pl": ["przepaść", "otchłań"],
    },
    "bomb": {
        "en": ["bomb", "explosion"],
        "hu": ["bomba", "robbanás"],
        "pl": ["bomba", "wybuch"],
    },

    # ── Stakes / Mortality ────────────────────────────────
    "die": {
        "en": ["die"],
        "hu": ["meghal"],
        "pl": ["umrzeć", "umierać"],
    },
    "dead": {
        "en": ["dead"],
        "hu": ["halott"],
        "pl": ["martwy", "zabity"],
    },
    "death": {
        "en": ["death"],
        "hu": ["halál"],
        "pl": ["śmierć"],
    },
    "grave": {
        "en": ["grave", "tomb"],
        "hu": ["sír", "sírbolt"],
        "pl": ["grób", "groba", "mogiła"],
    },
    "funeral": {
        "en": ["funeral"],
        "hu": ["temetés"],
        "pl": ["pogrzeb"],
    },
    "survive": {
        "en": ["survive", "survival"],
        "hu": ["túlél", "túlélés"],
        "pl": ["przetrwać", "ocalenie"],
    },
    "perish": {
        "en": ["perish"],
        "hu": ["elpusztul", "pusztulás"],
        "pl": ["zginąć", "ginąć"],
    },
    "lose": {
        "en": ["lose", "loss"],
        "hu": ["elveszít", "veszteség"],
        "pl": ["stracić", "strata"],
    },
    "doom": {
        "en": ["doom", "destruction"],
        "hu": ["végzet", "megsemmisülés"],
        "pl": ["zagłada", "zagładać", "zguba"],
    },
    "fate": {
        "en": ["fate", "destiny"],
        "hu": ["sors"],
        "pl": ["przeznaczenie", "fatum", "los"],
    },
    "ruin": {
        "en": ["ruin"],
        "hu": ["romlás"],
        "pl": ["ruina"],
    },
    "forever": {
        "en": ["forever", "nevermore"],
        "hu": ["örökre", "örökké"],
        "pl": ["wieczność", "zawsze"],
    },

    # ── Urgency & Fast Motion ─────────────────────────────
    "rush": {
        "en": ["rush"],
        "hu": ["rohan", "elrohan"],
        "pl": ["pędzić", "popędzić"],
    },
    "dash": {
        "en": ["dash", "sprint"],
        "hu": ["száguld", "szalad"],
        "pl": ["gnać", "pognać", "biec"],
    },
    "flee": {
        "en": ["flee"],
        "hu": ["menekül", "elmenekül"],
        "pl": ["uciekać", "uciec"],
    },
    "escape": {
        "en": ["escape"],
        "hu": ["megszökik", "szökik", "elszökik"],
        "pl": ["ucieczka", "umknąć", "umykać"],
    },
    "leap": {
        "en": ["leap"],
        "hu": ["ugrik", "felugrik", "kiugrik"],
        "pl": ["skoczyć", "skakać"],
    },
    "chase": {
        "en": ["chase", "pursuit"],
        "hu": ["üldöz", "üldözés", "hajszol"],
        "pl": ["ścigać", "pościg", "gonić"],
    },
    "hurry": {
        "en": ["hurry", "haste"],
        "hu": ["siet", "elsiet"],
        "pl": ["spieszyć", "pośpieszyć"],
    },
    "dive": {
        "en": ["dive", "lunge"],
        "hu": ["vetődik", "rávetődik"],
        "pl": ["rzucić", "rzucić_się"],
    },
    "stagger": {
        "en": ["stagger", "falter"],
        "hu": ["tántorog", "megtántorodik"],
        "pl": ["zataczać", "zatoczyć"],
    },
    "trip": {
        "en": ["trip", "slip"],
        "hu": ["megbotlik", "megcsúszik"],
        "pl": ["potknąć", "potykać", "poślizgnąć"],
    },
    "retreat": {
        "en": ["retreat"],
        "hu": ["hátrál", "meghátrál"],
        "pl": ["wycofać", "cofać"],
    },
    "evade": {
        "en": ["evade", "dodge"],
        "hu": ["kitér", "elhajol"],
        "pl": ["unikać", "uniknąć", "uchylić"],
    },

    # ── Conflict Speech ───────────────────────────────────
    "scream": {
        "en": ["scream"],
        "hu": ["sikolt", "sikol", "sikoly"],
        "pl": ["krzyczeć", "krzyk"],
    },
    "shriek": {
        "en": ["shriek", "screech"],
        "hu": ["visít", "visítás"],
        "pl": ["wrzeszczeć", "wrzask"],
    },
    "yell": {
        "en": ["yell", "shout"],
        "hu": ["ordít", "kiált", "kiáltás"],
        "pl": ["wrzasnąć", "krzyknąć"],
    },
    "roar": {
        "en": ["roar", "bellow"],
        "hu": ["üvölt", "üvöltés"],
        "pl": ["ryczeć", "ryk"],
    },
    "curse": {
        "en": ["curse"],
        "hu": ["átkoz", "átok", "átkozódik"],
        "pl": ["przeklinać", "klątwa"],
    },
    "threaten": {
        "en": ["threaten"],
        "hu": ["fenyeget", "fenyegetőzik"],
        "pl": ["grozić"],
    },
    "plead": {
        "en": ["plead", "beg"],
        "hu": ["könyörög", "esdekel"],
        "pl": ["błagać"],
    },
    "wail": {
        "en": ["wail", "sob"],
        "hu": ["jajgat", "zokog"],
        "pl": ["szlochać", "łkać", "lamentować"],
    },
}


def load_lexicon_lemmas(lang: str) -> set[str]:
    lemmas = set()
    lang_dir = os.path.join(LEXICONS_DIR, lang)
    for kind in INTENSITY_KINDS:
        fpath = os.path.join(lang_dir, f"{kind}.json")
        if not os.path.isfile(fpath):
            continue
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        for entry in data.get("entries", []):
            if "lemma" in entry and entry["lemma"]:
                lemmas.add(entry["lemma"].lower())
            for alt in entry.get("alt_lemmas") or []:
                lemmas.add(alt.lower())
    return lemmas


def run_coverage_check() -> bool:
    print("=" * 60)
    print(f"RUNNING LEXICON COVERAGE CHECK ({len(CORE_CONCEPTS)} core concepts)")
    print("=" * 60)

    languages = ["en", "hu", "pl"]
    lexicon_lemmas = {lang: load_lexicon_lemmas(lang) for lang in languages}

    all_passed = True
    missing_by_lang = {lang: [] for lang in languages}

    for concept, targets in sorted(CORE_CONCEPTS.items()):
        for lang in languages:
            expected_list = targets.get(lang, [])
            if not expected_list:
                continue
            matched = any(exp.lower() in lexicon_lemmas[lang] for exp in expected_list)
            if not matched:
                missing_by_lang[lang].append((concept, expected_list))
                all_passed = False

    for lang in languages:
        missing = missing_by_lang[lang]
        if missing:
            print(f"\n[{lang.upper()}] FAILED ({len(missing)} missing concepts):")
            for concept, exp in missing:
                print(f"  - {concept:16s} expected one of: {exp}")
        else:
            print(f"[{lang.upper()}] All {len(CORE_CONCEPTS)} core concepts covered! (0 missing)")

    print("\n" + "=" * 60)
    if all_passed:
        print(f"RESULT: PASSED — All {len(CORE_CONCEPTS)} core concepts covered in all 3 languages.")
    else:
        print("RESULT: FAILED — Some core concepts are missing.")
    print("=" * 60)

    return all_passed


if __name__ == "__main__":
    ok = run_coverage_check()
    sys.exit(0 if ok else 1)
