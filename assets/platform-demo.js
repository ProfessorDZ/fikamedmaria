/* =====================================================================
   Fika med Maria — demo data for the student cabinet.
   Used only in demo mode (add ?demo=1 to a platform page). account.js
   answers every question from this file, nothing is sent anywhere.
   Shapes are exactly the ones FMMAccount returns, so the cabinet pages
   work the same on fake and on real data:
     product = { product, modules: [{ …, lessons: [{ …, done, blocks }] }],
                 blocks (product-level), results { blockId: … }, work { blockId: … } }
   Together the demo course, the ready lesson and the book use all the
   student-visible block types (26; the teacher note is never sent to
   students, so it is not here). Pictures are real files of the site
   (assets/lessons/...); other file paths are made up on the spot by
   account.js (a short tone for sound, a tiny text for the rest).
   ===================================================================== */
window.FMM_DEMO = (function () {
  "use strict";

  /* blocks([[id, type, content], …]) -> [{ id, type, position, content }] */
  function blocks(list) {
    return list.map(function (x, i) { return { id: x[0], type: x[1], position: i + 1, content: x[2] }; });
  }

  var KO = "assets/lessons/a2b1-ko/";
  var FIKA = "assets/lessons/b1-fika/";
  var FRED = "assets/lessons/a2b1-fredagsmys/";
  var LAGOM = "assets/lessons/b1b2-lagom/";
  var SKOR = "assets/lessons/a2-skor/";

  /* ---------- Course: «Шведська A1–A2: перший крок» ---------- */
  var lesson111 = blocks([
    [1101, "text", {
      heading: "Перші слова",
      body: [
        "## Привіт! Hej!",
        "",
        "Сьогодні ти вивчиш **перші слова** шведською. Не поспішай: *повільно — значить добре*.",
        "",
        "### Корисні слова",
        "",
        "- Hej — привіт",
        "- Hej då — до побачення",
        "- Tack — дякую",
        "- Förlåt — вибач",
        "",
        "> Порада від Марії: у Швеції на «du» звертаються майже до всіх, навіть до начальника.",
        "",
        "Хочеш почути, як це звучить? Заглянь на [мій YouTube](https://www.youtube.com/@MaryZubchenko)."
      ].join("\n")
    }],
    [1102, "vocabulary", {
      title: "Слова до уроку",
      words: [
        { word: "Hej", translation: "привіт", example: "Hej! Hur mår du?", audio_src: "1/hej.mp3" },
        { word: "Hej då", translation: "до побачення", example: "Hej då, vi ses i morgon!" },
        { word: "Tack", translation: "дякую", example: "Tack för kaffet!", audio_src: "1/tack.mp3" },
        { word: "God morgon", translation: "доброго ранку", example: "God morgon, Anna!" },
        { word: "Förlåt", translation: "вибач, перепрошую", example: "Förlåt, jag är sen." }
      ]
    }],
    [1103, "audio", {
      title: "Послухай діалог",
      src: "1/hej-dialog.mp3",
      caption: "Двоє людей знайомляться. Послухай двічі: спочатку без тексту.",
      transcript: "**Anna:** Hej! Jag heter Anna. Vad heter du?\n\n**Olena:** Hej Anna! Jag heter Olena. Trevligt att träffas!\n\n**Anna:** Detsamma!"
    }],
    [1104, "choice", {
      title: "Вправа 1. Привітання",
      instructions: "Обери правильну відповідь. У другому питанні їх дві.",
      questions: [
        { q: "Що означає «Hej då»?", options: ["Привіт", "До побачення", "Дякую"], correct: [1], explain: "Hej = привіт, а Hej då = до побачення." },
        { q: "Які з цих слів — привітання?", options: ["Hej", "Tack", "God morgon", "Förlåt"], correct: [0, 2], explain: "Hej і God morgon (доброго ранку) — привітання." },
        { q: "Як сказати «Дякую»?", options: ["Tack", "Hej då", "Förlåt"], correct: [0] }
      ]
    }],
    [1105, "truefalse", {
      title: "Вправа 2. Правда чи неправда?",
      statements: [
        { text: "«Tack» шведською означає «будь ласка».", answer: false, explain: "Tack — це «дякую». «Будь ласка» звучить як «varsågod» або «ingen orsak»." },
        { text: "«Hej» можна сказати і коли зустрічаєш, і коли прощаєшся.", answer: true, explain: "Так, у розмові «Hej» часто кажуть і на початку, і наприкінці." },
        { text: "У Швеції до начальника завжди кажуть «ni».", answer: false, explain: "Майже всім кажуть «du», навіть начальнику." }
      ]
    }],
    [1106, "flashcards", {
      title: "Картки: перші слова",
      instructions: "Торкнись картки, щоб побачити переклад. Стрілками ← → можна гортати.",
      cards: [
        { front: "Hej", back: "привіт" },
        { front: "Hej då", back: "до побачення" },
        { front: "Tack", back: "дякую" },
        { front: "Förlåt", back: "вибач" },
        { front: "Trevligt att träffas", back: "приємно познайомитись" }
      ]
    }]
  ]);

  var lesson112 = blocks([
    [1111, "text", {
      heading: "Як сказати, що мене звати…",
      body: "## Jag heter…\n\nЩоб сказати своє імʼя, кажи **Jag heter Olena.** Щоб запитати: **Vad heter du?**\n\n- Jag heter … — мене звати …\n- Jag kommer från Ukraina — я з України\n- Jag bor i Krakow — я живу в Кракові"
    }],
    [1112, "table", {
      title: "Числа від 1 до 5",
      caption: "Запамʼятай «sju» і «tjugo» пізніше — зараз лише п'ять чисел.",
      header: ["Число", "Svenska", "Як читати"],
      rows: [["1", "ett", "ет"], ["2", "två", "тво"], ["3", "tre", "трей"], ["4", "fyra", "фіра"], ["5", "fem", "фем"]]
    }],
    [1113, "image", {
      title: "Так виглядають мої робочі аркуші",
      src: KO + "worksheet.webp",
      alt: "Приклад робочого аркуша з уроку про чергу",
      caption: "Приклад робочого аркуша. Натисни на картинку, щоб збільшити."
    }],
    [1114, "order_words", {
      title: "Вправа 3. Склади речення",
      instructions: "Натискай на слова в правильному порядку.",
      sentences: [
        { answer: "Jag heter Olena." },
        { answer: "Vad heter du?" },
        { answer: "Jag kommer från Ukraina." }
      ]
    }],
    [1115, "match", {
      title: "Вправа 4. З'єднай числа зі словами",
      pairs: [
        { left: "ett", right: "1" },
        { left: "två", right: "2" },
        { left: "tre", right: "3" },
        { left: "fyra", right: "4" }
      ]
    }],
    [1116, "gap", {
      title: "Вправа 5. Заповни пропуски",
      instructions: "Впиши слово у кожен пропуск.",
      text: "Hej! Jag [heter] Olena.\nJag [kommer|kom] från Ukraina.\nJag [bor] i Krakow."
    }],
    [1117, "open_answer", {
      title: "Завдання для Марії. Представся",
      question: "Напиши 2–3 речення про себе шведською: **Vad heter du? Var bor du?** Не бійся помилок — я їх поправлю.",
      min_words: 5
    }]
  ]);

  var lesson121 = blocks([
    [1201, "video", { title: "Відео: у кафе", src: "https://vimeo.com/76979871" }],
    [1202, "youtube", { title: "Ще одне відео", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw" }],
    [1203, "dropdown_gap", {
      title: "Вправа 6. Обери слово зі списку",
      instructions: "У кожному пропуску обери правильну форму.",
      text: "Jag [*vill|vilja|villa] ha en kaffe, tack.\nHon [*äter|äta|ät] en bulle till fikan.\nVi [*har|ha|hade] fika klockan tre."
    }],
    [1204, "drag_words", {
      title: "Вправа 7. Перетягни слова",
      instructions: "Постав слова на місце. Тут є зайві слова.",
      text: "Jag [dricker] kaffe varje morgon och [äter] en bulle.\nKaffet är [varmt] men glassen är [kall].",
      extra: ["dricka", "kallt"]
    }],
    [1205, "order_sentences", {
      title: "Вправа 8. Діалог у кафе",
      instructions: "Розстав репліки в правильному порядку. Можна тягнути або користуватися стрілками.",
      items: [
        "Hej! Vad önskar du?",
        "Jag skulle vilja ha en kaffe och en kanelbulle, tack.",
        "Det blir 55 kronor.",
        "Varsågod!",
        "Tack, trevlig fika!"
      ]
    }],
    [1206, "embed", {
      title: "Гра: слова до fika",
      instructions: "Пограй у вправу від WordWall. Це приклад вбудованої гри.",
      provider: "wordwall",
      url: "https://wordwall.net/embed/38a853ecb2fc4cb98c801b5cef3978c7?themeId=1",
      height: 420
    }]
  ]);

  var lesson122 = blocks([
    [1301, "audio", {
      title: "Діалог у магазині",
      src: "1/butik.mp3",
      caption: "Послухай діалог і повтори за ним уголос.",
      transcript: "**Kund:** Hej! Jag skulle vilja ha en liter mjölk, tack.\n\n**Kassör:** Varsågod. Något mer?\n\n**Kund:** Ja, ett bröd och lite ost.\n\n**Kassör:** Det blir 105 kronor."
    }],
    [1302, "hidden_text", {
      label: "Показати переклад",
      instructions: "Спершу спробуй зрозуміти сама.",
      body: "- Jag skulle vilja ha … — я хотіла б …\n- Något mer? — щось ще?\n- Det blir 105 kronor — разом 105 крон."
    }],
    [1303, "table_fill", {
      title: "Вправа 9. Що ми купуємо",
      instructions: "Впиши шведське слово. Таблицю можна гортати вбік.",
      header: ["Продукт", "Svenska", "Ціна"],
      rows: [
        ["молоко", "[mjölk]", "15 kronor"],
        ["хліб", "[bröd]", "30 kronor"],
        ["сир", "[ost]", "60 kronor"]
      ]
    }],
    [1304, "student_file", {
      title: "Завдання для Марії. Запиши голосове",
      task: "Запиши **голосове (до 1 хвилини)**: уяви, що ти в магазині, і замов молоко, хліб і сир. Можна записати прямо тут або завантажити файл.",
      accept: "audio",
      allow_recording: true
    }]
  ]);

  var lesson123 = blocks([
    [1401, "text", {
      heading: "Мій ранок",
      body: "## Підсумок\n\nТи вже вмієш привітатися, сказати, як тебе звати, порахувати до п'яти й замовити каву. **Så bra!**\n\nОсь ще кілька фраз про ранок:\n\n- Jag dricker kaffe på morgonen.\n- Jag äter en smörgås.\n- Sedan går jag till jobbet."
    }],
    [1402, "collage", {
      title: "Fika-настрій",
      images: [
        { src: FIKA + "cover.webp", alt: "Обкладинка уроку про fika", caption: "Fika" },
        { src: FRED + "cover.webp", alt: "Обкладинка уроку про пʼятничний затишок", caption: "Fredagsmys" },
        { src: SKOR + "cover.webp", alt: "Обкладинка уроку про взуття" },
        { src: FIKA + "slide-a.webp", alt: "Слайд до уроку про fika" }
      ]
    }],
    [1403, "open_answer", {
      title: "Завдання для Марії. Мій ранок",
      question: "Berätta om din morgon: **Vad dricker och äter du?** Напиши 3–4 речення шведською.",
      min_words: 8
    }],
    [1404, "link_button", { title: "Хочеш ще?", url: "https://www.youtube.com/@MaryZubchenko", label: "Мій канал на YouTube" }]
  ]);

  var course = {
    product: {
      id: 1, slug: "svenska-a1-a2-forsta-steget", kind: "course",
      title: "Шведська A1–A2: перший крок",
      short_description: "П'ять уроків, щоб привітатися, порахувати й замовити каву шведською.",
      description: "Мій перший курс для тих, хто починає. Короткі уроки з текстом, відео, вправами й завданнями, які я перевіряю сама.",
      cover_path: "assets/lessons/a2-skor/cover.webp"
    },
    modules: [
      {
        id: 11, title: "Знайомство", position: 1,
        lessons: [
          { id: 111, title: "Hej! Привіт і знайомство", position: 1, done: true,
            summary: "Перші слова, привітання й ввічливі фрази.", blocks: lesson111 },
          { id: 112, title: "Числа та «Jag heter…»", position: 2, done: false,
            summary: "Рахуємо до п'яти й розповідаємо, як нас звати.", blocks: lesson112 }
        ]
      },
      {
        id: 12, title: "Щоденні справи", position: 2,
        lessons: [
          { id: 121, title: "Fika: замовляємо каву", position: 1, done: false,
            summary: "Відео, діалог і гра про те, як замовити каву й булочку.", blocks: lesson121 },
          { id: 122, title: "Слухаємо: у магазині", position: 2, done: false,
            summary: "Послухай діалог, заповни таблицю й запиши голосове для мене.", blocks: lesson122 },
          { id: 123, title: "Підсумок: мій ранок", position: 3, done: false,
            summary: "Повторюємо все разом і пишемо про свій ранок.", blocks: lesson123 }
        ]
      }
    ],
    blocks: blocks([
      [1501, "gap", { title: "Підсумковий міні-тест", instructions: "Одне швидке завдання на закінчення.", text: "God [morgon]! Hur mår du?" }],
      [1502, "file", { title: "Усі слова курсу", src: "1/talen-a1.pdf", name: "Слова курсу.pdf", note: "PDF для друку, 1 сторінка." }]
    ]),
    results: {
      1104: { best_score: 2, last_score: 2, max_score: 3, attempts: 2, completed: false }
    },
    work: {
      1304: {
        status: "submitted", text: "",
        files: [{ path: "demo/1304/1730800000000-golosove.ogg", name: "golosove.ogg", size: 48213, type: "audio/ogg" }],
        feedback: "", score: null, reviewed_at: null
      },
      1403: {
        status: "reviewed",
        text: "På morgonen dricker jag kaffe och äter en smörgås. Sedan går jag till jobbet. Jag gillar att fika på fredagar.",
        files: [],
        feedback: "Super, **Olena**! Dina meningar är tydliga.\n\n- Bra: *dricker* och *äter* är rätt form.\n- Tips: säg «Jag **går** till jobbet» — du har det redan!\n\nSå bra jobbat, fortsätt så!",
        score: 90,
        reviewed_at: "2026-11-04T10:00:00Z"
      }
    }
  };

  /* ---------- Ready lesson (no modules) ---------- */
  var lesson = {
    product: {
      id: 2, slug: "b1b2-lagom", kind: "lesson",
      title: "Vad är egentligen lagom?",
      short_description: "Урок B1–B2 про слово, яке пояснює шведський характер.",
      description: "Готовий урок: історія слова lagom, сортування ситуацій, слайди й завдання додому.",
      cover_path: "assets/lessons/b1b2-lagom/cover.webp"
    },
    modules: [],
    blocks: blocks([
      [2101, "text", {
        heading: "Lagom — не «забагато» і не «замало»",
        body: "## Vad betyder *lagom*?\n\nOrdet **lagom** betyder «precis lagom mycket»: inte för lite och inte för mycket. Många svenskar säger att det är *en livsstil*.\n\n- lagom varmt — приємно тепло\n- lagom stor — якраз такого розміру\n- lagom är bäst — в міру найкраще"
      }],
      [2102, "image", { src: LAGOM + "cover.webp", alt: "Обкладинка уроку про lagom", caption: "Обкладинка уроку." }],
      [2103, "choice", {
        title: "Вправа 1. Що найближче до слова «lagom»?",
        questions: [
          { q: "Vad är närmast «lagom»?", options: ["Забагато", "В міру", "Зовсім трохи"], correct: [1], explain: "Lagom — це «саме стільки, скільки треба»." }
        ]
      }],
      [2104, "categorize", {
        title: "Вправа 2. Розклади ситуації",
        instructions: "Де «замало», де «lagom», а де «забагато»?",
        columns: [
          { title: "För lite", items: ["en droppe kaffe", "ett litet kryddkorn"] },
          { title: "Lagom", items: ["en kopp kaffe", "en skiva bröd"] },
          { title: "För mycket", items: ["tio koppar kaffe", "en hel tårta"] }
        ]
      }],
      [2105, "carousel", {
        title: "Слайди до заняття",
        images: [
          { src: LAGOM + "slide-a.webp", alt: "Слайд A", caption: "Слайд A" },
          { src: LAGOM + "slide-b.webp", alt: "Слайд B", caption: "Слайд B" },
          { src: LAGOM + "worksheet.webp", alt: "Робочий аркуш", caption: "Робочий аркуш" }
        ]
      }],
      [2106, "file", { title: "Робочий аркуш", src: "2/lagom-worksheet.pdf", name: "Lagom — робочий аркуш.pdf", note: "PDF для друку." }],
      [2107, "file", { title: "Слайди для заняття", src: "2/lagom-slides.pdf", name: "Lagom — слайди.pdf", note: "PDF, 12 слайдів." }],
      [2108, "link_button", { title: "Почитати більше", url: "https://sv.wikipedia.org/wiki/Lagom", label: "Стаття про lagom" }]
    ]),
    results: {},
    work: {}
  };

  /* ---------- Book ---------- */
  var book = {
    product: {
      id: 3, slug: "svenska-passiv", kind: "book",
      title: "Svenska passiv — міні-підручник",
      short_description: "Пасив шведською: 8 уроків з простими поясненнями.",
      description: "Короткий підручник у PDF: як утворюється пасив, коли він потрібен і як його не плутати з рефлексивними дієсловами.",
      cover_path: "assets/lessons/a2b1-introvert/cover.webp"
    },
    modules: [],
    blocks: blocks([
      [3101, "text", {
        heading: "S-passiv",
        body: "## Що таке пасив?\n\nУ пасиві важливо **що** відбувається, а не **хто** робить. У шведській найчастіше додають **-s** до дієслова:\n\n- Dörren öppnas klockan åtta. — Двері відчиняють о восьмій.\n- Brödet bakas varje morgon. — Хліб печуть щоранку."
      }],
      [3102, "table", {
        title: "Форми дієслів",
        header: ["Infinitiv", "Presens aktiv", "Presens passiv", "Preteritum passiv"],
        rows: [["öppna", "öppnar", "öppnas", "öppnades"], ["baka", "bakar", "bakas", "bakades"], ["skriva", "skriver", "skrivs", "skrevs"], ["läsa", "läser", "läses", "lästes"]]
      }],
      [3103, "hidden_text", { label: "Показати правило", body: "Якщо дієслово закінчується на **-a**, до нього додаємо **-s** (öppna → öppnas). Якщо на **-er**, то **-s** замість **-er** (skriver → skrivs)." }],
      [3104, "dropdown_gap", {
        title: "Вправа 1. Обери форму",
        text: "Brödet [*bakas|bakar|bakade] varje morgon.\nDörren [*öppnades|öppnade|öppnas] igår."
      }],
      [3105, "file", { title: "Підручник у PDF", src: "3/svenska-passiv.pdf", name: "Svenska passiv.pdf", note: "Повна версія для друку." }]
    ]),
    results: {},
    work: {}
  };

  var products = {};
  products[course.product.slug] = course;
  products[lesson.product.slug] = lesson;
  products[book.product.slug] = book;

  /* Library rows: counts are recomputed by account.js from `products`, the
     numbers below are only the starting values. */
  var library = [
    { product_id: 1, slug: course.product.slug, kind: "course", title: course.product.title,
      short_description: course.product.short_description, cover_path: course.product.cover_path,
      source: "purchase", granted_at: "2026-10-12T09:30:00Z", expires_at: null,
      lessons_total: 5, lessons_done: 1, blocks_total: 10, blocks_completed: 0, work_pending: 1, work_reviewed: 1 },
    { product_id: 2, slug: lesson.product.slug, kind: "lesson", title: lesson.product.title,
      short_description: lesson.product.short_description, cover_path: lesson.product.cover_path,
      source: "purchase", granted_at: "2026-10-20T16:05:00Z", expires_at: null,
      lessons_total: 0, lessons_done: 0, blocks_total: 2, blocks_completed: 0, work_pending: 0, work_reviewed: 0 },
    { product_id: 3, slug: book.product.slug, kind: "book", title: book.product.title,
      short_description: book.product.short_description, cover_path: book.product.cover_path,
      source: "admin_grant", granted_at: "2026-11-01T11:00:00Z", expires_at: null,
      lessons_total: 0, lessons_done: 0, blocks_total: 1, blocks_completed: 0, work_pending: 0, work_reviewed: 0 }
  ];

  var orders = [
    { id: 1002, created_at: "2026-10-20T16:04:00Z", paid_at: "2026-10-20T16:05:00Z", status: "paid",
      amount_total_cents: 900, currency: "EUR",
      items: [{ product_id: 2, title: lesson.product.title, kind: "lesson", unit_amount_cents: 900, quantity: 1 }] },
    { id: 1001, created_at: "2026-10-12T09:28:00Z", paid_at: "2026-10-12T09:30:00Z", status: "paid",
      amount_total_cents: 4900, currency: "EUR",
      items: [{ product_id: 1, title: course.product.title, kind: "course", unit_amount_cents: 4900, quantity: 1 }] }
  ];

  return {
    user: { id: "00000000-0000-4000-8000-000000000001", email: "olena.demo@example.com" },
    profile: { id: "00000000-0000-4000-8000-000000000001", email: "olena.demo@example.com", full_name: "Олена", locale: "uk" },
    library: library,
    orders: orders,
    products: products,
    admin: true
  };
})();
