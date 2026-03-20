

## Plan: Enhanced User Behavior Tracking, Multi-Account Detection, Notification Preferences & Account Recovery

This plan adds four systems to your betting platform based on your requirements.

---

### 1. Enhanced User Profile — Behavior Tracking Fields

**New migration** to create a `user_device_sessions` table and add hidden tracking columns to `user_risk_profiles`:

- **`user_device_sessions`** table: `id`, `user_id`, `device_fingerprint`, `ip_address`, `user_agent`, `last_seen_at`, `created_at`
- **Add columns to `user_risk_profiles`**: `betting_behavior_score` (numeric), `fraud_flags` (text[]), `ip_history` (text[])
- RLS: users can insert their own device sessions; admins can read all; users cannot read raw tracking data

A client-side hook (`useDeviceTracking`) will capture a basic device fingerprint (screen size, timezone, user agent hash) and POST it on login/app load.

---

### 2. Multi-Account Detection System

**New `linked_accounts` table**: `id`, `account_a`, `account_b`, `link_type` (enum: `same_ip`, `same_device`, `same_payment`, `same_kyc`), `confidence_score`, `detected_at`, `action_taken` (enum: `none`, `flagged`, `frozen`, `banned`)

**New DB function `detect_multi_accounts()`** (SECURITY DEFINER, callable by admins):
- Queries `user_device_sessions` for matching device fingerprints across different users
- Queries `user_device_sessions` for matching IPs across different users
- Queries payment methods for matching details across users
- Queries profiles for matching PAN/Aadhaar across users
- Inserts results into `linked_accounts`
- Auto-updates `user_risk_profiles` flags and account_status when matches found

**Admin UI tab** ("Multi-Account") on AdminDashboard:
- Shows linked account pairs with link type, confidence, and action taken
- Allows admin to freeze funds, ban accounts, or dismiss false positives
- "Run Detection" button to trigger the function

---

### 3. Notification Preferences (Persistent)

**New `notification_preferences` table**: `id`, `user_id`, `channel` (enum: `email`, `sms`, `in_app`), `category` (enum: `bet_results`, `promotions`, `odds_alerts`, `transactions`, `security`), `enabled` (boolean)

- Auto-created for new users via the existing signup trigger (all `in_app` enabled by default, `email` for security only)
- Profile page notification toggles will read/write from this table instead of being static
- `useNotificationPreferences` hook for CRUD

---

### 4. Account Recovery System

**New `account_recovery_requests` table**: `id`, `user_id`, `type` (enum: `password_reset`, `manual_support`), `status` (enum: `pending`, `verified`, `completed`, `rejected`), `ip_address`, `created_at`, `resolved_at`, `resolved_by`, `notes`

- Password reset already works via Supabase Auth OTP/email — this table logs all recovery attempts for audit
- Add a "Request Manual Recovery" flow on the auth page for locked-out users
- Admin "Recovery Requests" tab to review and resolve manual support requests
- All recovery attempts logged with IP for fraud monitoring

---

### Technical Details

**Migration file** — Single new migration with:
- `user_device_sessions` table + RLS
- `linked_accounts` table + RLS (admin-only read/write)
- `notification_preferences` table + RLS (user reads/writes own)
- `account_recovery_requests` table + RLS
- `detect_multi_accounts()` function
- Update `handle_new_user()` to also create default notification preferences

**New/modified files:**
- `supabase/migrations/[timestamp]_behavior_tracking.sql` — all schema changes
- `src/hooks/useDeviceTracking.ts` — fingerprint capture + session logging
- `src/hooks/useNotificationPreferences.ts` — preference CRUD
- `src/hooks/useAccountRecovery.ts` — recovery request submission
- `src/components/admin/AdminMultiAccountDetection.tsx` — detection UI
- `src/components/admin/AdminRecoveryRequests.tsx` — recovery review UI
- `src/pages/AdminDashboard.tsx` — add two new tabs
- `src/pages/Profile.tsx` — wire notification toggles to DB
- `src/pages/auth/AuthPage.tsx` — add manual recovery request option

**Existing patterns preserved:** Uses `has_role()` for admin RLS, `SECURITY DEFINER` for cross-user queries, real-time subscriptions for notifications, same UI styling conventions.

