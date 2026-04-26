import sys
import os

# Add the backend directory to path if needed for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tools.name_gen.locations import LocationNameGenConfig, generate_location_name

english_samples = [
    {
        "desc": "Full detailed",
        "geography": "tall dark mountains covered in ice",
        "history": "an old war where the king died",
        "founder": "arthur pendragon",
        "mythos": "dragons sleeping under the peaks",
        "native_tongue": "draconic frost speak"
    },
    {
        "desc": "Mostly missing",
        "geography": "swamp",
        "history": "",
        "founder": "",
        "mythos": "",
        "native_tongue": ""
    },
    {
        "desc": "Only founder",
        "geography": "",
        "history": "",
        "founder": "elara dawnstrider",
        "mythos": "",
        "native_tongue": ""
    },
    {
        "desc": "Mix 1",
        "geography": "green rolling hills",
        "history": "",
        "founder": "",
        "mythos": "a falling star struck the ground here",
        "native_tongue": ""
    },
    {
        "desc": "Mix 2",
        "geography": "",
        "history": "built on an ancient burial ground",
        "founder": "necromancer zalor",
        "mythos": "",
        "native_tongue": "dead words"
    },
    {
        "desc": "Desert focus",
        "geography": "endless red sand dunes and dry heat",
        "history": "the civilization starved",
        "founder": "",
        "mythos": "",
        "native_tongue": ""
    },
    {
        "desc": "Missing founder",
        "geography": "a floating island in the sky",
        "history": "magic lifted it from the ground a thousand years ago",
        "founder": "",
        "mythos": "angels inhabit the core",
        "native_tongue": "celestial chimes"
    },
    {
        "desc": "Basic",
        "geography": "dense forest",
        "history": "elves lived here",
        "founder": "",
        "mythos": "",
        "native_tongue": "elvish"
    },
    {
        "desc": "Short details",
        "geography": "river",
        "history": "flood",
        "founder": "john",
        "mythos": "river god",
        "native_tongue": ""
    },
    {
        "desc": "Only mythos",
        "geography": "",
        "history": "",
        "founder": "",
        "mythos": "a dark portal to the underworld",
        "native_tongue": ""
    }
]

hungarian_samples = [
    {
        "desc": "Full detailed",
        "geography": "magas sötét hegyek jéggel borítva",
        "history": "egy régi háború ahol a király meghalt",
        "founder": "arthur pendragon király",
        "mythos": "sárkányok alszanak a csúcsok alatt",
        "native_tongue": "drákói fagybeszéd"
    },
    {
        "desc": "Mostly missing",
        "geography": "mocsár",
        "history": "",
        "founder": "",
        "mythos": "",
        "native_tongue": ""
    },
    {
        "desc": "Only founder",
        "geography": "",
        "history": "",
        "founder": "elara dawnstrider",
        "mythos": "",
        "native_tongue": ""
    },
    {
        "desc": "Mix 1",
        "geography": "zöld hullámzó dombok",
        "history": "",
        "founder": "",
        "mythos": "egy hullócsillag csapódott ide",
        "native_tongue": ""
    },
    {
        "desc": "Mix 2",
        "geography": "",
        "history": "ősi temetkezési helyre épült",
        "founder": "zalor nekromanta",
        "mythos": "",
        "native_tongue": "halott szavak"
    },
    {
        "desc": "Desert focus",
        "geography": "végtelen vörös homokdűnék és száraz hőség",
        "history": "a civilizáció éhenhalt",
        "founder": "",
        "mythos": "",
        "native_tongue": ""
    },
    {
        "desc": "Missing founder",
        "geography": "egy lebegő sziget az égen",
        "history": "a mágia emelte fel ezer éve",
        "founder": "",
        "mythos": "angyalok lakják a magját",
        "native_tongue": "égi harangok"
    },
    {
        "desc": "Basic",
        "geography": "sűrű erdő",
        "history": "tündék éltek itt",
        "founder": "",
        "mythos": "",
        "native_tongue": "tünde"
    },
    {
        "desc": "Short details",
        "geography": "folyó",
        "history": "árvíz",
        "founder": "jános",
        "mythos": "folyó isten",
        "native_tongue": ""
    },
    {
        "desc": "Only mythos",
        "geography": "",
        "history": "",
        "founder": "",
        "mythos": "egy sötét portál az alvilágba",
        "native_tongue": ""
    }
]

def run_tests():
    drifts = [10, 40, 80] # low, medium, high
    
    print("Starting tests...")
    with open("name_gen_results.txt", "w", encoding="utf-8") as f:
        f.write("=== ENGLISH TESTS ===\n\n")
        for i, sample in enumerate(english_samples):
            print(f"  English Sample {i+1}/10...")
            f.write(f"--- Sample {i+1}: {sample['desc']} ---\n")
            f.write(f"Geography: '{sample['geography']}'\n")
            f.write(f"History: '{sample['history']}'\n")
            f.write(f"Founder: '{sample['founder']}'\n")
            f.write(f"Mythos: '{sample['mythos']}'\n")
            f.write(f"Native Tongue: '{sample['native_tongue']}'\n\n")
            
            for drift in drifts:
                f.write(f"  Drift: {drift}\n")
                config = LocationNameGenConfig(
                    genre="fantasy",
                    geography=sample['geography'],
                    history=sample['history'],
                    founder=sample['founder'],
                    native_tongue=sample['native_tongue'],
                    mythos=sample['mythos'],
                    drift=drift,
                    language="en",
                    site_type="city",
                    importance="high",
                    vowel_harmony=False
                )
                
                # generate 5 names for this exact config
                names = set()
                # Run 8 times just to try and get 5 unique if possible
                for _ in range(8):
                    if len(names) >= 5:
                        break
                    res = generate_location_name(config)
                    names.add(res)
                
                f.write(f"  Generated: {', '.join(sorted(list(names)))}\n\n")

        f.write("\n\n=== HUNGARIAN TESTS ===\n\n")
        for i, sample in enumerate(hungarian_samples):
            print(f"  Hungarian Sample {i+1}/10...")
            f.write(f"--- Sample {i+1}: {sample['desc']} ---\n")
            f.write(f"Geography: '{sample['geography']}'\n")
            f.write(f"History: '{sample['history']}'\n")
            f.write(f"Founder: '{sample['founder']}'\n")
            f.write(f"Mythos: '{sample['mythos']}'\n")
            f.write(f"Native Tongue: '{sample['native_tongue']}'\n\n")
            
            for drift in drifts:
                f.write(f"  Drift: {drift}\n")
                config = LocationNameGenConfig(
                    genre="fantasy",
                    geography=sample['geography'],
                    history=sample['history'],
                    founder=sample['founder'],
                    native_tongue=sample['native_tongue'],
                    mythos=sample['mythos'],
                    drift=drift,
                    language="hu",
                    site_type="city",
                    importance="high",
                    vowel_harmony=True
                )
                
                names = set()
                for _ in range(15):
                    if len(names) >= 10:
                        break
                    res = generate_location_name(config)
                    names.add(res)
                
                f.write(f"  Generated: {', '.join(sorted(list(names)))}\n\n")

if __name__ == '__main__':
    run_tests()
    print("Done generating names to name_gen_results.txt")
