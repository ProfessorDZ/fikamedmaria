// Sends new form submissions to Telegram.
// Called by the database (trigger and pg_cron), never by browsers.
// Deployed with verify_jwt=false: it checks its own shared secret instead.
import { createClient } from "npm:@supabase/supabase-js@2";

type Row = {
  id: number;
  form_key: string;
  fields: Record<string, unknown> | null;
  page_path: string | null;
  created_at: string;
  spam_reasons: string[] | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Value to a trimmed string ("" for null or undefined).
const str = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v).trim();
  return String(v).trim();
};

// Cut to max characters, add a suffix, and never leave half an emoji at the end.
const clip = (s: string, max: number, suffix = ""): string =>
  s.length <= max ? s : s.slice(0, max).replace(/[\ud800-\udbff]$/, "") + suffix;

// "dd.MM.yyyy HH:mm" in Stockholm time, or "" if the date is not valid.
const formatTime = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Stockholm",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${p("day")}.${p("month")}.${p("year")} ${p("hour")}:${p("minute")}`;
};

// Builds the plain-text Telegram message from one submission.
function buildMessage(row: Row): string {
  const f = row.fields ?? {};
  // the visible label wins over the raw value
  const pick = (key: string) => str(f[`${key}_label`]) || str(f[key]);

  const header = row.form_key === "contact"
    ? "🆕 Нова заявка з сайту"
    : `🆕 Нова форма з сайту: ${row.form_key}`;

  const details: string[] = [];
  const add = (label: string, value: string) => {
    if (value) details.push(`${label}: ${value}`);
  };
  add("Імʼя", pick("name"));
  add("Email", pick("email"));
  add("Рівень", pick("level"));
  add("Що цікавить", pick("goal"));
  add("Звідки дізнались", pick("heard_from"));

  // any other field (for example product), in the order it was stored
  const known = new Set(["name", "email", "level", "goal", "heard_from", "msg"]);
  for (const key of Object.keys(f)) {
    if (known.has(key) || key.endsWith("_label")) continue;
    add(key, pick(key));
  }

  const msg = clip(str(f.msg), 3000, "… (обрізано, повний текст у базі)");

  const footer: string[] = [];
  if (row.spam_reasons?.includes("too_fast")) {
    footer.push("⚠️ Заповнено дуже швидко, можливо бот");
  }
  if (str(row.page_path)) footer.push(`Сторінка: ${str(row.page_path)}`);
  const time = formatTime(row.created_at);
  if (time) footer.push(`Час: ${time}`);

  const blocks = [
    header,
    details.join("\n"),
    msg ? `Повідомлення:\n${msg}` : "",
    footer.join("\n"),
  ].filter(Boolean);

  // Telegram allows at most 4096 characters
  return clip(blocks.join("\n\n"), 4096);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secret = req.headers.get("x-fmm-notify-secret");
  if (!secret) return json({ error: "unauthorized" }, 401);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // take a batch of rows that are due (the database counts the attempt)
  const { data, error } = await db.rpc("telegram_claim_pending", {
    p_secret: secret,
    p_limit: 10,
  });
  if (error) {
    if (error.code === "28000") return json({ error: "unauthorized" }, 401);
    console.error("claim failed:", error.message);
    return json({ error: "internal_error" }, 500);
  }

  const rows: Row[] = data?.rows ?? [];
  const token: string = data?.bot_token ?? "";
  const chatId: string = data?.chat_id ?? "";
  // the token is part of the request URL, so it must never reach the DB or the logs
  const clean = (s: string) => (token ? s.replaceAll(token, "***") : s);

  // send one row to Telegram
  const send = async (row: Row) => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: buildMessage(row),
          link_preview_options: { is_disabled: true },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 200 && body?.ok === true) {
        return { ok: true, status: res.status, error: null };
      }
      const description = typeof body?.description === "string" ? body.description : "no description";
      return { ok: false, status: res.status, error: clean(`HTTP ${res.status}: ${description}`) };
    } catch (e) {
      return { ok: false, status: 0, error: clean(e instanceof Error ? e.message : String(e)) };
    }
  };

  let sent = 0;
  let failed = 0;

  for (const [i, row] of rows.entries()) {
    // Telegram allows about 1 message per second per chat
    if (i > 0) await sleep(1100);

    const result = await send(row);
    if (result.ok) sent++;
    else {
      failed++;
      console.error(`row ${row.id} failed: ${result.error}`);
    }

    const { error: markError } = await db.rpc("telegram_mark_result", {
      p_secret: secret,
      p_id: row.id,
      p_ok: result.ok,
      p_error: result.error,
    });
    if (markError) console.error(`row ${row.id} mark failed: ${clean(markError.message)}`);

    // rate limited: stop here, the rest stay claimed and come back by backoff
    if (result.status === 429) break;
  }

  return json({ sent, failed });
});
