// Hungarian Word Libraries and Syntactic Templates for Madlibs Story Sparks

export const CHARACTER_DATA = {
  archetypes: [
    { base: 'lovag', def: 'a lovag', defCap: 'A lovag' },
    { base: 'csempész', def: 'a csempész', defCap: 'A csempész' },
    { base: 'örökösnő', def: 'az örökösnő', defCap: 'Az örökösnő' },
    { base: 'kitaszított szerzetes', def: 'a kitaszított szerzetes', defCap: 'A kitaszított szerzetes' },
    { base: 'kegyvesztett alkimista', def: 'a kegyvesztett alkimista', defCap: 'A kegyvesztett alkimista' },
    { base: 'óraműves', def: 'az óraműves', defCap: 'Az óraműves' },
    { base: 'detektív', def: 'a detektív', defCap: 'A detektív' },
    { base: 'zsoldos', def: 'a zsoldos', defCap: 'A zsoldos' },
    { base: 'inkvizítor', def: 'az inkvizítor', defCap: 'Az inkvizítor' },
    { base: 'diplomata', def: 'a diplomata', defCap: 'A diplomata' },
    { base: 'térképész', def: 'a térképész', defCap: 'A térképész' },
    { base: 'ördögűző', def: 'az ördögűző', defCap: 'Az ördögűző' },
    { base: 'tolvaj', def: 'a tolvaj', defCap: 'A tolvaj' },
    { base: 'tudós', def: 'a tudós', defCap: 'A tudós' },
    { base: 'hadvezér', def: 'a hadvezér', defCap: 'A hadvezér' },
    { base: 'kovács', def: 'a kovács', defCap: 'A kovács' },
    { base: 'sírásó', def: 'a sírásó', defCap: 'A sírásó' },
    { base: 'szerencsejátékos', def: 'a szerencsejátékos', defCap: 'A szerencsejátékos' },
    { base: 'kurtizán', def: 'a kurtizán', defCap: 'A kurtizán' },
    { base: 'lázadóvezér', def: 'a lázadóvezér', defCap: 'A lázadóvezér' },
    { base: 'űrhajós', def: 'az űrhajós', defCap: 'Az űrhajós' },
    { base: 'neurohacker', def: 'a neurohacker', defCap: 'A neurohacker' },
    { base: 'csillaghajó-navigátor', def: 'a csillaghajó-navigátor', defCap: 'A csillaghajó-navigátor' },
    { base: 'szindikátusfőnök', def: 'a szindikátusfőnök', defCap: 'A szindikátusfőnök' },
    { base: 'szektás', def: 'a szektás', defCap: 'A szektás' },
    { base: 'vándor', def: 'a vándor', defCap: 'A vándor' },
    { base: 'javasasszony', def: 'a javasasszony', defCap: 'A javasasszony' },
    { base: 'levéltáros', def: 'a levéltáros', defCap: 'A levéltáros' },
    { base: 'fejvadász', def: 'a fejvadász', defCap: 'A fejvadász' },
    { base: 'halottkém', def: 'a halottkém', defCap: 'A halottkém' },
    { base: 'udvari bolond', def: 'az udvari bolond', defCap: 'Az udvari bolond' },
    { base: 'patikárius', def: 'a patikárius', defCap: 'A patikárius' },
    { base: 'gladiátor', def: 'a gladiátor', defCap: 'A gladiátor' },
    { base: 'írnok', def: 'az írnok', defCap: 'Az írnok' },
    { base: 'orvvadász', def: 'az orvvadász', defCap: 'Az orvvadász' },
    { base: 'fegyverkovács', def: 'a fegyverkovács', defCap: 'A fegyverkovács' },
    { base: 'szökevény herceg', def: 'a szökevény herceg', defCap: 'A szökevény herceg' },
    { base: 'világítótorony-őr', def: 'a világítótorony-őr', defCap: 'A világítótorony-őr' },
    { base: 'antikvárius', def: 'az antikvárius', defCap: 'Az antikvárius' },
    { base: 'hóhér', def: 'a hóhér', defCap: 'A hóhér' },
    { base: 'varrónő', def: 'a varrónő', defCap: 'A varrónő' },
    { base: 'hajóács', def: 'a hajóács', defCap: 'A hajóács' },
    { base: 'füvesember', def: 'a füvesember', defCap: 'A füvesember' },
    { base: 'illuzionista', def: 'az illuzionista', defCap: 'Az illuzionista' },
    { base: 'éjjeliőr', def: 'az éjjeliőr', defCap: 'Az éjjeliőr' },
    { base: 'paladin', def: 'a paladin', defCap: 'A paladin' },
    { base: 'fenevadszelídítő', def: 'a fenevadszelídítő', defCap: 'A fenevadszelídítő' },
    { base: 'zarándok', def: 'a zarándok', defCap: 'A zarándok' },
    { base: 'adóbeszedő', def: 'az adóbeszedő', defCap: 'Az adóbeszedő' },
    { base: 'jövendőmondó', def: 'a jövendőmondó', defCap: 'A jövendőmondó' },
    { base: 'mechanikus mester', def: 'a mechanikus mester', defCap: 'A mechanikus mester' },
    { base: 'sírrabló', def: 'a sírrabló', defCap: 'A sírrabló' },
    { base: 'filozófus', def: 'a filozófus', defCap: 'A filozófus' },
    { base: 'hadiellátó', def: 'a hadiellátó', defCap: 'A hadiellátó' },
    { base: 'őrszem', def: 'az őrszem', defCap: 'Az őrszem' },
    { base: 'takács', def: 'a takács', defCap: 'A takács' },
    { base: 'bányász', def: 'a bányász', defCap: 'A bányász' },
    { base: 'kémmester', def: 'a kémmester', defCap: 'A kémmester' },
    { base: 'régész', def: 'a régész', defCap: 'A régész' },
    { base: 'letűnt vallás papja', def: 'a letűnt vallás papja', defCap: 'A letűnt vallás papja' }
  ],

  conditions: [
    'kísértett',
    'megzsarolt',
    'megbabonázott',
    'megszállott',
    'túlterhelt',
    'gyötört',
    'rászedett',
    'megáldott',
    'üldözött',
    'tönkrement',
    'kegyvesztett',
    'elfeledett',
    'száműzött',
    'tőrbe csalt',
    'eladósodott',
    'megszállt',
    'megvilágosodott',
    'titoktartásra kötelezett',
    'elátkozott',
    'traumatizált',
    'hajthatatlanul űzött',
    'jóslatok által kísértett',
    'a korona által hajszolt',
    'magára hagyott',
    'bekötött szemű',
    'hamisan szentté avatott',
    'véresküvel kötött',
    'misztikus kórral fertőzött',
    'kiátkozott',
    'mutálódott',
    'becsületétől megfosztott'
  ],

  catalysts: [
    { base: 'egy kísérteties kopó', acc: 'egy kísérteties kopót', def: 'a kísérteties kopó', defAcc: 'a kísérteties kopót', ins: 'egy kísérteties kopóval' },
    { base: 'egy elátkozott családi ereklye', acc: 'egy elátkozott családi ereklyét', def: 'az elátkozott családi ereklye', defAcc: 'az elátkozott családi ereklyét', ins: 'egy elátkozott családi ereklyével' },
    { base: 'egy rég elidegenedett testvér', acc: 'egy rég elidegenedett testvért', def: 'a rég elidegenedett testvér', defAcc: 'a rég elidegenedett testvért', ins: 'egy rég elidegenedett testvérrel' },
    { base: 'egy ellopott prototípus', acc: 'egy ellopott prototípust', def: 'az ellopott prototípus', defAcc: 'az ellopott prototípust', ins: 'egy ellopott prototípussal' },
    { base: 'egy mechanikus szív', acc: 'egy mechanikus szívet', def: 'a mechanikus szív', defAcc: 'a mechanikus szívet', ins: 'egy mechanikus szívvel' },
    { base: 'egy túlvilági parazita', acc: 'egy túlvilági parazitát', def: 'a túlvilági parazita', defAcc: 'a túlvilági parazitát', ins: 'egy túlvilági parazitával' },
    { base: 'egy beszélő tőr', acc: 'egy beszélő tőrt', def: 'a beszélő tőr', defAcc: 'a beszélő tőrt', ins: 'egy beszélő tőrrel' },
    { base: 'egy adósságokba vert céh', acc: 'egy adósságokba vert céhet', def: 'az adósságokba vert céh', defAcc: 'az adósságokba vert céhet', ins: 'egy adósságokba vert céhhel' },
    { base: 'egy tiltott grimoire', acc: 'egy tiltott grimoire-t', def: 'a tiltott grimoire', defAcc: 'a tiltott grimoire-t', ins: 'egy tiltott grimoire-ral' },
    { base: 'egy császári rendelet', acc: 'egy császári rendeletet', def: 'a császári rendelet', defAcc: 'a császári rendeletet', ins: 'egy császári rendelettel' },
    { base: 'egy hajdani mentor', acc: 'egy hajdani mentort', def: 'a hajdani mentor', defAcc: 'a hajdani mentort', ins: 'egy hajdani mentorral' },
    { base: 'egy szökött klón', acc: 'egy szökött klónt', def: 'a szökött klón', defAcc: 'a szökött klónt', ins: 'egy szökött klónnal' },
    { base: 'egy kimondhatatlan tartozás', acc: 'egy kimondhatatlan tartozást', def: 'a kimondhatatlan tartozás', defAcc: 'a kimondhatatlan tartozást', ins: 'egy kimondhatatlan tartozással' },
    { base: 'egy ketyegő kronométer', acc: 'egy ketyegő kronométert', def: 'a ketyegő kronométer', defAcc: 'a ketyegő kronométert', ins: 'egy ketyegő kronométerrel' },
    { base: 'egy bosszúszomjas kisistenség', acc: 'egy bosszúszomjas kisistenséget', def: 'a bosszúszomjas kisistenség', defAcc: 'a bosszúszomjas kisistenséget', ins: 'egy bosszúszomjas kisistenséggel' },
    { base: 'egy haldokló csillag', acc: 'egy haldokló csillagot', def: 'a haldokló csillag', defAcc: 'a haldokló csillagot', ins: 'egy haldokló csillaggal' },
    { base: 'egy hamisított relikvia', acc: 'egy hamisított relikviát', def: 'a hamisított relikvia', defAcc: 'a hamisított relikviát', ins: 'egy hamisított relikviával' },
    { base: 'egy haláleseteket megjósoló titkos napló', acc: 'egy haláleseteket megjósoló titkos naplót', def: 'a haláleseteket megjósoló titkos napló', defAcc: 'a haláleseteket megjósoló titkos naplót', ins: 'egy haláleseteket megjósoló titkos naplóval' },
    { base: 'egy palackba zárt napsugár', acc: 'egy palackba zárt napsugarat', def: 'a palackba zárt napsugár', defAcc: 'a palackba zárt napsugarat', ins: 'egy palackba zárt napsugárral' },
    { base: 'egy árnyszindikátusnak tett tartozás', acc: 'egy árnyszindikátusnak tett tartozást', def: 'az árnyszindikátusnak tett tartozás', defAcc: 'az árnyszindikátusnak tett tartozást', ins: 'egy árnyszindikátusnak tett tartozással' },
    { base: 'egy záratlan obszidián kulcs', acc: 'egy záratlan obszidián kulcsot', def: 'a záratlan obszidián kulcs', defAcc: 'a záratlan obszidián kulcsot', ins: 'egy záratlan obszidián kulccsal' },
    { base: 'egy korsónyi suttogó hamu', acc: 'egy korsónyi suttogó hamut', def: 'a korsónyi suttogó hamu', defAcc: 'a korsónyi suttogó hamut', ins: 'egy korsónyi suttogó hamuval' },
    { base: 'egy veszélyt jelző iránytű', acc: 'egy veszélyt jelző iránytűt', def: 'a veszélyt jelző iránytű', defAcc: 'a veszélyt jelző iránytűt', ins: 'egy veszélyt jelző iránytűvel' },
    { base: 'egy kihalt vadállat koponyája', acc: 'egy kihalt vadállat koponyáját', def: 'a kihalt vadállat koponyája', defAcc: 'a kihalt vadállat koponyáját', ins: 'egy kihalt vadállat koponyájával' },
    { base: 'egy levágott mechanikus szárny', acc: 'egy levágott mechanikus szárnyat', def: 'a levágott mechanikus szárny', defAcc: 'a levágott mechanikus szárnyat', ins: 'egy levágott mechanikus szárnnyal' },
    { base: 'egy királyi kézírással írt árulólista', acc: 'egy királyi kézírással írt árulólistát', def: 'a királyi kézírással írt árulólista', defAcc: 'a királyi kézírással írt árulólistát', ins: 'egy királyi kézírással írt árulólistával' },
    { base: 'egy aranyat zabáló óraműves moly', acc: 'egy aranyat zabáló óraműves molyt', def: 'az aranyat zabáló óraműves moly', defAcc: 'az aranyat zabáló óraműves molyt', ins: 'egy aranyat zabáló óraműves mollyal' },
    { base: 'egy ládányi el nem olvasott szerelmes levél', acc: 'egy ládányi el nem olvasott szerelmes levelet', def: 'a ládányi el nem olvasott szerelmes levél', defAcc: 'a ládányi el nem olvasott szerelmes levelet', ins: 'egy ládányi el nem olvasott szerelmes levéllel' },
    { base: 'egy összetört porcelánmaszk', acc: 'egy összetört porcelánmaszkot', def: 'az összetört porcelánmaszk', defAcc: 'az összetört porcelánmaszkot', ins: 'egy összetört porcelánmaszkkal' },
    { base: 'egy csapdába ejtett vihart rejtő medál', acc: 'egy csapdába ejtett vihart rejtő medált', def: 'a csapdába ejtett vihart rejtő medál', defAcc: 'a csapdába ejtett vihart rejtő medált', ins: 'egy csapdába ejtett vihart rejtő medállal' },
    { base: 'egy ősi vérrel pecsételt tekercs', acc: 'egy ősi vérrel pecsételt tekercset', def: 'az ősi vérrel pecsételt tekercs', defAcc: 'az ősi vérrel pecsételt tekercset', ins: 'egy ősi vérrel pecsételt tekerccsel' }
  ],

  actions: [
    'meggyilkolta',
    'becsapta',
    'elárulta',
    'feltámasztotta',
    'leplezte le',
    'megmentette',
    'elcserélte',
    'kihallgatta',
    'megmérgezte',
    'elcsábította',
    'száműzte',
    'tőrbe csalta',
    'párbajra hívta',
    'felfedte',
    'megvédte',
    'megidézte',
    'megsokszorozta',
    'eladta',
    'kivégezte',
    'elrabolta',
    'megzsarolta',
    'megbosszulta',
    'elszabotálta',
    'helyettesítette',
    'beszivárogva megfigyelte'
  ],

  determiners: [
    'a város',
    'a patrónus',
    'a rivális',
    'a család',
    'a főpap',
    'az ártatlanok',
    'az ellenség',
    'a királyság',
    'az uralkodó',
    'a céhmester',
    'az alvilág',
    'a császári tanács'
  ],

  subjects: [
    { base: 'főparancsnoka', acc: 'főparancsnokát' },
    { base: 'kedvenc gyermeke', acc: 'kedvenc gyermekét' },
    { base: 'utolsó bajnoka', acc: 'utolsó bajnokát' },
    { base: 'kémmestere', acc: 'kémmesterét' },
    { base: 'megbízható őre', acc: 'megbízható őrét' },
    { base: 'királyi örököse', acc: 'királyi örökösét' },
    { base: 'első számú gyanúsítottja', acc: 'első számú gyanúsítottját' },
    { base: 'titkos besúgója', acc: 'titkos besúgóját' },
    { base: 'hadvezére', acc: 'hadvezérét' },
    { base: 'szent fenevada', acc: 'szent fenevadát' },
    { base: 'legősibb szövetségese', acc: 'legősibb szövetségesét' },
    { base: 'elfeledett istene', acc: 'elfeledett istenét' },
    { base: 'udvari orvosa', acc: 'udvari orvosát' },
    { base: 'kincstárnoka', acc: 'kincstárnokát' },
    { base: 'főépítésze', acc: 'főépítészét' },
    { base: 'titkos szeretője', acc: 'titkos szeretőjét' }
  ],

  stakes: [
    'visszaszerezze elveszett örökségét',
    'megakadályozzon egy pusztító háborút',
    'lerója véradóját a szindikátus előtt',
    'eltemessen egy ősi próféciát',
    'megtörje családja vérátkát',
    'átjusson az elbarikádozott peremvidéken',
    'megbosszulja elesett bajtársait',
    'megváltást nyerjen nemzetsége szemében',
    'megőrizze az otthon utolsó emlékét',
    'túlélje a holnapi virradatot',
    'leleplezze a tanács romlottságát',
    'megóvja maradék emberségét',
    'gyógyírt találjon a következő holdtöltéig',
    'új, szuverén birodalmat alapítson',
    'megtudja az igazságot a születéséről'
  ],

  wildcards: [
    { base: 'egy kóbor kutya, aki katasztrófális pénzügyi tanácsokat ad', acc: 'egy kóbor kutyát, aki katasztrófális pénzügyi tanácsokat ad', ins: 'egy kóbor kutyával, aki katasztrófális pénzügyi tanácsokat ad' },
    { base: 'a saját árnyéka, amely makacsul megtagadja mozdulatainak utánzását', acc: 'a saját árnyékát, amely makacsul megtagadja mozdulatainak utánzását', ins: 'a saját árnyékával, amely makacsul megtagadja mozdulatainak utánzását' },
    { base: 'egy érző lelkű szendvics, amit egy szent rítus során alkottak meg', acc: 'egy érző lelkű szendvicset, amit egy szent rítus során alkottak meg', ins: 'egy érző lelkű szendviccsel, amit egy szent rítus során alkottak meg' },
    { base: 'egy felhúzható mechanikus liba, amely Morse-kódban gágog', acc: 'egy felhúzható mechanikus libát, amely Morse-kódban gágog', ins: 'egy felhúzható mechanikus libával, amely Morse-kódban gágog' },
    { base: 'egy képzeletbeli barát, aki elkezdett valódi bűntetteket elkövetni', acc: 'egy képzeletbeli barátot, aki elkezdett valódi bűntetteket elkövetni', ins: 'egy képzeletbeli baráttal, aki elkezdett valódi bűntetteket elkövetni' },
    { base: 'egy vödörnyi világító nyálka, amely feltétlen tiszteletet követel', acc: 'egy vödörnyi világító nyálkát, amely feltétlen tiszteletet követel', ins: 'egy vödörnyi világító nyálkával, amely feltétlen tiszteletet követel' },
    { base: 'egy elátkozott tükör, amely kizárólag a legkínosabb emlékét hajlandó mutatni', acc: 'egy elátkozott tükröt, amely kizárólag a legkínosabb emlékét hajlandó mutatni', ins: 'egy elátkozott tükörrel, amely kizárólag a legkínosabb emlékét hajlandó mutatni' }
  ],

  names: [
    'Vance Valér', 'Holló Lilla', 'Kasszián Drágfy', 'Morrigan Szürke', 'Káldor Tövis',
    'Almássy Sára', 'Pintér Rózsa', 'Vass Elrik', 'Tövis Kelen', 'Keresztes Evander',
    'Sterbinszky Izolda', 'Garas Dárius', 'Dunn Orsolya', 'Várady Lukács', 'Holló Korvin',
    'Fagyos Mirella', 'Sólyom Gedeon', 'Kende Valér', 'Vécsey Nádja', 'Mérő Julián',
    'Hollósy Bram', 'Révay Tália', 'Farkas Fenris', 'Varjú Elvira', 'Láng Csedrik'
  ],

  traits: {
    positive: [
      'Együttérző', 'Éleseszű', 'Sztoikus', 'Alapos', 'Rugalmas',
      'Megvesztegethetetlen', 'Ékesszóló', 'Éber', 'Merész', 'Fegyelmezett',
      'Intuitív', 'Hűséges', 'Találékony', 'Diplomatikus', 'Türelmes',
      'Rettenthetetlen', 'Karisztikus', 'Megfigyelő', 'Könyörületes', 'Kitartó',
      'Alkalmazkodó', 'Pragmatikus', 'Áhítatos', 'Lovagias', 'Leleményes',
      'Állhatatos', 'Nagylelkű', 'Diszkrét', 'Oltalmazó', 'Szellemes',
      'Önzetlen', 'Tántoríthatatlan', 'Éleslátó', 'Becsületes', 'Bölcselkedő',
      'Bátor', 'Törekvő', 'Jövőbelátó', 'Társaságkedvelő', 'Töprengő'
    ],
    negative: [
      'Paranoid', 'Arogáns', 'Könyörtelen', 'Függő', 'Bosszúszomjas',
      'Cinikus', 'Hirtelenharagú', 'Titkolózó', 'Makacs', 'Érzéketlen',
      'Megszállott', 'Vakmerő', 'Gőgös', 'Rosszindulatú', 'Mohó',
      'Melankolikus', 'Áruló', 'Hiszékeny', 'Neurotikus', 'Nihilista',
      'Neheztelő', 'Képmutató', 'Fanatikus', 'Lobbanékony', 'Gyáva',
      'Csalárd', 'Irigy', 'Babonás', 'Hűvös', 'Morbid',
      'Szadista', 'Fatalista', 'Hedonista', 'Megaloman', 'Társfüggő',
      'Gonoszkodó', 'Dogmatikus', 'Nárcisztikus', 'Fásult', 'Birtokló'
    ]
  },

  roles: [
    { id: 'Protagonist', label: 'Főszereplő' },
    { id: 'Antagonist', label: 'Antagonista' },
    { id: 'Deuteragonist', label: 'Másodhegedűs' },
    { id: 'Supporting', label: 'Mellékszereplő' },
    { id: 'Mentor', label: 'Mentor / Útmutató' },
    { id: 'Wildcard', label: 'Kiszámíthatatlan / Zsivány' },
    { id: 'Rival', label: 'Rivális' },
    { id: 'Foil', label: 'Kontrasztfigura / Komikus ellenpont' },
    { id: 'Love Interest', label: 'Szerelmi szál' },
    { id: 'Reluctant Ally', label: 'Vonakodó szövetséges' }
  ]
}

export const CHARACTER_TEMPLATES = [
  'Egy {condition} {archetype}, akit {catalyst} kísért.',
  '{archetype:defCap}, aki {action} {determiner} {subject:acc}, hogy {stakes}.',
  'Egy idősödő {archetype}, aki {catalyst:acc} őrizget, miközben titokban {condition} állapotban gyötri a múltja.',
  'Egy cinikus {archetype}, aki miután rábukkant {catalyst:def} titkára, mindent kockára tesz, hogy {stakes}.',
  'Egy bujdosó {archetype}, aki megesküdött, hogy megvédi {catalyst:acc}, miközben a nyomában liheg {determiner} {subject}.',
  'Egy naiv {archetype}, akit {catalyst} kísér útján, miközben kíméletlenül üldözi {determiner} {subject}.',
  '{archetype:defCap}, aki {action} {catalyst:defAcc}, és most kénytelen kényes fegyverszünetet kötni: ellenfele {determiner} {subject}.',
  'Egy {condition} {archetype}, aki {catalyst:acc} kutatja egy kétségbeesett kísérletben, hogy {stakes}.',
  'Egy száműzött {archetype}, akinek egyetlen támasza {catalyst}, és készen áll szembenézni vele: {determiner} {subject}.',
  'A vidék legveszélyesebb harcosa, egy {condition} {archetype}, aki épp {catalyst:defAcc} keresi.',
  'Egy kegyvesztett {archetype}, aki véletlenül {action} {determiner} {subject:acc}.',
  'Egy {condition} {archetype}, aki {catalyst:acc} hordoz magával, beszorulva {determiner} {subject} és a lehetőség közé, hogy {stakes}.'
]

export const CHARACTER_WILDCARD_TEMPLATES = [
  'Egy {archetype}, akit menthetetlenül kísért {wildcard}.',
  '{archetype:defCap}, aki egy titkos küldetés kellős közepén kapcsolatba került vele: {wildcard}.',
  'Egy {condition} {archetype}, akinek a legnagyobb fegyvere nem más, mint {wildcard}.',
  'Egy {archetype}, aki szentül hiszi, hogy {determiner} {subject} a valóságban {wildcard}.'
]

export const LOCATION_DATA = {
  siteTypes: [
    { id: 'Citadel', label: 'Citadella', base: 'citadella', def: 'a citadella', defCap: 'A citadella' },
    { id: 'Wilderness', label: 'Vadon', base: 'vadon', def: 'a vadon', defCap: 'A vadon' },
    { id: 'Metropolis', label: 'Metropolisz', base: 'metropolisz', def: 'a metropolisz', defCap: 'A metropolisz' },
    { id: 'Outpost', label: 'Helyőrség', base: 'helyőrség', def: 'a helyőrség', defCap: 'A helyőrség' },
    { id: 'Ruins', label: 'Romváros', base: 'romváros', def: 'a romváros', defCap: 'A romváros' },
    { id: 'Sanctum', label: 'Szentély', base: 'szentély', def: 'a szentély', defCap: 'A szentély' },
    { id: 'Archipelago', label: 'Szigetvilág', base: 'szigetvilág', def: 'a szigetvilág', defCap: 'A szigetvilág' },
    { id: 'Under-City', label: 'Alsóváros', base: 'alsóváros', def: 'az alsóváros', defCap: 'Az alsóváros' },
    { id: 'Fortress', label: 'Erődítmény', base: 'erődítmény', def: 'az erődítmény', defCap: 'Az erődítmény' },
    { id: 'Abyss', label: 'Szakadék', base: 'szakadék', def: 'a szakadék', defCap: 'A szakadék' },
    { id: 'Megastructure', label: 'Megastruktúra', base: 'megastruktúra', def: 'a megastruktúra', defCap: 'A megastruktúra' },
    { id: 'Colony', label: 'Kolónia', base: 'kolónia', def: 'a kolónia', defCap: 'A kolónia' },
    { id: 'Orbital Station', label: 'Orbitális állomás', base: 'orbitális állomás', def: 'az orbitális állomás', defCap: 'Az orbitális állomás' },
    { id: 'Valley', label: 'Völgy', base: 'völgy', def: 'a völgy', defCap: 'A völgy' },
    { id: 'Necropolis', label: 'Nekropolisz', base: 'nekropolisz', def: 'a nekropolisz', defCap: 'A nekropolisz' }
  ],

  terrains: [
    'megkövesedett erdő',
    'obszidián szigetcsoport',
    'víz alatti kaldera',
    'neonfényes labirintus',
    'szélfútta puszta',
    'lebegő gombaerdő',
    'szmogba fulladt ipari medence',
    'zengő tükrök kanyonja',
    'töredezett sósíkság',
    'kráterek szabdalta bazaltfennsík',
    'föld alatti csatornahálózat',
    'elhagyatott orbitális roncsmező',
    'befagyott mocsárvidék',
    'csontporlepte sivatag',
    'kristályzátony',
    'napégette mészkőgerinc',
    'szunnyadó titánok völgye',
    'végtelen mangrovemocsár',
    'teraszos vasbánya',
    'ködbe burkolózó tőzegláp',
    'vulkanikus hasadékvölgy',
    'üreges hegy gyomra'
  ],

  relations: [
    'amely toronyként magasodik a következő fölé:',
    'amely veszedelmesen kapaszkodik a következő peremére:',
    'amely félig eltemetve nyugszik a következő alatt:',
    'amely közvetlenül a következő szikláiba vésődött:',
    'amely némán figyeli a következő csodát:',
    'amely lebegve függ a következő fölött:',
    'amely a következő csontvázának oltalmában rejtőzik:',
    'amely a következőhöz vezető szűk ösvényt őrzi:',
    'amely szinte megfullad a következő terhe alatt:',
    'amelyet kettéhasít egy monumentális képződmény:',
    'amelyet kolosszális láncok horgonyoznak ide:',
    'amely kígyóként tekeredik a következő köré:',
    'amely észrevétlenül rejtőzik a következő árnyékában:',
    'amely közvetlenül a következő szomszédságában terül el:'
  ],

  landmarks: [
    'az utolsó tiszta édesvizű forrás',
    'egy lezuhant dreadnought kolóniahajó',
    'egy soha el nem múló villámörvény',
    'egy elhagyatott óraműves katedrális',
    'egy feneketlen geodahasadék',
    'egy rég halott vastirannus trónja',
    'egy könnyező monolit kőtömb, amely fittyet hány a gravitációra',
    'egy növényzettel benőtt atmoszférikus felvonó',
    'egy higanykapukkal lezárt karanténzóna',
    'egy levéltán megkövesedett teteme',
    'egy megperzselt pergamentekercsekkel teli könyvtár',
    'egy navigációra használt, világító gombatorony',
    'alvó orbitális ágyúk ütege',
    'egy csillagász-király elfeledett sírkamrája',
    'egy kráter, ahol az idő visszafelé folyik',
    'egy forró szuroktenger fölött átívelő híd'
  ],

  atmospheres: [
    'ahol az eső réz- és hamuízű',
    'ahol áthatolhatatlan, vérvörös köd üli meg a tájat',
    'ahol örökös, sápadt alkony honol',
    'ahol a tükrök három másodperccel korábbi eseményeket tükröznek',
    'ahol megőrjítő, mély frekvenciájú zúgás vibrál a levegőben',
    'ahol ózon és szétmorzsolt kakukkfű halvány illata terjeng',
    'ahol napfogyatkozás idején az árnyékok elszakadnak a testektől',
    'ahol kizárólag foszforeszkáló zuzmók adnak fényt',
    'ahol hőszelek söpörnek végig, csontig marva a húst',
    'ahol az iránytűk tűi megállás nélkül pörögnek',
    'ahol éjfélkor kísérteties liturgikus énekek visszhangzanak',
    'ahol a nyílt lángok hideg kék fénnyel égnek',
    'ahol délben is dér borítja a földet',
    'ahol olyan súlyos csend feszül, hogy elered az ember orra vére'
  ],

  namePrefixes: [
    'Ó', 'Új', 'Felső', 'Alsó', 'Nagy', 'Kis', 'Észak', 'Dél',
    'Kelet', 'Nyugat', 'Sötét', 'Fehér', 'Vörös', 'Arany', 'Ezüst'
  ],

  nameRoots: [
    'Kő', 'Holló', 'Vas', 'Sas', 'Farkas', 'Hold', 'Nap', 'Csillag',
    'Köd', 'Árny', 'Tölgy', 'Bükk', 'Gyöngy', 'Sárkány', 'Tűz',
    'Jég', 'Vihar', 'Szél'
  ],

  nameSuffixes: [
    'vár', 'hegy', 'liget', 'part', 'orom', 'völgy', 'hát', 'mező',
    'fok', 'bánya', 'szirt', 'falu', 'halom', 'csúcs'
  ],

  scales: [
    { id: 'micro', label: 'Mikro (Kamra / Bunker)', desc: 'Zárt kamra, rejtett búvóhely vagy előretolt bázis fülkéje', word: 'apró léptékű' },
    { id: 'local', label: 'Helyi (Kerület / Tanya)', desc: 'Szomszédság, magányos település vagy apátság', word: 'helyi léptékű' },
    { id: 'regional', label: 'Regionális (Terület / Medence)', desc: 'Kiterjedt völgy, hegylánc vagy tartomány', word: 'regionális léptékű' },
    { id: 'macro', label: 'Kontinentális (Szuperrégió)', desc: 'Teljes földrajzi biom vagy kiterjedt birodalom', word: 'kontinentális méretű' },
    { id: 'global', label: 'Globális (Expanzió / Pálya)', desc: 'Bolygóméretű földrajz vagy orbitális megarendszer', word: 'bolygóméretű' }
  ],

  climates: [
    { id: 'glacial', label: 'Glaciális (-30°C)', badge: '❄️ Fagyos', word: 'sarkvidéki hidegű' },
    { id: 'frigid', label: 'Hideg (0°C)', badge: '🌨️ Dermesztő', word: 'dermesztő éghajlatú' },
    { id: 'temperate', label: 'Mérsékelt (20°C)', badge: '🍃 Mérsékelt', word: 'mérsékelt égövi' },
    { id: 'arid', label: 'Száraz / Perzselő (45°C)', badge: '☀️ Perzselő', word: 'perzselően száraz' },
    { id: 'infernal', label: 'Vulkanikus / Pokoli (80°C+)', badge: '🌋 Pokoli', word: 'vulkanikus hőségű' }
  ],

  populations: [
    { id: 'deserted', label: 'Elhagyatott (0)', badge: 'Szellemhely' },
    { id: 'outpost', label: 'Helyőrség (~50)', badge: 'Ritkás őrhely' },
    { id: 'settlement', label: 'Település (~500)', badge: 'Falucska' },
    { id: 'city', label: 'Város (~50 000)', badge: 'Virágzó város' },
    { id: 'metropolis', label: 'Metropolisz (1 000 000+)', badge: 'Megalopolisz' }
  ],

  sensoryTags: [
    'obszidián oszlopok', 'örökös köd', 'omladozó vízvezetékek', 'rúnákkal vésett monolitok',
    'üvöltő szakadék', 'elárasztott kripták', 'vasból vert bástyák'
  ]
}

export const SENSORY_APPEND = {
  first: '{^tag}.',
  more: '{prev} Feltűnő sajátosság: {~tag}.'
}

export const GENERIC_PATTERNS = {
  protag: 'egy {archetype}',
  protagConditioned: 'egy {condition} {archetype}',
  place: '{siteType:def}',
  placeName: '{siteType:defCap}'
}

export const STORY_IDEA_DATA = {
  genreFlavor: {
    fantasy: {
      adjectives: [
        'istenek kísértette',
        'varázslattal átszőtt',
        'mítoszokba font',
        'esküvel pecsételt',
        'parázsló fényű'
      ],
      settings: [
        'a kilenc vízbe fúlt udvar',
        'a suttogó tornyok királysága',
        'a mágusurak utolsó szabad enklávéja',
        'egy régi adósságokból és még ősibb istenekből összevarrt birodalom',
        'egy kihalt dinasztia parázsló trónja',
        'egy határvidék, ahol a térkép egyszerűen véget ér'
      ]
    },
    'sci-fi': {
      adjectives: [
        'csillagokba veszett',
        'szabályszegő',
        'orbitális léptékű',
        'összeomlás utáni',
        'jelekkel kísértett'
      ],
      settings: [
        'egy pusztuló orbitális gyűrű',
        'az utolsó külső kolónia',
        'egy alvó telepesekkel teli űrhajó',
        'a bérelt emlékek metropolisza',
        'a Jupiteren túli karanténzóna',
        'egy haldokló csillag körül keringő kutatóállomás'
      ]
    },
    thriller: {
      adjectives: [
        'végletekig feszült',
        'lassan égő',
        'árulásokkal teli',
        'határidő szorításában zajló',
        'árnyak által űzött'
      ],
      settings: [
        'a hatalom folyosói',
        'egy város, amely felfalja saját informátorait',
        'az átadás előtti utolsó tizenkét óra',
        'egy határváros tele bérszemekkel',
        'a hírszerzési háború titkos csatornái',
        'egy éjszaka, egy autó, egy aktatáska'
      ]
    },
    romance: {
      adjectives: [
        'lassan bontakozó',
        'új esélyt hozó',
        'balcsillagzatú',
        'fájdalmasan gyengéd',
        'kényelmetlen'
      ],
      settings: [
        'egy titkokkal teli tengerparti kisváros',
        'az utolsó könyvesbolt zárás előtt',
        'egy esküvő, amelyen egyikük sem akart ott lenni',
        'egy közös lakás, amit egyikük sem engedhet meg elhagyni',
        'egy hosszú, esőáztatta nyár',
        'egy hosszú műszak hajnali órái'
      ]
    },
    horror: {
      adjectives: [
        'vérfagyasztó',
        'rettegéssel teli',
        'suttogásokkal kísért',
        'könyörtelen',
        'hátborzongató'
      ],
      settings: [
        'egy falu, amely megfeledkezik a halottairól',
        'a ház a kohóút végén',
        'egy erdő, amely egyetlen istennek sem engedelmeskedik',
        'egy menedékház, amely egyetlen éjszaka alatt kiürült',
        'a kápolna alatti elárasztott kripták',
        'egy város, ahol a köd soha nem száll fel'
      ]
    },
    mystery: {
      adjectives: [
        'szövevényes',
        'nyomokkal teli',
        'csendben baljós',
        'döglött aktákba illő',
        'esőtől csillogó'
      ],
      settings: [
        'egy udvarház, amelyet a temetés óta lepecsételtek',
        'egy rendőrőrs, amely elássa a hibáit',
        'a lopás és a vallomás közötti tizenkét nap',
        'egy bentlakásos iskola egyetlen üres ággyal',
        'egy detektívügynökség három nappal a csőd előtt',
        'a városi archívum záróra után'
      ]
    },
    literary: {
      adjectives: [
        'csendes tónusú',
        'szívbemarkoló',
        'keserédes',
        'kérlelhetetlen',
        'fanyar'
      ],
      settings: [
        'három nemzedék egy fedél alatt',
        'egy gyárváros az utolsó műszak után',
        'a hosszú nyár, amikor minden megváltozott',
        'egy bevándorlónegyed, amely új nyelvet tanul',
        'egy házasság, amit az elmaradt nyugták mesélnek el',
        'a hónapok, miután a levelek elmaradtak'
      ]
    },
    custom: {
      adjectives: [
        'kategorizálhatatlan',
        'nyughatatlan',
        'lehetetlen',
        'különös',
        'formátlan'
      ],
      settings: [
        'egy műfajok közötti világ',
        'egy történet, amely nem hajlandó megülni',
        'a tér, ahol a feljegyzéseid véget érnek',
        'egy feltevés, amire nincs példa',
        'a térkép legszéle',
        'valahol, ahová a szabályok még nem értek el'
      ]
    }
  }
}

export const STORY_TEMPLATES = [
  'Egy {genreAdj} krónika: {protag} megtalálja {catalyst:defAcc}, és most kénytelen megkísérelni, hogy {stakes}.',
  'Olyan környezetben, mint {setting}, {protag} reménytelen helyzetbe kerül — és {catalyst} az egyetlen kiút.',
  '{protagCap} összefonódott {catalyst:def} sorsával; muszáj elérnie, hogy {stakes}, mielőtt {setting} világa végleg elnyeli.',
  'Amikor {catalyst} felbukkan — a helyszín: {setting} —, {protag} előtt egyetlen esély nyílik, hogy {stakes}.',
  'Egy {genreAdj} saga: {protag}, aki sarokba szorítva versenyt fut az idővel, hogy {stakes}.',
  '{^place} falai között {protag} felfedezi {catalyst:defAcc} — és ezt többé nem teheti semmissé.',
  '{placeName} rejtélyes kincset őriz: {catalyst:defAcc}. {protagCap} elszánta magát, hogy megszerzi, bármi áron.',
  'Miután birtokába került {catalyst}, {protag} mindent megtesz, hogy {stakes} — a háttérben pedig: {setting}.',
  'Egy {genreAdj} elbeszélés: {protag}, {catalyst}, és egy mindent eldöntő összecsapás, amelynek hátteréül {setting} szolgál.',
  '{protagCap} sorsát összefonta {catalyst}; a végső próbatétel színtere {setting}, ahol meg kell kísérelnie, hogy {stakes}.',
  '{^place} rejtekén {protag} kétségbeesetten próbálkozik: az egyetlen menekvés az, hogy {stakes}.',
  'Történet, amelynek középpontjában {protag}, {catalyst}, és egy {genreAdj} leszámolás áll, amelynek színtere {setting}.'
]

export const LOCATION_TEMPLATES = [
  'Egy {terrain}, {relation} {landmark}, {atmosphere}.',
  'Egy {scale} {siteType}, amely egy {terrain} belsejében épült ki, {relation} {landmark}.',
  'Egy veszedelmes, romos {siteType}, {relation} {landmark}, {atmosphere}.',
  'Egy elszigetelt {terrain}, {relation} {landmark}, {atmosphere}.',
  'Egykor szuverén dinasztia által uralt {climate} {terrain}, {relation} {landmark}.',
  'Egy erősen megerősített {siteType}, amely egy {terrain} fölé magasodik, {atmosphere}.',
  'Egy legendás {terrain}, {relation} {landmark}, amely a környéken úgy ismert, mint egy hely, {atmosphere}.',
  'Egy {scale} {terrain}, {relation} {landmark}.'
]
