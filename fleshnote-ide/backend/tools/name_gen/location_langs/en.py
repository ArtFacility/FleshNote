import random
import re
from typing import List, Optional

# ─── Fallback pools — drawn randomly so empty-input runs stay varied ─────────
_FALLBACK_GEO_NOUNS  = ["fell", "moor", "crag", "fen", "tor", "mere", "weald",
                         "heath", "holm", "beck", "wold", "holt", "dene", "lea"]
_FALLBACK_GEO_ADJS   = ["grey", "stark", "dim", "old", "far", "cold", "still",
                         "black", "pale", "deep", "ash", "iron", "lost", "fell"]
_FALLBACK_FOUNDERS   = ["Edric", "Maren", "Aldric", "Sewyn", "Brynn", "Oswin",
                         "Elwyn", "Calder", "Vael", "Sorn", "Gareth", "Kira",
                         "Thorn", "Linne", "Erric", "Dawyn"]
_FALLBACK_HIST_NOUNS = ["ash", "dusk", "siege", "pyre", "toll", "oath",
                         "sorrow", "crown", "ruin", "wake", "brand", "wraith"]
_FALLBACK_MYTHS      = ["Vael", "Sorath", "Miren", "Caern", "Wrath",
                         "Dusk", "Ashur", "Thorn", "Mael"]

# ─── Suffix families, organized by linguistic origin ─────────────────────────
_SUFFIXES_OLD_ENGLISH = ["burg", "ham", "ford", "wick", "thorpe", "ley",
                          "stow", "worth", "den", "dene", "mere", "holt", "burn"]
_SUFFIXES_NORSE       = ["vik", "heim", "fjord", "dal", "by", "nes",
                          "fell", "beck", "thwaite", "garth", "ness"]
_SUFFIXES_FANTASY     = ["keep", "hold", "watch", "stone", "gate", "reach",
                          "mark", "ward", "crest", "spire", "vale", "maw", "wall"]

# Possessive descriptors for "[Founder]'s X" patterns
_POSSESSIVES = ["Rest", "Fall", "Folly", "Hope", "Watch", "Keep",
                 "Reach", "End", "Last", "Cross", "Grief", "Wake", "Mark"]

# Directional & age prefixes
_PREFIXES = ["Old", "New", "High", "Low", "Far", "Lost", "Ash",
              "Dark", "Bright", "Last", "Dead"]


class EnglishLocationStrategy:

    def _fallback(self, pool: list) -> str:
        return random.choice(pool)

    def _pick_suffix_family(self) -> list:
        """Pick one linguistic suffix family to keep a batch internally consistent."""
        return random.choice([_SUFFIXES_OLD_ENGLISH, _SUFFIXES_NORSE, _SUFFIXES_FANTASY])

    def _stem(self, word: str, max_len: int = 8) -> str:
        """
        Strip common derivational suffixes to get a root suitable for compounding.
        Only returns the stripped form if the result is still >= 3 chars and
        the compound won't be illegibly long.
        """
        w = word.lower()
        for suffix in ["tion", "ation", "ness", "ment", "ity", "ing",
                        "ure", "ance", "ence", "ism", "al", "ous"]:
            if w.endswith(suffix) and len(w) - len(suffix) >= 3:
                w = w[:-len(suffix)]
                break
        # Safety: don't return an ugly root
        if len(w) < 3:
            return word.lower()
        if not any(c in "aeiouy" for c in w):
            return word.lower()  # all-consonant root — unusable
        return w

    def generate_options(self, config, context: dict) -> List[str]:
        if config.genre != "fantasy":
            return []  # Sci-fi deferred

        # ─── Resolve context — None means field was empty ─────────────────
        geo_noun_raw  = context.get("geo_noun")
        geo_adj_raw   = context.get("geo_adj")
        hist_noun_raw = context.get("hist_noun")
        founder_raw   = context.get("founder")
        myth_raw      = context.get("myth")
        native_raw    = context.get("native")

        # Fallbacks for structure words (geo always needs something)
        geo_noun  = geo_noun_raw  or self._fallback(_FALLBACK_GEO_NOUNS)
        geo_adj   = geo_adj_raw   or self._fallback(_FALLBACK_GEO_ADJS)
        hist_noun = hist_noun_raw or self._fallback(_FALLBACK_HIST_NOUNS)

        # Founders and myths only appear if the user actually provided them
        founder: Optional[str] = founder_raw
        myth: Optional[str]    = myth_raw

        options = []
        suffixes = self._pick_suffix_family()

        # Pre-compute stems for compounding
        adj_stem  = self._stem(geo_adj)
        noun_stem = self._stem(geo_noun)
        hist_stem = self._stem(hist_noun)

        # ─── Track 1A: Adj+Geo compound (single word) ─────────────────────
        comp_ag = adj_stem + noun_stem
        if 5 <= len(comp_ag) <= 14:
            options.append(comp_ag.capitalize())
            if config.drift > 0:
                options.append(self.apply_phonetic_drift(comp_ag.capitalize(), config.drift))

        # Track 1B: Hist+Geo compound — only if history was real input
        if hist_noun_raw:
            comp_hg = hist_stem + noun_stem
            if 5 <= len(comp_hg) <= 14:
                options.append(comp_hg.capitalize())
                if config.drift > 15:
                    options.append(self.apply_phonetic_drift(comp_hg.capitalize(), config.drift))

        # ─── Track 2: Spaced two-word ─────────────────────────────────────
        # Classic "[Adj] [Geo]" — always available
        options.append(f"{geo_adj.capitalize()} {geo_noun.capitalize()}")

        # "[Geo_adj] [Geo_noun]" with mythic/history flavour
        if hist_noun_raw:
            options.append(f"The {hist_noun.capitalize()} {geo_noun.capitalize()}")

        # Directional / age prefix — 50% chance, randomized
        if random.random() > 0.4:
            prefix    = self._fallback(_PREFIXES)
            base_word = random.choice([geo_adj.capitalize(), geo_noun.capitalize()])
            options.append(f"{prefix} {base_word}")

        # ─── Track 3: Eponymous — only if founder present ─────────────────
        if founder:
            # Take just the first name token for compounds
            fname = founder.split()[0].capitalize()

            # Single-word: first-name + suffix
            suf = random.choice(suffixes)
            eponymous = fname + suf
            if len(eponymous) <= 16:
                options.append(eponymous)
            if config.drift > 0:
                options.append(self.apply_phonetic_drift(eponymous, config.drift))

            # Possessive: "[Name]'s [Descriptor]"
            options.append(f"{fname}'s {self._fallback(_POSSESSIVES)}")

            # Compound with geo: "[Name][geo]" — only if short enough
            fgeo = fname + geo_noun.lower()
            if len(fgeo) <= 16:
                options.append(fgeo.capitalize())

        # ─── Track 4: Native tongue influence ─────────────────────────────
        if native_raw and config.native_tongue:
            native_stem = self._stem(native_raw, 6)
            native_comp = native_stem + noun_stem
            if 4 <= len(native_comp) <= 14:
                options.append(native_comp.capitalize())
            if hist_noun_raw and config.drift > 15:
                native_hist = self._stem(native_raw, 6) + hist_stem
                if 4 <= len(native_hist) <= 14:
                    options.append(
                        self.apply_phonetic_drift(native_hist.capitalize(), config.drift)
                    )

        # ─── Track 5: Myth-derived ────────────────────────────────────────
        if myth:
            myth_word = myth.split()[0].capitalize()  # First token
            # Myth + suffix
            myth_suf = myth_word + random.choice(suffixes)
            if len(myth_suf) <= 16:
                options.append(myth_suf)
            # Myth + geo compound
            myth_geo = myth_word.lower() + noun_stem
            if 5 <= len(myth_geo) <= 14:
                if config.drift > 0:
                    options.append(self.apply_phonetic_drift(myth_geo.capitalize(), config.drift))
                else:
                    options.append(myth_geo.capitalize())

        return options

    def apply_phonetic_drift(self, word: str, drift: int) -> str:
        """
        Three-tier historically-grounded phonetic drift.

        Tier 1 (1-30):  Lenition   — soft consonant voicing, still clearly readable
        Tier 2 (31-60): Syncope    — vowel reduction, syllable compression
        Tier 3 (61-100): Compression — aggressive trimming to 1-2 syllable root
        """
        if drift == 0 or not word:
            return word

        w = word.lower().rstrip("'")
        vowels = "aeiouy"

        # ─── Tier 1: Lenition ─────────────────────────────────────────────
        if drift >= 1:
            lenition = {"p": "b", "t": "d", "k": "g", "f": "v"}
            result = list(w)
            for i, ch in enumerate(result):
                prev_v = i > 0 and w[i - 1] in vowels
                next_v = i < len(w) - 1 and w[i + 1] in vowels
                if prev_v and next_v and ch in lenition:
                    result[i] = lenition[ch]
            w = "".join(result)

        # ─── Tier 2: Syncope ──────────────────────────────────────────────
        if drift >= 31:
            # Drop medial unstressed 'e' between two consonants
            w = re.sub(r'([bcdfghjklmnpqrstvwxz])e([bcdfghjklmnpqrstvwxz])', r'\1\2', w)
            # Common suffix contractions (modelling medieval English)
            w = re.sub(r'tion$', 'ton',  w)
            w = re.sub(r'ing$',  'en',   w)
            w = re.sub(r'ness$', 'nes',  w)
            # Vowel cluster reductions
            w = w.replace('ea', 'a').replace('ou', 'o').replace('ue', 'e').replace('ae', 'e')
            # Drop trailing vowel-consonant-e pattern (silent e)
            w = re.sub(r'([aeiou][bcdfghjklmnpqrstvwxz])e$', r'\1', w)

        # ─── Tier 3: Compression ──────────────────────────────────────────
        if drift >= 61:
            # Keep only first 2 vowel nuclei (= ~2 syllables)
            syl_count = 0
            cut = len(w)
            for i, ch in enumerate(w):
                if ch in vowels:
                    syl_count += 1
                    if syl_count == 2:
                        # Extend to include the following consonant cluster
                        j = i + 1
                        while j < len(w) and w[j] not in vowels:
                            j += 1
                        cut = j
                        break
            w = w[:cut]
            # Add an archaic place-name ending that feels old
            # (modelled on Chester←Caestir, Dore, Arden, Pevensey etc.)
            endings = ["", "ar", "or", "el", "en", "an", "oth", "ath", "orn", "ald"]
            w = w.rstrip(vowels) + random.choice(endings)

        # ─── Cleanup ──────────────────────────────────────────────────────
        # Fix consonant clusters of 3+ by inserting a binding vowel
        result = []
        cons_run = 0
        for ch in w:
            if ch.lower() not in set(vowels):
                cons_run += 1
                if cons_run >= 3:
                    result.append(random.choice(["a", "e", "i"]))
                    cons_run = 1
            else:
                cons_run = 0
            result.append(ch)
        w = "".join(result)

        # Collapse double identical vowels
        w = re.sub(r'([aeiou])\1+', r'\1', w)

        # Must be at least 3 chars to be usable
        if len(w) < 3:
            return word

        return w.capitalize()

    def harmonize_and_shorten(self, word: str) -> str:
        """No-op: shortening is now handled within compound construction logic."""
        return word
