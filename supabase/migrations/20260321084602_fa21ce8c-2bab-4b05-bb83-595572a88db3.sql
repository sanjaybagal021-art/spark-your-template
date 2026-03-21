
-- ═══════════════════════════════════════════════════════
-- LIVEBET — Complete Database Schema
-- ═══════════════════════════════════════════════════════

-- ── ENUM TYPES ──
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.kyc_status_enum AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TYPE public.account_status_enum AS ENUM ('active', 'restricted', 'suspended', 'under_review', 'blocked');

-- ── PROFILES ──
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text,
  username      text,
  phone         text,
  balance       numeric(12,2) NOT NULL DEFAULT 0,
  bonus_balance numeric(12,2) NOT NULL DEFAULT 0,
  kyc_level     smallint NOT NULL DEFAULT 0,
  kyc_status    text NOT NULL DEFAULT 'unverified',
  pan_number    text,
  aadhaar_number text,
  date_of_birth date,
  kyc_submitted_at timestamptz,
  kyc_reviewed_at  timestamptz,
  kyc_reject_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, balance, bonus_balance)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Player'), 1000, 0);
  -- Also create risk profile and referral record
  INSERT INTO public.user_risk_profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── USER ROLES ──
CREATE TABLE public.user_roles (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Admin can read all profiles for admin dashboard
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all profiles" ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- ── TRANSACTIONS ──
CREATE TABLE public.transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('deposit','withdrawal','bet_placed','bet_win','bet_refund','bonus')),
  amount        numeric(12,2) NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','pending','failed','cancelled')),
  balance_after numeric(12,2),
  currency      text NOT NULL DEFAULT 'INR',
  metadata      jsonb DEFAULT '{}',
  idempotency_key text UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own tx" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tx" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all tx" ON public.transactions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ── BETS ──
CREATE TABLE public.bets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id        text NOT NULL,
  match_title     text NOT NULL,
  market_name     text NOT NULL,
  selection_label text NOT NULL,
  odds            numeric(8,2) NOT NULL,
  stake           numeric(12,2) NOT NULL,
  potential_win   numeric(12,2) NOT NULL,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost','void','cashout')),
  profit_loss     numeric(12,2),
  placed_at       timestamptz NOT NULL DEFAULT now(),
  settled_at      timestamptz
);

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own bets" ON public.bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bets" ON public.bets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all bets" ON public.bets FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update bets" ON public.bets FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- ── PAYMENT METHODS ──
CREATE TABLE public.payment_methods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('upi','bank_account','card')),
  label       text NOT NULL,
  details     jsonb NOT NULL DEFAULT '{}',
  is_default  boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own methods" ON public.payment_methods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own methods" ON public.payment_methods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own methods" ON public.payment_methods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own methods" ON public.payment_methods FOR DELETE USING (auth.uid() = user_id);

-- ── NOTIFICATIONS ──
CREATE TABLE public.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text NOT NULL,
  title        text NOT NULL,
  message      text,
  read         boolean NOT NULL DEFAULT false,
  reference_id text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifs" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notifs" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own notifs" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- ── NOTIFICATION PREFERENCES ──
CREATE TABLE public.notification_preferences (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel  text NOT NULL CHECK (channel IN ('email','sms','in_app')),
  category text NOT NULL CHECK (category IN ('bet_results','promotions','odds_alerts','transactions','security')),
  enabled  boolean NOT NULL DEFAULT true,
  UNIQUE (user_id, channel, category)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own prefs" ON public.notification_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own prefs" ON public.notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own prefs" ON public.notification_preferences FOR UPDATE USING (auth.uid() = user_id);

-- ── KYC DOCUMENTS ──
CREATE TABLE public.kyc_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type      text NOT NULL CHECK (doc_type IN ('aadhaar','passport','driving_license','pan','address_proof','selfie')),
  file_url      text NOT NULL,
  file_name     text NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reject_reason text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own docs" ON public.kyc_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own docs" ON public.kyc_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all docs" ON public.kyc_documents FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update docs" ON public.kyc_documents FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- ── USER DEVICE SESSIONS ──
CREATE TABLE public.user_device_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  user_agent         text,
  screen_resolution  text,
  timezone           text,
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_device_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own sessions" ON public.user_device_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sessions" ON public.user_device_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions" ON public.user_device_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sessions" ON public.user_device_sessions FOR DELETE USING (auth.uid() = user_id);

-- ── LOGIN EVENTS ──
CREATE TABLE public.login_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type         text NOT NULL,
  user_agent         text,
  device_fingerprint text,
  ip_address         text,
  is_new_device      boolean NOT NULL DEFAULT false,
  is_new_ip          boolean NOT NULL DEFAULT false,
  risk_flags         text[] NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own login events" ON public.login_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own login events" ON public.login_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── USER RISK PROFILES ──
CREATE TABLE public.user_risk_profiles (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_score             integer NOT NULL DEFAULT 0,
  risk_level             text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  account_status         text NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','restricted','suspended','under_review','blocked')),
  max_bet_override       numeric(12,2),
  blocked_markets        text[] NOT NULL DEFAULT '{}',
  bonuses_disabled       boolean NOT NULL DEFAULT false,
  withdrawal_delay_hours integer NOT NULL DEFAULT 0,
  flags                  text[] NOT NULL DEFAULT '{}',
  last_calculated_at     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_risk_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own risk" ON public.user_risk_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins read all risk" ON public.user_risk_profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update risk" ON public.user_risk_profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- ── AFFILIATES ──
CREATE TABLE public.affiliates (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code      text NOT NULL UNIQUE,
  name      text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read affiliates" ON public.affiliates FOR SELECT USING (true);

-- ── USER REFERRALS ──
CREATE TABLE public.user_referrals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_id  uuid REFERENCES public.affiliates(id),
  referral_code text,
  referred_by   uuid REFERENCES auth.users(id),
  source        text DEFAULT 'direct',
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  landing_url   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own referral" ON public.user_referrals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own referral" ON public.user_referrals FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── LINKED ACCOUNTS (Multi-account detection) ──
CREATE TABLE public.linked_accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_a        uuid NOT NULL REFERENCES auth.users(id),
  account_b        uuid NOT NULL REFERENCES auth.users(id),
  link_type        text NOT NULL CHECK (link_type IN ('same_device','same_ip','same_payment','same_kyc')),
  confidence_score numeric(3,2) NOT NULL DEFAULT 0,
  action_taken     text NOT NULL DEFAULT 'none',
  action_by        uuid REFERENCES auth.users(id),
  action_at        timestamptz,
  notes            text,
  detected_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read linked" ON public.linked_accounts FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update linked" ON public.linked_accounts FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- ── ACCOUNT RECOVERY REQUESTS ──
CREATE TABLE public.account_recovery_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  text NOT NULL,
  user_id     uuid REFERENCES auth.users(id),
  type        text NOT NULL DEFAULT 'manual_support',
  status      text NOT NULL DEFAULT 'pending',
  ip_address  text,
  notes       text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_recovery_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone insert recovery" ON public.account_recovery_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins read recovery" ON public.account_recovery_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update recovery" ON public.account_recovery_requests FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- ── MARKET SUSPENSIONS ──
CREATE TABLE public.market_suspensions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     text NOT NULL,
  market_name  text NOT NULL,
  reason       text,
  suspended_by uuid REFERENCES auth.users(id),
  suspended_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, market_name)
);

ALTER TABLE public.market_suspensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read suspensions" ON public.market_suspensions FOR SELECT USING (true);
CREATE POLICY "Admins manage suspensions" ON public.market_suspensions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ── BET LIMITS ──
CREATE TABLE public.bet_limits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_name text NOT NULL UNIQUE DEFAULT 'default',
  min_stake   numeric(12,2) NOT NULL DEFAULT 10,
  max_stake   numeric(12,2) NOT NULL DEFAULT 50000,
  max_win     numeric(12,2) NOT NULL DEFAULT 500000,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bet_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read limits" ON public.bet_limits FOR SELECT USING (true);
CREATE POLICY "Admins update limits" ON public.bet_limits FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Insert default limits
INSERT INTO public.bet_limits (market_name, min_stake, max_stake, max_win) VALUES ('default', 10, 50000, 500000);

-- ── LOCKED FUNDS ──
CREATE TABLE public.locked_funds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      numeric(12,2) NOT NULL,
  reason      text NOT NULL,
  status      text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked','released')),
  locked_at   timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  notes       text
);

ALTER TABLE public.locked_funds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own locks" ON public.locked_funds FOR SELECT USING (auth.uid() = user_id);

-- ── WALLET BALANCES (view) ──
CREATE TABLE public.wallet_balances (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_balance numeric(12,2) NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own wallet" ON public.wallet_balances FOR SELECT USING (auth.uid() = user_id);

-- ── USER BEHAVIOR EVENTS ──
CREATE TABLE public.user_behavior_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  event_data  jsonb DEFAULT '{}',
  page_path   text,
  session_id  text,
  duration_ms integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_behavior_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own events" ON public.user_behavior_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read events" ON public.user_behavior_events FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════
-- WALLET FUNCTIONS (Atomic Operations)
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.wallet_get_balance(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT balance INTO v_balance FROM profiles WHERE user_id = p_user_id;
  RETURN jsonb_build_object('balance', COALESCE(v_balance, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_credit(
  p_user_id uuid, p_amount numeric, p_type text, p_description text, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_existing uuid;
BEGIN
  -- Idempotency check
  SELECT id INTO v_existing FROM transactions WHERE idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    SELECT balance INTO v_balance FROM profiles WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'balance', v_balance, 'duplicate', true);
  END IF;

  UPDATE profiles SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;

  INSERT INTO transactions (user_id, type, amount, description, status, balance_after, idempotency_key)
  VALUES (p_user_id, p_type, p_amount, p_description, 'completed', v_balance, p_idempotency_key);

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_debit(
  p_user_id uuid, p_amount numeric, p_type text, p_description text, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM transactions WHERE idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    SELECT balance INTO v_balance FROM profiles WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'balance', v_balance, 'duplicate', true);
  END IF;

  SELECT balance INTO v_balance FROM profiles WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance');
  END IF;

  UPDATE profiles SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;

  INSERT INTO transactions (user_id, type, amount, description, status, balance_after, idempotency_key)
  VALUES (p_user_id, p_type, -p_amount, p_description, 'completed', v_balance, p_idempotency_key);

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_withdraw_with_checks(
  p_user_id uuid, p_amount numeric, p_description text, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_kyc_level smallint;
  v_risk_level text;
  v_account_status text;
  v_withdrawn_today numeric;
  v_daily_limit numeric;
  v_result_status text := 'completed';
BEGIN
  -- Get profile
  SELECT balance, kyc_level INTO v_balance, v_kyc_level
  FROM profiles WHERE user_id = p_user_id FOR UPDATE;

  -- KYC check
  IF v_kyc_level = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Complete KYC verification to withdraw');
  END IF;

  -- Balance check
  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Risk check
  SELECT risk_level, account_status INTO v_risk_level, v_account_status
  FROM user_risk_profiles WHERE user_id = p_user_id;

  IF v_account_status IN ('suspended', 'blocked') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is ' || v_account_status);
  END IF;

  -- Daily limit check for KYC level 1
  IF v_kyc_level = 1 THEN
    v_daily_limit := 10000;
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_withdrawn_today
    FROM transactions
    WHERE user_id = p_user_id AND type = 'withdrawal'
      AND created_at >= date_trunc('day', now());

    IF v_withdrawn_today + p_amount > v_daily_limit THEN
      RETURN jsonb_build_object('success', false, 'error', 'Daily withdrawal limit exceeded. Upgrade KYC.');
    END IF;
  END IF;

  -- High risk = pending review
  IF v_risk_level IN ('high', 'critical') OR v_account_status = 'under_review' THEN
    v_result_status := 'pending';
  END IF;

  -- Debit
  UPDATE profiles SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;

  INSERT INTO transactions (user_id, type, amount, description, status, balance_after, idempotency_key)
  VALUES (p_user_id, 'withdrawal', -p_amount, p_description, v_result_status, v_balance, p_idempotency_key);

  RETURN jsonb_build_object('success', true, 'balance', v_balance, 'status', v_result_status);
END;
$$;

-- ═══════════════════════════════════════════════════════
-- PLACE BET (Atomic)
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.place_bet_atomic(
  p_match_id text, p_match_title text, p_market_name text,
  p_selection_label text, p_odds numeric, p_stake numeric, p_potential_win numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance numeric;
  v_limits record;
  v_bet_id uuid;
  v_suspended boolean;
BEGIN
  -- Check market suspension
  SELECT EXISTS (
    SELECT 1 FROM market_suspensions WHERE match_id = p_match_id AND market_name = p_market_name
  ) INTO v_suspended;

  IF v_suspended THEN
    RETURN jsonb_build_object('error', 'market_suspended');
  END IF;

  -- Get limits
  SELECT min_stake, max_stake, max_win INTO v_limits FROM bet_limits WHERE market_name = 'default';

  IF p_stake < COALESCE(v_limits.min_stake, 10) THEN
    RETURN jsonb_build_object('error', 'stake_too_low', 'min_stake', v_limits.min_stake);
  END IF;
  IF p_stake > COALESCE(v_limits.max_stake, 50000) THEN
    RETURN jsonb_build_object('error', 'stake_too_high', 'max_stake', v_limits.max_stake);
  END IF;
  IF p_potential_win > COALESCE(v_limits.max_win, 500000) THEN
    RETURN jsonb_build_object('error', 'max_win_exceeded', 'max_win', v_limits.max_win);
  END IF;

  -- Lock and check balance
  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance < p_stake THEN
    RETURN jsonb_build_object('error', 'insufficient_balance');
  END IF;

  -- Debit
  UPDATE profiles SET balance = balance - p_stake, updated_at = now() WHERE user_id = v_user_id;

  -- Insert bet
  INSERT INTO bets (user_id, match_id, match_title, market_name, selection_label, odds, stake, potential_win)
  VALUES (v_user_id, p_match_id, p_match_title, p_market_name, p_selection_label, p_odds, p_stake, p_potential_win)
  RETURNING id INTO v_bet_id;

  -- Record transaction
  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id;
  INSERT INTO transactions (user_id, type, amount, description, status, balance_after)
  VALUES (v_user_id, 'bet_placed', -p_stake, p_match_title || ' · ' || p_selection_label, 'completed', v_balance);

  RETURN jsonb_build_object('success', true, 'bet_id', v_bet_id, 'balance', v_balance);
END;
$$;

-- ═══════════════════════════════════════════════════════
-- MULTI-ACCOUNT DETECTION
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.detect_multi_accounts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Detect same device fingerprint
  INSERT INTO linked_accounts (account_a, account_b, link_type, confidence_score)
  SELECT DISTINCT a.user_id, b.user_id, 'same_device', 0.85
  FROM user_device_sessions a
  JOIN user_device_sessions b ON a.device_fingerprint = b.device_fingerprint AND a.user_id < b.user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM linked_accounts la
    WHERE la.account_a = a.user_id AND la.account_b = b.user_id AND la.link_type = 'same_device'
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('new_links', v_count);
END;
$$;

-- ═══════════════════════════════════════════════════════
-- KYC STORAGE BUCKET
-- ═══════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false);

CREATE POLICY "Users upload own kyc docs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own kyc docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read all kyc docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════
-- ENABLE REALTIME
-- ═══════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_suspensions;
