-- Identifiers for Meta Conversions API and GA4 Measurement Protocol, plus the "ads" consent purpose.
-- Nothing is sent to Meta or Google from here. The database only stores what the browser sends
-- when the visitor allowed it: Google Analytics ids (analytics consent) and ad click ids, an ad
-- key and the full IP address (ads consent). The IP address is erased after 7 days.

-- 1. consent_log accepts the new purpose
alter table public.consent_log drop constraint if exists consent_log_purpose_check;
alter table public.consent_log add constraint consent_log_purpose_check
  check (purpose in ('analytics', 'marketing_email', 'privacy_notice', 'terms', 'digital_withdrawal_waiver', 'ads'));

-- 2. new columns on form_submissions
alter table public.form_submissions
  add column if not exists ga_client_id text check (length(ga_client_id) <= 64),
  add column if not exists ga_session_id text check (ga_session_id ~ '^\d{1,20}$'),
  add column if not exists ads_consent boolean not null default false,
  add column if not exists ad_key uuid,
  add column if not exists ad_ids jsonb not null default '{}'
    check (jsonb_typeof(ad_ids) = 'object' and pg_column_size(ad_ids) <= 4096), -- 8 ids of 400 characters always fit
  add column if not exists client_ip text check (length(client_ip) <= 64);

comment on column public.form_submissions.ga_client_id is
  'Google Analytics client id from the _ga cookie. Only with analytics consent; cleared when it is withdrawn.';
comment on column public.form_submissions.ga_session_id is
  'Google Analytics session id from the _ga_<id> cookie. Only with analytics consent; cleared when it is withdrawn.';
comment on column public.form_submissions.ads_consent is
  'True when the visitor had allowed ads when the form was sent.';
comment on column public.form_submissions.ad_key is
  'Random id made in the browser when ads were allowed. Also stored in consent_log.visitor_key for the ads purpose. Cleared when ads consent is withdrawn.';
comment on column public.form_submissions.ad_ids is
  'Ad click ids and Meta cookies (gclid, gbraid, wbraid, fbclid, msclkid, ttclid, fbc, fbp). Only with ads consent; emptied when it is withdrawn.';
comment on column public.form_submissions.client_ip is
  'Full IP address, kept only with ads consent (for Meta and Google matching) and erased after 7 days.';

-- finds rows by ad key (withdrawal) and rows that still hold an IP address (purge)
create index if not exists form_submissions_ad_key_idx
  on public.form_submissions (ad_key)
  where ad_key is not null;

create index if not exists form_submissions_client_ip_idx
  on public.form_submissions (id)
  where client_ip is not null;

-- 3. the full IP address of the request (same logic as request_ip_prefix, without the mask)
create or replace function private.request_ip()
returns text
language plpgsql
stable
set search_path to ''
as $$
declare
  v_headers jsonb;
  v_raw     text;
  v_ip      inet;
begin
  v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  if v_headers is null or jsonb_typeof(v_headers) <> 'object' then
    return null;
  end if;

  v_raw := nullif(btrim(v_headers ->> 'cf-connecting-ip'), '');
  if v_raw is null then
    v_raw := nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  end if;
  if v_raw is null or length(v_raw) > 64 then
    return null;
  end if;

  -- an IPv4 address written in IPv6 form (::ffff:1.2.3.4) counts as IPv4
  v_raw := regexp_replace(v_raw, '^::ffff:(\d{1,3}(\.\d{1,3}){3})$', '\1', 'i');

  v_ip := v_raw::inet;
  return host(v_ip);
exception when others then
  return null;
end;
$$;

-- 4. keeps only known ad identifiers with safe values; anything else gives an empty object
create or replace function private.clean_ad_ids(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path to ''
as $$
declare
  v_out jsonb := '{}'::jsonb;
  v_key text;
  v_val text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return '{}'::jsonb;
  end if;

  foreach v_key in array array['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid', 'fbc', 'fbp'] loop
    if jsonb_typeof(p -> v_key) = 'string' then
      v_val := p ->> v_key;
      if length(v_val) <= 400 and v_val ~ '^[A-Za-z0-9._-]+$' then
        v_out := v_out || jsonb_build_object(v_key, v_val);
      end if;
    end if;
  end loop;

  return v_out;
exception when others then
  return '{}'::jsonb;
end;
$$;

-- 5. submit_form: same as before, plus GA ids, ad consent, ad key, ad ids and the IP address
create or replace function public.submit_form(p jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  c_slug_re       constant text := '^[a-z0-9]+(-[a-z0-9]+)*$';
  v_submission_key uuid;
  v_form_key       text;
  v_fields         jsonb;
  v_page_path      text;
  v_referrer       text;
  v_attribution    jsonb;
  v_visitor_key    uuid;
  v_visitor_id     bigint;
  v_session_key    text;
  v_attempt_key    uuid;
  v_notice         text;
  v_marketing      boolean;
  v_elapsed        numeric;
  v_reasons        text[] := '{}';
  v_is_spam        boolean;
  v_country        text;
  v_submission_id  bigint;
  v_email          text;
  v_name           text;
  v_contact        bigint;
  v_heard          text;
  v_level          text;
  v_goal           text;
  v_product        text;
  v_lead_type      text;
  v_interest       text;
  v_lead_id        bigint;
  v_ga_client      text;
  v_ga_session     text;
  v_ads            boolean;
  v_ad_key         uuid;
  v_ad_ids         jsonb := '{}'::jsonb;
  v_client_ip      text;
begin
  -- a. The shape must be usable, otherwise there is nothing to store.
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  v_submission_key := private.try_uuid(private.jsonb_string(p, 'submission_key'));
  v_form_key := private.jsonb_string(p, 'form_key');
  v_fields := p -> 'fields';
  if v_submission_key is null
     or v_form_key is null
     or v_form_key !~ '^[a-z][a-z0-9_]{0,39}$'
     or coalesce(jsonb_typeof(v_fields), '') <> 'object'
     or pg_column_size(v_fields) > 16384 then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  -- b. Rate limit. The browser keeps the form in its outbox and retries later.
  if private.hit_rate_limit('form:' || coalesce(private.request_ip_prefix(), 'unknown'), 10) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- c. Signals. Nothing is ever dropped. Only the honeypot marks the submission
  --    as spam. "too_fast" is a soft signal, recorded in spam_reasons only: a real
  --    person using autofill can be quick and must always reach Maria.
  if nullif(btrim(p ->> 'hp'), '') is not null then
    v_reasons := array_append(v_reasons, 'honeypot');
  end if;
  if jsonb_typeof(p -> 'elapsed_ms') = 'number' then
    v_elapsed := (p ->> 'elapsed_ms')::numeric;
    if v_elapsed < 1500 then
      v_reasons := array_append(v_reasons, 'too_fast');
    end if;
  end if;
  v_is_spam := 'honeypot' = any (v_reasons);

  -- clean up everything else so the raw insert below cannot fail on a limit
  v_page_path   := private.clip_text(private.jsonb_string(p, 'page_path'), 300);
  v_referrer    := private.clip_text(private.jsonb_string(p, 'referrer'), 500);
  v_session_key := private.clip_text(private.jsonb_string(p, 'session_key'), 64);
  v_notice      := private.clip_text(private.jsonb_string(p, 'privacy_notice_version'), 40);
  v_attempt_key := private.try_uuid(private.jsonb_string(p, 'attempt_key'));
  v_marketing   := coalesce((p -> 'marketing_opt_in') = 'true'::jsonb, false);
  v_attribution := case
    when jsonb_typeof(p -> 'attribution') = 'object' and pg_column_size(p -> 'attribution') <= 4096
      then p -> 'attribution'
    else '{}'::jsonb
  end;
  v_country := private.request_header('cf-ipcountry');
  if v_country is null or v_country !~ '^[A-Z]{2}$' then
    v_country := null;
  end if;

  -- Google Analytics ids: kept only when they look like real ones
  v_ga_client := private.jsonb_string(p, 'ga_client_id');
  if v_ga_client is not null and (length(v_ga_client) > 64 or v_ga_client !~ '^\d+\.\d+$') then
    v_ga_client := null;
  end if;
  v_ga_session := private.jsonb_string(p, 'ga_session_id');
  if v_ga_session is not null and v_ga_session !~ '^\d{1,20}$' then
    v_ga_session := null;
  end if;

  -- Ad identifiers and the full IP address: kept only when the browser says ad consent was given.
  -- Without an ad key a later withdrawal could not find the row, so nothing is kept then either.
  v_ad_key := private.try_uuid(private.jsonb_string(p, 'ad_key'));
  v_ads := coalesce((p -> 'ads_consent') = 'true'::jsonb, false) and v_ad_key is not null;
  if v_ads then
    v_ad_ids    := private.clean_ad_ids(p -> 'ad_ids');
    v_client_ip := private.request_ip();
  else
    v_ad_key := null;
  end if;

  -- d. The visitor counts only if it already exists (analytics was accepted).
  v_visitor_key := private.try_uuid(private.jsonb_string(p, 'visitor_key'));
  if v_visitor_key is not null then
    select v.id into v_visitor_id from public.visitors v where v.visitor_key = v_visitor_key;
  end if;

  -- GA ids are erased through the visitor row, so without one they are not kept
  if v_visitor_id is null then
    v_ga_client := null;
    v_ga_session := null;
  end if;

  -- e. The raw copy. A repeat of the same submission_key stops here.
  insert into public.form_submissions (
    submission_key, form_key, payload, page_path, referrer, attribution,
    visitor_id, session_key, attempt_key, privacy_notice_version, marketing_opt_in,
    is_spam, spam_reasons, ip_prefix, user_agent, country,
    ga_client_id, ga_session_id, ads_consent, ad_key, ad_ids, client_ip
  ) values (
    v_submission_key, v_form_key, v_fields, v_page_path, v_referrer, v_attribution,
    v_visitor_id, v_session_key, v_attempt_key, v_notice, v_marketing,
    v_is_spam, v_reasons, private.request_ip_prefix(), private.request_header('user-agent'), v_country,
    v_ga_client, v_ga_session, v_ads, v_ad_key, v_ad_ids, v_client_ip
  )
  on conflict (submission_key) do nothing
  returning id into v_submission_id;

  if v_submission_id is null then
    return;
  end if;

  -- Everything below is follow-up work. If any of it fails, it is undone as a
  -- group, the raw copy above stays, and the error is written on the submission.
  begin
    if not v_is_spam then
      -- f. The person
      v_email := private.jsonb_string(v_fields, 'email');
      v_name  := private.jsonb_string(v_fields, 'name');
      v_contact := private.contact_for_email(v_email, v_name, 'site_form');

      v_level := private.jsonb_string(v_fields, 'level');
      if v_level not in ('zero', 'a1_a2', 'b1_b2', 'b2_plus', 'unknown') then
        v_level := null;
      end if;

      if v_contact is not null then
        update public.form_submissions set contact_id = v_contact where id = v_submission_id;

        if v_visitor_id is not null then
          update public.visitors set contact_id = v_contact
           where id = v_visitor_id and contact_id is null;

          update public.contacts c
             set first_source       = v.first_source,
                 first_medium       = v.first_medium,
                 first_campaign     = v.first_campaign,
                 first_referrer     = v.first_referrer,
                 first_landing_page = v.first_landing_page,
                 first_seen_at      = v.first_seen_at
            from public.visitors v
           where c.id = v_contact
             and v.id = v_visitor_id
             and c.first_seen_at is null
             and c.first_source is null and c.first_medium is null and c.first_campaign is null
             and c.first_referrer is null and c.first_landing_page is null;
        end if;

        v_heard := private.clip_text(private.jsonb_string(v_fields, 'heard_from'), 200);
        if v_heard is not null then
          update public.contacts set heard_from = v_heard
           where id = v_contact and heard_from is null;
        end if;

        if v_level is not null then
          update public.contacts set swedish_level = v_level
           where id = v_contact
             and (swedish_level is null or (swedish_level = 'unknown' and v_level <> 'unknown'));
        end if;
      end if;

      -- g. The lead (contact form only)
      if v_contact is not null and v_form_key = 'contact' then
        v_goal := private.jsonb_string(v_fields, 'goal');
        v_product := private.jsonb_string(v_fields, 'product');
        if v_product is not null and (v_product !~ c_slug_re or length(v_product) > 80) then
          v_product := null;
        end if;

        if v_goal in ('indyvidualni-zanyattya', 'parni-zanyattya', 'sprakkafe', 'knyzhkovyi-klub') then
          v_lead_type := 'live_lessons';
          v_interest := v_goal;
        elsif v_goal = 'consultation' then
          v_lead_type := 'consultation';
        elsif v_goal = 'teacher_collab' then
          v_lead_type := 'teacher_collab';
        elsif v_goal = 'waitlist' then
          v_lead_type := 'waitlist';
          v_interest := v_product;
        elsif v_goal ~ c_slug_re and length(v_goal) <= 80 then
          v_lead_type := 'product_question';
          v_interest := v_goal;
        else
          v_lead_type := 'other';
        end if;

        insert into public.leads (
          contact_id, submission_id, channel, lead_type, interest_slug, swedish_level, message
        ) values (
          v_contact, v_submission_id, 'site_form', v_lead_type, v_interest, v_level,
          private.clip_text(private.jsonb_string(v_fields, 'msg'), 5000)
        )
        returning id into v_lead_id;
      end if;

      -- h. Consent rows
      if v_notice is not null then
        insert into public.consent_log (visitor_key, contact_id, purpose, state, notice_version, mechanism, page_path)
        values (case when v_visitor_id is not null then v_visitor_key end,
                v_contact, 'privacy_notice', 'granted', v_notice, 'form_checkbox', v_page_path);
      end if;
      if v_marketing then
        insert into public.consent_log (visitor_key, contact_id, purpose, state, notice_version, mechanism, page_path)
        values (case when v_visitor_id is not null then v_visitor_key end,
                v_contact, 'marketing_email', 'granted', v_notice, 'form_checkbox', v_page_path);
        if v_contact is not null then
          update public.contacts
             set marketing_status = 'subscribed', marketing_changed_at = now()
           where id = v_contact and marketing_status = 'none';
        end if;
      end if;

      -- i. The server-side generate_lead event, written only when a lead row was
      --    really created (it exists even without analytics consent)
      if v_lead_id is not null then
        insert into public.events (
          event_key, event_name, origin, contact_id, visitor_id, session_key, page_path, item_slug, params
        ) values (
          'lead:' || v_submission_key::text, 'generate_lead', 'server',
          v_contact, v_visitor_id, v_session_key, v_page_path, v_interest,
          jsonb_strip_nulls(jsonb_build_object(
            'form_key', v_form_key,
            'lead_type', v_lead_type,
            'swedish_level', v_level,
            'lead_id', v_lead_id,
            'submission_id', v_submission_id
          ))
        )
        on conflict (event_key) do nothing;
      end if;
    end if;

    -- j. Close the form-fill attempt, if the browser reported one
    if v_attempt_key is not null then
      update public.form_attempts
         set submitted_at = coalesce(submitted_at, now()),
             submission_id = coalesce(submission_id, v_submission_id),
             last_activity_at = now()
       where attempt_key = v_attempt_key;
    end if;
  exception when others then
    update public.form_submissions
       set spam_reasons = array_append(spam_reasons, left('processing_error: ' || sqlerrm, 200))
     where id = v_submission_id;
  end;
end;
$$;

-- 6. record_consent: purpose may now be analytics or ads
create or replace function public.record_consent(p jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_state      text;
  v_key        uuid;
  v_visitor_id bigint;
  v_purpose    text;
begin
  if p is null or jsonb_typeof(p) <> 'object'
     or coalesce(private.jsonb_string(p, 'purpose'), '') not in ('analytics', 'ads') then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  v_purpose := private.jsonb_string(p, 'purpose');
  v_state := private.jsonb_string(p, 'state');
  if v_state is null or v_state not in ('granted', 'denied', 'withdrawn') then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  if private.hit_rate_limit('consent:' || coalesce(private.request_ip_prefix(), 'unknown'), 20) then
    return;
  end if;

  -- a refusal is logged without any identifier
  -- for ads the id is ad_key, a random id of its own; it goes in the visitor_key column
  if v_state in ('granted', 'withdrawn') then
    v_key := private.try_uuid(private.jsonb_string(p, case when v_purpose = 'ads' then 'ad_key' else 'visitor_key' end));
  end if;

  insert into public.consent_log (visitor_key, purpose, state, notice_version, mechanism, page_path)
  values (
    v_key, v_purpose, v_state,
    private.clip_text(private.jsonb_string(p, 'notice_version'), 40),
    'banner',
    private.clip_text(private.jsonb_string(p, 'page_path'), 300)
  );

  -- withdrawing consent removes what analytics collected about this browser
  if v_purpose = 'analytics' and v_state = 'withdrawn' and v_key is not null then
    select v.id into v_visitor_id from public.visitors v where v.visitor_key = v_key;
    if v_visitor_id is not null then
      delete from public.events where visitor_id = v_visitor_id and origin = 'browser';
      -- the browser rows are gone, so this only reaches server and admin rows
      update public.events set session_key = null
       where visitor_id = v_visitor_id and session_key is not null;
      delete from public.form_attempts where visitor_id = v_visitor_id;
      -- session, form-attempt and GA identifiers on form submissions were collected under the same consent
      update public.form_submissions
         set session_key = null, attempt_key = null, ga_client_id = null, ga_session_id = null
       where visitor_id = v_visitor_id
         and (session_key is not null or attempt_key is not null
              or ga_client_id is not null or ga_session_id is not null);
      -- GA identifiers and the session key saved on checkout attempts were collected under the same consent
      update public.checkout_attempts
         set analytics_consent = false, ga_client_id = null, ga_session_id = null, session_key = null
       where visitor_id = v_visitor_id
         and (analytics_consent or ga_client_id is not null or ga_session_id is not null
              or session_key is not null);
      delete from public.visitors where id = v_visitor_id;
    end if;
  end if;

  -- withdrawing ad consent removes the ad identifiers and the IP address kept with submissions
  if v_purpose = 'ads' and v_state = 'withdrawn' and v_key is not null then
    update public.form_submissions
       set ads_consent = false, ad_ids = '{}', client_ip = null, ad_key = null
     where ad_key = v_key;
  end if;
end;
$$;

-- 7. the full IP address is kept for 7 days at most
create or replace function private.purge_client_ips()
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.form_submissions
     set client_ip = null
   where client_ip is not null
     and created_at < now() - interval '7 days';
end;
$$;

select cron.schedule('purge-client-ips', '23 3 * * *', 'select private.purge_client_ips()');

-- 8. permissions: the new private functions are not callable from the API
-- (submit_form and record_consent keep the grants they already have)
revoke execute on function private.request_ip() from public, anon, authenticated;
revoke execute on function private.clean_ad_ids(jsonb) from public, anon, authenticated;
revoke execute on function private.purge_client_ips() from public, anon, authenticated;
