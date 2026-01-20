# Aura-Match Architecture

## Overview

Aura-Match is an internship allocation platform that matches students with companies through a backend-authoritative system. The frontend is a **thin client** that displays state and captures user input without implementing business logic.

---

## Core Principles

### 1. Thin Client

The frontend:
- Displays data from the backend
- Captures and forwards user input
- Validates data **shape only** (via Zod)
- Never computes business outcomes
- Never enforces business rules

The backend:
- Owns all business logic
- Decides match outcomes, offer validity, deadlines
- Computes verification status
- Enforces intake limits and grace periods

### 2. JWT-Only Authentication

**Model:**
- Backend issues ONE short-lived JWT
- JWT is stored in `localStorage` as `aura_access_token`
- JWT expiry returns HTTP 401
- Frontend clears token and redirects to `/login`
- User must fully re-authenticate

**Prohibited:**
- Refresh tokens
- Silent renewal
- Background token refresh
- Retry loops on 401

### 3. Single Source of Truth

**`/auth/me`** is the ONLY source of user state:
- Called on app mount
- Called on tab focus
- Called after any auth mutation (login, register, OTP verify)
- Response determines `isAuthenticated`, `isFullyVerified`

**Login functions return `void`:**
- `login()` stores JWT, returns nothing
- `register()` stores JWT, returns nothing
- `handleOAuthCallback()` stores JWT, returns nothing
- User state is hydrated by `refreshUser()` calling `/auth/me`

---

## System Architecture

```
┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │
│  React Client   │◄───────►│  Backend API    │
│  (Thin Client)  │  HTTPS  │  (Authority)    │
│                 │         │                 │
└─────────────────┘         └─────────────────┘
        │                           │
        │ JWT Only                  │
        │ No Business Logic         │ All Business Logic
        │ Shape Validation          │ Data Validation
        │                           │ Matching Engine
        │                           │ Offer Lifecycle
        │                           │ Intake Enforcement
```

---

## User Types

### Student
- Uploads resume (local file or Google Drive)
- Confirms extracted skills
- Sets preferences (location, domain, salary)
- Receives match results
- Accepts/declines offers

### Company
- Creates job postings with requirements
- Reviews matched candidates
- Extends offers
- Manages intake limits

### System (Backend)
- Runs matching algorithm
- Enforces offer deadlines
- Manages grace periods
- Auto-refills slots on decline
- Enforces intake caps

---

## State Management

### UIContext (Students)
- Owns student user state
- Hydrates from `/auth/me`
- Provides auth actions (login, logout, OTP verify)
- Exposes derived state: `isAuthenticated`, `isFullyVerified`

### CompanyContext
- Owns company user state
- Hydrates from `/company/me`
- Provides company-specific auth actions

### Route Guards
- `FlowGuard` - Student route protection based on onboarding step
- `CompanyFlowGuard` - Company route protection

Guards read from context hydrated state. They never check localStorage directly.

---

## Validation Strategy

**Zod schemas validate shape only:**
```typescript
// CORRECT - shape validation
const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
});

// WRONG - business logic in schema
const UserSchema = z.object({
  email: z.string().email().endsWith('@university.edu'),
});
```

**Frontend surfaces backend errors without masking:**
- If backend returns 409 (conflict), show the error
- If backend returns validation error, display it
- Never assume what makes data "valid"

---

## Error Handling

| HTTP Status | Frontend Behavior |
|-------------|-------------------|
| 401 | Clear token, redirect to `/login` |
| 403 | Display "access denied" message |
| 409 | Display conflict error from backend |
| 410 | Display "resource expired" message |
| 422 | Display validation errors from backend |
| 5xx | Display generic error, log for debugging |

---

## File Structure

```
src/
├── api/              # API call functions with Zod validation
├── components/       # Reusable UI components
├── context/          # UIContext, CompanyContext
├── hooks/            # Custom hooks (Google Drive picker)
├── pages/            # Route components
│   ├── student/      # Student-specific pages
│   └── company/      # Company-specific pages
├── schemas/          # Zod schemas for API responses
├── types/            # TypeScript type definitions
└── utils/            # API client, env config
```

---

## Security Boundaries

**Frontend allowed:**
- Store `aura_access_token` in localStorage
- Store optional onboarding flags
- Send Authorization header with requests

**Frontend prohibited:**
- Store refresh tokens
- Store user data persistently
- Make decisions about data validity
- Retry failed auth requests
- Talk to third-party OAuth providers directly
