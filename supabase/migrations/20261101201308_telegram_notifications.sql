-- Telegram notifications for form submissions.
-- Every non-spam row in public.form_submissions is forwarded to a Telegram chat by the
-- telegram-notify edge function. A trigger kicks it right after insert and pg_cron
-- retries every 2 minutes. A Telegram failure never blocks or loses a submission.

-- 1. extensions
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- 2. notification columns, index and table comment
alter table public.form_submissions
  add column if not exists notify_last_attempt_at timestamptz,
  add column if not exists notify_error text check (length(notify_error) <= 500);

-- finds rows still waiting to be sent
create index if not exists form_submissions_notify_pending_idx
  on public.form_submissions (id)
  where notified_at is null and not is_spam;

comment on table public.form_submissions is
  'Raw copy of every form sent, exactly as typed. Written once and never edited by the app (only the contact link, the processing note and the notification columns are added afterwards).';

-- 3. shared secret between the database and the edge function (nobody needs to read it)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'telegram_notify_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'telegram_notify_secret',
      'Shared secret between the database and the telegram-notify edge function'
    );
  end if;
end;
$$;
-- telegram_bot_token and telegram_chat_id are added by hand in Vault later.

-- 4. rows that still need sending and are due by backoff (1 min, 2, 4 ... up to 1 hour)
create or replace view private.telegram_due as
select f.id
from public.form_submissions f
where f.notified_at is null
  and not f.is_spam
  and f.anonymized_at is null
  and f.created_at > now() - interval '7 days'
  and (
    f.notify_last_attempt_at is null
    or f.notify_last_attempt_at < now() - least(
      interval '1 hour',
      interval '1 minute' * power(2, least(f.notify_attempts, 10))
    )
  );

revoke all on private.telegram_due from public, anon, authenticated;

-- 5. wakes the edge function when there is something to send
create or replace function private.telegram_kick()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_secret text;
begin
  -- do nothing until the owner has added the bot token and chat id
  if (select count(*) from vault.secrets where name in ('telegram_bot_token', 'telegram_chat_id')) < 2 then
    return;
  end if;

  -- do nothing when nothing is waiting
  if not exists (select 1 from private.telegram_due) then
    return;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'telegram_notify_secret';

  perform net.http_post(
    url := 'https://svgqvvctlujameejtqnm.supabase.co/functions/v1/telegram-notify',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-fmm-notify-secret', v_secret
    ),
    timeout_milliseconds := 15000
  );
end;
$$;

-- 6. trigger: an error here must never undo the insert of a form submission
create or replace function private.form_submissions_notify()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  begin
    perform private.telegram_kick();
  exception when others then
    raise warning 'telegram kick failed: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists form_submissions_notify on public.form_submissions;
create trigger form_submissions_notify
  after insert on public.form_submissions
  for each row
  when (not new.is_spam)
  execute function private.form_submissions_notify();

-- 7. the edge function takes a batch of due rows (and counts the attempt)
create or replace function public.telegram_claim_pending(p_secret text, p_limit integer default 10)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_secret text;
  v_token text;
  v_chat text;
  v_rows jsonb;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'telegram_notify_secret';

  if p_secret is null or p_secret is distinct from v_secret then
    raise exception 'not_authorized' using errcode = '28000';
  end if;

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'telegram_bot_token';

  select decrypted_secret into v_chat
  from vault.decrypted_secrets
  where name = 'telegram_chat_id';

  -- not set up yet: claim nothing so attempts are not used up
  if v_token is null or v_chat is null then
    return jsonb_build_object('rows', '[]'::jsonb);
  end if;

  -- claim up to 20 due rows; rows another run is holding are skipped
  with picked as (
    select f.id
    from public.form_submissions f
    join private.telegram_due d on d.id = f.id
    order by f.id
    limit greatest(least(p_limit, 20), 0)
    for update of f skip locked
  ),
  claimed as (
    update public.form_submissions f
    set notify_attempts = f.notify_attempts + 1,
        notify_last_attempt_at = now()
    from picked
    where f.id = picked.id
    returning f.id, f.form_key, f.payload, f.page_path, f.created_at, f.spam_reasons
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'form_key', c.form_key,
        'fields', c.payload,
        'page_path', c.page_path,
        'created_at', c.created_at,
        'spam_reasons', to_jsonb(c.spam_reasons)
      )
      order by c.id
    ),
    '[]'::jsonb
  )
  into v_rows
  from claimed c;

  return jsonb_build_object('bot_token', v_token, 'chat_id', v_chat, 'rows', v_rows);
end;
$$;

-- 8. the edge function reports what happened to one row
create or replace function public.telegram_mark_result(
  p_secret text,
  p_id bigint,
  p_ok boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'telegram_notify_secret';

  if p_secret is null or p_secret is distinct from v_secret then
    raise exception 'not_authorized' using errcode = '28000';
  end if;

  if p_ok then
    update public.form_submissions
    set notified_at = coalesce(notified_at, now()),
        notify_error = null
    where id = p_id;
  else
    update public.form_submissions
    set notify_error = left(coalesce(p_error, 'unknown error'), 500)
    where id = p_id;
  end if;
end;
$$;

-- 9. permissions: only the service role may call the public functions
-- (anon and authenticated are named because Supabase grants them execute by default)
revoke all on function public.telegram_claim_pending(text, integer) from public, anon, authenticated;
grant execute on function public.telegram_claim_pending(text, integer) to service_role;

revoke all on function public.telegram_mark_result(text, bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.telegram_mark_result(text, bigint, boolean, text) to service_role;

revoke execute on function private.telegram_kick() from public, anon, authenticated;
revoke execute on function private.form_submissions_notify() from public, anon, authenticated;

-- 10. retry sweep every 2 minutes
select cron.schedule('telegram-notify-sweep', '*/2 * * * *', 'select private.telegram_kick()');
