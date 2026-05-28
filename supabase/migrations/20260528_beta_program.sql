BEGIN;

-- Promo codes for Beta program
CREATE TABLE public.promo_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  cohort          TEXT NOT NULL DEFAULT 'beta',
  granted_plan    TEXT NOT NULL,
  granted_tokens  INT NOT NULL DEFAULT 0,
  granted_months  INT NOT NULL DEFAULT 3,
  max_redemptions INT NOT NULL DEFAULT 1,
  redemptions     INT NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '60 days',
  created_by      UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX idx_promo_codes_cohort ON public.promo_codes(cohort);

-- Redemption history
CREATE TABLE public.promo_redemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id   UUID NOT NULL REFERENCES public.promo_codes(id),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  UNIQUE (promo_code_id, user_id)
);

-- Beta feedback
CREATE TABLE public.beta_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  pillar          TEXT NOT NULL,
  nps             INT NOT NULL CHECK (nps BETWEEN 0 AND 10),
  what_worked     TEXT,
  what_didnt      TEXT,
  user_email      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_beta_feedback_user ON public.beta_feedback(user_id);
CREATE INDEX idx_beta_feedback_pillar ON public.beta_feedback(pillar);
CREATE INDEX idx_beta_feedback_created ON public.beta_feedback(created_at DESC);

-- RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_codes_admin_only" ON public.promo_codes
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      'waselhup@gmail.com',
      'almodhih.1995@gmail.com',
      'alhashimali649@gmail.com'
    )
  );

CREATE POLICY "redemptions_own_or_admin" ON public.promo_redemptions
  FOR SELECT USING (
    user_id = auth.uid() OR
    auth.jwt() ->> 'email' IN (
      'waselhup@gmail.com',
      'almodhih.1995@gmail.com',
      'alhashimali649@gmail.com'
    )
  );

CREATE POLICY "redemptions_user_insert" ON public.promo_redemptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "feedback_user_insert" ON public.beta_feedback
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "feedback_admin_read" ON public.beta_feedback
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN (
      'waselhup@gmail.com',
      'almodhih.1995@gmail.com',
      'alhashimali649@gmail.com'
    )
  );

-- RPC: redeem promo code (atomic)
-- Uses INSERT ... ON CONFLICT upsert for wallet_bonus (matches foundation migration convention)
CREATE OR REPLACE FUNCTION public.redeem_promo_code(
  p_code TEXT,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promo RECORD;
  v_redemption_id UUID;
BEGIN
  SELECT * INTO v_promo
  FROM public.promo_codes
  WHERE code = upper(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_NOT_FOUND');
  END IF;

  IF v_promo.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_EXPIRED');
  END IF;

  IF v_promo.redemptions >= v_promo.max_redemptions THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_EXHAUSTED');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.promo_redemptions
    WHERE promo_code_id = v_promo.id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_REDEEMED');
  END IF;

  INSERT INTO public.promo_redemptions (promo_code_id, user_id, expires_at)
  VALUES (v_promo.id, p_user_id, NOW() + (v_promo.granted_months || ' months')::INTERVAL)
  RETURNING id INTO v_redemption_id;

  UPDATE public.promo_codes
  SET redemptions = redemptions + 1
  WHERE id = v_promo.id;

  IF v_promo.granted_tokens > 0 THEN
    INSERT INTO public.wallet_bonus (user_id, balance, expires_at, updated_at)
    VALUES (
      p_user_id,
      v_promo.granted_tokens,
      NOW() + (v_promo.granted_months || ' months')::INTERVAL,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE
      SET balance    = wallet_bonus.balance + v_promo.granted_tokens,
          expires_at = GREATEST(wallet_bonus.expires_at, NOW() + (v_promo.granted_months || ' months')::INTERVAL),
          updated_at = NOW();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'granted_tokens', v_promo.granted_tokens,
    'granted_plan', v_promo.granted_plan,
    'granted_months', v_promo.granted_months
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_promo_code TO authenticated;

COMMIT;
