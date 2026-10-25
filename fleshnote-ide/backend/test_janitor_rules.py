"""Regression tests for the rule-based Janitor precision fixes:
passives only when the doer is named, no filter-verb SDT flags, knowing is
not telling, and HU/PL emotion labels in pro-drop copula sentences.
Skips per language when the spaCy model is not downloaded."""
import os
import sys
import unittest

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from nlp_manager import check_model_exists
from routes import janitor as J
from routes import hun_janitor as H
from routes import pol_janitor as P


def flagged(fn, text, lang):
    return bool(fn(text, lang))


class TestDashDialogue(unittest.TestCase):
    """HU/PL dialogue dashes, including the plain hyphen many writers type."""

    def spoken(self, text):
        # a span runs up to and including the dash that closes it
        return [text[s:e].strip(" –-") for s, e in J._speech_spans(text, dash_dialogue=True)]

    def test_hyphen_dialogue_with_attribution(self):
        self.assertEqual(self.spoken("- Nem megyek - mondta a lány. - Soha."), ["Nem megyek", "Soha."])

    def test_hyphen_and_en_dash_mixed_in_one_line(self):
        self.assertEqual(self.spoken("- Hová mész? – kérdezte a fiú. - Haza."), ["Hová mész?", "Haza."])

    def test_hyphen_after_a_colon_opens_speech(self):
        self.assertEqual(self.spoken("Aztán így szólt: - Gyere velem."), ["Gyere velem."])

    def test_hyphens_in_narration_are_not_dialogue(self):
        for text in ("A csak-csak működő lámpa alatt állt.",
                     "Ez a ház - ha még áll - a nagyapjáé volt.",
                     "-Hozzáférés megtagadva, olvasta a képernyőn."):
            self.assertEqual(self.spoken(text), [], text)

    def test_english_ignores_dashes(self):
        self.assertEqual(J._speech_spans("- No - he said.", dash_dialogue=False), [])


@unittest.skipUnless(check_model_exists("en"), "English spaCy model not downloaded")
class TestEnglishRules(unittest.TestCase):
    def test_passive_only_with_named_agent(self):
        self.assertTrue(flagged(J._analyze_passive_voice, "The ball was kicked by John into the goal.", "en"))
        for text in ("He was born in a village that no longer exists.",
                     "The ship had been abandoned long before the storm found it.",
                     "Our path was bordered by hopelessly tangled bushes.",
                     "We were separated from the sea by two panes of glass."):
            self.assertFalse(flagged(J._analyze_passive_voice, text, "en"), text)

    def test_emotion_labels_flagged(self):
        for text in ("She was very angry at him.", "He felt guilty about the lie.",
                     "She was surprised to find the door unlocked."):
            self.assertTrue(flagged(J._analyze_show_dont_tell, text, "en"), text)

    def test_perception_and_knowledge_not_flagged(self):
        for text in ("She heard footsteps on the stairs and held her breath.",
                     "He felt the cold stone under his palm and pushed.",
                     "He knew the road would flood by nightfall.",
                     "He was tired after the long march."):
            self.assertFalse(flagged(J._analyze_show_dont_tell, text, "en"), text)

    def test_a_bit_is_not_taste(self):
        self.assertNotIn("bit", J.TASTE_WORDS_EN)

    def test_told_emotion_patterns_flagged(self):
        for text in ("She was terrified.",                      # participle read as passive
                     "He became crestfallen all at once.",       # full lexicon, not the old 40
                     "Much to my surprise, he went back down south.",
                     "I repaired to my stateroom, full of wonder at the excursion.",
                     "She trembled with fear.",
                     "Furious, Ned tried to see through the mists.",
                     "Rather surprised, I said yes.",
                     "I almost envied him the possession of this flame.",
                     "The news appalled her."):
            self.assertTrue(flagged(J._analyze_show_dont_tell, text, "en"), text)

    def test_dialogue_skipped_but_narration_checked(self):
        self.assertTrue(flagged(J._analyze_show_dont_tell,
                                "“Stop,” she said. Ahab's crew was terrified.", "en"))
        self.assertFalse(flagged(J._analyze_show_dont_tell,
                                 "“I am furious,” she said.", "en"))

    def test_look_as_a_noun_is_not_a_linking_verb(self):
        from nlp_manager import get_nlp
        sent = next(get_nlp("en")("The whites had a curious look about them.").sents)
        self.assertIsNone(J._detect_emotion_label_en(sent))

    def test_modern_draft_patterns_flagged(self):
        for text in ("Sophia scared, hides below the seat.",          # name + emotion fragment
                     "The little creature gets scared.",              # get as linking verb
                     "Matheus looks down on the nervous Sophia.",     # emotion adj on a character
                     "Torin looks at her with a worried expression.",  # on a face noun
                     "Anger starts to escape through his eyes.",      # emotion as the actor
                     "She holds her hand to contain her nervousness.",
                     "The officer looks down on him angrily.",        # manner on any verb
                     "She says out loud, confused."):                 # trailing detached
            self.assertTrue(flagged(J._analyze_show_dont_tell, text, "en"), text)
        for text in ("Sophia scared the cat away.",                   # an action, not a feeling
                     "They stood in a charmed circle of ice.",        # a group is not a character
                     "The angry sea swallowed the boat."):
            self.assertFalse(flagged(J._analyze_show_dont_tell, text, "en"), text)

    def test_lookalikes_not_flagged(self):
        for text in ("Ned Land was content to sharpen his harpoon.",   # content to = willing
                     "The watchman was relieved by the day crew.",     # relieved = replaced
                     "The day was ending in a serenity of still brilliance.",
                     "The silence was menacing.",                      # a thing, not a character
                     "Queequeg disdained no seeming ignominy.",
                     "He had the power to charm or frighten rudimentary souls.",
                     "She wept and trembled on the stairs."):          # shown, not told
            self.assertFalse(flagged(J._analyze_show_dont_tell, text, "en"), text)


@unittest.skipUnless(check_model_exists("hu"), "Hungarian model not downloaded")
class TestHungarianRules(unittest.TestCase):
    def test_passive_needs_altal(self):
        self.assertTrue(flagged(H._analyze_passive_voice_hu, "A levelet a király által aláírva küldték el.", "hu"))
        self.assertFalse(flagged(H._analyze_passive_voice_hu, "Sírva futott ki a házból.", "hu"))

    def test_pro_drop_emotion_label(self):
        self.assertTrue(flagged(H._analyze_show_dont_tell_hu, "Nagyon dühös volt a férjére.", "hu"))
        self.assertFalse(flagged(H._analyze_show_dont_tell_hu, "A ház üres volt.", "hu"))
        self.assertFalse(flagged(H._analyze_show_dont_tell_hu, "Hallotta a lépteket a lépcsőn.", "hu"))

    def test_told_emotion_patterns_flagged(self):
        for text in ("Nemecsek zavartan állt a csomó közepén.",       # -an adverb = essive adj
                     "Csodálkozva néztek egymásra.",                  # converb
                     "Az aga dühös pillantást vetett az ifjúra.",     # adj on a look noun
                     "A diák aggódó arccal fordult a paphoz.",        # adj on instrumental manner
                     "Csaknem felkiáltott örömében.",                 # noun in a case frame
                     "Nemecsek nagyon megijedt."):                    # experiencer verb
            self.assertTrue(flagged(H._analyze_show_dont_tell_hu, text, "hu"), text)

    def test_lookalikes_not_flagged(self):
        for text in ("A tomahawk félelmetesen csillogott a sötétben.",  # causes fear
                     "Rettenetes erőfeszítéssel kapta fel.",            # intensifier
                     "Az ember is boldogan élhetne.",                   # hypothetical
                     "De a béka boldogabb, mint az ember."):            # comparison
            self.assertFalse(flagged(H._analyze_show_dont_tell_hu, text, "hu"), text)

    def test_dialogue_skipped_but_attribution_checked(self):
        self.assertTrue(flagged(H._analyze_show_dont_tell_hu, "– Nem – mondta büszkén Weisz.", "hu"))
        self.assertFalse(flagged(H._analyze_show_dont_tell_hu, "– Nagyon dühös vagyok – mondta Weisz.", "hu"))
        # the same with the plain hyphen writers type
        self.assertTrue(flagged(H._analyze_show_dont_tell_hu, "- Nem - mondta büszkén Weisz.", "hu"))
        self.assertFalse(flagged(H._analyze_show_dont_tell_hu, "- Nagyon dühös vagyok - mondta Weisz.", "hu"))


@unittest.skipUnless(check_model_exists("pl"), "Polish model not downloaded")
class TestPolishRules(unittest.TestCase):
    def test_passive_needs_przez(self):
        self.assertTrue(flagged(P._analyze_passive_voice_pl, "Drzwi zostały otwarte przez Sarę.", "pl"))
        self.assertFalse(flagged(P._analyze_passive_voice_pl, "Drzwi zostały otwarte.", "pl"))

    def test_przez_must_name_a_person(self):
        for text in ("List został napisany przez króla.",
                     "Obiad został ugotowany przez matkę."):  # feminine: no Animacy tag
            self.assertTrue(flagged(P._analyze_passive_voice_pl, text, "pl"), text)
        for text in ("Był przez chwilę zaskoczony.",          # przez = for (a while)
                     "Pokój był oświetlony przez okna.",      # inanimate doer
                     "Pole było otoczone przez las."):
            self.assertFalse(flagged(P._analyze_passive_voice_pl, text, "pl"), text)

    def test_pro_drop_emotion_label(self):
        self.assertTrue(flagged(P._analyze_show_dont_tell_pl, "Był bardzo zły na brata.", "pl"))
        self.assertFalse(flagged(P._analyze_show_dont_tell_pl, "Dom był pusty.", "pl"))
        self.assertFalse(flagged(P._analyze_show_dont_tell_pl, "Usłyszała kroki na schodach.", "pl"))

    def test_adjective_stem_matches_inflected_forms(self):
        self.assertEqual(P._adj_stem_pl("zdumiona"), P._adj_stem_pl("zdumiony"))
        self.assertEqual(P._adj_stem_pl("zdumieni"), P._adj_stem_pl("zdumiony"))
        self.assertEqual(P._adj_stem_pl("wściekli"), P._adj_stem_pl("wściekły"))

    def test_told_emotion_patterns_flagged(self):
        for text in ("Wrócił na obiad bardzo zakłopotany.",           # depictive adjective
                     "Rzekł Zbyszko zaniepokojonym głosem.",          # adj on a voice noun
                     "Woźnica osadził ze strachu konie.",             # noun frame
                     "W chwilę później wstydziła się swego szaleństwa."):  # experiencer verb
            self.assertTrue(flagged(P._analyze_show_dont_tell_pl, text, "pl"), text)

    def test_lookalikes_not_flagged(self):
        for text in ("Cięcie było tak straszne, że zwierz runął.",    # causes fear
                     "Nawrócił się ku wierze katolickiej.",           # faith, not a feeling
                     "W czasie spokoju gospodarzył w Spychowie."):    # peacetime
            self.assertFalse(flagged(P._analyze_show_dont_tell_pl, text, "pl"), text)

    def test_dialogue_skipped_but_attribution_checked(self):
        self.assertTrue(flagged(P._analyze_show_dont_tell_pl,
                                "— Będziem po kolei śpiewali — zawołał uradowany Zych.", "pl"))


if __name__ == "__main__":
    unittest.main()
