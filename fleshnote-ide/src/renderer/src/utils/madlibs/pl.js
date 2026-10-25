// Polish Word Libraries and Syntactic Templates for Madlibs Story Sparks

export const GRAMMAR_WORDS = {
  who: { m: 'który', f: 'która', n: 'które', pl: 'którzy', base: 'który' },
  whose: { m: 'którego', f: 'której', n: 'którego', pl: 'których', base: 'którego' }
}

export const CHARACTER_DATA = {
  archetypes: [
    { base: 'rycerz', g: 'm' },
    { base: 'przemytnik', g: 'm' },
    { base: 'dziedziczka', g: 'f' },
    { base: 'wygnany mnich', g: 'm' },
    { base: 'zhańbiony alchemik', g: 'm' },
    { base: 'zegarmistrz', g: 'm' },
    { base: 'detektyw', g: 'm' },
    { base: 'najemnik', g: 'm' },
    { base: 'inkwizytor', g: 'm' },
    { base: 'dyplomata', g: 'm' },
    { base: 'kartograf', g: 'm' },
    { base: 'egzorcysta', g: 'm' },
    { base: 'złodziej', g: 'm' },
    { base: 'uczony', g: 'm' },
    { base: 'generał', g: 'm' },
    { base: 'kowal', g: 'm' },
    { base: 'grabarz', g: 'm' },
    { base: 'hazardzista', g: 'm' },
    { base: 'kurtyzana', g: 'f' },
    { base: 'przywódca buntowników', g: 'm' },
    { base: 'astronauta', g: 'm' },
    { base: 'neurohaker', g: 'm' },
    { base: 'nawigator gwiezdny', g: 'm' },
    { base: 'szef syndykatu', g: 'm' },
    { base: 'kultysta', g: 'm' },
    { base: 'wędrowiec', g: 'm' },
    { base: 'wiedźma z bezdroży', g: 'f' },
    { base: 'archiwista', g: 'm' },
    { base: 'łowca nagród', g: 'm' },
    { base: 'koroner', g: 'm' },
    { base: 'błazen nadworny', g: 'm' },
    { base: 'aptekarz', g: 'm' },
    { base: 'gladiator', g: 'm' },
    { base: 'skryba', g: 'm' },
    { base: 'kłusownik', g: 'm' },
    { base: 'rusznikarz', g: 'm' },
    { base: 'zbiegły książę', g: 'm' },
    { base: 'latarnik', g: 'm' },
    { base: 'antykwariusz', g: 'm' },
    { base: 'kat', g: 'm' },
    { base: 'szwaczka', g: 'f' },
    { base: 'szkutnik', g: 'm' },
    { base: 'zielarka', g: 'f' },
    { base: 'iluzjonista', g: 'm' },
    { base: 'strażnik nocny', g: 'm' },
    { base: 'paladyn', g: 'm' },
    { base: 'poskramiacz bestii', g: 'm' },
    { base: 'pielgrzym', g: 'm' },
    { base: 'poborca podatkowy', g: 'm' },
    { base: 'wróżbiarka', g: 'f' },
    { base: 'rzemieślnik artefaktów', g: 'm' },
    { base: 'rabuś grobowców', g: 'm' },
    { base: 'filozof', g: 'm' },
    { base: 'kwatermistrz', g: 'm' },
    { base: 'wartownik', g: 'm' },
    { base: 'tkacz', g: 'm' },
    { base: 'górnik', g: 'm' },
    { base: 'mistrz szpiegów', g: 'm' },
    { base: 'archeolog', g: 'm' },
    { base: 'kapłan utraconej wiary', g: 'm' },
    { base: 'alchemiczka', g: 'f' },
    { base: 'przemytniczka', g: 'f' },
    { base: 'łowczyni nagród', g: 'f' }
  ],

  conditions: [
    { base: 'nawiedzony', m: 'nawiedzony', f: 'nawiedzona' },
    { base: 'szantażowany', m: 'szantażowany', f: 'szantażowana' },
    { base: 'zauroczony', m: 'zauroczony', f: 'zauroczona' },
    { base: 'ogarnięty obsesją', m: 'ogarnięty obsesją', f: 'ogarnięta obsesją' },
    { base: 'obciążony brzemieniem', m: 'obciążony brzemieniem', f: 'obciążona brzemieniem' },
    { base: 'udręczony', m: 'udręczony', f: 'udręczona' },
    { base: 'oszukany', m: 'oszukany', f: 'oszukana' },
    { base: 'błogosławiony', m: 'błogosławiony', f: 'błogosławiona' },
    { base: 'osaczony', m: 'osaczony', f: 'osaczona' },
    { base: 'zrujnowany', m: 'zrujnowany', f: 'zrujnowana' },
    { base: 'zhańbiony', m: 'zhańbiony', f: 'zhańbiona' },
    { base: 'zapomniany', m: 'zapomniany', f: 'zapomniana' },
    { base: 'wygnany', m: 'wygnany', f: 'wygnana' },
    { base: 'wrobiony', m: 'wrobiony', f: 'wrobiona' },
    { base: 'zadłużony', m: 'zadłużony', f: 'zadłużona' },
    { base: 'opętany', m: 'opętany', f: 'opętana' },
    { base: 'oświecony', m: 'oświecony', f: 'oświecona' },
    { base: 'związany przysięgą milczenia', m: 'związany przysięgą milczenia', f: 'związana przysięgą milczenia' },
    { base: 'przeklęty', m: 'przeklęty', f: 'przeklęta' },
    { base: 'straumatyzowany', m: 'straumatyzowany', f: 'straumatyzowana' },
    { base: 'nieugięcie ścigany', m: 'nieugięcie ścigany', f: 'nieugięcie ścigana' },
    { base: 'dręczony proroctwami', m: 'dręczony proroctwami', f: 'dręczona proroctwami' },
    { base: 'poszukiwany listem gończym', m: 'poszukiwany listem gończym', f: 'poszukiwana listem gończym' },
    { base: 'porzucony na pastwę losu', m: 'porzucony na pastwę losu', f: 'porzucona na pastwę losu' },
    { base: 'z zawiązanymi oczami', m: 'z zawiązanymi oczami', f: 'z zawiązanymi oczami' },
    { base: 'fałszywie kanonizowany', m: 'fałszywie kanonizowany', f: 'fałszywie kanonizowana' },
    { base: 'związany krwawym paktem', m: 'związany krwawym paktem', f: 'związana krwawym paktem' },
    { base: 'skażony tajemną zarazą', m: 'skażony tajemną zarazą', f: 'skażona tajemną zarazą' },
    { base: 'ekskomunikowany', m: 'ekskomunikowany', f: 'ekskomunikowana' },
    { base: 'zmutowany', m: 'zmutowany', f: 'zmutowana' },
    { base: 'odarty z honoru', m: 'odarty z honoru', f: 'odarta z honoru' }
  ],

  catalysts: [
    { base: 'widmowy ogar', acc: 'widmowego ogara', gen: 'widmowego ogara', ins: 'widmowym ogarem', g: 'm' },
    { base: 'przeklęty relikt', acc: 'przeklęty relikt', gen: 'przeklętego reliktu', ins: 'przeklętym reliktem', g: 'm' },
    { base: 'zaginione rodzeństwo', acc: 'zaginione rodzeństwo', gen: 'zaginionego rodzeństwa', ins: 'zaginionym rodzeństwem', g: 'n' },
    { base: 'skradziony prototyp', acc: 'skradziony prototyp', gen: 'skradzionego prototypu', ins: 'skradzionym prototypem', g: 'm' },
    { base: 'mechaniczne serce', acc: 'mechaniczne serce', gen: 'mechanicznego serca', ins: 'mechanicznym sercem', g: 'n' },
    { base: 'odwieczny pasożyt', acc: 'odwiecznego pasożyta', gen: 'odwiecznego pasożyta', ins: 'odwiecznym pasożytem', g: 'm' },
    { base: 'mówiący sztylet', acc: 'mówiący sztylet', gen: 'mówiącego sztyletu', ins: 'mówiącym sztyletem', g: 'm' },
    { base: 'zadłużona gildia', acc: 'zadłużoną gildię', gen: 'zadłużonej gildii', ins: 'zadłużoną gildią', g: 'f' },
    { base: 'zakazany grymuar', acc: 'zakazany grymuar', gen: 'zakazanego grymuaru', ins: 'zakazanym grymuarem', g: 'm' },
    { base: 'cesarski dekret', acc: 'cesarski dekret', gen: 'cesarskiego dekretu', ins: 'cesarskim dekretem', g: 'm' },
    { base: 'dawny mentor', acc: 'dawnego mentora', gen: 'dawnego mentora', ins: 'dawnym mentorem', g: 'm' },
    { base: 'zbiegły klon', acc: 'zbiegłego klona', gen: 'zbiegłego klona', ins: 'zbiegłym klonem', g: 'm' },
    { base: 'niewypowiedziany dług', acc: 'niewypowiedziany dług', gen: 'niewypowiedzianego długu', ins: 'niewypowiedzianym długiem', g: 'm' },
    { base: 'tykający chronometr', acc: 'tykający chronometr', gen: 'tykającego chronometru', ins: 'tykającym chronometrem', g: 'm' },
    { base: 'mściwe pomniejsze bóstwo', acc: 'mściwe pomniejsze bóstwo', gen: 'mściwego pomniejszego bóstwa', ins: 'mściwym pomniejszym bóstwem', g: 'n' },
    { base: 'umierająca gwiazda', acc: 'umierającą gwiazdę', gen: 'umierającej gwiazdy', ins: 'umierającą gwiazdą', g: 'f' },
    { base: 'sfałszowana relikwia', acc: 'sfałszowaną relikwię', gen: 'sfałszowanej relikwii', ins: 'sfałszowaną relikwią', g: 'f' },
    { base: 'tajemny dziennik wieszczący zgony', acc: 'tajemny dziennik wieszczący zgony', gen: 'tajemnego dziennika wieszczącego zgony', ins: 'tajemnym dziennikiem wieszczącym zgony', g: 'm' },
    { base: 'butelka ze schwytanym światłem słonecznym', acc: 'butelkę ze schwytanym światłem słonecznym', gen: 'butelki ze schwytanym światłem słonecznym', ins: 'butelką ze schwytanym światłem słonecznym', g: 'f' },
    { base: 'dług wobec syndykatu cieni', acc: 'dług wobec syndykatu cieni', gen: 'długu wobec syndykatu cieni', ins: 'długiem wobec syndykatu cieni', g: 'm' },
    { base: 'obsydianowy klucz bez zamka', acc: 'obsydianowy klucz bez zamka', gen: 'obsydianowego klucza bez zamka', ins: 'obsydianowym kluczem bez zamka', g: 'm' },
    { base: 'słój szepczących popiołów', acc: 'słój szepczących popiołów', gen: 'słoja szepczących popiołów', ins: 'słojem szepczących popiołów', g: 'm' },
    { base: 'kompas wskazujący niebezpieczeństwo', acc: 'kompas wskazujący niebezpieczeństwo', gen: 'kompasu wskazującego niebezpieczeństwo', ins: 'kompasem wskazującym niebezpieczeństwo', g: 'm' },
    { base: 'czaszka wymarłej bestii', acc: 'czaszkę wymarłej bestii', gen: 'czaszki wymarłej bestii', ins: 'czaszką wymarłej bestii', g: 'f' },
    { base: 'odcięte mechaniczne skrzydło', acc: 'odcięte mechaniczne skrzydło', gen: 'odciętego mechanicznego skrzydła', ins: 'odciętym mechanicznym skrzydłem', g: 'n' },
    { base: 'lista zdrajców spisana ręką króla', acc: 'listę zdrajców spisaną ręką króla', gen: 'listy zdrajców spisanej ręką króla', ins: 'listą zdrajców spisaną ręką króla', g: 'f' },
    { base: 'zegarowa ćma pożerająca złoto', acc: 'zegarową ćmę pożerającą złoto', gen: 'zegarowej ćmy pożerającej złoto', ins: 'zegarową ćmą pożerającą złoto', g: 'f' },
    { base: 'szkatuła nieprzeczytanych listów miłosnych', acc: 'szkatułę nieprzeczytanych listów miłosnych', gen: 'szkatuły nieprzeczytanych listów miłosnych', ins: 'szkatułą nieprzeczytanych listów miłosnych', g: 'f' },
    { base: 'strzaskana porcelanowa maska', acc: 'strzaskaną porcelanową maskę', gen: 'strzaskanej porcelanowej maski', ins: 'strzaskaną porcelanową maską', g: 'f' },
    { base: 'wisior uwięzionej burzy', acc: 'wisior uwięzionej burzy', gen: 'wisiora uwięzionej burzy', ins: 'wisiorem uwięzionej burzy', g: 'm' },
    { base: 'kryształ uśpionej pamięci', acc: 'kryształ uśpionej pamięci', gen: 'kryształu uśpionej pamięci', ins: 'kryształem uśpionej pamięci', g: 'm' }
  ],

  actions: [
    { base: 'zamordował', m: 'zamordował', f: 'zamordowała' },
    { base: 'oszukał', m: 'oszukał', f: 'oszukała' },
    { base: 'zdradził', m: 'zdradził', f: 'zdradziła' },
    { base: 'wskrzesił', m: 'wskrzesił', f: 'wskrzesiła' },
    { base: 'zdemaskował', m: 'zdemaskował', f: 'zdemaskowała' },
    { base: 'ocalił', m: 'ocalił', f: 'ocaliła' },
    { base: 'wymienił', m: 'wymienił', f: 'wymieniła' },
    { base: 'przesłuchał', m: 'przesłuchał', f: 'przesłuchała' },
    { base: 'otruł', m: 'otruł', f: 'otruła' },
    { base: 'uwiódł', m: 'uwiódł', f: 'uwiodła' },
    { base: 'wygnał', m: 'wygnał', f: 'wygnała' },
    { base: 'wrobił', m: 'wrobił', f: 'wrobiła' },
    { base: 'wyzwał na pojedynek', m: 'wyzwał na pojedynek', f: 'wyzwała na pojedynek' },
    { base: 'przechytrzył', m: 'przechytrzył', f: 'przechytrzyła' },
    { base: 'obronił', m: 'obronił', f: 'obroniła' },
    { base: 'przywołał', m: 'przywołał', f: 'przywołała' },
    { base: 'sklonował', m: 'sklonował', f: 'sklonowała' },
    { base: 'sprzedał', m: 'sprzedał', f: 'sprzedała' },
    { base: 'stracił', m: 'stracił', f: 'straciła' },
    { base: 'uprowadził', m: 'uprowadził', f: 'uprowadziła' },
    { base: 'szantażował', m: 'szantażował', f: 'szantażowała' },
    { base: 'pomścił', m: 'pomścił', f: 'pomściła' },
    { base: 'sabotował', m: 'sabotował', f: 'sabotowała' },
    { base: 'zastąpił fałszywym sobowtórem', m: 'zastąpił fałszywym sobowtórem', f: 'zastąpiła fałszywym sobowtórem' },
    { base: 'szpiegował', m: 'szpiegował', f: 'szpiegowała' }
  ],

  determiners: [
    'wszystkich',
    'swojego patrona',
    'całego miasta',
    'osławionego rodu',
    'głównego rywala',
    'własnej rodziny',
    'arcykapłana',
    'niewinnych',
    'śmiertelnego wroga',
    'królestwa',
    'swego monarchy',
    'mistrza gildii',
    'mrocznego kultu',
    'lokalnego watażki'
  ],

  subjects: [
    { base: 'dowódca straży', acc: 'dowódcę straży', gen: 'dowódcy straży', ins: 'dowódcą straży', g: 'm' },
    { base: 'ulubione dziecko', acc: 'ulubione dziecko', gen: 'ulubionego dziecka', ins: 'ulubionym dzieckiem', g: 'n' },
    { base: 'ostatni czempion', acc: 'ostatniego czempiona', gen: 'ostatniego czempiona', ins: 'ostatnim czempionem', g: 'm' },
    { base: 'mistrz szpiegów', acc: 'mistrza szpiegów', gen: 'mistrza szpiegów', ins: 'mistrzem szpiegów', g: 'm' },
    { base: 'zaufany strażnik', acc: 'zaufanego strażnika', gen: 'zaufanego strażnika', ins: 'zaufanym strażnikiem', g: 'm' },
    { base: 'królewski dziedzic', acc: 'królewskiego dziedzica', gen: 'królewskiego dziedzica', ins: 'królewskim dziedzicem', g: 'm' },
    { base: 'główny podejrzany', acc: 'głównego podejrzanego', gen: 'głównego podejrzanego', ins: 'głównym podejrzanym', g: 'm' },
    { base: 'informator z półświatka', acc: 'informatora z półświatka', gen: 'informatora z półświatka', ins: 'informatorem z półświatka', g: 'm' },
    { base: 'generał polowy', acc: 'generała polowego', gen: 'generała polowego', ins: 'generałem polowym', g: 'm' },
    { base: 'święta bestia', acc: 'świętą bestię', gen: 'świętej bestii', ins: 'świętą bestią', g: 'f' },
    { base: 'najstarszy sojusznik', acc: 'najstarszego sojusznika', gen: 'najstarszego sojusznika', ins: 'najstarszym sojusznikiem', g: 'm' },
    { base: 'zapomniane bóstwo', acc: 'zapomniane bóstwo', gen: 'zapomnianego bóstwa', ins: 'zapomnianym bóstwem', g: 'n' },
    { base: 'osobisty medyk', acc: 'osobistego medyka', gen: 'osobistego medyka', ins: 'osobistym medykiem', g: 'm' },
    { base: 'skarbnik', acc: 'skarbnika', gen: 'skarbnika', ins: 'skarbnikiem', g: 'm' },
    { base: 'nadworny architekt', acc: 'nadwornego architekta', gen: 'nadwornego architekta', ins: 'nadwornym architektem', g: 'm' },
    { base: 'tajemny kochanek', acc: 'tajemnego kochanka', gen: 'tajemnego kochanka', ins: 'tajemnym kochankiem', g: 'm' }
  ],

  stakes: [
    'odzyskać utracone dziedzictwo',
    'zapobiec apokaliptycznej wojnie',
    'spłacić krwawy dług wobec syndykatu cieni',
    'pogrzebać prastare proroctwo',
    'złamać rodową klątwę krwi',
    'uciec za ufortyfikowane rubieże',
    'pomścić poległy pułk',
    'odkupić winy w oczach własnego klanu',
    'ocalić ostatnie wspomnienie o rodzinnym domu',
    'przetrwać do jutrzejszego świtu',
    'ujawnić zgniliznę w sercu rady',
    'ocalić resztki własnego człowieczeństwa',
    'odnaleźć lekarstwo przed następną pełnią',
    'stworzyć nowe, niezależne królestwo',
    'odkryć prawdę o swoim pochodzeniu'
  ],

  wildcards: [
    { base: 'bezpański pies udzielający fatalnych porad finansowych', acc: 'bezpańskiego psa udzielającego fatalnych porad finansowych', gen: 'bezpańskiego psa udzielającego fatalnych porad finansowych', ins: 'bezpańskim psem udzielającym fatalnych porad finansowych', g: 'm' },
    { base: 'własny cień, który kategorycznie odmawia naśladowania ruchów', acc: 'własny cień, który kategorycznie odmawia naśladowania ruchów', gen: 'własnego cienia, który kategorycznie odmawia naśladowania ruchów', ins: 'własnym cieniem, który kategorycznie odmawia naśladowania ruchów', g: 'm' },
    { base: 'świadoma kanapka sporządzona podczas zakazanego rytuału', acc: 'świadomą kanapkę sporządzoną podczas zakazanego rytuału', gen: 'świadomej kanapki sporządzonej podczas zakazanego rytuału', ins: 'świadomą kanapką sporządzoną podczas zakazanego rytuału', g: 'f' },
    { base: 'mechaniczna gęś gęgająca alfabetem Morse’a', acc: 'mechaniczną gęś gęgającą alfabetem Morse’a', gen: 'mechanicznej gęsi gęgającej alfabetem Morse’a', ins: 'mechaniczną gęsią gęgającą alfabetem Morse’a', g: 'f' },
    { base: 'zmyślony przyjaciel, który zaczął popełniać prawdziwe przestępstwa', acc: 'zmyślonego przyjaciela, który zaczął popełniać prawdziwe przestępstwa', gen: 'zmyślonego przyjaciela, który zaczął popełniać prawdziwe przestępstwa', ins: 'zmyślonym przyjacielem, który zaczął popełniać prawdziwe przestępstwa', g: 'm' },
    { base: 'wiadro świecącego śluzu, które bezwzględnie domaga się szacunku', acc: 'wiadro świecącego śluzu, które bezwzględnie domaga się szacunku', gen: 'wiadra świecącego śluzu, które bezwzględnie domaga się szacunku', ins: 'wiadrem świecącego śluzu, które bezwzględnie domaga się szacunku', g: 'n' },
    { base: 'przeklęte lustro pokazujące wyłącznie najbardziej żenujący moment życia', acc: 'przeklęte lustro pokazujące wyłącznie najbardziej żenujący moment życia', gen: 'przeklętego lustra pokazującego wyłącznie najbardziej żenujący moment życia', ins: 'przeklętym lustrem pokazującym wyłącznie najbardziej żenujący moment życia', g: 'n' }
  ],

  names: [
    'Wacław Kruk', 'Kazimierz Mrozek', 'Dobroniega Czarna', 'Bolesław Żelazny',
    'Stanisław Zmora', 'Jadwiga Kalinowska', 'Ścibor z Popiołów', 'Bogumił Wilczyński',
    'Ziemowit Mglisty', 'Mściwój Cierń', 'Rzędzian Lasota', 'Drogomir Wilk',
    'Witosława z Młyna', 'Sambor Złotousty', 'Czcibor Krwawy', 'Radomiła Bór',
    'Władysław Kłodzki', 'Zbyszko Wichura', 'Boguchwał Grochot', 'Siemomysł Cień',
    'Nawoj z Otchłani', 'Mirogniew Ostry', 'Świętopełk Karzeł', 'Grzymisława Szara',
    'Sędzimir Ciemny', 'Bożydar Blady'
  ],

  traits: {
    positive: [
      'Empatyczny', 'Bystry', 'Stoicki', 'Skrupulatny', 'Odporny',
      'Nieskazitelny', 'Wymowny', 'Czujny', 'Zuchwały', 'Dyscyplinowany',
      'Intuicyjny', 'Lojalny', 'Zaradny', 'Dyplomatyczny', 'Cierpliwy',
      'Nieustraszony', 'Charyzmatyczny', 'Spostrzegawczy', 'Współczujący', 'Nieugięty',
      'Elastyczny', 'Pragmatyczny', 'Pobożny', 'Rycerski', 'Pomysłowy',
      'Niezłomny', 'Wspaniałomyślny', 'Dyskretny', 'Opiekuńczy', 'Dowcipny',
      'Altruistyczny', 'Niezachwiany', 'Przenikliwy', 'Honorowy', 'Filozoficzny',
      'Odważny', 'Ambitny', 'Wizjonerski', 'Towarzyski', 'Zadumany'
    ],
    negative: [
      'Paranoiczny', 'Arogancki', 'Bezwzględny', 'Uzależniony', 'Mściwy',
      'Cyniczny', 'Impulsywny', 'Skryty', 'Uparty', 'Oziębły',
      'Obsesyjny', 'Lekkomyślny', 'Pyszny', 'Zawistny', 'Chciwy',
      'Melancholijny', 'Zdradziecki', 'Łatwowierny', 'Neurotyczny', 'Nihilistyczny',
      'Uraźliwy', 'Obłudny', 'Fanatyczny', 'Porywczy', 'Tchórzliwy',
      'Podstępny', 'Zazdrosny', 'Przesądny', 'Obojętny', 'Makabryczny',
      'Sadystyczny', 'Fatalistyczny', 'Hedonistyczny', 'Megalomaniakalny', 'Zależny',
      'Złośliwy', 'Dogmatyczny', 'Narcystyczny', 'Apatyczny', 'Zaborczy'
    ]
  },

  roles: [
    { id: 'Protagonist', label: 'Protagonista' },
    { id: 'Antagonist', label: 'Antagonista' },
    { id: 'Deuteragonist', label: 'Deuteragonista' },
    { id: 'Supporting', label: 'Postać drugoplanowa' },
    { id: 'Mentor', label: 'Mentor / Przewodnik' },
    { id: 'Wildcard', label: 'Nieprzewidywalny sojusznik / Banita' },
    { id: 'Rival', label: 'Rywal' },
    { id: 'Foil', label: 'Kontrast / Ulga komiczna' },
    { id: 'Love Interest', label: 'Obiekt uczuć' },
    { id: 'Reluctant Ally', label: 'Niechętny sojusznik' }
  ]
}

export const CHARACTER_TEMPLATES = [
  '{^condition@archetype} {archetype}, {who@archetype} zmaga się z {catalyst:ins}.',
  '{^archetype}, {who@archetype} {action@archetype} {subject:acc} {determiner}, aby {stakes}.',
  '{^condition@archetype} {archetype} ukrywa {catalyst:acc}, od lat dręcząc się własną przeszłością.',
  '{^archetype}, {who@archetype} odnalazłszy {catalyst:acc}, ryzykuje wszystko, by {stakes}.',
  '{^archetype} na wygnaniu pragnie chronić {catalyst:acc} przed {subject:ins} {determiner}.',
  '{^archetype}, w {whose@archetype} ręce trafia {catalyst}, staje w obliczu zagrożenia ze strony {subject:gen} {determiner}.',
  '{^archetype}, {who@archetype} {action@archetype} {catalyst:acc}, musi teraz zawrzeć kruchy sojusz z {subject:ins} {determiner}.',
  '{^condition@archetype} {archetype} poszukuje {catalyst:gen} w desperackiej próbie, aby {stakes}.',
  '{^condition@archetype} {archetype}, mając za broń jedynie {catalyst:acc}, stawia czoła potędze, jaką reprezentuje {subject} {determiner}.',
  '{^condition@archetype} {archetype} nieustannie tropi {catalyst:acc}, aby {stakes}.',
  '{^archetype}, {who@archetype} przez przypadek {action@archetype} {subject:acc} {determiner}.',
  '{^condition@archetype} {archetype} niesie {catalyst:acc}, znajdując się w potrzasku między {subject:ins} {determiner} a szansą, by {stakes}.'
]

export const CHARACTER_WILDCARD_TEMPLATES = [
  '{^archetype}, {who@archetype} nie potrafi uwolnić się od fenomenu, jakim jest {wildcard}.',
  '{^archetype}, {who@archetype} przypadkowo {action@archetype} {wildcard:acc} podczas tajnej misji szpiegowskiej.',
  '{^condition@archetype} {archetype}, w {whose@archetype} życiu najważniejszą rolę odgrywa {wildcard}.',
  '{^archetype} z niezłomnym przekonaniem, że {subject} {determiner} to w rzeczywistości {wildcard}.'
]

export const LOCATION_DATA = {
  siteTypes: [
    { id: 'Citadel', label: 'Cytadela', base: 'cytadela', g: 'f', gen: 'cytadeli', loc: 'cytadeli', ins: 'cytadelą' },
    { id: 'Wilderness', label: 'Pustkowie', base: 'pustkowie', g: 'n', gen: 'pustkowia', loc: 'pustkowiu', ins: 'pustkowiem' },
    { id: 'Metropolis', label: 'Metropolia', base: 'metropolia', g: 'f', gen: 'metropolii', loc: 'metropolii', ins: 'metropolią' },
    { id: 'Outpost', label: 'Placówka', base: 'placówka', g: 'f', gen: 'placówki', loc: 'placówce', ins: 'placówką' },
    { id: 'Ruins', label: 'Ruiny', base: 'ruiny', g: 'pl', gen: 'ruin', loc: 'ruinach', ins: 'ruinami' },
    { id: 'Sanctum', label: 'Sanktuarium', base: 'sanktuarium', g: 'n', gen: 'sanktuarium', loc: 'sanktuarium', ins: 'sanktuarium' },
    { id: 'Archipelago', label: 'Archipelag', base: 'archipelag', g: 'm', gen: 'archipelagu', loc: 'archipelagu', ins: 'archipelagiem' },
    { id: 'Under-City', label: 'Podmiasto', base: 'podmiasto', g: 'n', gen: 'podmiasta', loc: 'podmieściu', ins: 'podmiastem' },
    { id: 'Fortress', label: 'Twierdza', base: 'twierdza', g: 'f', gen: 'twierdzy', loc: 'twierdzy', ins: 'twierdzą' },
    { id: 'Abyss', label: 'Otchłań', base: 'otchłań', g: 'f', gen: 'otchłani', loc: 'otchłani', ins: 'otchłanią' },
    { id: 'Megastructure', label: 'Megastruktura', base: 'megastruktura', g: 'f', gen: 'megastruktury', loc: 'megastrukturze', ins: 'megastrukturą' },
    { id: 'Colony', label: 'Kolonia', base: 'kolonia', g: 'f', gen: 'kolonii', loc: 'kolonii', ins: 'kolonią' },
    { id: 'Orbital Station', label: 'Stacja orbitalna', base: 'stacja orbitalna', g: 'f', gen: 'stacji orbitalnej', loc: 'stacji orbitalnej', ins: 'stacją orbitalną' },
    { id: 'Valley', label: 'Dolina', base: 'dolina', g: 'f', gen: 'doliny', loc: 'dolinie', ins: 'doliną' },
    { id: 'Necropolis', label: 'Nekropolia', base: 'nekropolia', g: 'f', gen: 'nekropolii', loc: 'nekropolii', ins: 'nekropolią' }
  ],

  terrains: [
    { base: 'skamieniały las', gen: 'skamieniałego lasu', loc: 'skamieniałym lesie', ins: 'skamieniałym lasem', g: 'm' },
    { base: 'obsydianowy archipelag', gen: 'obsydianowego archipelagu', loc: 'obsydianowym archipelagu', ins: 'obsydianowym archipelagiem', g: 'm' },
    { base: 'zatopiona kaldera', gen: 'zatopionej kaldery', loc: 'zatopionej kalderze', ins: 'zatopioną kalderą', g: 'f' },
    { base: 'neonowy labirynt', gen: 'neonowego labiryntu', loc: 'neonowym labiryncie', ins: 'neonowym labiryntem', g: 'm' },
    { base: 'smagany wiatrem step', gen: 'smaganego wiatrem stepu', loc: 'smaganym wiatrem stepie', ins: 'smaganym wiatrem stepem', g: 'm' },
    { base: 'dryfujący baldachim grzybów', gen: 'dryfującego baldachimu grzybów', loc: 'dryfującym baldachimie grzybów', ins: 'dryfującym baldachimem grzybów', g: 'm' },
    { base: 'spowita smogiem kotlina przemysłowa', gen: 'spowitej smogiem kotliny przemysłowej', loc: 'spowitej smogiem kotlinie przemysłowej', ins: 'spowitą smogiem kotliną przemysłową', g: 'f' },
    { base: 'kanion śpiewających luster', gen: 'kanionu śpiewających luster', loc: 'kanionie śpiewających luster', ins: 'kanionem śpiewających luster', g: 'm' },
    { base: 'spękana solna równina', gen: 'spękanej solnej równiny', loc: 'spękanej solnej równinie', ins: 'spękaną solną równiną', g: 'f' },
    { base: 'pokryty kraterami płaskowyż bazaltowy', gen: 'pokrytego kraterami płaskowyżu bazaltowego', loc: 'pokrytym kraterami płaskowyżu bazaltowym', ins: 'pokrytym kraterami płaskowyżem bazaltowym', g: 'm' },
    { base: 'podziemna sieć kanałów', gen: 'podziemnej sieci kanałów', loc: 'podziemnej sieci kanałów', ins: 'podziemną siecią kanałów', g: 'f' },
    { base: 'orbitalne cmentarzysko wraków', gen: 'orbitalnego cmentarzyska wraków', loc: 'orbitalnym cmentarzysku wraków', ins: 'orbitalnym cmentarzyskiem wraków', g: 'n' },
    { base: 'zamarznięte trzęsawisko', gen: 'zamarzniętego trzęsawiska', loc: 'zamarzniętym trzęsawisku', ins: 'zamarzniętym trzęsawiskiem', g: 'n' },
    { base: 'pustynia sproszkowanych kości', gen: 'pustyni sproszkowanych kości', loc: 'pustyni sproszkowanych kości', ins: 'pustynią sproszkowanych kości', g: 'f' },
    { base: 'krystaliczna rafa', gen: 'krystalicznej rafy', loc: 'krystalicznej rafie', ins: 'krystaliczną rafą', g: 'f' },
    { base: 'wypalona słońcem grań wapienna', gen: 'wypalonej słońcem grani wapiennej', loc: 'wypalonej słońcem grani wapiennej', ins: 'wypaloną słońcem granią wapienną', g: 'f' },
    { base: 'dolina uśpionych tytanów', gen: 'doliny uśpionych tytanów', loc: 'dolinie uśpionych tytanów', ins: 'doliną uśpionych tytanów', g: 'f' },
    { base: 'bezkresne bagno namorzynowe', gen: 'bezkresnego bagna namorzynowego', loc: 'bezkresnym bagnie namorzynowym', ins: 'bezkresnym bagnem namorzynowym', g: 'n' },
    { base: 'tarasowe wyrobisko żelaza', gen: 'tarasowego wyrobiska żelaza', loc: 'tarasowym wyrobisku żelaza', ins: 'tarasowym wyrobiskiem żelaza', g: 'n' },
    { base: 'nasiąknięte mgłą torfowisko', gen: 'nasiąkniętego mgłą torfowiska', loc: 'nasiąkniętym torfowisku', ins: 'nasiąkniętym mgłą torfowiskiem', g: 'n' },
    { base: 'wulkaniczna dolina ryftowa', gen: 'wulkanicznej doliny ryftowej', loc: 'wulkanicznej dolinie ryftowej', ins: 'wulkaniczną doliną ryftową', g: 'f' },
    { base: 'pieczara we wnętrzu góry', gen: 'pieczary we wnętrzu góry', loc: 'pieczarze we wnętrzu góry', ins: 'pieczarą we wnętrzu góry', g: 'f' }
  ],

  relations: [
    'wznosi się ponad miejscem, w którym spoczywa',
    'przylega do strefy, w której znajduje się',
    'spoczywa w bezpośrednim sąsiedztwie miejsca, gdzie stoi',
    'rozciąga się wokół fenomenu, jakim jest',
    'trwa w milczeniu tuż obok miejsca, w którym wznosi się',
    'dryfuje w przestrzeni ponad cudem, jakim jest',
    'znajduje schronienie w cieniu fenomenu, jakim jest',
    'strzeże jedynego przejścia w stronę miejsca, gdzie majaczy',
    'znika niemal pod naporem miejsca, gdzie trwa',
    'rozdziela się na dwoje pod wpływem fenomenu, jakim jest',
    'wiąże się potężnymi więzami z obszarem, na którym stoi',
    'owija się niczym wąż wokół miejsca, gdzie spoczywa',
    'pozostaje w ukryciu nieopodal miejsca, w którym trwa',
    'graniczy z terenem, na którym znajduje się'
  ],

  landmarks: [
    'ostatnia nieskażona warstwa wodonośna',
    'wrak kolosalnego okrętu kolonizacyjnego',
    'nieustanny wir wyładowań atmosferycznych',
    'opuszczona katedra zegarowa',
    'bezdenna szczelina geody',
    'tron dawno zmarłego żelaznego tyrana',
    'płaczący monolit przeczący prawom grawitacji',
    'zarośnięta winda orbitalna',
    'strefa kwarantanny zapieczętowana rtęciowymi wrotami',
    'skamieniałe truchło lewiatana',
    'biblioteka spalonych zwojów pergaminu',
    'świecąca iglica grzybowa służąca do nawigacji',
    'bateria uśpionych dział antysatelitarnych',
    'zapomniany grobowiec króla-astronoma',
    'krater, w którym czas płynie wstecz',
    'most przerzucony nad morzem wrzącej smoły'
  ],

  atmospheres: [
    'gdzie deszcz ma posmak miedzi i popiołu',
    'gdzie świat spowija nieprzenikniona, szkarłatna mgła',
    'gdzie nieustannie panuje blady półmrok',
    'gdzie lustra odbijają wydarzenia sprzed trzech sekund',
    'gdzie rozbrzmiewa doprowadzający do szaleństwa pomruk niskich częstotliwości',
    'gdzie powietrze pachnie ozonem i roztartym tymiankiem',
    'gdzie cienie odrywają się od ciał w trakcie zaćmienia',
    'gdzie jedynym źródłem światła są fosforyzujące porosty',
    'gdzie szaleją termiczne wichry zdzierające skórę z kości',
    'gdzie igły kompasów wirują bez wytchnienia',
    'gdzie o północy rozbrzmiewają widmowe chorały',
    'gdzie otwarty płomień pali się zimnym, błękitnym blaskiem',
    'gdzie ziemię ścina mróz nawet w samo południe',
    'gdzie panuje cisza tak ciężka, że wywołuje krwawienie z nosa'
  ],

  namePrefixes: [
    'Nowy', 'Stary', 'Górny', 'Dolny', 'Wielki', 'Mały', 'Cichy', 'Święty',
    'Mroczny', 'Biały', 'Czarny', 'Złoty', 'Żelazny', 'Królewski', 'Wilczy'
  ],

  nameRoots: [
    'Kruk', 'Wilk', 'Dąb', 'Ostrog', 'Jasno', 'Ciemno', 'Zimno', 'Krasno',
    'Biał', 'Czarn', 'Grom', 'Wichr', 'Mgło', 'Miedzo', 'Bor', 'Kamien',
    'Złot', 'Żelaz'
  ],

  nameSuffixes: [
    'gród', 'bór', 'wola', 'pole', 'góra', 'dół', 'rzeka', 'most',
    'woda', 'kamień', 'las', 'brzeg', 'drzew', 'zamek'
  ],

  scales: [
    { id: 'micro', label: 'Mikro (Komnata / Schron)', desc: 'Zamknięte pomieszczenie, ukryta kryjówka lub moduł placówki', word: { base: 'niewielki', m: 'niewielki', f: 'niewielka', n: 'niewielkie', pl: 'niewielkie' } },
    { id: 'local', label: 'Lokalna (Dystrykt / Przysiółek)', desc: 'Okolica, odizolowana osada lub opactwo', word: { base: 'lokalny', m: 'lokalny', f: 'lokalna', n: 'lokalne', pl: 'lokalne' } },
    { id: 'regional', label: 'Regionalna (Terytorium / Kotlina)', desc: 'Rozległa dolina, pasmo górskie lub prowincja', word: { base: 'rozległy', m: 'rozległy', f: 'rozległa', n: 'rozległe', pl: 'rozległe' } },
    { id: 'macro', label: 'Kontynentalna (Super-region)', desc: 'Cały biom geograficzny lub zwarte imperium', word: { base: 'kontynentalny', m: 'kontynentalny', f: 'kontynentalna', n: 'kontynentalne', pl: 'kontynentalne' } },
    { id: 'global', label: 'Planetarna (Przestrzeń / Orbita)', desc: 'Geografia w skali globu lub mega-system orbitalny', word: { base: 'planetarny', m: 'planetarny', f: 'planetarna', n: 'planetarne', pl: 'planetarne' } }
  ],

  climates: [
    { id: 'glacial', label: 'Lodowcowy (-30°C)', badge: '❄️ Lodowcowy', word: { base: 'lodowcowy', m: 'lodowcowy', f: 'lodowcowa', n: 'lodowcowe', pl: 'lodowcowe' } },
    { id: 'frigid', label: 'Mroźny (0°C)', badge: '🌨️ Mroźny', word: { base: 'mroźny', m: 'mroźny', f: 'mroźna', n: 'mroźne', pl: 'mroźne' } },
    { id: 'temperate', label: 'Umiarkowany (20°C)', badge: '🍃 Umiarkowany', word: { base: 'umiarkowany', m: 'umiarkowany', f: 'umiarkowana', n: 'umiarkowane', pl: 'umiarkowane' } },
    { id: 'arid', label: 'Upalny / Pustynny (45°C)', badge: '☀️ Piekielny upał', word: { base: 'upalny', m: 'upalny', f: 'upalna', n: 'upalne', pl: 'upalne' } },
    { id: 'infernal', label: 'Wulkaniczny / Piekielny (80°C+)', badge: '🌋 Wulkaniczny', word: { base: 'wulkaniczny', m: 'wulkaniczny', f: 'wulkaniczna', n: 'wulkaniczne', pl: 'wulkaniczne' } }
  ],

  populations: [
    { id: 'deserted', label: 'Opuszczone (0)', badge: 'Widmowe miejsce' },
    { id: 'outpost', label: 'Placówka (~50)', badge: 'Niewielki posterunek' },
    { id: 'settlement', label: 'Osada (~500)', badge: 'Wioska' },
    { id: 'city', label: 'Miasto (~50 000)', badge: 'Tętniące miasto' },
    { id: 'metropolis', label: 'Metropolia (1 000 000+)', badge: 'Megalopolis' }
  ],

  sensoryTags: [
    'obsydianowe iglice', 'wieczne opary mgły', 'zrujnowane akwedukty', 'runiczne monolity',
    'przepastne rozpadliny', 'zatopione krypty', 'żelazne szańce'
  ]
}

export const SENSORY_APPEND = {
  first: '{^tag}.',
  more: '{prev} W krajobrazie dominują {~tag}.'
}

export const GENERIC_PATTERNS = {
  protag: '{~archetype}',
  protagConditioned: '{~condition@archetype} {~archetype}',
  place: '{~siteType}',
  placeName: '{^siteType}'
}

export const STORY_IDEA_DATA = {
  genreFlavor: {
    fantasy: {
      adjectives: [
        'owiana mitami',
        'naznaczona klątwą bogów',
        'spętana magią',
        'związana krwawą przysięgą',
        'rozświetlona gasnącym zarzewiem'
      ],
      settings: [
        'dziewięć zatopionych dworów',
        'królestwo szepczących iglic',
        'ostatnia wolna enklawa władców magii',
        'kraina utkana ze starych długów i zapomnianych bóstw',
        'popielny tron wymarłej dynastii',
        'pogranicze, na którym mapa po prostu się urywa'
      ]
    },
    'sci-fi': {
      adjectives: [
        'zagubiona wśród gwiazd',
        'pozbawiona protokołów',
        'orbitalna',
        'postapokaliptyczna',
        'nawiedzona przez echa sygnałów'
      ],
      settings: [
        'niszczejący pierścień orbitalny',
        'ostatnia kolonia na rubieżach',
        'okręt uśpionych kolonistów',
        'megamiasto wypożyczonych wspomnień',
        'pas kwarantanny poza orbitą Jowisza',
        'stacja badawcza krążąca wokół umierającej gwiazdy'
      ]
    },
    thriller: {
      adjectives: [
        'pełna napięcia',
        'bezwzględna',
        'naznaczona zdradą',
        'nieubłagana w czasie',
        'ścigana przez cienie'
      ],
      settings: [
        'korytarze władzy',
        'miasto pożerające własnych informatorów',
        'dwanaście godzin przed ostatecznym transferem',
        'przygraniczne miasteczko pełne płatnych szpiegów',
        'tajne kanały wojny wywiadów',
        'jedna noc, jeden samochód, jedna walizka'
      ]
    },
    romance: {
      adjectives: [
        'pełna tęsknoty',
        'nieuchronna',
        'niedozwolona',
        'bolesna i czuła',
        'niefortunna'
      ],
      settings: [
        'nadmorskie miasteczko pełne sekretów',
        'ostatnia księgarnia przed zamknięciem',
        'wesele, na którym żadne z nich nie chciało się pojawić',
        'wspólne mieszkanie, którego żadne z nich nie może opuścić',
        'jedno długie, deszczowe lato',
        'późne godziny nocnej zmiany'
      ]
    },
    horror: {
      adjectives: [
        'mrożąca krew w żyłach',
        'przesiąknięta grozą',
        'pełna upiornych szeptów',
        'bezduszna',
        'przyprawiająca o dreszcze'
      ],
      settings: [
        'wioska, która zapomina o swoich zmarłych',
        'dom na skraju zapomnianego traktu huty',
        'las, który nie odpowiada żadnemu bogu',
        'przytułek opuszczony w ciągu jednej nocy',
        'zalane krypty pod kaplicą',
        'miasto, w którym mgła nigdy nie opada'
      ]
    },
    mystery: {
      adjectives: [
        'labiryntowa',
        'pełna fałszywych tropów',
        'cicho złowroga',
        'niewyjaśniona',
        'śliska od deszczu'
      ],
      settings: [
        'posiadłość zapieczętowana od dnia pogrzebu',
        'komisariat, który grzebie własne pomyłki',
        'dwanaście dni między kradzieżą a wyznaniem',
        'szkoła z internatem z jednym pustym łóżkiem',
        'agencja detektywistyczna trzy dni przed bankructwem',
        'miejskie archiwum po godzinach zamknięcia'
      ]
    },
    literary: {
      adjectives: [
        'kameralna',
        'przejmująca',
        'gorzko-słodka',
        'bezlitosna',
        'cierpka'
      ],
      settings: [
        'trzy pokolenia pod jednym dachem',
        'fabryczne miasteczko po ostatniej zmianie',
        'długie lato, podczas którego wszystko uległo zmianie',
        'dzielnica imigrantów ucząca się nowego języka',
        'małżeństwo spisane w brakujących rachunkach',
        'miesiące po tym, jak listy przestały przychodzić'
      ]
    },
    custom: {
      adjectives: [
        'nieuchwytna',
        'niespokojna',
        'niemożliwa',
        'osobliwa',
        'pozbawiona ram'
      ],
      settings: [
        'świat na styku gatunków',
        'historia, która wymyka się regułom',
        'przestrzeń poza krawędzią notatek',
        'założenie bez żadnego precedensu',
        'sam skraj mapy',
        'miejsce, do którego reguły jeszcze nie dotarły'
      ]
    }
  }
}

export const STORY_TEMPLATES = [
  'Opowieść {genreAdj}: {protag} odnajduje {catalyst:acc} i musi {stakes}.',
  'W scenerii takiej jak {setting}, {protag} znajduje się w śmiertelnym niebezpieczeństwie — a {catalyst} to jedyna droga ocalenia.',
  '{protagCap} wiąże swój los z {catalyst:ins} i musi {stakes}, nim bez śladu przepadnie w świecie, którego tłem jest {setting}.',
  'Gdy w miejscu takim jak {setting} pojawia się niespodziewanie {catalyst}, {protag} ma tylko jedną szansę, aby {stakes}.',
  'Kronika {genreAdj}: {protag} nie ma już wyboru i staje do wyścigu, by {stakes}.',
  'W miejscu zwanym {place}, {protag} odkrywa {catalyst:acc} — i tej prawdy nie da się już wymazać.',
  '{placeName} skrywa {catalyst:acc}. {protagCap} zamierza zdobyć ten skarb za wszelką cenę.',
  'Mając przy sobie {catalyst:acc}, {protag} podejmuje ucieczkę; areną tych zmagań staje się sceneria taka jak {setting}, a celem jest to, by {stakes}.',
  'Opowieść {genreAdj}: {protag}, {catalyst} oraz dramatyczne wydarzenia, a w tle: {setting}.',
  '{protagCap} zmaga się z brzemieniem {catalyst:gen}; jedyna droga ucieczki wiedzie przez miejsce takie jak {setting}.',
  'W rejonie znanym jako {place}, {protag} staje przed próbą: {catalyst} to jedyny ratunek, by {stakes}.',
  'Dramatyczna historia: {protag}, {catalyst} oraz nieodwracalne rozstrzygnięcie, dla którego tłem jest miejsce takie jak {setting}.'
]

export const LOCATION_TEMPLATES = [
  '{^terrain} {relation} {landmark}, {atmosphere}.',
  '{^scale@siteType} {siteType} w granicach obszaru, na którym leży {terrain}, {relation} {landmark}.',
  'Złowrogi relikt przeszłości, jakim pozostaje {siteType}, {relation} {landmark}, {atmosphere}.',
  '{^terrain}, kraina pełna tajemnic; obszar ten {relation} {landmark}, {atmosphere}.',
  '{^climate@terrain} {terrain}, niegdyś pod panowaniem suwerennej dynastii, dziś {relation} {landmark}.',
  'Silnie ufortyfikowany punkt oporu, jakim jest {siteType}; w pobliżu rozpościera się {terrain}, {atmosphere}.',
  'Legendarny obszar, jakim jest {terrain}, {relation} {landmark}; miejsce znane w całym regionie, {atmosphere}.',
  '{^scale@terrain} {terrain} rozpościera się tam, gdzie krajobraz {relation} {landmark}.'
]
