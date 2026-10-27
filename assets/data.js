/* =====================================================================
   Fika med Maria — content data
   Edit text here and it updates everywhere. Prices/dates are placeholders
   ("Уточнюється") until Maria provides finals.
   ===================================================================== */
window.FMM = {

  /* ---------------- Seasonal decor ----------------
     Small corner accents on every page's hero, for mood only — never
     covers text, never sits under a button. To change the season, edit
     ONLY this one array (e.g. swap to ["❄️","⛄","🌟","🕯️"] for winter,
     ["🌸","🦋","☀️","🌷"] for spring) — every page updates automatically,
     nothing else needs touching. Leave the array empty ([]) to turn decor
     off entirely. */
  seasonDecor: ["🍂", "🎃", "🦇", "🕸️"],

  /* ---------------- Live lessons with Maria ("Курси з Марією") ----------------
     Fixed offerings — exactly these 4. Prices are in Swedish kronor (SEK). */
  liveLessons: [
    {
      id: "indyvidualni-zanyattya",
      icon: "🌱",
      title: "Індивідуальні заняття",
      badge: "Індивідуально",
      meta: "60 хвилин",
      price: "390 SEK / урок",
      packages: "Абонемент на 5, 10 або 20 занять · 20 занять — 7000 SEK",
      cta: "Записатися",
      href: "kontakty.html"
    },
    {
      id: "parni-zanyattya",
      icon: "🤝",
      title: "Парні заняття",
      badge: "Будь-який рівень",
      meta: "60 хвилин · у парі",
      price: "250 SEK / особа за урок",
      packages: "",
      cta: "Записатися",
      href: "kontakty.html"
    },
    {
      id: "sprakkafe",
      icon: "☕",
      title: "Språkkafe",
      badge: "Раз на тиждень",
      meta: "",
      price: "200 SEK / зустріч",
      packages: "Або абонемент на 5, 10 чи 20 зустрічей",
      cta: "Приєднатися",
      href: "kontakty.html"
    },
    {
      id: "knyzhkovyi-klub",
      icon: "📖",
      title: "Книжковий клуб шведською мовою",
      badge: "Раз на місяць",
      meta: "У невеликих групах · шведською",
      price: "300 SEK",
      priceNote: "Ціна ще попередня й може змінитися",
      packages: "",
      cta: "Записатися",
      href: "kontakty.html"
    }
  ],

  /* ---------------- Self-study courses ("Курси для самостійного опрацювання") ----------------
     Fixed set — exactly these 12, in this order. No prices yet (Maria will add
     them later). `level` and `status` are optional — leave both out ("") if
     Maria hasn't told us. status: "" | "growing" | "in-development". */
  selfStudyCourses: [
    {
      id: "shvedska-a1-a2",
      icon: "🌱",
      title: "Шведська A1–A2",
      level: "A1–A2",
      status: "",
      description: "Курс для початківців: самостійні уроки з відео та граматикою у своєму темпі."
    },
    {
      id: "shvedska-b1-b2",
      icon: "📈",
      title: "Шведська B1–B2",
      level: "B1–B2",
      status: "",
      description: "Самостійний курс для впевненого середнього рівня."
    },
    {
      id: "leksyka-c1",
      icon: "📘",
      title: "Лексика C1",
      level: "C1",
      status: "growing",
      description: "Курс ще не завершений, але вже можна почати — Марія додає нові уроки щодня."
    },
    {
      id: "103-diyeslova",
      icon: "🔤",
      title: "103 шведських дієслова",
      level: "",
      status: "",
      description: "Нова лексика з перекладом: як утворюються дієслова і як ними користуватися в мовленні. 103 — як швидка допомога для твоєї шведської."
    },
    {
      id: "103-prykmetnyky",
      icon: "🔤",
      title: "103 шведські прикметники",
      level: "",
      status: "",
      description: "Нова лексика з перекладом: як утворюються прикметники і як ними користуватися в мовленні. 103 — як швидка допомога для твоєї шведської."
    },
    {
      id: "103-imennyky",
      icon: "🔤",
      title: "103 шведські іменники",
      level: "",
      status: "",
      description: "Нова лексика з перекладом: як утворюються іменники і як ними користуватися в мовленні. 103 — як швидка допомога для твоєї шведської."
    },
    {
      id: "shvedska-hramatyka",
      icon: "🧩",
      title: "Шведська граматика",
      level: "",
      status: "",
      description: "Чисте повторення граматики з вправами для практики."
    },
    {
      id: "skarbnychka-sliv",
      icon: "💰",
      title: "Скарбничка шведських слів",
      level: "",
      status: "",
      description: "Обирай тему сам — і отримуєш короткий список слів із вправами для практики. Усього в скарбничці 2500 слів."
    },
    {
      id: "shpargalka-dlya-mam",
      icon: "🍼",
      title: "Шпаргалка для мам",
      level: "",
      status: "",
      description: "Фрази для реальних ситуацій: вагітність, пологи, садочок, школа, майданчик і лікарі — саме там, де вони знадобляться одразу."
    },
    {
      id: "prepositioner",
      icon: "🧭",
      title: "Prepositioner",
      level: "B1+",
      status: "in-development",
      description: "Прийменники: як вживати їх природно й без помилок."
    },
    {
      id: "partikelverb",
      icon: "🧩",
      title: "Partikelverb",
      level: "B1+",
      status: "in-development",
      description: "Дієслова з частками: конструкції, які шведи справді використовують у мовленні."
    },
    {
      id: "idiom-och-slang",
      icon: "💬",
      title: "Idiom och slang",
      level: "B1+",
      status: "in-development",
      description: "Ідіоми та сленг, щоб звучати природніше й розуміти живу шведську."
    }
  ],

  /* ---------------- Ready lessons ("Готові уроки") ----------------
     Maria's finished lessons, sold through Patreon. Topics and order follow her
     roadmap (gotovi-uroky-plan); numbers in the comments are her lesson numbers.
     Each lesson: `id` (= its folder name in gotovi-uroky/lessons), topic, level
     label ("A2–B1", en dash), title, `description` (the card), and for its own
     page urok.html: `about`, `grammar` (omit if the lesson has none) and
     `project`. Level filtering is derived from the label in main.js, so a range
     like "A2–B1" matches both A2 and B1.
     Images, lesson plan and key expressions come from assets/lesson-details.js,
     GENERATED by gotovi-uroky/tools/site_export.py — so to add lessons: add an
     entry here (and a topic to resourceTopics if new), then run that script.
     The catalogue, its "Тема" filter and the lesson's page pick them up on their own. */
  /* TODO: Patreon link for the lessons — Maria will send it. One shared link;
     give a lesson its own `href` if she wants per-lesson links. While it is "#"
     every "Купити" button stays inert. */
  patreonUrl: "#",

  resourceTopics: [
    { id: "sverige", title: "Sverige på riktigt", subtitle: "Швеція без підручника" },
    { id: "talar", title: "Svenska som svenskar faktiskt talar", subtitle: "Жива розмовна шведська" },
    { id: "psykologi", title: "Psykologi & människan", subtitle: "Психологія й людина" }
  ],

  /* Descriptions are built from the lessons' real content (task titles,
     grammar point, final project) — nothing invented. #4 is the shorter pilot
     lesson, and it carries its real title, "Fika – mer än bara kaffe". */
  resources: [
    /* ---- Sverige på riktigt ---- */
    { id: "b1b2-lagom", topic: "sverige", level: "B1–B2", title: "Vad är egentligen lagom?",
      description: "Що насправді означає lagom — слово, яке пояснює багато в шведському характері. Читаєш його історію, розбираєш, де «в міру» доречне, і разом складаєш поради новачкові: як бути lagom на роботі, у сусідстві чи на святі.",
      about: "Урок будується навколо одного слова: розминка «Är du lagom?», історія слова lagom, сортування ситуацій, рангування сфер життя, де «в міру» важить найбільше, і груповий проєкт. Вдома пишеш текст «Hur lagom är du?».",
      project: "Разом складаєте п’ять порад новачкові: як бути lagom на роботі, у сусідстві чи на шведській вечірці." },
    { id: "a2b1-framlingar", topic: "sverige", level: "A2–B1", title: "Får man prata med främlingar på bussen?",
      description: "Чи прийнято розмовляти з незнайомцями в автобусі — і які неписані правила діють у шведському публічному просторі. Вчиш говорити про правила з får, måste, behöver inte й brukar та пишеш коротку сценку про невелике непорозуміння.",
      about: "Спершу вгадуєш неписані правила, потім читаєш текст «Tyst på bussen?» і розставляєш правила від найважчого до найлегшого для себе. Наприкінці обговорюєте правила у твоїй країні, а вдома пишеш листа другові, який збирається переїхати до Швеції.",
      grammar: "Модальні дієслова får, måste, behöver inte і brukar — щоб говорити про правила й звички.",
      project: "У групі пишете коротку сцену на шість реплік: у автобусі, на роботі чи в гостях хтось ненавмисно порушує правило." },
    { id: "a2b1-fredagsmys", topic: "sverige", level: "A2–B1", title: "Fredagsmys – Sveriges heligaste kväll?",
      description: "Fredagsmys — затишний п’ятничний вечір, який у Швеції сприймають майже як ритуал. Читаєш про цю традицію, вчиш прислівники частоти (alltid, ofta, ibland, sällan, aldrig) і разом плануєш ідеальну п’ятницю.",
      about: "Починаєш із власного п’ятничного вечора, сортуєш речі на «mysigt» і «не дуже», читаєш текст «Dags för fredagsmys» і порівнюєш шведські традиції зі своїми. Вдома пишеш текст «Min perfekta fredag».",
      grammar: "Прислівники частоти alltid, ofta, ibland, sällan, aldrig — щоб розповідати, як часто ти щось робиш.",
      project: "У групі плануєте ідеальне fredagsmys: їжу, місце, заняття — і як часто ви це робили б." },
    { id: "b1-fika", topic: "sverige", level: "B1", title: "Fika – mer än bara kaffe",
      description: "Fika — це не просто кава з булочкою, а шведська пауза для розмови й спільноти. Коротший за інші урок: текст про fika, вправи на розуміння, нові слова й завдання, де треба розставити п’ять пов’язаних із fika речей за важливістю та порівняти з партнером.",
      about: "Короткий урок-знайомство з fika: розминка «Känner du igen dig?», текст «Dags för fika», вправа «правда чи ні», нові вирази та рангування п’яти речей, пов’язаних із fika.",
      project: "Розставляєш п’ять речей, пов’язаних із fika, за важливістю, а потім порівнюєш свій рейтинг із партнером і пояснюєш відмінності." },
    { id: "a2-skor", topic: "sverige", level: "A2", title: "Varför tar svenskar av sig skorna?",
      description: "Чому шведи знімають взуття, коли заходять у гості, — і як чемно про це нагадати. Практикуєш зворотні займенники (ta av sig skorna) і в групі проєктуєш ідеальний передпокій шведського дому з табличкою «Ta av er skorna!».",
      about: "Починаєш із питання про власне взуття, вгадуєш звички, читаєш текст «Skor av, tack!» і розповідаєш, як заведено в тебе вдома. Вдома пишеш текст «Min entré» — про взуття в тебе вдома.",
      grammar: "Зворотні займенники (mig, dig, sig, oss) у виразі ta av sig skorna — хто саме знімає взуття.",
      project: "У групі проєктуєте ідеальний передпокій шведського дому й пишете табличку «Ta av er skorna!» для гостей." },
    { id: "b1b2-samborelationer", topic: "sverige", level: "B1–B2", title: "Sambo, särbo eller gift?",
      description: "Sambo, särbo чи gift — три способи жити разом у Швеції. Читаєш про кожен із них, вчиш порівнювати (vanligare, vanligast, bättre, bäst) і обираєш, який варіант найкраще пасує вигаданій парі.",
      about: "Розминка «Hur vill du bo?», гра «Gissa normen!» про те, що у Швеції вважають звичним, текст «Tre sätt att leva ihop» і розмова про те, як живуть пари у твоїй країні.",
      grammar: "Ступені порівняння прикметників: vanligare, vanligast, bättre, bäst — разом із неправильними.",
      project: "У групі обираєте вигадану пару й вирішуєте, що їй найкраще підходить: sambo, gift чи särbo." },
    { id: "a2b1-ko", topic: "sverige", level: "A2–B1", title: "Varför står svenskar i kö så snällt?",
      description: "Чому шведи так терпляче стоять у черзі — і як описати, хто де стоїть. Вчиш прийменники місця (framför, bakom, bredvid, mellan) і пишеш коротку сценку, у якій хтось пролазить без черги.",
      about: "Відповідаєш, як ти чекаєш у черзі, вирішуєш, що в черзі «ввічливо», а що ні, і читаєш текст «Så väntar svenskar». Вдома пишеш про чергу, яку пам’ятаєш.",
      grammar: "Прийменники місця framför, bakom, bredvid, mellan — щоб описати, хто де стоїть.",
      project: "Вигадуєте чотирьох-п’ятьох людей у черзі, описуєте, хто де стоїть, і пишете коротку сцену, у якій хтось лізе без черги." },
    { id: "b2c1-jantelagen", topic: "sverige", level: "B2–C1", title: "Jantelagen – finns den fortfarande?",
      description: "Jantelagen — неписані правила скромності, відомі з роману Сандемусе. Чи діють вони в сучасній Швеції? Читаєш, вчиш абстрактні іменники на -het (jämlikhet, blygsamhet, trygghet) і в групах ведеш дебати «за» і «проти».",
      about: "Розминка «Skryt eller blygsamhet?», перевірка себе на «правила Янте», текст «Du ska inte tro…» і дебати про те, чи ці правила ще діють. Вдома пишеш власну думку в тексті «Min syn på jantelagen».",
      grammar: "Абстрактні іменники на -het: jämlikhet, blygsamhet, frihet, trygghet — і як вони утворюються від прикметників.",
      project: "У групах по четверо ділитеся на дві сторони: одні доводять, що jantelagen ще існує, інші — що вона зникає." },
    { id: "b1b2-systembolaget", topic: "sverige", level: "B1–B2", title: "Systembolaget – varför kan man inte köpa vin i mataffären?",
      description: "Чому у Швеції не можна купити вино в супермаркеті — і навіщо існує державна алкогольна крамниця. Вчиш говорити про вік (fylla 20 år, vara över 18) і робиш афішу чи буклет про шведські правила щодо алкоголю для друга, який щойно переїхав.",
      about: "Урок про те, як у Швеції влаштований продаж алкоголю: розминка, текст «En butik med ensamrätt», вправи на розуміння та порівняння зі звичками у твоїй країні в тексті «Alkohol här och där».",
      grammar: "Вік і межі: fylla X år, vara X år gammal, under / över X år.",
      project: "Робите афішу або буклет про шведські правила щодо алкоголю для друга, який щойно переїхав: вікові межі, де що можна купити і чому існує така система." },
    { id: "b1b2-allemansratten", topic: "sverige", level: "B1–B2", title: "Allemansrätten – får man verkligen gå nästan överallt?",
      description: "Allemansrätten — право гуляти, збирати ягоди й ночувати в наметі майже де завгодно в природі, але за певними правилами. Вчиш прийменники руху (genom, längs, in i, över, förbi) і малюєш карту прогулянки з поясненням, що дозволено на кожній зупинці.",
      about: "Сортуєш, що в природі дозволено, а що ні, читаєш текст «Inte störa, inte förstöra» і порівнюєш шведські правила прогулянок із тим, як це у твоїй країні.",
      grammar: "Прийменники руху й напрямку: genom, längs, in i, över, förbi.",
      project: "Малюєте в групі просту карту прогулянки з чотирма-п’ятьма зупинками й розповідаєте, що дозволено на кожній згідно з allemansrätten." },

    /* ---- Svenska som svenskar faktiskt talar ---- */
    { id: "b1b2-juvalnog", topic: "talar", level: "B1–B2", title: "Ju, väl, nog och egentligen – små ord, stor skillnad",
      description: "Чотири маленькі слова, які змінюють тон усього речення. З’ясовуєш, що означають ju, väl, nog і egentligen, і вчишся пом’якшувати прямі фрази так, щоб звучати по-шведськи природно, — у вправі «до і після».",
      about: "Розбираєш, чим розмовна мова відрізняється від письмової, читаєш текст «Fyra ord, en hel ton» і вчишся відчувати, як одне маленьке слово змінює тон фрази. Вдома пом’якшуєш власні речення.",
      grammar: "Модальні частки ju, väl, nog, egentligen: що вони означають і де стоять у реченні.",
      project: "У парі переписуєте прямі речення з картки, додаючи ju, väl, nog чи egentligen, і порівнюєте, як змінився тон." },
    { id: "b1b2-vifarse", topic: "talar", level: "B1–B2", title: "”Vi får se” betyder kanske nej",
      description: "Чому шведське «Vi får se» часто означає «скоріше ні» — і як не помилитися, розшифровуючи ухильні відповіді. Вчиш конструкцію det beror på + vad / om / hur / vem і розкриваєш, що люди насправді мають на увазі.",
      about: "Сортуєш відповіді на прямі й ухильні, читаєш текст «Nej utan att säga nej» і порівнюєш, як відмовляють у Швеції та у твоїй країні.",
      grammar: "Конструкція det beror på + vad / om / hur / vem — щоб відповідати на питання залежно від обставин.",
      project: "У парі розшифровуєте ухильні відповіді на кшталт «vi får se» чи «det beror på»: що людина мала на увазі насправді." },
    { id: "a2b1-detblirbra", topic: "talar", level: "A2–B1", title: "”Det blir bra” – svenskarnas universalsvar",
      description: "«Det blir bra» — улюблена шведська заспокійлива фраза. Вчиш різницю між bli та vara (blir bra, blir kallt, blir svårt) і пишеш теплу записку другові, який хвилюється.",
      about: "Розминка «Vad tänker du?», гра «Orolig eller lugn?», текст «Ett svar man hör ofta» про те, чому шведи так часто кажуть «det blir bra», і розмова про те, як заспокоюють у тебе вдома. Вдома пишеш, що кажуть, щоб втішити людину, у твоїй країні, і порівнюєш це з «det blir bra».",
      grammar: "bli чи vara: blir bra, blir kallt, blir svårt — зміна стану проти стану, який уже є.",
      project: "Пишеш (сам або в парі) теплу записку другові, який хвилюється перед іспитом, переїздом чи співбесідою." },
    { id: "b1b2-assatyp", topic: "talar", level: "B1–B2", title: "Asså, typ, liksom…",
      description: "Asså, typ, liksom — слова-паразити, без яких не обходиться жива шведська розмова. З’ясовуєш, коли вони звучать природно, співвідносиш їх із формальними відповідниками й пишеш діалог, який звучить по-справжньому.",
      about: "Дізнаєшся, коли asså, typ і liksom звучать невпевнено, а коли просто природно, читаєш текст «Ord som fyller tystnaden» і порівнюєш слова-паразити в шведській та у твоїй мові.",
      grammar: "Розмовні слова та їхні формальні відповідники: asså / alltså ↔ så, typ ↔ ungefär, liksom ↔ på sätt och vis.",
      project: "У парі пишете коротку природну розмову на шість-вісім реплік, у якій щонайменше чотири слова-паразити звучать доречно." },
    { id: "b1b2-orkapalla", topic: "talar", level: "B1–B2", title: "Orka! Palla! Lägg av!",
      description: "Orka! Palla! Lägg av! — вигуки й слова, які шведи вживають щодня, а підручники пропускають. Вчиш наказовий спосіб (Lägg av! Sluta! Kom igen!) і складаєш швидкий довідник реакцій для нового учня.",
      about: "Сортуєш реакції на позитивні й негативні, читаєш текст «Ord man faktiskt hör» і вчишся розуміти слова, які чуєш у розмові, але рідко бачиш у підручнику. Вдома розповідаєш про сленг у своїй мові.",
      grammar: "Наказовий спосіб: Lägg av! Sluta! Kom igen! Skärp dig! — і як він утворюється від інфінітива.",
      project: "У парі складаєте короткий довідник реакцій для нового учня: чотири-п’ять повсякденних ситуацій (втома, здивування, радість) і найприроднішу реакцію для кожної." },
    { id: "b2-intressant", topic: "talar", level: "B2", title: "Vad menar svenskar när de säger ”intressant”?",
      description: "Що насправді мають на увазі шведи, коли кажуть «intressant» чи «inte dåligt». Вчиш літоту — стриманий вираз, який означає більше, ніж звучить, і пишеш ввічливий, але чесний відгук про посередній фільм чи ресторан.",
      about: "Розрізняєш буквальний та іронічний зміст, читаєш текст «Mer än orden säger» про стриману шведську манеру висловлюватися і порівнюєш, як іронію сприймають у твоїй мові.",
      grammar: "Літота: inte + прикметник як стримане твердження (inte dåligt, inte direkt billigt).",
      project: "Пишеш (сам або в парі) ввічливий, але чесний відгук про посередній фільм чи ресторан — без прямої критики, лише з літотою й недомовками." },
    { id: "b1b2-nejformler", topic: "talar", level: "B1–B2", title: "Hur säger man nej utan att säga nej?",
      description: "Як чемно відмовити так, щоб тебе зрозуміли. Вчиш ввічливі формули відмови (tyvärr, jag skulle gärna men…), конструкцію hellre … än і пишеш коротке тактовне повідомлення — відмову на запрошення чи прохання про допомогу.",
      about: "Відрізняєш чітку відмову від нечіткої, читаєш текст «Ett tydligt nej, fast mjukt» і вчишся казати «ні» м’яко, але зрозуміло. Вдома пишеш про те, як відмовляють у тебе вдома.",
      grammar: "Конструкція hellre … än («радше … ніж …») і форми vill / skulle / ville — щоб відмовляти й пропонувати альтернативу.",
      project: "Пишеш коротке, чітке, але ввічливе повідомлення з відмовою: на запрошення, на прохання допомогти з переїздом або на друге побачення." },
    { id: "a2b1-tacktack", topic: "talar", level: "A2–B1", title: "Tack tack, hej hej, ja ja – varför säger svenskar allt två gånger?",
      description: "Чому шведи кажуть tack tack, hej hej, ja ja — і що кожне з цих подвоєнь означає. Розбираєш подвоєні слова, вчишся відчувати, коли вони доречні, й складаєш міні-словничок із прикладами.",
      about: "Вгадуєш, де шведи повторюють слово двічі, читаєш текст «Två gånger är mer» і дізнаєшся, що додає подвоєння. Вдома шукаєш подвоєні слова у своїй мові.",
      grammar: "Подвоєння слів: tack tack (більше вдячності), hej hej (невимушене «па-па»), ja ja (стримана згода), nej nej (заспокоєння).",
      project: "У парі складаєте міні-словничок подвоєних слів із прикладом до кожного й презентуєте його класові." },
    { id: "b1-ordnarsig", topic: "talar", level: "B1", title: "Det ordnar sig! – 15 vardagsfraser",
      description: "П’ятнадцять буденних фраз, якими шведи підбадьорюють і заспокоюють, — від «det ordnar sig» до «ta det piano». Вчиш зворотні дієслова самостійного розв’язання (ordna sig, klara sig, reda sig, lösa sig) і створюєш гру на підбір фрази до ситуації.",
      about: "Підбираєш фрази до ситуацій, де вони доречні, читаєш текст «Många sätt att säga samma sak» і збираєш п’ятнадцять буденних фраз-підбадьорень. Вдома пишеш, як підбадьорюють у твоїй мові.",
      grammar: "Зворотні дієслова самостійного розв’язання: ordna sig, klara sig, reda sig, lösa sig.",
      project: "У парі робите гру: п’ять карток із фразами («det ordnar sig», «ta det piano») і п’ять карток із ситуаціями, а інша пара добирає відповідності." },
    { id: "b2c1-slanguage", topic: "talar", level: "B2–C1", title: "Svenska som aldrig står i läroboken",
      description: "Шведська, якої немає в підручниках: скорочення, реакції й розмовні слова на кшталт oxå, iaf, najs. Вчиш, як утворюються такі скорочення, і складаєш «закодоване» SMS, яке інша пара має розшифрувати.",
      about: "Вгадуєш значення скорочень і реакцій, читаєш текст «Det läroboken missar» про шведську, якої немає в підручниках, і порівнюєш із тим, як скорочують слова у твоїй мові.",
      grammar: "Як утворюються скорочення: oxå, iaf, mkt, nml — і розмовні реакції на кшталт najs, lugnt, skönt.",
      project: "У парі пишете SMS другові на три-чотири речення зі скороченнями й реакціями, а інша пара розшифровує його повними реченнями." },

    /* ---- Psykologi & människan ---- */
    { id: "b1b2-prokrastinering", topic: "psykologi", level: "B1–B2", title: "Varför skjuter vi upp saker?",
      description: "Чому ми відкладаємо справи, навіть коли знаємо, що буде гірше. Читаєш, що про це думають дослідники, вчиш майбутній час (ska, tänker, kommer att) і разом розбиваєш «страшне» завдання на п’ять маленьких кроків.",
      about: "Починаєш із впізнавання себе в ситуаціях відкладання, сортуєш звички на ті, що допомагають почати, і ті, що змушують чекати, і читаєш текст «Plötsligt tvättar du». Вдома пишеш текст «Dags att börja».",
      grammar: "Майбутнє: ska та tänker (план) проти kommer att (прогноз).",
      project: "У групі беретеся за справу, яку часто відкладають (лист, прибирання, дзвінок лікарю), розбиваєте її на п’ять маленьких кроків і призначаєте час для кожного." },
    { id: "a2b1-introvert", topic: "psykologi", level: "A2–B1", title: "Är du introvert eller extrovert?",
      description: "Інтроверт чи екстраверт — а може, трохи і те, і те? Вчиш конструкції både … och, antingen … eller і varken … eller, робиш невелике опитування в класі й розповідаєш про його результати.",
      about: "Сортуєш ситуації за тим, що дає енергію, читаєш текст «Lite av båda» про те, що більшість людей — трохи інтроверти й трохи екстраверти. Вдома описуєш, як відновлюєш сили, у тексті «Så laddar jag batterierna».",
      grammar: "Парні сполучники både … och, antingen … eller, varken … eller.",
      project: "У групі пишете п’ять запитань («Fest eller soffa?»), опитуєте іншу групу, рахуєте відповіді й розповідаєте результат класові." },
    { id: "b1b2-jamforelser", topic: "psykologi", level: "B1–B2", title: "Varför jämför vi oss med andra?",
      description: "Чому ми порівнюємо себе з іншими — особливо в соцмережах. Вчиш прикметники й дієслова з постійними прийменниками (stolt över, nöjd med, avundsjuk på) і розбираєш, що лишається «за кадром» ідеального допису.",
      about: "Сортуєш порівняння на «вгору» й «вниз», читаєш текст «Den perfekta semesterbilden» і задумуєшся, що не потрапляє в кадр. Вдома пишеш текст «När jag jämförde mig» — про власний досвід порівнянь.",
      grammar: "Прикметники з постійними прийменниками: stolt över, nöjd med, avundsjuk på, besviken på, jämföra sig med.",
      project: "У групі вигадуєте чотири дописи в соцмережах (відпустка, селфі із залу, сімейна вечеря, повідомлення про роботу) і пишете, що на них видно, а чого не видно." },
    { id: "b2c1-impostor", topic: "psykologi", level: "B2–C1", title: "Impostor syndrome – varför känner vi oss som bluffar?",
      description: "Синдром самозванця: чому деякі люди почуваються ошуканцями, навіть коли досягли успіху. Вчиш говорити про відчуття й враження (känna sig, kännas, verka, se ut) і пишеш сценарій хвилинного епізоду подкасту на цю тему.",
      about: "Розрізняєш, що людина відчуває всередині й що видно зовні, читаєш текст «Framgång eller bara tur?» про відчуття, що ти не на своєму місці. Вдома пишеш пораду другові у тексті «Ett råd till en vän».",
      grammar: "känna sig, kännas, verka, se ut + прикметник — щоб говорити про відчуття й враження.",
      project: "У парі чи трійкою пишете сценарій хвилинного епізоду подкасту про почуття самозванця: привітання, приклад, практична порада й завершення." },
    { id: "b1b2-lyckligare", topic: "psykologi", level: "B1–B2", title: "Kan man lära sig att bli lyckligare?",
      description: "Чи можна навчитися бути щасливішим? Читаєш, що про це кажуть дослідження, вчиш різницю між perfekt і preteritum, коли розповідаєш про наукові результати, і пишеш «новину» про вигадане дослідження — суто для практики.",
      about: "Сортуєш радощі на швидкі й тривалі, читаєш текст «Kan lycka tränas?» про те, що кажуть дослідження щастя. Вдома обираєш щось нове, що спробуєш, у тексті «Något nytt att prova».",
      grammar: "perfekt чи preteritum: har visat проти deltog — як розповідати про результати досліджень.",
      project: "У групі вигадуєте невелике дослідження про радість — суто для вправи — і пишете коротку новину: заголовок, учасники, що зробили дослідники, результати та порада експерта." },
    { id: "b1b2-vanor", topic: "psykologi", level: "B1–B2", title: "Varför är det så svårt att ändra en vana?",
      description: "Чому так важко змінити звичку — і що про це справді відомо. Вчиш конструкцію det är svårt / lätt / viktigt att … і в групі граєш у «міф чи факт» про звички.",
      about: "Відрізняєш звичку від свідомого вибору, читаєш текст «Mobilen bredvid kaffekoppen» і дізнаєшся, що про формування звичок кажуть дослідження. Вдома описуєш нову звичку, яку хочеш виробити, у тексті «Min nya vana».",
      grammar: "Конструкція det är + прикметник + att + інфінітив: det är svårt / lätt / viktigt att …",
      project: "У групі пишете п’ять тверджень про звички — частина правдивих, частина міфів — і обмінюєтеся ними з іншою групою, яка визначає «міф чи факт» і виправляє міфи." },
    { id: "b2-overtankande", topic: "psykologi", level: "B2", title: "Övertänkande – när hjärnan aldrig stänger av",
      description: "Коли голова не вимикається: різниця між «fundera» і «älta». Вчиш конструкцію sitta / ligga / stå / gå + och + дієслово (sitta och älta) і малюєш «дерево рішень» для думки, що крутиться по колу.",
      about: "Сортуєш роздуми на «fundera» й «älta», читаєш текст «Mitt i natten» про думки, що не дають заснути. Вдома пишеш про думку, яка в тебе крутиться по колу. Наприкінці урок м’яко нагадує звернутися до лікаря чи психолога, якщо це заважає жити.",
      grammar: "Псевдокоординація sitta / ligga / stå / gå + och + дієслово: sitta och älta, ligga och tänka.",
      project: "У групі малюєте «дерево рішень» для думки, що крутиться в голові, починаючи з питання «Kan jag göra något åt det?»." },
    { id: "b1b2-motivation", topic: "psykologi", level: "B1–B2", title: "Vad gör oss motiverade?",
      description: "Що нас мотивує: внутрішнє чи зовнішнє, «lust eller lön». Вчиш конструкції göra + прикметник і få någon att + інфінітив, а потім презентуєш власну ідею, що допомагає не втрачати мотивацію, — додаток, гурток чи челендж.",
      about: "Сортуєш, що мотивує зсередини («lust»), а що ззовні («lön»), читаєш текст «Steg för steg» про те, як маленькі кроки підтримують мотивацію. Вдома формулюєш власну ціль у тексті «Mitt mål».",
      grammar: "Конструкції göra + прикметник та få någon att + інфінітив — щоб розповідати, що на що впливає.",
      project: "У групі вигадуєте ідею, яка допомагає людям не втрачати мотивацію (додаток, гурток чи челендж): назва, три функції, слоган — і презентуєте її класові." },
    { id: "b2c1-personlighet", topic: "psykologi", level: "B2–C1", title: "Kan man verkligen förändra sin personlighet?",
      description: "Чи можна змінити свою особистість — і наскільки? Вчиш правильно вживати sin / sitt / sina та hans / hennes / deras (в українській тут допомагає «свій») і створюєш часову лінію життя вигаданої людини, що змінювала поведінку.",
      about: "Розрізняєш, що в людині риса характеру, а що поведінка, читаєш текст «Från larv till fjäril?» про те, наскільки людина може змінитися, і формулюєш власну позицію в тексті «Min syn på förändring».",
      grammar: "Зворотний присвійний sin / sitt / sina проти hans / hennes / deras — тут допомагає українське «свій».",
      project: "У групі вигадуєте людину й малюєте часову лінію її життя з чотирма-п’ятьма моментами, коли вона змінила поведінку чи характер." },
    { id: "b2-bryr-oss", topic: "psykologi", level: "B2", title: "Varför bryr vi oss så mycket om vad andra tycker?",
      description: "Чому нас так турбує, що думають інші, — і чи помічають вони нас так, як нам здається (spotlighteffekten). Вчиш причинні сполучники (eftersom, därför att, på grund av, tack vare) і плануєш невеликий безпечний експеримент.",
      about: "Сортуєш, чому ти щось робиш: для себе чи для інших, читаєш текст «Alla ögon på mig?» про ефект прожектора — відчуття, що всі дивляться на тебе. Вдома розмірковуєш у тексті «Bry dig – eller inte?».",
      grammar: "Причинні сполучники й прийменники: eftersom, därför att, därför, på grund av, tack vare.",
      project: "У групі плануєте невеликий безпечний експеримент, що перевіряє ефект прожектора (наприклад, незвичайний капелюх): гіпотеза, метод і прогноз." }
  ],

  /* ---------------- Blog posts ---------------- */
  /* 12 real articles, replacing the earlier placeholder set. `time` is an
     editorial estimate (not given by Maria) based on each article's length —
     she should adjust any that feel off. `category` is likewise our own
     best-fit assignment onto the existing filter labels above the grid. */
  posts: [
    {
      title: "Чи можна звучати по-шведськи, не позбуваючись свого акценту",
      category: "Як вчити шведську",
      time: "6 хв",
      excerpt: "Чи потрібно позбуватися акценту, щоб добре говорити шведською? Розбираємо вимову, ритм, зрозумілість і реалістичні цілі.",
      icon: "🗣️",
      href: "blog/shvedska-vymova-i-aktsent.html",
      image: "assets/blog/shvedska-vymova-i-aktsent.webp"
    },
    {
      title: "У Швеції немає однієї шведської: хто вирішив, яка вимова правильна",
      category: "Культура Швеції",
      time: "6 хв",
      excerpt: "Чому шведська звучить по-різному в різних регіонах, що вважати стандартом і до якої вимови готуватися студенту.",
      icon: "🗺️",
      href: "blog/dialekty-shvedskoi-movy.html",
      image: "assets/blog/dialekty-shvedskoi-movy.webp"
    },
    {
      title: "Prestigelös, förankra, avstämning: словник, без якого не зрозуміти шведську роботу",
      category: "Життя у Швеції",
      time: "7 хв",
      excerpt: "Що означають prestigelös, förankra, avstämning, återkoppling та högt i tak — і як ці слова розкривають роботу у Швеції.",
      icon: "💼",
      href: "blog/shvedska-dlia-roboty-kliuchovi-slova.html",
      image: "assets/blog/shvedska-dlia-roboty-kliuchovi-slova.webp"
    },
    {
      title: "Шведська свобода має інструкцію: чому країна індивідуалістів так любить правила",
      category: "Культура Швеції",
      time: "6 хв",
      excerpt: "Чому особиста свобода у Швеції поєднується з чергами, домовленостями та правилами — через мову й повсякденні ситуації.",
      icon: "⚖️",
      href: "blog/shvedska-svoboda-i-pravyla.html",
      image: "assets/blog/shvedska-svoboda-i-pravyla.webp"
    },
    {
      title: "Шведська, якої не існує: чому підручники вчать говорити не так, як говорять шведи",
      category: "Слова та вирази",
      time: "7 хв",
      excerpt: "Чому розмовна шведська так відрізняється від навчальних діалогів? Розбираємо скорочення, частки та реальні фрази шведів.",
      icon: "💬",
      href: "blog/zhyva-shvedska-ne-yak-u-pidruchnyku.html",
      image: "assets/blog/zhyva-shvedska-ne-yak-u-pidruchnyku.webp"
    },
    {
      title: "Ви навіть не помітили, що швед на вас розсердився",
      category: "Культура Швеції",
      time: "6 хв",
      excerpt: "Як розпізнати критику, відмову й роздратування у шведській мові, навіть якщо співрозмовник говорить спокійно та ввічливо.",
      icon: "🤐",
      href: "blog/yak-shvedy-vyslovliuiut-nevdovolennia.html",
      image: "assets/blog/yak-shvedy-vyslovliuiut-nevdovolennia.webp"
    },
    {
      title: "Маленькі слова, велика влада: ju, väl, nog, typ і liksom",
      category: "Слова та вирази",
      time: "6 хв",
      excerpt: "Просте пояснення п'яти шведських слів, які змінюють тон речення: ju, väl, nog, typ і liksom — з живими прикладами.",
      icon: "🧩",
      href: "blog/ju-val-nog-typ-liksom.html",
      image: "assets/blog/ju-val-nog-typ-liksom.webp"
    },
    {
      title: "Шведська ввічливість може звучати як байдужість — а українська щирість як тиск",
      category: "Культура Швеції",
      time: "6 хв",
      excerpt: "Чому українці та шведи по-різному показують турботу, відмовляють і ставлять особисті запитання — з прикладами шведських фраз.",
      icon: "🌍",
      href: "blog/shvedska-vvichlyvist-i-ukrainska-shchyrist.html",
      image: "assets/blog/shvedska-vvichlyvist-i-ukrainska-shchyrist.webp"
    },
    {
      title: "Чому шведські діти розмовляють із дорослими як із рівними",
      category: "Життя у Швеції",
      time: "6 хв",
      excerpt: "Чому шведські діти звертаються до дорослих на du, висловлюють незгоду й беруть участь у рішеннях — із корисними фразами для батьків.",
      icon: "🧒",
      href: "blog/yak-hovoriat-iz-ditmy-u-shvetsii.html",
      image: "assets/blog/yak-hovoriat-iz-ditmy-u-shvetsii.webp"
    },
    {
      title: "Fika — не перерва на каву: як один ритуал пояснює шведські стосунки",
      category: "Культура Швеції",
      time: "5 хв",
      excerpt: "Fika — це більше, ніж кава з булочкою. Як вона працює вдома й на роботі, про що говорять і які шведські фрази потрібні.",
      icon: "☕",
      href: "blog/shcho-take-fika-u-shvetsii.html",
      image: "assets/blog/shcho-take-fika-u-shvetsii.webp"
    },
    {
      title: "Від fredagsmys до söndagsångest: емоційна карта шведського тижня",
      category: "Культура Швеції",
      time: "5 хв",
      excerpt: "Як слова fredagsmys, lillördag, lördagsgodis і söndagsångest описують повсякденне життя та настрій тижня у Швеції.",
      icon: "🛋️",
      href: "blog/fredagsmys-lordagsgodis-sondagsangest.html",
      image: "assets/blog/fredagsmys-lordagsgodis-sondagsangest.webp"
    },
    {
      title: "Шведська мова майбутнього: що з нею роблять англійська, TikTok і нові покоління",
      category: "Слова та вирази",
      time: "6 хв",
      excerpt: "Як англійська, соцмережі, молодіжний сленг і багатомовна Швеція змінюють сучасну шведську — і що з цього вчити студенту.",
      icon: "📱",
      href: "blog/suchasna-shvedska-anhlitsyzmy-slenh.html",
      image: "assets/blog/suchasna-shvedska-anhlitsyzmy-slenh.webp"
    }
  ],

  /* ---------------- FAQ (homepage / general) ---------------- */
  faq: [
    {
      q: "Чи підходить навчання для повного нуля?",
      a: "Так. Індивідуальні заняття з Марією підлаштовуються під твій рівень, а курс «Шведська A1–A2» створений саме для початківців."
    },
    {
      q: "Чи будемо говорити шведською на заняттях?",
      a: "Так, говоріння присутнє з перших занять — поступово й комфортно. Мета — не «пройти тему», а навчитися використовувати мову."
    },
    {
      q: "Чи буде граматика?",
      a: "Звісно. Але граматика тут — інструмент для спілкування, а не самоціль. Ми бачимо її в контексті, прикладах і реальних реченнях."
    },
    {
      q: "Чи залишаються матеріали після уроку?",
      a: "Так. Марія створює власні матеріали — фрази, добірки слів, пояснення, — до яких хочеться повертатися між заняттями."
    },
    {
      q: "Чи підходить навчання, якщо я вже живу у Швеції?",
      a: "Так. Індивідуальні заняття з Марією підлаштовуються під твої цілі — включно з побутом, документами, small talk і щоденними ситуаціями в Швеції."
    },
    {
      q: "У якому форматі проходять заняття?",
      a: "Є кілька форматів: індивідуальні та парні заняття з Марією, групові зустрічі Språkkafe й книжковий клуб, а також курси для самостійного опрацювання."
    }
  ],

  /* ---------------- Course-detail FAQ ---------------- */
  courseFaq: [
    { q: "Чи підходить курс для повного нуля?", a: "Так, курс «Шведська з нуля» створений саме для старту з нульового або майже нульового рівня." },
    { q: "Скільки часу потрібно на домашні завдання?", a: "Орієнтовно 20–40 хвилин між заняттями. Завдання невеликі, але регулярні — щоб мова закріплювалася." },
    { q: "Чи буде граматика?", a: "Так, але через приклади й контекст. Ми вчимося бачити патерни, а не зубрити правила." },
    { q: "Чи будемо говорити шведською на заняттях?", a: "Так, говоримо з перших тем — поступово й без тиску." },
    { q: "Чи є матеріали після уроку?", a: "Так, до кожної теми залишаються матеріали, до яких можна повертатися." },
    { q: "Чи можна навчатися у власному темпі?", a: "Темп підлаштовується під вас. Розклад занять узгоджується індивідуально." }
  ],

  /* ---------------- Testimonials ----------------
     Real reactions Maria received — YouTube comments and Instagram DMs/story
     replies, sent to us as screenshots 2026-10-01. Wording kept as written,
     only stray spacing around punctuation cleaned up. Two messages had no
     name attached (anonymous DM, story-reply notification), so `name` is
     left out there on purpose — never invent one. Alya's message opened with
     a greeting to Maria ("Привіт, Маша, мене звати Аля, я твоя учениця") —
     trimmed since it's addressed to Maria personally, not useful on the
     site; the feedback itself is untouched.
     `photo` — their own avatar, cropped from the same screenshots, only
     where one showed an actual personal photo. Where a person had no real
     photo (YouTube's blank initial-letter icon) or sent no avatar at all,
     there's no `photo` field and the card falls back to a plain letter
     circle (first letter of `name`) — or an unmarked circle for the two
     anonymous ones, since there's no name to take a letter from. */
  testimonials: [
    { name: "Наталія Ціж", quote: "Дякую Вам за такий цікавий урок! 😍", source: "Коментар на YouTube", photo: "assets/testimonials/natalia.png" },
    { name: "Анатолій Дувальчук", quote: "Приєднуюсь до подяки за Вашу працю ✍️📋💪👍🔥🙂", source: "Коментар на YouTube" },
    { name: "Zhanna Kond", quote: "Дуже дякую. Чудові заняття.", source: "Коментар на YouTube" },
    { name: "Аля", quote: "Дуже хочу подякувати тобі за твої зусилля. Мені дуже подобається, як просто і доступно ти доносиш матеріал, видно, що ти це любиш. Тішуся, що є уроки в записі, бо моя пам'ять часом мене дуже підводить 😂🙈 Думаю, спільними зусиллями я швидко вивчу мову, ну принаймні на це надіюся 😅 Приємно було бачити у відео твого котика, це дуже розряджає 🐈", source: "Повідомлення в Instagram", photo: "assets/testimonials/alya.png" },
    { quote: "Дякую тобі за уроки, це мега круто 🐱 Не встигаю попадати вчасно, дивлюсь в ютубі, бо працюю( Але дуже дуже дякую ❤️", source: "Повідомлення в Instagram", photo: "assets/testimonials/instagram-1.png" },
    { quote: "Дякую Вам за уроки 🙏 просто, зрозуміло, і дуже щиро ❤️", source: "Реакція на Instagram-сторіс" }
  ]
};
