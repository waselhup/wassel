-- Reduce welcome tokens from 100 to 10 (B.13)
-- Existing users keep their current balance. Only new signups affected.

ALTER TABLE public.profiles
  ALTER COLUMN token_balance SET DEFAULT 10;

-- Note: handle_new_user() trigger does NOT explicitly set token_balance,
-- so the new column default (10) is what new auth.users get.
