import random
import re
from typing import Literal
from pydantic import BaseModel, Field
from string import capwords

class LocationNameGenConfig(BaseModel):
    genre: Literal["fantasy", "scifi"] = "fantasy"
    geography: str = ""
    history: str = ""
    founder: str = ""
    native_tongue: str = ""
    mythos: str = ""
    drift: int = Field(0, ge=0, le=100)
    language: str = "en"
    site_type: str = "planet"
    importance: str = "medium"

def _extract_pos(text: str, nlp, allowed_pos: set) -> list[str]:
    if not text.strip():
        return []
    try:
        doc = nlp(text)
        # Filter tokens by requested parts of speech and grab text
        tokens = [token.text for token in doc if token.pos_ in allowed_pos and not token.is_stop]
        if not tokens:
            # Fallback to just the words if pos tagging failed or stripped everything
            tokens = [w for w in text.split() if w]
        return tokens
    except Exception:
        # Fallback if NLP fails entirely
        return [w for w in text.split() if w]

def _cmudict_phonemes(word: str) -> list[str] | None:
    try:
        from nltk.corpus import cmudict
        d = cmudict.dict()
        w_lower = word.lower()
        if w_lower in d:
            return d[w_lower][0] # Return the first pronunciation variant
    except Exception:
        pass
    return None

def _apply_phonetic_drift(word: str, drift: int) -> str:
    """Simulate linguistic evolution / phonetic drift over time."""
    if drift == 0 or not word:
        return word
        
    phonemes = _cmudict_phonemes(word)
    # If word not in cmudict, do some rough heuristic string replacements
    if not phonemes:
        w = word.lower()
        if drift > 30:
            # Elision (drop middle weak vowels)
            w = re.sub(r'([bcdfgjklmnpqrstvwxz])[aeiou]+([bcdfgjklmnpqrstvwxz])', r'\1\2', w, 1)
        if drift > 70:
            # Drop trailing syllables roughly
            w = re.sub(r'[aeiou]+[bcdfgjklmnpqrstvwxz]+$', '', w)
        if drift > 10:
            # Lenition
            w = w.replace('p', 'b').replace('t', 'd').replace('k', 'g')
        reconstructed = w
    else:
        # If we have phonemes, we apply drift rules
        # NLTK cmudict uses Arpabet: AE1, B, D, ER0, etc.
        res_phonemes = []
        for ph in phonemes:
            p = ph.upper()
            # Lenition: softened consonants
            if drift >= 10:
                lenition_map = {'P': 'B', 'T': 'D', 'K': 'G', 'F': 'V', 'S': 'Z'}
                if p in lenition_map:
                    p = lenition_map[p]
            
            # Elision: drop unstressed vowels
            if drift >= 30:
                if p.endswith('0'): # unstressed
                    continue 
                    
            res_phonemes.append(p)
            
        # Assimilation/Truncation
        if drift >= 70:
            if len(res_phonemes) > 2:
                res_phonemes = res_phonemes[:-1] # drop last sound
            
            # Merge adjacent identical consonants
            merged = []
            for p in res_phonemes:
                if not merged or merged[-1] != p:
                    merged.append(p)
            res_phonemes = merged

        # Map back to string. This is a very rough Arpabet-to-English mapping
        r_map = {
            'AA': 'A', 'AE': 'A', 'AH': 'U', 'AO': 'O', 'AW': 'OW', 'AY': 'Y', 'B': 'B', 'CH': 'CH',
            'D': 'D', 'DH': 'TH', 'EH': 'E', 'ER': 'ER', 'EY': 'AY', 'F': 'F', 'G': 'G', 'HH': 'H',
            'IH': 'I', 'IY': 'EE', 'JH': 'J', 'K': 'C', 'L': 'L', 'M': 'M', 'N': 'N', 'NG': 'NG',
            'OW': 'O', 'OY': 'OY', 'P': 'P', 'R': 'R', 'S': 'S', 'SH': 'SH', 'T': 'T', 'TH': 'TH',
            'UH': 'OO', 'UW': 'OO', 'V': 'V', 'W': 'W', 'Y': 'Y', 'Z': 'Z', 'ZH': 'SU'
        }
        
        reconstructed = ""
        for ph in res_phonemes:
            # Strip stress numbers (0, 1, 2)
            base_ph = ''.join([c for c in ph if not c.isdigit()])
            reconstructed += r_map.get(base_ph, base_ph.lower())
            
    # Prevent 3-4 consonant stacking
    vowels = set("aeiouy")
    final_reconstructed = ""
    cons_count = 0
    for char in reconstructed:
        if not char.isalpha():
            cons_count = 0
            final_reconstructed += char
            continue
            
        if char.lower() not in vowels:
            cons_count += 1
            if cons_count >= 3:
                # Insert a fitting vowel to break the cluster
                final_reconstructed += random.choice(['a', 'o', 'e', 'u', 'i'])
                cons_count = 1
            final_reconstructed += char
        else:
            cons_count = 0
            final_reconstructed += char
            
    # Clean up any weird double identical vowels created occasionally
    final_reconstructed = re.sub(r'([aeiou])\1+', r'\1', final_reconstructed)
        
    return final_reconstructed.capitalize()

def _harmonize_and_shorten(word: str) -> str:
    """Randomly shorten long words and harmonize vowels for better flow."""
    if not word or len(word) < 7:
        return word
        
    w = word.lower()
    if "szelawil" in w: w = w.replace("szelawil", "szewil")
    
    chop_chance = min(0.9, (len(w) - 6) * 0.15)
    if random.random() < chop_chance:
        vowels = set("aeiouy")
        v_count = 0
        cut_idx = len(w)
        for i, char in enumerate(w):
            if char in vowels:
                v_count += 1
                if v_count == 2 and i >= 3:
                    cut_idx = i + 1
                    if i + 1 < len(w) and w[i+1] not in vowels:
                        cut_idx += 1
                    break
        
        if len(w) - cut_idx >= 3:
            w = w[:cut_idx]
            if random.random() > 0.5:
                if w[-1] not in vowels:
                    w += random.choice(['o', 'a', 'y', 'i', 'e'])
                elif random.random() > 0.5:
                    w = w[:-1] + random.choice(['o', 'a', 'y'])
                        
    if w.count('a') > 1 and 'e' in w:
        w = w.replace('e', 'a')
    elif w.count('e') > 1 and 'a' in w:
        w = w.replace('a', 'e')
        
    if word[0].isupper(): return w.capitalize()
    return w

def generate_location_name(config: LocationNameGenConfig) -> str:
    import sys
    import os
    # We must be able to import backend modules properly
    from nlp_manager import get_nlp
    from nltk_manager import ensure_cmudict_available, get_synonyms

    ensure_cmudict_available()

    # 1. Pipeline NLP setup
    try:
        nlp = get_nlp(config.language)
    except Exception:
        nlp = get_nlp("en") # fallback

    # filter out generic filler words
    filler_words = {"the", "a", "an", "of", "and", "in", "on", "at", "to", "for", "with", "is", "are", "was", "were", "land", "place", "area", "work", "job", "lot", "many", "days", "hard", "great", "some", "very", "much"}
    
    # helper for introducing synonyms to spice up generation and prevent literal 1:1 mapped names
    def enrich_with_synonyms(words, lang="eng"):
        enriched = list(words)
        for w in words:
            if random.random() > 0.5:
                groups = get_synonyms(w, lang)
                for group in groups:
                    if group.get("synonyms"):
                        # Mix up the group array without modifying original
                        mixed = list(group["synonyms"])
                        random.shuffle(mixed)
                        for syn in mixed:
                            # Use clean single word synonyms that aren't filler
                            if "_" not in syn and "-" not in syn and syn.lower() not in filler_words:
                                enriched.append(syn)
                                break
        return enriched

    nltk_lang = "eng" if config.language == "en" else config.language
    
    geo_nouns = enrich_with_synonyms([n for n in _extract_pos(config.geography, nlp, {"NOUN", "PROPN"}) if n.lower() not in filler_words], nltk_lang)
    geo_adjs = enrich_with_synonyms([n for n in _extract_pos(config.geography, nlp, {"ADJ"}) if n.lower() not in filler_words], nltk_lang)
    hist_nouns = enrich_with_synonyms([n for n in _extract_pos(config.history, nlp, {"NOUN", "PROPN"}) if n.lower() not in filler_words], nltk_lang)
    founders = enrich_with_synonyms([n for n in _extract_pos(config.founder, nlp, {"PROPN", "NOUN"}) if n.lower() not in filler_words], nltk_lang)
    mythos = enrich_with_synonyms([n for n in _extract_pos(config.mythos, nlp, {"PROPN", "NOUN"}) if n.lower() not in filler_words], nltk_lang)
    native_words = [n for n in config.native_tongue.split() if n.lower() not in filler_words]

    # Normalize extracted variables to prevent duplicates across categories
    all_extracted = set()
    def get_diff_choice(choices, default_val):
        if not choices: return default_val
        valid = [c for c in choices if c.lower() not in all_extracted]
        if not valid: valid = choices
        ch = random.choice(valid)
        all_extracted.add(ch.lower())
        return ch

    geo_noun = get_diff_choice(geo_nouns, "Peak" if config.genre=="fantasy" else "Sector").lower()
    hist_noun = get_diff_choice(hist_nouns, "Valor" if config.genre=="fantasy" else "Void").lower()
    geo_adj = get_diff_choice(geo_adjs, "High" if config.genre=="fantasy" else "Dark").lower()
    founder = get_diff_choice(founders, "Aethel").capitalize()
    myth = get_diff_choice(mythos, "Ares").capitalize()
    native = get_diff_choice(native_words, "Tor").capitalize()

    # 3. Rule sets
    options = []
    
    if config.genre == "fantasy":
        # A. Literal Combinations
        base = ""
        if random.random() > 0.4 and geo_adj != "dark":
            base = geo_adj + geo_noun
        elif hist_noun != "valor" and geo_noun != "peak":
            base = hist_noun + geo_noun
        else:
            base = geo_adj + hist_noun + geo_noun
            
        base = base.capitalize()
        # Apply drift if > 0
        if config.drift > 0:
            options.append(_apply_phonetic_drift(base, config.drift))
            if config.drift > 30 and random.random() > 0.5:
                options.append(_apply_phonetic_drift(founder + geo_noun, config.drift))
        
        options.append(base)
            
        # B. Eponymous
        suffixes = ['ton', 'bury', 'ford', 'grad', 'ov', 'heim', 'vik', 'ville', 'keep', 'hold', 'watch', 'wood', 'stone', 'gate']
        options.append(founder + random.choice(suffixes))
        if random.random() > 0.5:
            options.append(f"{founder}'s {random.choice(['Rest', 'Fall', 'Folly', 'Hope', 'Fjord', 'Peak', geo_noun.capitalize()])}")
        
        # C. Native Translation
        if config.native_tongue and native != "Tor":
            options.append(native + geo_noun)
            if config.drift > 20:
                options.append(_apply_phonetic_drift(native + hist_noun, config.drift))
            else:
                options.append(native + hist_noun)
            
        # D. Blended & Descriptive
        if random.random() > 0.4:
            options.append(f"{capwords(geo_adj)} {geo_noun.capitalize()}")
        if random.random() > 0.4:
            options.append(f"The {hist_noun.capitalize()} {geo_noun.capitalize()}")
            
        # Add random prefixes occasionally
        if random.random() > 0.7:
            prefix = random.choice(["Old", "New", "High", "Low", "Far", "Inner"])
            options.append(f"{prefix} {founder}")

    elif config.genre == "scifi":
        importance = getattr(config, "importance", "medium")
        stype = getattr(config, "site_type", "planet")
        
        # Suffixes mapped by site type
        site_suffixes = {
            "planet": ["Prime", "Minor", "World", "Globe", "Reach", "Fall"],
            "colony": ["Haven", "Settlement", "Colony", "Outpost", "Base", "Landing", "Hope"],
            "facility": ["Station", "Terminal", "Hub", "Node", "Lab", "Array", "Nexus"],
            "system": ["System", "Sector", "Cluster", "Nebula", "Expanse"]
        }
        
        suffixes = site_suffixes.get(stype, site_suffixes["planet"])
        if not suffixes: suffixes = ["Prime"]
        
        # A. Catalog numbers (Low importance heavy)
        prefixes = ["HD", "KPL", "NGC", "PSR", "GLS", "CRN", "XG"]
        greek = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]
        catalog = f"{random.choice(prefixes)}-{random.randint(10, 9999)}"
        if stype == "planet": catalog += random.choice(['a','b','c','d','e'])
        if importance == "high":
            catalog += f" {random.choice(greek)}"
        if importance == "low" or random.random() > 0.7:
            options.append(catalog)
            
        # B. Acronyms based on inputs
        words = config.history.split() + config.geography.split() + config.founder.split()
        words = [w for w in words if len(w) > 2] # Drop small words
        if words:
            acronym = "".join([w[0].upper() for w in words])[:4]
            if len(acronym) >= 2:
                acronym += f"-{random.randint(1, 99)}"
                if importance == "low" or random.random() > 0.5:
                    options.append(acronym)
                if stype in ("facility", "colony"):
                    options.append(f"Site {acronym}")
                    options.append(f"{random.choice(site_suffixes[stype])} {acronym}")
                    
        # C. Corporate Rebrand
        if founder and founder != "Aethel":
            options.append(f"{founder} {random.choice(suffixes)}")
            if importance in ("medium", "high") and stype == "planet":
                options.append(f"{founder} Prime")
                
        # D. Mythos Translation (High importance heavy)
        numerals = ["I", "II", "III", "IV", "V", "X"]
        if myth and myth != "Ares":
            if importance in ("medium", "high"):
                options.append(f"{myth} {random.choice(numerals)}")
                options.append(f"New {myth}")
            if importance == "high":
                options.append(f"{myth}'s {random.choice(['Rest', 'Vanguard', 'Glory', 'Anvil', 'Eye'])}")
                
        # E. Blended Characteristics
        if hist_noun and hist_noun != "void":
            if importance == "high":
                options.append(f"The {hist_noun.capitalize()} {random.choice(suffixes)}")
            else:
                options.append(f"{hist_noun.capitalize()} {random.choice(suffixes)}")
                
        if geo_adj and geo_adj != "dark":
            if stype == "planet":
                options.append(f"{geo_adj.capitalize()} {geo_noun.capitalize()}")
            else:
                options.append(f"{geo_adj.capitalize()} {random.choice(suffixes)}")

        # Fallback if somehow options is empty
        if not options:
            options.append(f"{hist_noun.capitalize()} {random.choice(suffixes)}")

    # Randomly shorten and harmonize pieces
    final_options = []
    for opt in options:
        parts = opt.split()
        harmonized_parts = []
        for p in parts:
            if random.random() < 0.6:  # 60% chance to attempt shortening on any long part
                harmonized_parts.append(_harmonize_and_shorten(p))
            else:
                harmonized_parts.append(p)
        final_options.append(" ".join(harmonized_parts).strip())

    # Ensure options are unique 
    options_set = list(set(final_options))
    return random.choice(options_set) if options_set else "Unknown"
