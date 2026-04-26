import random
import re
from typing import List, Optional

# ─── FALLBACK POOLS (Required by locations.py) ───────────────────────────────
_PL_FALLBACK_GEO_NOUNS = [
    "góra", "las", "dolina", "rzeka", "jezioro", "pole",
    "wzgórze", "bór", "skała", "brzeg", "bagno", "puszcza"
]
_PL_FALLBACK_GEO_ADJS = [
    "stary", "nowy", "wielki", "mały", "czarny", "biały",
    "zimny", "głęboki", "wysoki", "mroczny", "czerwony", "kamienny"
]

class PolishLocationStrategy:
    def _fallback(self, pool: list) -> str:
        return random.choice(pool)

    def _get_gender(self, word: str) -> str:
        """Heuristic for determining Polish noun gender based on ending."""
        word_lower = word.lower()
        if word_lower.endswith('a') or word_lower.endswith('i'):
            return "f" # Feminine (most words ending in 'a' are feminine)
        elif word_lower.endswith('e') or word_lower.endswith('o') or word_lower.endswith('um'):
            return "n" # Neuter
        else:
            return "m" # Masculine (consonants)

    def _inflect_adjective(self, adj: str, gender: str) -> str:
        """Inflects masculine dictionary adjective forms to match noun gender."""
        adj_lower = adj.lower()
        
        # Identify typical Polish adjective endings
        if adj_lower.endswith('y') or adj_lower.endswith('i'):
            base = adj_lower[:-1]
            if gender == "f":
                return base + "a"
            elif gender == "n":
                return base + "e"
            else: # m
                return adj_lower
        
        # If it doesn't end in standard 'y'/'i', just append tentatively or leave it
        if gender == "f" and not adj_lower.endswith('a'):
            return adj_lower + "a"
        return adj_lower

    def apply_phonetic_drift(self, word: str, drift: int) -> str:
        """
        Simulates natural Polish erosion and orthographic historical shifts.
        """
        if not word or drift < 10:
            return word

        w = word.lower()

        # TIER 1: Assimilation & Junction Erosion
        # Kill triple identical consonants
        w = re.sub(r'([bcdfghjklmnpqrstvwxz])\1+', r'\1\1', w)

        # TIER 2: Slur and Shift
        if drift >= 40:
            # Shift some generic consonants to Polish digraphs randomly (simulating spelling shifts)
            shifts = [("s", "sz"), ("c", "cz"), ("z", "rz"), ("dz", "dź")]
            for old, new in shifts:
                if old in w and random.random() > 0.7:
                    w = w.replace(old, new, 1)

            # Drop unstressed inner vowels (Syncope)
            if len(w) > 6 and random.random() > 0.5:
                w = re.sub(r'([^aeiouy])[ei]([^aeiouy])', r'\1\2', w, count=1)

        # TIER 3: Deep History and Relics
        if drift >= 75:
            # Archaisms
            w = w.replace("ie", "i").replace("ia", "a")
            # Replace -owo / -ewo with more archaic forms or crop
            if w.endswith("owo") and random.random() > 0.5:
                w = w[:-3] + "ów"
            elif w.endswith("ewo") and random.random() > 0.5:
                w = w[:-3] + "ew"

        # Cleanup resulting bad clusters like 3 consonants again
        w = re.sub(r'([^aeiouyąćęłńóśźż]{3,})', lambda m: m.group(1)[:2], w)

        return w.capitalize()

    def _get_random_suffix(self, options: list) -> str:
        # Ensures less predictable suffix assignment per user request
        return random.choice(options)

    def generate_options(self, config, context: dict) -> List[str]:
        geo_n = context.get("geo_noun") or self._fallback(_PL_FALLBACK_GEO_NOUNS)
        geo_a = context.get("geo_adj") or self._fallback(_PL_FALLBACK_GEO_ADJS)
        founder = context.get("founder")
        hist_n = context.get("hist_noun")

        options = []

        if geo_a.lower() == geo_n.lower() or geo_a.lower() in geo_n.lower():
            geo_a = self._fallback(_PL_FALLBACK_GEO_ADJS)

        # ─── CORE GENERATION TRACKS ──────────────────────────────────────────

        # Track 1: Adjective + Noun
        if geo_a:
            gender = self._get_gender(geo_n)
            inflected_adj = self._inflect_adjective(geo_a, gender)
            
            # Simple combined "Stara Góra"
            base = f"{inflected_adj.capitalize()} {geo_n.capitalize()}"
            options.append(base)

            # Fused version (e.g. Białogard, Jasnogóra) with linking 'o'
            if geo_a.endswith('y') or geo_a.endswith('i'):
                link_adj = geo_a[:-1] + "o"
            else:
                link_adj = geo_a + "o"
            
            fused = f"{link_adj.capitalize()}{geo_n.lower()}"
            options.append(fused)
            
            # Add hyphenated alternative
            options.append(f"{inflected_adj.capitalize()}-{geo_n.lower()}")

            if config.drift > 0:
                options.append(self.apply_phonetic_drift(fused, config.drift))

        # Track 2: Eponymous / Patronymic (Founder + Noun)
        if founder:
            fname = founder.split()[0].lower()
            if fname.endswith('a'):
                fname_stem = fname[:-1]
            else:
                fname_stem = fname
            
            # Possessive suffixes (randomized to prevent predictable repetitive endings)
            possessive_suffixes = ["ów", "owo", "ew", "ewo", "ice", "in", "yce"]
            random.shuffle(possessive_suffixes)
            
            # Apply some randomly
            for suff in possessive_suffixes[:3]:
                options.append(f"{fname_stem.capitalize()}{suff}")
                
                # Add drifted version of the patronymic
                if config.drift > 0:
                    options.append(self.apply_phonetic_drift(f"{fname_stem.capitalize()}{suff}", config.drift))

            # Classic "Founder's Noun" (e.g. Janowa Góra)
            # Create a pseudo-adjective from the founder
            if fname_stem:
                founder_adj = f"{fname_stem}ow"
                f_gender = self._get_gender(geo_n)
                inflected_f_adj = self._inflect_adjective(founder_adj + "y", f_gender)
                options.append(f"{inflected_f_adj.capitalize()} {geo_n.capitalize()}")

        # Track 3: Historical
        if hist_n:
            # Historical compounding (e.g., Bitwa + pole -> Bitwopole)
            h_stem = hist_n.lower()
            if h_stem.endswith('a') or h_stem.endswith('e') or h_stem.endswith('y') or h_stem.endswith('i'):
                h_stem = h_stem[:-1]
                
            hist_fused = f"{h_stem.capitalize()}o{geo_n.lower()}"
            options.append(hist_fused)

            # Suffixing the history element directly
            hist_suff_options = ["owo", "sk", "sko", "ów"]
            h_suff = self._get_random_suffix(hist_suff_options)
            options.append(f"{hist_n.capitalize()}{h_suff}")

        # ─── CLEANUP ─────────────────────────────────────────────────────────
        final_options = []
        for opt in options:
            if opt:
                clean_opt = opt.replace("--", "-").strip("- ")
                final_options.append(clean_opt)

        return list(set(final_options))

    def harmonize_and_shorten(self, word: str) -> str:
        return word
