import random
import re
from typing import List, Optional

# ─── CORRECTED POSSESSIVE TABLE ──────────────────────────────────────────────
HU_POSSESSIVE = {
  "hegy": "hegye", "völgy": "völgye", "erdő": "erdeje", "mező": "mezeje",
  "kő": "köve", "bérc": "bérce", "szirt": "szirtje", "liget": "ligete",
  "sziget": "szigete", "rét": "rétje", "föld": "földje", "vár": "vára",
  "tó": "tava", "folyó": "folyója", "mocsár": "mocsara", "orom": "orma",
  "puszta": "pusztája", "domb": "dombja", "havas": "havasa", "csúcs": "csúcsa",
  "láp": "lápja", "rom": "romja", "berek": "berke", "szurdok": "szurdoka"
}

# ─── FALLBACK POOLS (Required by locations.py) ───────────────────────────────
_HU_FALLBACK_GEO_NOUNS = [
  "szirt", "bérc", "liget", "havas", "láp", "rét",
  "berek", "orom", "csúcs", "szurdok", "ösvény"
]
_HU_FALLBACK_GEO_ADJS = [
  "sötét", "fehér", "fekete", "hideg", "ősi", "vad",
  "régi", "csendes", "elhagyott", "komor", "zordon", "titokzatos"
]


class HungarianLocationStrategy:

  def _fallback(self, pool: list) -> str:
    return random.choice(pool)

  def _get_vowel_type(self, word: str) -> str:
    """Determines if a root word is front, back, or mixed."""
    front = set("eéiíöőüű")
    back = set("aáoóuú")
    word_lower = word.lower()

    has_front = any(c in front for c in word_lower)
    has_back = any(c in back for c in word_lower)

    # Pure front words take front suffixes. Everything else (back or mixed) takes back.
    if has_front and not has_back:
      return "front"
    return "back"

  def _harmonize_suffix(self, root: str, back_suffix: str, front_suffix: str) -> str:
    """Applies Hungarian vowel harmony ONLY to the suffix being attached."""
    return front_suffix if self._get_vowel_type(root) == "front" else back_suffix

  def apply_phonetic_drift(self, word: str, drift: int) -> str:
    """
    Simulates natural Hungarian erosion and historical charter spellings.
    Does NOT globally mutate root vowels.
    """
    if not word or drift < 10:
      return word

    w = word.lower()

    # TIER 1 (Lazy Tongue): Assimilation & Junction Erosion
    # Kills triple consonants created by sloppy compounding
    w = re.sub(r'([bcdfghjklmnpqrstvwxz])\1+', r'\1\1', w)

    # TIER 2 (Centuries of Use): Medial Vowel Loss / Syncope
    # Drops the grammatical possession if it's been used as a name for too long
    if drift >= 40:
      reductions = {"hegye": "hegy", "vára": "vár", "mezeje": "mező", "erdeje": "erdő"}
      for old, new in reductions.items():
        if w.endswith(old):
          w = w[:-len(old)] + new
          break

    # TIER 3 (Deep History): Archaic Charters & Hard Suffixes
    # Simulates 11th-13th century place name formation (e.g., Visegrád, Tihany)
    if drift >= 75:
      # We add archaic locative/diminutive endings, but we MUST harmonize them to the root
      if random.random() > 0.5:
        # The 'd' suffix (very common in old Hungarian settlements)
        if w[-1] in "aeiouáéíóúöőüű":
          w = w[:-1] + self._harmonize_suffix(w, "d", "d")
        else:
          w = w + self._harmonize_suffix(w, "ad", "ed")
      else:
        # The 'ny' or 'n' suffix
        w = w + self._harmonize_suffix(w, "ony", "ény")

      # Simulate historical orthography (g for gy, n for ny) randomly
      if random.random() > 0.7:
        w = w.replace("gy", "g").replace("ny", "n")

    return w.capitalize()

  def _slang_crunch(self, word1: str, word2: str) -> str:
    """
    Mimics Hungarian slang/settlement clipping (e.g., Tengerpartisziklák -> Tengersziklák).
    Surgically extracts the first 1-2 syllables of a word to preserve the root.
    """
    vowels = set("aáeéiíoóöőuúüű")

    def extract_head(w: str, target_vowels: int) -> str:
      v_seen = 0
      for i, c in enumerate(w.lower()):
        if c in vowels:
          v_seen += 1
        # Once we hit our target vowel count, keep going until we hit the next vowel
        elif v_seen >= target_vowels and c not in vowels:
          return w[:i + 1]
      return w  # Return the whole word if it's super short

    # Grab the first 2 syllables of the adjective (Tengerparti -> Tenger)
    head = extract_head(word1, 2)

    # 50/50 chance to either keep the whole noun, or crunch that too
    # (sziklák -> sziklák) OR (sziklák -> szik)
    if random.random() > 0.5:
      tail = word2.lower()
    else:
      tail = extract_head(word2, 1)

    # Clean up any weird consonant collisions we just created
    crunched = head + tail
    crunched = re.sub(r'([bcdfghjklmnpqrstvwxz])\1+', r'\1\1', crunched)

    return crunched.capitalize()

  def generate_options(self, config, context: dict) -> List[str]:
    # Resolve context
    geo_n = context.get("geo_noun") or self._fallback(_HU_FALLBACK_GEO_NOUNS)
    geo_a = context.get("geo_adj") or self._fallback(_HU_FALLBACK_GEO_ADJS)
    founder = context.get("founder")
    hist_n = context.get("hist_noun")

    options = []

    # ECHO KILLER: If WordNet spat out the same root for adj and noun, nuke the adj
    if geo_a.lower() == geo_n.lower() or geo_a.lower() in geo_n.lower():
      geo_a = self._fallback(_HU_FALLBACK_GEO_ADJS)

    # Get grammatical possessive safely
    poss = HU_POSSESSIVE.get(geo_n.lower(), geo_n + self._harmonize_suffix(geo_n, "ja", "je"))

    # ─── CORE GENERATION TRACKS ──────────────────────────────────────────

    # Track 1: Adjective + Noun
    if geo_a:
      if len(geo_a) + len(geo_n) <= 13:
        base = f"{geo_a.capitalize()}{geo_n.lower()}"
        options.append(base)
      else:
        base = f"{geo_a.capitalize()}-{geo_n.lower()}"
        options.append(base)

      if config.drift > 0:
        # Add the standard historical erosion
        options.append(self.apply_phonetic_drift(base.replace("-", ""), config.drift))

      # slang cropping n shit
      if config.drift >= 75 and len(geo_a) + len(geo_n) > 10:
        crunched_name = self._slang_crunch(geo_a, geo_n)
        # feeding it back to the suffixer
        options.append(self.apply_phonetic_drift(crunched_name, 80))

    # Track 2: Eponymous (Founder + Noun)
    if founder:
      fname = founder.split()[0].capitalize()
      # Classic possessive (e.g., Koppány vára)
      options.append(f"{fname} {poss}")

      # Fused (e.g., Koppányvár)
      fused = f"{fname}{geo_n.lower()}"
      options.append(fused)

      if config.drift > 0:
        options.append(self.apply_phonetic_drift(fused, config.drift))

    # Track 3: Historical/Mythological Events
    if hist_n:
      art = "Az" if hist_n[0].lower() in "aáeéiíoóöőuúüű" else "A"
      # e.g., A Csata hegye
      options.append(f"{art} {hist_n.capitalize()} {poss}")

      # Fused historical (e.g., Csatahegy)
      hist_fused = f"{hist_n.capitalize()}{geo_n.lower()}"
      options.append(hist_fused)

    # ─── CLEANUP ─────────────────────────────────────────────────────────
    # Ensure no empty strings and capitalize properly
    final_options = []
    for opt in options:
      if opt:
        # Clean up any lingering hyphen weirdness
        clean_opt = opt.replace("--", "-").strip("- ")
        final_options.append(clean_opt)

    return list(set(final_options))

  def harmonize_and_shorten(self, word: str) -> str:
    """Bypassed. Erosion logic is handled natively in apply_phonetic_drift."""
    return word
