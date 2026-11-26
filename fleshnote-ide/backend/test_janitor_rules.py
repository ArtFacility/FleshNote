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


class TestAliasSuggestions(unittest.TestCase):
    """Alias hints must be unambiguous and independently dismissable."""

    FILLER = "The long corridor stretched on without a sound. " * 7

    @staticmethod
    def ent(eid, name, aliases=None):
        return {"id": eid, "name": name, "type": "character", "aliases": aliases or []}

    def test_shared_fragment_is_not_suggested(self):
        entities = [self.ent("a", "District 40"), self.ent("b", "District 12")]
        text = ("District 40 burned down that night. " + self.FILLER +
                "District 12 held. " + self.FILLER +
                "For weeks afterwards, District was all anyone spoke about.")
        self.assertEqual(J._analyze_alias(text, entities), [])

    def test_shared_family_surname_is_not_suggested(self):
        entities = [self.ent("a", "John Smith"), self.ent("b", "Mary Smith")]
        text = ("John Smith arrived first. " + self.FILLER +
                "Mary Smith followed. " + self.FILLER +
                "Later that evening, Smith appeared at the door.")
        self.assertEqual(J._analyze_alias(text, entities), [])

    def test_unambiguous_part_uses_the_text_as_written(self):
        entity = self.ent("a", "Vael Ren")
        text = ("Vael Ren walked in. " + self.FILLER +
                "Much later, Vael returned from the cold.")
        found = J._analyze_alias(text, [entity])
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["matched_text"], "Vael")
        self.assertEqual(text[found[0]["char_offset"]:found[0]["char_offset"] + 4], "Vael")

    def test_category_nouns_are_not_suggested(self):
        cases = [
            ("Floor 672", "the corridor ended at the floor below"),
            ("Tower Cafe", "a small cafe stood on the corner"),
            ("Izakaya 40", "an izakaya near the station"),
        ]
        for name, standalone in cases:
            text = (name + " was crowded that night. " + self.FILLER +
                    "By dawn, " + standalone + " was empty.")
            self.assertEqual(J._analyze_alias(text, [self.ent("a", name)]), [], name)

    def test_capitalized_common_noun_after_determiner_is_not_suggested(self):
        entity = self.ent("a", "Tower Cafe")
        text = ("Tower Cafe stood on the quay. " + self.FILLER +
                "They entered the Cafe later that evening.")
        self.assertEqual(J._analyze_alias(text, [entity]), [])

    def test_alias_ids_are_unique_per_entity(self):
        import tempfile
        from routes.janitor_paragraphs import ChapterAnalysis

        with tempfile.TemporaryDirectory() as tmp:
            analysis = ChapterAnalysis(tmp, "c1", "<p>Smith walked in.</p>", "xx")
            base = {
                "type": "alias", "matched_text": "Smith", "char_offset": 0,
                "context": "", "context_highlight_start": 0, "context_highlight_end": 0,
            }
            first = analysis.finish({**base, "entity_id": "a"}, J._make_id)
            second = analysis.finish({**base, "entity_id": "b"}, J._make_id)
            self.assertNotEqual(first["id"], second["id"])


class TestLinkRanges(unittest.TestCase):
    def test_ranges_align_with_analysed_plain_text(self):
        from routes.janitor_paragraphs import split_blocks

        html = ('<p>Tom &amp; Jerry met. #TODO&nbsp;draft note\u200b'
                '<span data-entity-type="char" data-entity-id="5">Sophia</span> smiled.</p>')
        plain = "".join(text for _, text in split_blocks(html))
        ranges = J._get_linked_ranges(html)
        self.assertEqual(len(ranges), 1)
        self.assertEqual(plain[ranges[0][0]:ranges[0][1]], "Sophia")

    def test_note_spans_do_not_hide_entity_links(self):
        html = ('<p><span data-entity-type="twist" data-entity-id="t1">'
                'A long note about Sophia</span> then Sophia left.</p>')
        self.assertEqual(J._get_linked_ranges(html), [])

    def test_nested_entity_link_inside_twist_span_is_detected(self):
        from routes.janitor_paragraphs import split_blocks

        html = ('<p><span data-entity-type="twist" data-entity-id="t1">'
                'A secret about <span data-entity-type="char" data-entity-id="5">Sophia</span>'
                '</span> then Sophia left.</p>')
        plain = "".join(text for _, text in split_blocks(html))
        ranges = J._get_linked_ranges(html)
        self.assertEqual(len(ranges), 1)
        self.assertEqual(plain[ranges[0][0]:ranges[0][1]], "Sophia")
        self.assertEqual(ranges[0][0], plain.index("Sophia"))

    def test_uppercase_closing_span_tag_is_handled(self):
        html = '<p><SPAN data-entity-type="char" data-entity-id="5">Sophia</SPAN> smiled.</p>'
        self.assertEqual(J._get_linked_ranges(html), [(0, 6)])


class TestLinkAll(unittest.TestCase):
    @staticmethod
    def ent(eid, name, etype="character", aliases=None):
        return {"id": eid, "name": name, "type": etype, "aliases": aliases or []}

    def plan(self, html, entities):
        from routes.janitor_paragraphs import split_blocks

        blocks = split_blocks(html)
        plain = "".join(t for _, t in blocks)
        linked = J._get_linked_ranges(html)
        return J._plan_link_all(plain, blocks, linked, entities), plain

    def test_multiple_mentions_same_and_across_lines_in_order(self):
        entities = [self.ent("c1", "Sophia")]
        html = "<p>Sophia met Sophia by the gate.</p><p>Later, Sophia smiled.</p>"
        (auto_links, ambiguous), plain = self.plan(html, entities)
        self.assertEqual(ambiguous, [])
        self.assertEqual(len(auto_links), 3)
        offsets = [item["char_offset"] for item in auto_links]
        self.assertEqual(offsets, sorted(offsets))
        self.assertEqual(
            [plain[item["char_offset"]:item["char_offset"] + len(item["matched_text"])] for item in auto_links],
            ["Sophia", "Sophia", "Sophia"],
        )

    def test_longest_match_wins_and_standalone_shared_first_name_is_ambiguous(self):
        entities = [self.ent("c1", "Jon Snow"), self.ent("c2", "Jon Arryn")]
        html = "<p>Jon Snow rode north while Jon stayed behind.</p>"
        (auto_links, ambiguous), plain = self.plan(html, entities)
        self.assertEqual(len(auto_links), 1)
        self.assertEqual(auto_links[0]["matched_text"], "Jon Snow")
        self.assertEqual(auto_links[0]["entity_id"], "c1")
        self.assertEqual(len(ambiguous), 1)
        amb = ambiguous[0]
        self.assertEqual(amb["matched_text"], "Jon")
        self.assertEqual(
            amb["context"][amb["context_highlight_start"]:amb["context_highlight_end"]],
            "Jon",
        )
        self.assertEqual({c["entity_id"] for c in amb["candidates"]}, {"c1", "c2"})
        self.assertEqual(plain[amb["char_offset"]:amb["char_offset"] + 3], "Jon")

    def test_shared_surname_is_ambiguous(self):
        entities = [self.ent("c1", "John Smith"), self.ent("c2", "Mary Smith")]
        html = "<p>Smith knocked on the door.</p>"
        (auto_links, ambiguous), _ = self.plan(html, entities)
        self.assertEqual(auto_links, [])
        self.assertEqual(len(ambiguous), 1)
        self.assertEqual(ambiguous[0]["matched_text"], "Smith")
        self.assertEqual({c["entity_id"] for c in ambiguous[0]["candidates"]}, {"c1", "c2"})

    def test_explicit_name_colliding_with_other_first_name_is_ambiguous(self):
        entities = [self.ent("c1", "Jon"), self.ent("c2", "Jon Snow")]
        html = "<p>Jon entered the hall.</p>"
        (auto_links, ambiguous), _ = self.plan(html, entities)
        self.assertEqual(auto_links, [])
        self.assertEqual(len(ambiguous), 1)
        self.assertEqual(ambiguous[0]["matched_text"], "Jon")
        self.assertEqual(
            [c["entity_id"] for c in ambiguous[0]["candidates"]],
            ["c1", "c2"],
        )

    def test_lowercase_explicit_names_link_while_generic_lowercase_parts_skip(self):
        entities = [self.ent("c1", "Jon"), self.ent("c2", "Tom Baker")]
        html = "<p>Jon and jon saw Tom Baker and a baker before Baker left.</p>"
        (auto_links, ambiguous), _ = self.plan(html, entities)
        self.assertEqual(ambiguous, [])
        self.assertEqual(
            [(item["entity_id"], item["matched_text"]) for item in auto_links],
            [("c1", "Jon"), ("c1", "jon"), ("c2", "Tom Baker"), ("c2", "Baker")],
        )

    def test_non_character_parts_ignored_and_already_linked_skipped(self):
        entities = [
            self.ent("l1", "Tower Cafe", etype="location"),
            self.ent("c1", "Sophia", etype="character"),
        ]
        html = (
            '<p>They visited the Cafe near <span data-entity-type="location" data-entity-id="l1">Tower Cafe</span>. '
            '<span data-entity-type="twist" data-entity-id="t1">Inside, '
            '<span data-entity-type="char" data-entity-id="c1">Sophia</span> waited</span> '
            'while Sophia watched the street.</p>'
        )
        (auto_links, ambiguous), plain = self.plan(html, entities)
        self.assertEqual(ambiguous, [])
        self.assertEqual(len(auto_links), 1)
        self.assertEqual(auto_links[0]["matched_text"], "Sophia")
        self.assertEqual(auto_links[0]["char_offset"], plain.rindex("Sophia"))


if __name__ == "__main__":
    unittest.main()
