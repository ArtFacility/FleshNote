"""
Ultimate Location Name Generator Stress Tester
===============================================
Runs 300 combinatorially diverse test cases across English and Hungarian,
with 5 sparsity levels and 3 drift values each.
Outputs a clean formatted report + statistics to ultimate_test_results.txt
"""
import sys
import os
import random
import time
import argparse
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tools.name_gen.locations import LocationNameGenConfig, generate_location_name

# Per-call timeout in seconds — enough for NLP + WordNet, not enough to hang forever
CALL_TIMEOUT_SECS = 8

# Shared executor (avoids overhead of spawning one per call)
_executor = ThreadPoolExecutor(max_workers=1)

def _safe_generate(config: LocationNameGenConfig) -> str:
    """
    Calls generate_location_name with a hard timeout.
    Returns '[TIMEOUT]' if the call stalls, '[ERROR: ...]' on exceptions.
    """
    future = _executor.submit(generate_location_name, config)
    try:
        return future.result(timeout=CALL_TIMEOUT_SECS)
    except FuturesTimeoutError:
        return "[TIMEOUT]"
    except Exception as e:
        return f"[ERROR: {e}]"


# ═══════════════════════════════════════════════════════════════════════════
# ENGLISH LIBRARIES
# ═══════════════════════════════════════════════════════════════════════════

EN_GEO = [
    "jagged black peaks split by deep glacial valleys",
    "a sunken city beneath dark water",
    "wide marshland where willows weep into the mud",
    "an ancient crater forest filled with pale mist",
    "red sandstone cliffs carved by a dying river",
    "salt flats stretching beyond sight under a white sky",
    "volcanic obsidian fields still warm from old eruptions",
    "a floating island tethered by iron chains",
    "deep cavern system lit by glowing fungi",
    "rolling limestone hills riddled with hidden tombs",
    "frozen tundra where the wind never stops",
    "dense canopy rainforest over a black river",
    "shattered glacier with meltwater torrents",
    "an archipelago of tiny rocky islands in storm water",
    "swamp",
    "desert",
    "mountains",
    "river delta",
    "high moorland",
    "oak forest",
    "sea cliffs",
    "underground lake",
    "jungle",
    "sunken valley",
    "burning plains",
    "dead volcanic wasteland",
    "highlands above the cloud line",
    "coastal estuary thick with reeds",
    "a canyon carved by an ancient god",
    "steppes and grass as far as any eye can reach",
]

EN_HIST = [
    "an old war where the last king fell defending the gate",
    "built on the ruins of a plague city no one names",
    "founded when refugees fled the burning empire",
    "a prison colony that outlasted the civilization that built it",
    "site of a failed magical experiment that scorched the valley",
    "the final battlefield of a century-long succession war",
    "the place where three clans signed a blood oath in iron",
    "once a thriving market town before the river changed course",
    "an old war",
    "plague swept through here",
    "the empire abandoned it",
    "built during the siege",
    "floods took the old town",
    "scholars came and built a tower",
    "dwarves mined it hollow and left",
    "conquered and forgotten three times over",
    "the army gathered here before the last march",
    "the crown jewels were buried here and never recovered",
    "a holy order made it their fortress for a hundred years",
    "it was the capital before the capital burned",
    "trade route collapsed",
    "drought killed the founders",
    "miners struck something wrong below",
    "crusaders razed it to ash",
    "the dead walked here once",
    "a river flooded it for a century",
    "the forest grew back over the streets",
    "salt miners built it rich then abandoned it dry",
    "none who lived there remained to tell what happened",
    "first settled by the wanderers after the long silence",
]

EN_FOUNDERS = [
    "elara dawnstrider",
    "arthur pendragon",
    "calder ashvein",
    "maren of the grey coast",
    "lord edric stoneholt",
    "sister brynn",
    "commander oswin the younger",
    "aldric the exile",
    "sewyn ironmark",
    "vael nightwhisper",
    "kira no-name",
    "lord gareth",
    "sorn of the eastern reaches",
    "the witch thorn",
    "dame linne silverbow",
    "king erric the blind",
    "tomas wayfarer",
    "magister dorin",
    "the old shepherd",
    "none — settled by no single founder",
    "john",
    "the wanderer",
    "a hermit whose name was never recorded",
    "captain vael coldwater",
    "mother maer",
    "the deserter",
    "prince dawyn the young",
    "the ferryman",
    "high lord caern",
    "an unnamed exarch",
]

EN_MYTHOS = [
    "dragons sleeping beneath the peaks since the first age",
    "a dark portal to the underworld sealed with blood",
    "angels fell here when the sky cracked open",
    "a river god cursed the valley after the bridge was burned",
    "the goddess wept here and her tears became the lake",
    "three witches bound a demon below the old well",
    "the dead do not stay buried in this place",
    "a falling star struck the earth here long ago",
    "the first men made their covenant with fire here",
    "ghosts of the old army march on moonless nights",
    "a volcano god demands tribute every generation",
    "time moves strangely under the mountain",
    "the forest remembers every death within it",
    "the sea gives and the sea takes",
    "an old god sleeps in the rock",
    "a giant was buried here standing up",
    "the light never fully reaches the valley floor",
    "nothing built here stays standing",
    "the wind speaks names of the dead at dusk",
    "a curse was laid on all who call themselves rulers here",
    "dragons",
    "ghosts",
    "a cursed place",
    "sacred ground",
    "demons below",
    "a god died here",
    "witches claimed it",
    "an old prophecy about this exact hill",
    "fey folk dwell in the deep wood beyond",
    "the earth itself is alive and watches",
]

EN_NATIVE = [
    "draconic frost speak",
    "deepspeak",
    "the old tongue",
    "tidal words",
    "ashsong",
    "elvish",
    "shadow cant",
    "stonecaller dialect",
    "the fourth tongue",
    "forest signs",
    "blood language",
    "celestial chimes",
    "tidecaller",
    "runemark",
    "witchcraft",
    "dust speech",
    "the dead language",
    "thornwhisper",
    "ironmouth",
    "saltwater cant",
]


# ═══════════════════════════════════════════════════════════════════════════
# HUNGARIAN LIBRARIES
# ═══════════════════════════════════════════════════════════════════════════

HU_GEO = [
    "magas sötét hegyek jéggel borítva",
    "egy elsüllyedt város fekete víz alatt",
    "széles mocsárvidék ahol a fűzfák sírnak az iszapba",
    "ősi kráter erdő sápadt ködde tele",
    "vörös homokkő sziklák egy haldokló folyótól vájva",
    "só síkság a szemen túl fehér ég alatt",
    "vulkáni obszidián mezők még melegen régi kitöréstől",
    "egy lebegő sziget vasláncokon lógva",
    "mély barlangrendszer izzó gombáktól megvilágítva",
    "gömbölyű mészkő dombok rejtett sírokkal tele",
    "fagyott tundrán ahol a szél sohasem áll meg",
    "sűrű lombkorona esőerdő fekete folyó felett",
    "szétszakadt gleccser olvadékvíz zuhatagokkal",
    "apró sziklás szigetek viharzó vízben",
    "mocsár",
    "sivatag",
    "hegyek",
    "folyódelta",
    "magasan fekvő pusztaság",
    "tölgyerdő",
    "tengerparti sziklák",
    "föld alatti tó",
    "dzsungel",
    "süllyedt völgy",
    "égő síkság",
    "halott vulkáni pusztaság",
    "nádas tenger melyek szerte nő",
    "egy isten vájta kanyonban",
    "puszta és fű ameddig a szem ellát",
    "felföld a felhők vonala felett",
]

HU_HIST = [
    "egy régi háború ahol az utolsó király elesett kapunál",
    "egy pestis város romjain épült amelyet senki nem nevez nevén",
    "menekültek alapították amikor az égő birodalmtól menekültek",
    "börtöntelep amely túlélte az azt épített civilizációt",
    "egy elbukott mágikus kísérlet helyszíne amely felperzselte a völgyet",
    "egy száz éves öröklési háború utolsó csatasíkja",
    "ahol három klán véresküt tett vasban",
    "egykor virágzó piacváros mielőtt a folyó irányt váltott",
    "egy régi háború",
    "vírus söpört át itt",
    "a birodalom elhagyta",
    "az ostrom idején épült",
    "az árvíz vitte el a régi várost",
    "tudósok jöttek és tornyot emeltek",
    "törpék kiüresítették és elmentek",
    "háromszor meghódítottak és elfelejtették",
    "a sereg itt gyülekezett az utolsó menetelés előtt",
    "a koronát itt temették el és sohasem találták meg",
    "egy szent rend száz évig erődjévé tette",
    "ez volt a főváros mielőtt a főváros leégett",
    "kereskedelmi útvonal összeomlott",
    "aszály megölte az alapítókat",
    "a bányászok valami rosszra leltek lent",
    "keresztes lovagok hamuvá égették",
    "a halottak egyszer jártak itt",
    "egy folyó száz évig elöntötte",
    "az erdő visszanőtt az utcák fölé",
    "sóbányászok gazdaggá tették majd szárazon hagyták",
    "senki aki ott élt nem maradt hogy elmondja mi történt",
    "először a vándorok telepítették be a hosszú csend után",
]

HU_FOUNDERS = [
    "elara hajnalvándor",
    "arthur pendragon király",
    "kővári kálmán",
    "szürke part marén asszonya",
    "edric kőtartó úr",
    "brynn nővér",
    "Arlon Nean",
    "Magdolna",
    "oswin parancsnok az ifjabb",
    "aldric a száműzött",
    "sewyn vasjel",
    "vael éjsuttogó",
    "kira névnélküli",
    "gareth úr",
    "sorn a keleti határoktól",
    "thorn a boszorkány",
    "linne ezüstíj asszony",
    "erric vak király",
    "tamás vándor",
    "dorin mágister",
    "az öreg pásztor",
    "senki — nem volt egyetlen alapítója",
    "jános",
    "a kóborló",
    "egy remete akinek a nevét soha nem jegyezték fel",
    "Vael hidegvíz kapitány",
    "maér anya",
    "a dezertőr",
    "dawyn ifjú herceg",
    "a révész",
    "kaern főúr",
    "egy névtelen exarcha",
]

HU_MYTHOS = [
    "sárkányok alszanak a csúcsok alatt az első kor óta",
    "az alvilágba nyíló sötét kaput vérrel pecsételték le",
    "angyalok estek ide amikor az ég meghasadt",
    "egy folyóisten megátkozta a völgyet miután felégették a hidat",
    "az istennő itt sírt és könnyei tóvá lettek",
    "három boszorkány egy démont kötött meg a régi kút alatt",
    "a halottak nem maradnak eltemetve ezen a helyen",
    "egy hullócsillag csapódott ide régen",
    "az első emberek tűzzel kötöttek szövetséget itt",
    "holdtalan éjjeleken a régi sereg szellemei menetelnek",
    "egy vulkán isten minden nemzedékben áldozatot követel",
    "az idő furcsán telik a hegy alatt",
    "az erdő minden halált megjegyez ami benne történt",
    "a tenger ad és a tenger elvesz",
    "egy öreg isten alszik a kőben",
    "itt temettek el egy óriást állva",
    "a fény sohasem éri el teljesen a völgy alját",
    "semmi sem áll meg amit itt építenek",
    "szélben a halottak neveit suttogja alkonyatkor",
    "átkot vetett mindenre aki itt fejedelemnek nevezi magát",
    "sárkányok",
    "kísértetek",
    "elátkozott hely",
    "szent föld",
    "démonok lent",
    "egy isten halt meg itt",
    "boszorkányok tartják hatalomban",
    "egy régi jóslat erről a dombról",
    "tündérek laknak a mély erdőben odakint",
    "maga a föld él és figyel",
]

HU_NATIVE = [
    "drákói fagybeszéd",
    "mélynyelvű",
    "az ős nyelv",
    "árszavak",
    "hamudal",
    "tündényelv",
    "árnyhadarász",
    "köhívó tájszólás",
    "a negyedik nyelv",
    "erdei jelek",
    "vérnyelv",
    "égi harangok",
    "tenger hívó",
    "rúnajelzés",
    "boszorkányság",
    "pornyelvű",
    "a halott nyelv",
    "tüskedal",
    "vasszájú",
    "sósvízi cant",
]


# ═══════════════════════════════════════════════════════════════════════════
# POLISH LIBRARIES
# ═══════════════════════════════════════════════════════════════════════════

PL_GEO = [
    "wysokie ciemne góry skute lodem",
    "zatopione miasto pod czarną wodą",
    "szerokie mokradła gdzie wierzby płaczą w błoto",
    "starożytny las w kraterze pełen bladej mgły",
    "czerwone piaskowcowe klify wyrzeźbione przez umierającą rzekę",
    "solniska ciągnące się po horyzont pod białym niebem",
    "wulkaniczne pola obsydianu wciąż ciepłe po dawnych erupcjach",
    "latająca wyspa uwiązana żelaznymi łańcuchami",
    "głęboki system jaskiń oświetlony świecącymi grzybami",
    "faliste wapienne wzgórza usiane ukrytymi grobowcami",
    "zamarznięta tundra gdzie wiatr nigdy nie ustaje",
    "gęsty las deszczowy nad czarną rzeką",
    "roztrzaskany lodowiec z potokami wody roztopowej",
    "archipelag malutkich skalistych wysp na wzburzonej wodzie",
    "bagno",
    "pustynia",
    "góry",
    "delta rzeki",
    "wysokie wrzosowiska",
    "dąbrowa",
    "morskie klify",
    "podziemne jezioro",
    "dżungla",
    "zatopiona dolina",
    "płonące równiny",
    "martwe wulkaniczne pustkowie",
    "wysoczyzna ponad linią chmur",
    "nadbrzeżne estuarium gęste od trzcin",
    "kanion wyrzeźbiony przez starożytnego boga",
    "stepy i trawy po horyzont",
]

PL_HIST = [
    "stara wojna gdzie ostatni król poległ broniąc bramy",
    "zbudowane na ruinach miasta zarazy, którego nikt nie nazywa",
    "założone gdy uchodźcy uciekli z płonącego imperium",
    "kolonia karna, która przetrwała cywilizację, która ją zbudowała",
    "miejsce nieudanego eksperymentu magicznego, który spalił dolinę",
    "ostatnie pole bitwy stuletniej wojny o sukcesję",
    "miejsce gdzie trzy klany złożyły pakt krwi w żelazie",
    "niegdyś kwitnące miasto targowe, zanim rzeka zmieniła koryt",
    "stara wojna",
    "plaga przeszła tędy",
    "imperium je porzuciło",
    "zbudowane podczas oblężenia",
    "powodzie zabrały stare miasto",
    "uczeni przybyli i zbudowali wieżę",
    "krasnoludy wydrążyły je i odeszły",
    "zdobyte i zapomniane trzy razy z rzędu",
    "armia zebrała się tutaj przed ostatnim marszem",
    "klejnoty koronne zostały tu pogrzebane i nigdy nie odzyskane",
    "święty zakon uczynił je swoją twierdzą na sto lat",
    "to była stolica zanim spłonęła",
    "szlak handlowy upadł",
    "susza zabiła założycieli",
    "górnicy natrafili na coś złego poniżej",
    "krzyżowcy zrównali je z ziemią",
    "umarli chodzili tu kiedyś",
    "rzeka zalewała je przez stulecie",
    "las odrósł nad ulicami",
    "górnicy soli uczynili je bogatym, a potem zostawili suche",
    "nikt kto tam żył, nie ostał się by opowiedzieć co się stało",
    "najpierw zasiedlone przez wędrowców po długiej ciszy",
]

PL_FOUNDERS = [
    "elara obieżyświat",
    "artur pendragon",
    "kalder",
    "marena z szarego wybrzeża",
    "lord edryk",
    "siostra brynn",
    "dowódca oswin młodszy",
    "aldryk wygnaniec",
    "sewyn",
    "vael nocny szept",
    "kira bezimienna",
    "lord gareth",
    "sorn ze wschodnich rubieży",
    "wiedźma ciernista",
    "pani linne srebrny łuk",
    "król eryk ślepy",
    "tomasz wędrowiec",
    "magister dorin",
    "stary pasterz",
    "nikt — zasiedlone przez żadnego założyciela",
    "jan",
    "wędrowiec",
    "pustelnik którego imienia nigdy nie zapisano",
    "kapitan vael zimna woda",
    "matka maer",
    "dezerter",
    "książę dawyn młody",
    "przewoźnik",
    "najwyższy lord caern",
    "bezimienny egzarcha",
]

PL_MYTHOS = [
    "smoki śpiące pod szczytami od pierwszej ery",
    "mroczny portal w zaświaty opieczętowany krwią",
    "anioły upadły tutaj gdy niebo pękło",
    "bóg rzeki przeklął dolinę po spaleniu mostu",
    "bogini płakała tutaj i jej łzy stały się jeziorem",
    "trzy czarownice uwięziły demona pod starą studnią",
    "umarli nie pozostają pogrzebani w tym miejscu",
    "spadająca gwiazda uderzyła w ziemię dawno temu",
    "pierwsi ludzie zawarli przymierze z ogniem tutaj",
    "duchy starej armii maszerują w bezksiężycowe noce",
    "bóg wulkanu żąda haraczu w każdym pokoleniu",
    "czas płynie dziwnie pod górą",
    "las pamięta każdą śmierć w swoim wnętrzu",
    "morze daje i morze zabiera",
    "stary bóg śpi w kamieniu",
    "gigant został tu pochowany na stojąco",
    "światło nigdy w pełni nie dociera na dno doliny",
    "nic co tu zbudowano nie ostoi się",
    "wiatr wymienia imiona zmarłych o zmierzchu",
    "klątwa rzucona na wszystkich, którzy zwą się władcami",
    "smoki",
    "duchy",
    "przeklęte miejsce",
    "święta ziemia",
    "demony poniżej",
    "bóg zginął tutaj",
    "wiedźmy to zajęły",
    "stara przepowiednia o tym właśnie wzgórzu",
    "wróżki zamieszkują w gęstym lesie",
    "sama ziemia żyje i patrzy",
]

PL_NATIVE = [
    "smocza mowa chłodu",
    "mowa głębin",
    "stary język",
    "słowa pływów",
    "pieśń popiołów",
    "elficki",
    "żargon cieni",
    "dialekt zaklinaczy",
    "czwarty język",
    "znaki lasu",
    "język krwi",
    "niebiańskie dzwony",
    "przywoływacz fal",
    "znak runy",
    "czary",
    "mowa pyłu",
    "martwy język",
    "szept cierni",
    "żelazne usta",
    "kod słonej wody",
]



# ═══════════════════════════════════════════════════════════════════════════
# TEST RUNNER
# ═══════════════════════════════════════════════════════════════════════════

DRIFT_LEVELS = [15, 50, 85]

def pick_fields(geo_pool, hist_pool, founder_pool, mythos_pool, native_pool, sparsity: str):
    """
    Return a dict of fields based on sparsity level.
    - bare:    1 random field
    - sparse:  2 random fields
    - partial: geography + 2 random others
    - full:    all 5 fields
    - edge:    one of the specifically tricky edge cases
    """
    all_fields = {
        "geography":   random.choice(geo_pool),
        "history":     random.choice(hist_pool),
        "founder":     random.choice(founder_pool),
        "mythos":      random.choice(mythos_pool),
        "native_tongue": random.choice(native_pool),
    }

    if sparsity == "full":
        return all_fields

    if sparsity == "edge":
        choice = random.choice([
            # only founder
            {"founder": random.choice(founder_pool)},
            # only mythos
            {"mythos": random.choice(mythos_pool)},
            # only geo
            {"geography": random.choice(geo_pool)},
            # geo + history, no founder
            {"geography": random.choice(geo_pool), "history": random.choice(hist_pool)},
            # all empty
            {},
        ])
        return {k: v for k, v in all_fields.items() if k in choice}

    keys   = list(all_fields.keys())
    chosen = {}

    if sparsity == "partial":
        # Always include geography
        chosen["geography"] = all_fields["geography"]
        others = [k for k in keys if k != "geography"]
        random.shuffle(others)
        for k in others[:2]:
            chosen[k] = all_fields[k]

    elif sparsity == "sparse":
        random.shuffle(keys)
        for k in keys[:2]:
            chosen[k] = all_fields[k]

    elif sparsity == "bare":
        k = random.choice(keys)
        chosen[k] = all_fields[k]

    return chosen


def run_tests(args):
    sparsity_levels = ["bare", "sparse", "partial", "full", "edge"]
    samples_per_sparsity = args.samples
    names_per_config = args.names
    max_attempts = names_per_config * 2  # Don't loop forever trying to hit unique names

    all_names = {lang: [] for lang in args.langs}
    timeouts  = {lang: 0 for lang in args.langs}

    lines = []
    sep = "═" * 60

    def write(*a):
        lines.append(" ".join(str(x) for x in a))

    lang_configs = []
    if "en" in args.langs:
        lang_configs.append(("ENGLISH",  "en", EN_GEO, EN_HIST, EN_FOUNDERS, EN_MYTHOS, EN_NATIVE, False))
    if "hu" in args.langs:
        lang_configs.append(("HUNGARIAN","hu", HU_GEO, HU_HIST, HU_FOUNDERS, HU_MYTHOS, HU_NATIVE, True))
    if "pl" in args.langs:
        lang_configs.append(("POLISH",   "pl", PL_GEO, PL_HIST, PL_FOUNDERS, PL_MYTHOS, PL_NATIVE, False))

    for lang_label, lang_code, geo_p, hist_p, founder_p, mythos_p, native_p, use_harmony in lang_configs:
        write("")
        write(sep)
        write(f"  {lang_label}")
        write(sep)

        for sparsity in sparsity_levels:
            for sample_idx in range(samples_per_sparsity):
                fields = pick_fields(geo_p, hist_p, founder_p, mythos_p, native_p, sparsity)

                for drift in DRIFT_LEVELS:
                    config = LocationNameGenConfig(
                        genre="fantasy",
                        geography=fields.get("geography", ""),
                        history=fields.get("history", ""),
                        founder=fields.get("founder", ""),
                        mythos=fields.get("mythos", ""),
                        native_tongue=fields.get("native_tongue", ""),
                        drift=drift,
                        language=lang_code,
                        vowel_harmony=use_harmony,
                    )

                    total_cases = len(sparsity_levels) * samples_per_sparsity * len(DRIFT_LEVELS)
                    current = (sparsity_levels.index(sparsity) * samples_per_sparsity + sample_idx) * len(DRIFT_LEVELS) + DRIFT_LEVELS.index(drift) + 1
                    print(f"  [{lang_label}] {current}/{total_cases} — sparsity={sparsity} drift={drift}", flush=True)

                    # Generate names with per-call timeout guard
                    names = set()
                    for _ in range(max_attempts):
                        if len(names) >= names_per_config:
                            break
                        result = _safe_generate(config)
                        if result and result not in ("Unknown", "[TIMEOUT]") and not result.startswith("[ERROR"):
                            names.add(result)
                        elif result == "[TIMEOUT]":
                            timeouts[lang_code] += 1
                            print(f"    [TIMEOUT] on {lang_label} drift={drift} sparsity={sparsity}", flush=True)
                            break  # Don't keep hammering a stalled config
                        elif result and result.startswith("[ERROR"):
                            names.add(result)
                            break

                    all_names[lang_code].extend(names)

                    write("")
                    write(sep)
                    write(f"  {lang_label}  |  Sparsity: {sparsity.upper()} #{sample_idx+1}  |  Drift: {drift}")
                    write("─" * 60)
                    for k, v in [
                        ("Geography", fields.get("geography", "(empty)")),
                        ("History",   fields.get("history",   "(empty)")),
                        ("Founder",   fields.get("founder",   "(empty)")),
                        ("Mythos",    fields.get("mythos",    "(empty)")),
                        ("Native",    fields.get("native_tongue", "(empty)")),
                    ]:
                        display = v if v else "(empty)"
                        if len(display) > 55:
                            display = display[:52] + "..."
                        write(f"  {k:<10}: {display}")
                    write("─" * 60)
                    sorted_names = sorted(names)
                    for i, name in enumerate(sorted_names, 1):
                        write(f"  {i}. {name}")
                    if not names:
                        write("  [No valid names generated]")
                    write(sep)

        write("")

    # ─── Statistics ──────────────────────────────────────────────────────
    write("")
    write("═" * 60)
    write("  STATISTICS")
    write("═" * 60)

    for lang_code, lang_label in [(c[1], c[0].capitalize()) for c in lang_configs]:
        name_list = all_names[lang_code]
        total     = len(name_list)
        unique    = len(set(n.lower() for n in name_list))
        errors    = sum(1 for n in name_list if n.startswith("[ERROR"))
        avg_len   = round(sum(len(n) for n in name_list if not n.startswith("[ERROR")) / max(1, total - errors), 1)
        avg_words = round(sum(len(n.split()) for n in name_list if not n.startswith("[ERROR")) / max(1, total - errors), 1)

        write(f"")
        write(f"  [{lang_label}]")
        write(f"    Total generated : {total}")
        write(f"    Unique names    : {unique}  ({round(unique/max(1,total)*100, 1)}%)")
        write(f"    Errors          : {errors}")
        write(f"    Timeouts        : {timeouts[lang_code]}")
        write(f"    Avg length      : {avg_len} chars")
        write(f"    Avg word count  : {avg_words}")

    write("")
    write("═" * 60)
    write("  END OF REPORT")
    write("═" * 60)

    return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ultimate Location Name Generator Stress Tester")
    parser.add_argument("--langs", nargs="+", choices=["en", "hu", "pl"], default=["en", "hu", "pl"], help="Languages to generate for")
    parser.add_argument("--samples", type=int, default=10, help="Number of samples per sparsity level")
    parser.add_argument("--names", type=int, default=5, help="Number of names per config")
    parser.add_argument("--output", type=str, default="ultimate_test_results.txt", help="Output filename")
    args = parser.parse_args()

    print(f"Starting ultimate name generation test for {args.langs}...", flush=True)
    start = time.time()

    report = run_tests(args)

    # Write report
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), args.output)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(report)

    elapsed = round(time.time() - start, 1)
    print(f"Done in {elapsed}s. Results written to {args.output}", flush=True)
