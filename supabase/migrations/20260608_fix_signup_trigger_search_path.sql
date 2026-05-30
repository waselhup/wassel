-- ═══════════════════════════════════════════
-- P0 FIX — New-user signup was failing in production with
-- "500: Database error saving new user".
--
-- ROOT CAUSE
-- ----------
-- Three AFTER INSERT triggers fire on auth.users:
--   on_auth_user_created          -> handle_new_user()      (creates profiles row)
--   on_auth_user_created_grant_tokens -> grant_signup_tokens()  (seeds token ledger)
--   on_auth_user_signup_event     -> log_signup_event()     (signup funnel event)
--
-- Supabase Auth (GoTrue) executes these SECURITY DEFINER trigger functions with
-- an EMPTY search_path. grant_signup_tokens() and log_signup_event() referenced
-- their tables UNqualified (user_tokens, token_transactions, user_subscriptions,
-- signup_events), so under the empty search_path they resolved to nothing and
-- threw `ERROR: relation "user_tokens" does not exist`.
--
-- grant_signup_tokens() has NO exception guard, so that error aborted the whole
-- auth.users INSERT transaction -> every signup (email + LinkedIn OAuth) returned
-- a 500. (handle_new_user() survived only because it already qualifies
-- public.profiles; log_signup_event() never broke signup because of its
-- EXCEPTION WHEN OTHERS guard, but it silently logged nothing.)
--
-- Confirmed by Supabase advisor: function_search_path_mutable on grant_signup_tokens.
--
-- FIX
-- ---
-- Pin `SET search_path = public, pg_temp` on all three functions AND
-- schema-qualify every table reference (defense in depth). Welcome grant is
-- standardized to 10 tokens to match the profiles.token_balance default set in
-- 20260516_reduce_welcome_tokens.sql. Idempotent; existing users unaffected.
-- ═══════════════════════════════════════════

-- 1) Profile creator — already qualifies public.profiles; add pinned search_path.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url, token_balance, plan, is_banned, verified, created_at)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(TRIM(CONCAT(
        COALESCE(NEW.raw_user_meta_data->>'given_name', ''),
        ' ',
        COALESCE(NEW.raw_user_meta_data->>'family_name', '')
      )), ''),
      ''
    ),
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
      NULLIF(NEW.raw_user_meta_data->>'picture', ''),
      ''
    ),
    10,            -- welcome grant (matches profiles.token_balance default)
    'free',
    false,
    COALESCE((NEW.raw_user_meta_data->>'email_verified')::boolean, false),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = COALESCE(NULLIF(EXCLUDED.full_name, ''),  public.profiles.full_name),
    email      = COALESCE(EXCLUDED.email, public.profiles.email),
    avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), public.profiles.avatar_url);
  RETURN NEW;
END;
$function$;

-- 2) Token-ledger seeder — THE function that was aborting signup.
--    Pinned search_path + schema-qualified tables + a guard so a future ledger
--    hiccup can never again take down auth.
CREATE OR REPLACE FUNCTION public.grant_signup_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.user_tokens (user_id, balance, total_purchased)
  VALUES (NEW.id, 10, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- NOTE: token_transactions has no balance_after column (the drifted live
  -- function referenced one, which threw 42703 and was swallowed by the guard
  -- below). Insert only the columns that exist.
  INSERT INTO public.token_transactions (user_id, amount, type, description)
  VALUES (NEW.id, 10, 'free_signup', 'Welcome bonus - Trial plan');

  INSERT INTO public.user_subscriptions (user_id, plan_id, billing_cycle, status, current_period_start)
  VALUES (NEW.id, 'free', 'free', 'active', NOW())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block signup if the ledger seed fails; profiles.token_balance still
  -- grants the welcome tokens, and token-consumption.ts falls back to it.
  RAISE WARNING 'grant_signup_tokens failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- 3) Signup funnel logger — add pinned search_path + qualify table (already guarded).
CREATE OR REPLACE FUNCTION public.log_signup_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.signup_events (user_id, email, event_type, metadata)
  VALUES (NEW.id, NEW.email, 'signup_started', jsonb_build_object('provider', NEW.raw_app_meta_data->>'provider'));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;
