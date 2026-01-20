# API Contract

This document defines all API endpoints called by the Aura-Match frontend. Backend implementation must match these contracts exactly.

**Base URL**: Configured via `VITE_API_URL` (includes `/api` suffix)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Student APIs](#student-apis)
3. [Resume Management](#resume-management)
4. [Offers](#offers)
5. [Reviews](#reviews)
6. [Application Lifecycle](#application-lifecycle)
7. [Matching (Student)](#matching-student)
8. [Company Authentication](#company-authentication)
9. [Company Jobs](#company-jobs)
10. [Company Matching](#company-matching)
11. [OAuth Flows](#oauth-flows)
12. [Error Codes](#error-codes)
13. [Business Logic Reference](#business-logic-reference)

---

## Authentication

### POST /auth/login

Login with email and password.

**Request:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "access_token": "string"
}
```

**Errors:**
- `401`: Invalid credentials

---

### POST /auth/register

Register a new student account.

**Request:**
```json
{
  "email": "string",
  "password": "string",
  "phone": "string",
  "role": "student"
}
```

**Response:**
```json
{
  "success": true,
  "access_token": "string"
}
```

**Errors:**
- `409`: Email already registered

---

### GET /auth/me

Get current authenticated user. **Single source of truth for user state.**

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "phone": "string | null",
  "role": "student | company",
  "location": { "lat": "number", "lng": "number" } | null,
  "skills": ["string"],
  "resume": "string | null",
  "preferences": {
    "domains": ["string"],
    "workStyle": "remote | hybrid | onsite",
    "distance": "number",
    "stipend": "number | null"
  } | null,
  "status": "string",
  "emailVerified": "boolean",
  "phoneVerified": "boolean",
  "matchResult": {
    "companyId": "string",
    "companyName": "string",
    "score": "number",
    "explanation": ["string"],
    "status": "matched | waitlist | rejected"
  } | null,
  "onboardingComplete": "boolean",
  "createdAt": "string (ISO 8601)"
}
```

**Errors:**
- `401`: Token expired or invalid

---

### POST /auth/logout

Invalidate current session.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK` (body ignored)

---

### POST /auth/request-email-otp

Request OTP for email verification.

**Request:**
```json
{
  "email": "string"
}
```

**Response:**
```json
{
  "message": "string",
  "expiresIn": "number (optional)"
}
```

---

### POST /auth/verify-email-otp

Verify email with OTP.

**Request:**
```json
{
  "email": "string",
  "otp": "string"
}
```

**Response:**
```json
{
  "message": "string",
  "success": true
}
```

**Errors:**
- `400`: Invalid or expired OTP

---

### POST /auth/request-phone-otp

Request OTP for phone verification.

**Request:**
```json
{
  "phone": "string"
}
```

**Response:**
```json
{
  "message": "string",
  "expiresIn": "number (optional)"
}
```

---

### POST /auth/verify-phone-otp

Verify phone with OTP.

**Request:**
```json
{
  "phone": "string",
  "otp": "string"
}
```

**Response:**
```json
{
  "message": "string",
  "success": true
}
```

**Errors:**
- `400`: Invalid or expired OTP

---

## Student APIs

### GET /student/profile

Get student profile.

**Headers:** `Authorization: Bearer <token>`

**Response:** Same as `/auth/me`

---

### PATCH /student/profile

Update student profile.

**Headers:** `Authorization: Bearer <token>`

**Request:** Partial user object

**Response:** Updated user object

---

### POST /student/skills/extract

Extract skills from resume.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "resumeId": "string"
}
```

**Response:**
```json
{
  "skills": ["string"]
}
```

---

### POST /student/skills/confirm

Confirm extracted skills.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "skills": ["string"]
}
```

**Response:**
```json
{
  "skills": ["string"]
}
```

---

### POST /student/preferences

Update student preferences.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "domains": ["string"],
  "workStyle": "remote | hybrid | onsite",
  "distance": "number",
  "stipend": "number | null"
}
```

**Response:**
```json
{
  "success": true
}
```

---

### GET /student/domains

Get available domains for preference selection.

**Response:**
```json
{
  "domains": ["string"]
}
```

---

## Resume Management

### GET /api/resumes/history

Get all resume versions (current and archived).

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "currentVersion": {
    "resumeId": "string",
    "version": "number",
    "fileName": "string",
    "uploadedAt": "string (ISO 8601)",
    "status": "active | archived | pending_extraction",
    "extractedSkills": ["string"],
    "skillsConfirmed": "boolean",
    "fileSize": "number"
  } | null,
  "archivedVersions": [ResumeVersion]
}
```

---

### POST /api/resumes/upload

Upload new resume. Backend archives current version.

**Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`

**Request:** Form data with `file` field

**Response:** `ResumeVersion`

---

### POST /api/resumes/upload/gdrive

Upload resume from Google Drive.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "fileId": "string",
  "fileName": "string",
  "mimeType": "string"
}
```

**Response:** `ResumeVersion`

---

### POST /api/resumes/:resumeId/extract

Trigger skill extraction (AI/NLP on backend).

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "skills": ["string"]
}
```

---

### POST /api/resumes/:resumeId/confirm

Confirm/modify extracted skills.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "skills": ["string"]
}
```

**Response:** `ResumeVersion`

---

### GET /api/matches/:matchId/resume-version

Get resume version used for a specific match.

**Response:**
```json
{
  "version": "number",
  "uploadedAt": "string (ISO 8601)"
}
```

---

## Offers

### GET /api/offers

Get all offers for current student.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
[
  {
    "offerId": "string",
    "matchId": "string",
    "jobId": "string",
    "companyId": "string",
    "companyName": "string",
    "roleTitle": "string",
    "location": "string",
    "matchScore": "number",
    "status": "pending | accepted | declined | expired | withdrawn | superseded",
    "createdAt": "string (ISO 8601)",
    "decisionDeadline": "string (ISO 8601)",
    "decidedAt": "string | null",
    "resumeVersionUsed": "number",
    "explanation": ["string"],
    "systemNote": "string | null"
  }
]
```

---

### GET /api/offers/pending

Get only pending offers.

**Response:** Same as `/api/offers` (filtered)

---

### GET /api/offers/:offerId

Get specific offer.

**Response:** Single `Offer` object

**Errors:**
- `404`: Offer not found

---

### POST /api/offers/:offerId/accept

Accept an offer.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "offer": Offer
}
```

**Errors:**
- `400`: Offer expired or already decided
- `409`: Conflict (e.g., already accepted another offer)

**Backend Behavior:**
- Validates offer is still pending
- Validates within grace period
- Marks other pending offers as superseded
- Records decision timestamp

---

### POST /api/offers/:offerId/decline

Decline an offer.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "offer": Offer
}
```

**Errors:**
- `400`: Offer already decided

**Backend Behavior:**
- Validates offer is still pending
- Records decision timestamp
- Triggers auto-refill if applicable (see Business Logic)

---

## Reviews

### GET /api/reviews

Get all review requests for current user.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
[
  {
    "reviewId": "string",
    "matchId": "string",
    "reason": "skills_misinterpreted | resume_context_ignored | domain_mismatch | location_logic_incorrect | other",
    "otherReason": "string | null",
    "createdAt": "string (ISO 8601)",
    "status": "submitted | under_review | resolved",
    "resolvedAt": "string | null",
    "resolution": "string | null"
  }
]
```

---

### GET /api/reviews/match/:matchId

Get review for specific match.

**Response:** `ReviewRequest | null`

**Errors:**
- `404`: No review exists (returns null to frontend)

---

### GET /api/reviews/can-request/:matchId

Check if review can be requested.

**Response:**
```json
{
  "canRequest": "boolean"
}
```

---

### POST /api/reviews/flag

Submit flag request with predefined reason.

**Request:**
```json
{
  "matchId": "string",
  "reason": "skills_misinterpreted | resume_context_ignored | domain_mismatch | location_logic_incorrect | other",
  "otherReason": "string | null"
}
```

**Response:** `ReviewRequest`

**Errors:**
- `409`: Review already exists for this match

---

### POST /api/reviews/manual

Submit manual review request.

**Request:**
```json
{
  "matchId": "string",
  "reason": "string"
}
```

**Response:** `ReviewRequest`

---

### GET /api/reviews/:reviewId

Get specific review status.

**Response:** `ReviewRequest | null`

---

## Application Lifecycle

### GET /api/application/state

Get current application state.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "status": "active | withdrawn | cooldown | completed",
  "withdrawnAt": "string | null",
  "cooldownEndsAt": "string | null",
  "cooldownDays": "number",
  "canReapply": "boolean",
  "withdrawalReason": "string | null"
}
```

---

### GET /api/application/can-withdraw

Check if withdrawal is allowed.

**Response:**
```json
{
  "canWithdraw": "boolean",
  "reason": "string | null"
}
```

---

### POST /api/application/withdraw

Withdraw application.

**Request:**
```json
{
  "reason": "string"
}
```

**Response:** `ApplicationState`

**Errors:**
- `400`: Cannot withdraw (e.g., accepted offer exists)
- `409`: Already withdrawn

**Backend Behavior:**
- Sets cooldown period
- Records withdrawal reason and timestamp

---

### POST /api/application/reapply

Reapply after cooldown.

**Response:** `ApplicationState`

**Errors:**
- `400`: Cooldown not complete

---

## Matching (Student)

### POST /student/match/run

Trigger match computation.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "companyId": "string",
  "companyName": "string",
  "score": "number",
  "explanation": ["string"],
  "status": "matched | waitlist | rejected"
}
```

---

### GET /student/match/status

Get current match status.

**Response:** `MatchResult | null`

---

### POST /student/match/accept

Accept current match.

**Response:**
```json
{
  "success": "boolean"
}
```

---

### POST /student/match/decline

Decline current match.

**Response:**
```json
{
  "success": "boolean"
}
```

---

## Company Authentication

### POST /company/auth/register

Register company account.

**Request:**
```json
{
  "email": "string",
  "password": "string",
  "companyName": "string"
}
```

**Response:**
```json
{
  "message": "string"
}
```

---

### POST /company/auth/login

Login company.

**Request:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "access_token": "string"
}
```

---

### GET /company/auth/me

Get current company session. **Single source of truth for company state.**

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": "string",
  "companyName": "string",
  "email": "string",
  "contactPerson": "string (optional)",
  "gstNumber": "string (optional)",
  "emailVerified": "boolean",
  "status": "profile-pending | active",
  "createdAt": "string (ISO 8601)"
}
```

---

### POST /company/auth/otp/request

Request email OTP for company.

**Request:**
```json
{
  "email": "string"
}
```

**Response:**
```json
{
  "message": "string"
}
```

---

### POST /company/auth/otp/verify

Verify company email OTP.

**Request:**
```json
{
  "email": "string",
  "otp": "string"
}
```

**Response:**
```json
{
  "message": "string"
}
```

---

### POST /company/verify/gst

Verify company GST number.

**Request:**
```json
{
  "gstNumber": "string"
}
```

**Response:**
```json
{
  "message": "string"
}
```

---

### PATCH /company/profile

Update company profile.

**Request:** Partial company object

**Response:** `CompanyUser`

---

### POST /company/auth/logout

Logout company.

**Response:** `200 OK`

---

## Company Jobs

### POST /api/company/jobs

Create new job (draft status).

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "companyId": "string",
  "title": "string",
  "requiredSkills": ["string"],
  "location": {
    "lat": "number",
    "lng": "number",
    "label": "string"
  },
  "intake": "number",
  "stipend": "number (optional)",
  "perks": "string (optional)",
  "originalJD": "string"
}
```

**Response:**
```json
{
  "id": "string",
  "companyId": "string",
  "title": "string",
  "requiredSkills": ["string"],
  "location": { "lat": "number", "lng": "number", "label": "string" },
  "intake": "number",
  "stipend": "number (optional)",
  "perks": "string (optional)",
  "originalJD": "string",
  "status": "draft | processing | matched | closed",
  "createdAt": "string (ISO 8601)",
  "processedAt": "string (optional)",
  "closedAt": "string (optional)"
}
```

---

### GET /api/company/jobs

Get all jobs for company.

**Query:** `companyId=string`

**Response:** `CompanyJob[]`

---

### GET /api/company/jobs/:jobId

Get specific job.

**Response:** `CompanyJob`

**Errors:**
- `404`: Job not found

---

### POST /api/company/jobs/:jobId/process

Submit job for NLP processing.

**Response:**
```json
{
  "success": "boolean"
}
```

**Backend Behavior:**
- Validates job is in draft status
- Runs NLP/AI skill extraction on JD
- Transitions to 'processing' then 'active'

---

### DELETE /api/company/jobs/:jobId

Delete job (if policy allows).

**Response:** `204 No Content`

**Errors:**
- `403`: Deletion not allowed (e.g., active matches exist)

---

## Company Matching

### POST /company/jobs/:jobId/match

Run matching for a job.

**Response:**
```json
[
  {
    "matchId": "string",
    "studentId": "string",
    "score": "number",
    "skills": ["string"],
    "explanation": ["string"],
    "status": "proposed | approved | rejected"
  }
]
```

---

### GET /company/jobs/:jobId/matches

Get matches for a job.

**Response:** `MatchProposal[]`

---

### POST /company/matches/:matchId/action

Perform action on match.

**Request:**
```json
{
  "action": "approve | reject | hold"
}
```

**Response:** `MatchProposal`

---

### GET /company/jobs/:jobId/summary

Get job match summary.

**Query:** `intake=number`

**Response:**
```json
{
  "totalMatches": "number",
  "approvedCount": "number",
  "pendingCount": "number",
  "rejectedCount": "number",
  "intakeFilled": "boolean"
}
```

---

### GET /company/matches/:matchId

Get specific match.

**Response:** `MatchProposal | null`

---

## OAuth Flows

### GET /auth/google

Initiate Google OAuth.

**Query:** `redirect_uri=string`

**Behavior:**
1. Backend redirects to Google consent screen
2. After consent, Google redirects to backend
3. Backend creates/updates user, issues JWT
4. Backend redirects to `redirect_uri?token=<jwt>`

Frontend calls this URL directly via `window.location.href`.

---

### GET /oauth/google-drive/picker

Initiate Google Drive picker OAuth.

**Query:** `redirect_uri=string`

**Behavior:**
1. Backend requests `drive.file` scope
2. After consent, backend redirects with file selection capability
3. User selects file, backend receives file reference
4. Backend redirects to `redirect_uri` with file info

---

## Error Codes

| Code | Meaning | Frontend Behavior |
|------|---------|-------------------|
| `400` | Bad request / Validation error | Display error message |
| `401` | Unauthorized / Token expired | Clear token, redirect to login |
| `403` | Forbidden | Display access denied |
| `404` | Not found | Handle gracefully (null response) |
| `409` | Conflict | Display conflict message |
| `410` | Gone / Expired | Display expiration message |
| `422` | Validation failed | Display field errors |
| `5xx` | Server error | Display generic error |

---

## Business Logic Reference

### Offer Lifecycle

```
┌─────────┐     Company      ┌─────────┐
│ Created │────approves────►│ Pending │
└─────────┘                  └────┬────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
            ▼                     ▼                     ▼
     ┌──────────┐          ┌──────────┐          ┌──────────┐
     │ Accepted │          │ Declined │          │ Expired  │
     └──────────┘          └──────────┘          └──────────┘
            │
            ▼ (other pending offers)
     ┌────────────┐
     │ Superseded │
     └────────────┘
```

### Grace Period

- **Definition**: Time window for student to accept/decline offer
- **Duration**: Backend-defined (not exposed to frontend)
- **Expiry**: Offer automatically moves to `expired` status
- **Frontend**: Displays countdown but NEVER auto-transitions

### Auto-Refill

When a student declines an offer:
1. Backend checks if intake not met
2. Backend may auto-generate new offer to next candidate
3. Original declining student's slot is released
4. New student receives offer with fresh grace period

### Intake Enforcement

- **Definition**: Maximum hires for a job posting
- **Enforcement**: Backend tracks accepted offers against intake
- **When full**: No new offers generated, pending offers may be withdrawn
- **Company cannot**: Bypass intake through frontend

### Race Conditions

**Scenario**: Two students accepting same last slot

**Backend Contract**:
- First successful accept wins
- Second receives 409 Conflict
- Frontend must re-fetch offers after any action

**Frontend Responsibility**:
- Disable UI during request
- Handle 409 gracefully
- Always re-fetch after action
