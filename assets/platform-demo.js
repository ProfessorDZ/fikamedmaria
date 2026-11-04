/* =====================================================================
   Fika med Maria — demo data for the student cabinet.
   Used only in demo mode (add ?demo=1 to a platform page). account.js
   answers every question from this file, nothing is sent anywhere.
   Shapes are exactly the ones FMMAccount returns, so the cabinet pages
   work the same on fake and on real data.
   Cover and file paths are real files of the site (assets/lessons/...).
   ===================================================================== */
window.FMM_DEMO = (function () {
  "use strict";

  /* ---------- Exercise sets (format of the spec, section 3) ---------- */
  var exHej = {
    version: 1,
    items: [
      { type: "choice", prompt: "Що означає «Hej då»?", options: ["Привіт", "До побачення", "Дякую"],
        answer: 1, explain: "Hej = привіт, а Hej då = до побачення." },
      { type: "truefalse", statement: "«Tack» шведською означає «будь ласка».", answer: false,
        explain: "Tack — це «дякую». «Будь ласка» звучить як «varsågod» або «ingen orsak»." },
      { type: "multi", prompt: "Які з цих слів — привітання?", options: ["Hej", "Tack", "God morgon", "Förlåt"],
        answer: [0, 2], explain: "Hej і God morgon (доброго ранку) — привітання." }
    ]
  };

  var exNumbers = {
    version: 1,
    items: [
      { type: "order", prompt: "Склади речення:", words: ["jag", "heter", "Olena"],
        answer: ["Jag heter Olena"], explain: "Порядок слів: підмет, потім дієслово." },
      { type: "match", prompt: "З'єднай числа зі словами:",
        pairs: [["ett", "один"], ["två", "два"], ["tre", "три"], ["fyra", "чотири"]] }
    ]
  };

  var exFika = {
    version: 1,
    items: [
      { type: "gap", prompt: "Jag ___ kaffe varje morgon och ___ en bulle.",
        answers: [["dricker"], ["äter", "tar"]], hint: "presens: кава п'ється, булочка їсться",
        explain: "Dricker (п'ю) і äter (їм) — дієслова теперішнього часу." },
      { type: "choice", prompt: "Як попросити каву чемно?", options: ["Jag vill ha en kaffe, tack.", "Kaffe!", "Ge mig kaffe."],
        answer: 0, explain: "Чемно — з «tack» наприкінці." }
    ]
  };

  var exFinal = {
    version: 1,
    items: [
      { type: "truefalse", statement: "«Fika» — це тільки кава.", answer: false,
        explain: "Fika — це пауза для розмови, а кава — лише її частина." },
      { type: "gap", prompt: "God ___! (доброго ранку)", answers: [["morgon"]] }
    ]
  };

  var exLagom = {
    version: 1,
    items: [
      { type: "choice", prompt: "Що найближче до слова «lagom»?", options: ["Забагато", "В міру", "Зовсім трохи"],
        answer: 1, explain: "Lagom — це «саме стільки, скільки треба»." },
      { type: "gap", prompt: "Det är ___ varmt i dag. (в міру)", answers: [["lagom"]] }
    ]
  };

  var minimalMd = [
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
    "Хочеш почути, як це звучить? Заглянь на [мій YouTube](https://www.youtube.com/@MaryZubchenko).",
    "Потім виконай вправи нижче."
  ].join("\n");

  /* ---------- Course: «Шведська A1–A2: перший крок» ---------- */
  var course = {
    product: {
      id: 1, slug: "svenska-a1-a2-forsta-steget", kind: "course",
      title: "Шведська A1–A2: перший крок",
      short_description: "Чотири уроки, щоб привітатися, порахувати й замовити каву шведською.",
      description: "Мій перший курс для тих, хто починає. Короткі уроки з текстом, відео, вправами й підсумковим тестом.",
      cover_path: "assets/lessons/a2-skor/cover.webp"
    },
    modules: [
      {
        id: 11, title: "Знайомство", position: 1,
        lessons: [
          {
            id: 111, title: "Hej! Привіт і знайомство", position: 1, done: true,
            summary: "Перші слова, привітання й ввічливі фрази.",
            materials: [
              { id: 1111, kind: "text", title: "Урок: перші слова", storage_path: null, external_ref: null, body: minimalMd, position: 1 }
            ],
            exercises: [
              { id: 1121, title: "Привітання", instructions: "Обери правильну відповідь.", content: exHej, position: 1,
                result: { best_score: 2, last_score: 2, max_score: 3, attempts: 2, completed: false } }
            ]
          },
          {
            id: 112, title: "Числа та «Jag heter…»", position: 2, done: false,
            summary: "Рахуємо до чотирьох і розповідаємо, як нас звати.",
            materials: [
              { id: 1131, kind: "pdf", title: "Робочий аркуш: числа", storage_path: "1/talen-a1.pdf", external_ref: null, body: null, position: 1 }
            ],
            exercises: [
              { id: 1122, title: "Склади речення і з'єднай пари", instructions: "Торкайся слів по черзі.", content: exNumbers, position: 1, result: null }
            ]
          }
        ]
      },
      {
        id: 12, title: "Щоденні справи", position: 2,
        lessons: [
          {
            id: 121, title: "Fika: замовляємо каву", position: 1, done: false,
            summary: "Коротке відео про те, як замовити каву й булочку.",
            materials: [
              { id: 1141, kind: "video", title: "Відео: у кафе", storage_path: null, external_ref: "https://player.vimeo.com/video/76979871", body: null, position: 1 }
            ],
            exercises: [
              { id: 1123, title: "У кафе", instructions: "Заповни пропуски і обери фразу.", content: exFika, position: 1, result: null }
            ]
          },
          {
            id: 122, title: "Слухаємо: у магазині", position: 2, done: false,
            summary: "Послухай діалог і повтори за ним уголос.",
            materials: [
              { id: 1151, kind: "audio", title: "Аудіо: діалог у магазині", storage_path: "1/butik.mp3", external_ref: null, body: null, position: 1 }
            ],
            exercises: []
          }
        ]
      }
    ],
    materials: [],
    exercises: [
      { id: 1124, title: "Підсумковий міні-тест", instructions: "Два швидкі питання.", content: exFinal, position: 1, result: null }
    ]
  };

  /* ---------- Ready lesson (no modules) ---------- */
  var lesson = {
    product: {
      id: 2, slug: "b1b2-lagom", kind: "lesson",
      title: "Vad är egentligen lagom?",
      short_description: "Урок B1–B2 про слово, яке пояснює шведський характер.",
      description: "Готовий урок: історія слова lagom, сортування ситуацій, проєкт у групі й завдання додому.",
      cover_path: "assets/lessons/b1b2-lagom/cover.webp"
    },
    modules: [],
    materials: [
      { id: 2101, kind: "pdf", title: "Робочий аркуш (PDF)", storage_path: "2/lagom-worksheet.pdf", external_ref: null, body: null, position: 1 },
      { id: 2102, kind: "pdf", title: "Слайди для заняття (PDF)", storage_path: "2/lagom-slides.pdf", external_ref: null, body: null, position: 2 },
      { id: 2103, kind: "link", title: "Стаття про lagom", storage_path: null, external_ref: "https://sv.wikipedia.org/wiki/Lagom", body: null, position: 3 }
    ],
    exercises: [
      { id: 2111, title: "Перевір себе: lagom", instructions: "Дві швидкі вправи.", content: exLagom, position: 1, result: null }
    ]
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
    materials: [
      { id: 3101, kind: "pdf", title: "Svenska passiv (PDF)", storage_path: "3/svenska-passiv.pdf", external_ref: null, body: null, position: 1 }
    ],
    exercises: []
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
      lessons_total: 4, lessons_done: 1, exercises_total: 4, exercises_completed: 0 },
    { product_id: 2, slug: lesson.product.slug, kind: "lesson", title: lesson.product.title,
      short_description: lesson.product.short_description, cover_path: lesson.product.cover_path,
      source: "purchase", granted_at: "2026-10-20T16:05:00Z", expires_at: null,
      lessons_total: 0, lessons_done: 0, exercises_total: 1, exercises_completed: 0 },
    { product_id: 3, slug: book.product.slug, kind: "book", title: book.product.title,
      short_description: book.product.short_description, cover_path: book.product.cover_path,
      source: "admin_grant", granted_at: "2026-11-01T11:00:00Z", expires_at: null,
      lessons_total: 0, lessons_done: 0, exercises_total: 0, exercises_completed: 0 }
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
