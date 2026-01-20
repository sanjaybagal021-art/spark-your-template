# Environment Configuration

This document defines all environment variables used by the Aura-Match frontend.

## Variables

### VITE_API_URL

| Property | Value |
|----------|-------|
| **Required** | Yes (production), Optional (development) |
| **Purpose** | Backend API base URL for all API calls and OAuth redirects |
| **Format** | Full URL with `/api` suffix |
| **Example** | `https://api.aura-match.com/api` |

**Files where used:**
- `src/utils/env.ts` - Centralized validation and export
- `src/utils/api.ts` - Axios base URL configuration
- `src/api/auth.api.ts` - Google OAuth redirect construction
- `src/hooks/useGoogleDrivePicker.ts` - Google Drive OAuth flow

**Behavior:**
- **Production**: Application throws fatal error if not set
- **Development**: Falls back to `/api` (relative path for local proxy)

---

## Derived Configuration

The following are NOT environment variables but are derived from `VITE_API_URL`:

| Endpoint | Construction |
|----------|--------------|
| Google OAuth | `${VITE_API_URL}/auth/google?redirect_uri=...` |
| Google Drive Picker | `${VITE_API_URL}/oauth/google-drive/picker?redirect_uri=...` |
| All API calls | Axios baseURL set to `VITE_API_URL` |

---

## Production Deployment (Vercel)

1. Set `VITE_API_URL` in Vercel project settings
2. Redeploy

No other configuration required.

---

## Development

Create `.env` file in project root:

```env
VITE_API_URL=http://localhost:3001/api
```

Or use Vite proxy by omitting the variable (falls back to `/api`).

---

## Validation

The application validates environment on module load (`src/utils/env.ts`):

```typescript
if (isProd && !apiUrl) {
  throw new Error('FATAL: VITE_API_URL environment variable is required');
}
```

This ensures fail-fast behavior - no silent failures in production.
