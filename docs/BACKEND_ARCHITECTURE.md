# Aura-Match Backend Architecture

> **System Type**: Allocation-based internship matching system (NOT a job portal)  
> **Authority Model**: Backend is the single source of truth  
> **Frontend Model**: Thin client - renders state only, never computes

---

## Table of Contents

1. [System Context Diagram](#1-system-context-diagram)
2. [High-Level Backend Architecture](#2-high-level-backend-architecture)
3. [Authentication & Session Flow](#3-authentication--session-flow)
4. [Resume Lifecycle](#4-resume-lifecycle)
5. [Student Application Lifecycle State Machine](#5-student-application-lifecycle-state-machine)
6. [Matching Engine Flow](#6-matching-engine-flow-core)
7. [Offer Lifecycle & Auto-Refill](#7-offer-lifecycle--auto-refill)
8. [Concurrency & Race Condition Handling](#8-concurrency--race-condition-handling)
9. [Company Control Flow](#9-company-control-flow)
10. [Review/Flag & Audit Flow](#10-reviewflag--audit-flow)
11. [Batch & Scheduler](#11-batch--scheduler)
12. [Data Model (ERD)](#12-data-model-erd)

---

## 1. System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TRUST BOUNDARY: EXTERNAL                            │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                    │
│  │    Student    │    │    Company    │    │  Government/  │                    │
│  │   (Browser)   │    │   (Browser)   │    │    Admin      │                    │
│  │               │    │               │    │   (Browser)   │                    │
│  │  THIN CLIENT  │    │  THIN CLIENT  │    │  THIN CLIENT  │                    │
│  │  - No logic   │    │  - No logic   │    │  - Audit view │                    │
│  │  - No storage │    │  - No storage │    │  - Reports    │                    │
│  └───────┬───────┘    └───────┬───────┘    └───────┬───────┘                    │
│          │                    │                    │                             │
└──────────┼────────────────────┼────────────────────┼─────────────────────────────┘
           │ HTTPS/JWT          │ HTTPS/JWT          │ HTTPS/JWT
           │                    │                    │
┌──────────┴────────────────────┴────────────────────┴─────────────────────────────┐
│                          TRUST BOUNDARY: BACKEND                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                        AURA-MATCH BACKEND                                    │ │
│  │                    (Single Source of Truth)                                  │ │
│  │                                                                              │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │ │
│  │   │ API Gateway │  │ Auth Service│  │  Matching   │  │   Offer     │        │ │
│  │   │             │  │             │  │   Engine    │  │   Service   │        │ │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │ │
│  │                                                                              │ │
│  │   ┌─────────────────────────────────────────────────────────────────┐       │ │
│  │   │                    PostgreSQL Database                           │       │ │
│  │   │              (Transactional, ACID-compliant)                     │       │ │
│  │   └─────────────────────────────────────────────────────────────────┘       │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
└───────────┬─────────────────────┬─────────────────────┬──────────────────────────┘
            │                     │                     │
┌───────────┴─────────────────────┴─────────────────────┴──────────────────────────┐
│                          TRUST BOUNDARY: EXTERNAL SERVICES                        │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                     │
│  │  Google OAuth │    │ Google Drive  │    │  Email/SMS    │                     │
│  │               │    │     API       │    │   Provider    │                     │
│  │  - Auth only  │    │  - File fetch │    │  - OTP        │                     │
│  │  - No tokens  │    │  - Read-only  │    │  - Notifs     │                     │
│  │    to client  │    │               │    │               │                     │
│  └───────────────┘    └───────────────┘    └───────────────┘                     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Trust Boundaries

| Actor | Can Do | Cannot Do |
|-------|--------|-----------|
| Student | Submit profile, confirm skills, accept/decline offers | Modify match scores, bypass allocation |
| Company | Create jobs, approve/reject proposals | Cherry-pick students, exceed intake |
| Admin | View audit logs, generate reports | Modify historical data |
| Backend | All state mutations, allocation decisions | N/A (authoritative) |
| Frontend | Render state, send user intent | Compute, cache, or infer state |

---

## 2. High-Level Backend Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   API LAYER                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                            REST API Gateway                                   │   │
│  │   /auth/*  │  /student/*  │  /company/*  │  /api/*  │  /admin/*              │   │
│  │                                                                               │   │
│  │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │   │
│  │   │  Rate Limiter   │  │   JWT Verify    │  │  Request Logger │              │   │
│  │   └─────────────────┘  └─────────────────┘  └─────────────────┘              │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│      AUTH SERVICE       │ │     RESUME SERVICE      │ │    MATCHING ENGINE      │
│  ┌───────────────────┐  │ │  ┌───────────────────┐  │ │  ┌───────────────────┐  │
│  │ Password Auth     │  │ │  │ Upload Handler    │  │ │  │ Scoring Algorithm │  │
│  │ OTP Verification  │  │ │  │ Version Manager   │  │ │  │ Gale-Shapley      │  │
│  │ Google OAuth      │  │ │  │ GDrive Connector  │  │ │  │ Fairness Engine   │  │
│  │ JWT Issuer        │  │ │  │ Skill Extractor   │  │ │  │ Explainability    │  │
│  └───────────────────┘  │ │  └───────────────────┘  │ │  └───────────────────┘  │
│         SYNC            │ │      SYNC + ASYNC       │ │         SYNC            │
└─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
                    │                    │                    │
                    ▼                    ▼                    ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│     OFFER SERVICE       │ │  APPLICATION LIFECYCLE  │ │    REVIEW SERVICE       │
│  ┌───────────────────┐  │ │  ┌───────────────────┐  │ │  ┌───────────────────┐  │
│  │ Offer Creation    │  │ │  │ State Machine     │  │ │  │ Flag Handler      │  │
│  │ Accept/Decline    │  │ │  │ Withdrawal Logic  │  │ │  │ Manual Review Q   │  │
│  │ Grace Period      │  │ │  │ Cooldown Manager  │  │ │  │ Resolution Engine │  │
│  │ Auto-Refill       │  │ │  │ Reapplication     │  │ │  │ Audit Logger      │  │
│  └───────────────────┘  │ │  └───────────────────┘  │ │  └───────────────────┘  │
│   SYNC + ROW LOCKING    │ │         SYNC            │ │         SYNC            │
└─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
                    │                    │                    │
                    └────────────────────┼────────────────────┘
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              NOTIFICATION SERVICE                                    │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                     │
│   │   Email Queue   │  │    SMS Queue    │  │  Push Queue     │                     │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘                     │
│                                  ASYNC                                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              BATCH / SCHEDULER                                       │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                     │
│   │ Grace Expiry    │  │ Auto-Refill     │  │ Cooldown Reset  │                     │
│   │ Job (hourly)    │  │ Job (on-demand) │  │ Job (daily)     │                     │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘                     │
│                              CRON / QUEUE-BASED                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  DATABASE LAYER                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                          PostgreSQL (Primary)                                │    │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │    │
│  │   │   users     │  │   jobs      │  │   offers    │  │ audit_logs  │        │    │
│  │   │   resumes   │  │   matches   │  │   reviews   │  │ app_states  │        │    │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │    │
│  │                                                                              │    │
│  │   ROW-LEVEL LOCKING  │  SERIALIZABLE ISOLATION  │  ADVISORY LOCKS           │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                          Object Storage (S3/GCS)                             │    │
│  │                          Resume files, attachments                           │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Sync vs Async Boundaries

| Service | Sync Operations | Async Operations |
|---------|-----------------|------------------|
| Auth | All operations | None |
| Resume | Upload, version create | AI skill extraction |
| Matching | Score calculation, allocation | None (deterministic) |
| Offer | Accept/decline/create | Notification dispatch |
| Notification | None | Email, SMS, Push |
| Batch | None | Grace expiry, auto-refill |

### Locking Points

| Operation | Lock Type | Scope |
|-----------|-----------|-------|
| Offer accept | Row lock | `offers` + `jobs.accepted_count` |
| Intake check | Advisory lock | `job_id` |
| Match proposal | Serializable txn | `matches` table |
| Auto-refill | Advisory lock | `job_id` |

---

## 3. Authentication & Session Flow

### 3.1 Email/Password Login

```
┌──────────┐          ┌──────────┐          ┌──────────┐
│ Frontend │          │  Backend │          │   DB     │
└────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │
     │ POST /auth/login    │                     │
     │ {email, password}   │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ SELECT user WHERE   │
     │                     │ email = ?           │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ User row            │
     │                     │<────────────────────│
     │                     │                     │
     │                     │ bcrypt.compare()    │
     │                     │ (password hash)     │
     │                     │                     │
     │                     │ Generate JWT        │
     │                     │ (sub: user_id,      │
     │                     │  exp: 24h,          │
     │                     │  role: student)     │
     │                     │                     │
     │ 200 OK              │                     │
     │ {access_token}      │                     │
     │<────────────────────│                     │
     │                     │                     │
     │ Store in            │                     │
     │ localStorage        │                     │
     │                     │                     │
     │ GET /auth/me        │                     │
     │ Authorization:      │                     │
     │ Bearer <jwt>        │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ Verify JWT          │
     │                     │ SELECT user, prefs, │
     │                     │ skills, status...   │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ Complete user obj   │
     │                     │<────────────────────│
     │                     │                     │
     │ 200 OK              │                     │
     │ {UserData}          │                     │
     │<────────────────────│                     │
     │                     │                     │
     │ Hydrate UIContext   │                     │
     │                     │                     │
```

### 3.2 Google OAuth Flow

```
┌──────────┐          ┌──────────┐          ┌──────────┐          ┌──────────┐
│ Frontend │          │  Backend │          │  Google  │          │    DB    │
└────┬─────┘          └────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │                     │
     │ Redirect to         │                     │                     │
     │ /auth/google?       │                     │                     │
     │ redirect_uri=...    │                     │                     │
     │────────────────────>│                     │                     │
     │                     │                     │                     │
     │                     │ Build Google URL    │                     │
     │                     │ with client_id,     │                     │
     │                     │ scope, state        │                     │
     │                     │                     │                     │
     │ 302 Redirect        │                     │                     │
     │ Location: Google    │                     │                     │
     │<────────────────────│                     │                     │
     │                     │                     │                     │
     │ ─────────────────────────────────────────>│                     │
     │                     │                     │                     │
     │           User consents on Google         │                     │
     │                     │                     │                     │
     │ <─────────────────────────────────────────│                     │
     │ Redirect to backend │                     │                     │
     │ /auth/google/cb?    │                     │                     │
     │ code=AUTH_CODE      │                     │                     │
     │────────────────────>│                     │                     │
     │                     │                     │                     │
     │                     │ POST /oauth/token   │                     │
     │                     │ {code, secret}      │                     │
     │                     │────────────────────>│                     │
     │                     │                     │                     │
     │                     │ {access_token,      │                     │
     │                     │  id_token}          │                     │
     │                     │<────────────────────│                     │
     │                     │                     │                     │
     │                     │ GET /userinfo       │                     │
     │                     │────────────────────>│                     │
     │                     │                     │                     │
     │                     │ {email, name, sub}  │                     │
     │                     │<────────────────────│                     │
     │                     │                     │                     │
     │                     │ UPSERT user         │                     │
     │                     │ (google_id, email)  │                     │
     │                     │────────────────────────────────────────────>
     │                     │                     │                     │
     │                     │ user_id             │                     │
     │                     │<────────────────────────────────────────────
     │                     │                     │                     │
     │                     │ Generate Aura JWT   │                     │
     │                     │ (NEVER return       │                     │
     │                     │  Google tokens)     │                     │
     │                     │                     │                     │
     │ 302 Redirect        │                     │                     │
     │ /auth/callback?     │                     │                     │
     │ token=AURA_JWT      │                     │                     │
     │<────────────────────│                     │                     │
     │                     │                     │                     │
     │ Extract token,      │                     │                     │
     │ store, call /me     │                     │                     │
     │                     │                     │                     │
```

### 3.3 OTP Verification Flow

```
┌──────────┐          ┌──────────┐          ┌──────────┐          ┌──────────┐
│ Frontend │          │  Backend │          │    DB    │          │ SMS/Email│
└────┬─────┘          └────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │                     │
     │ POST /auth/         │                     │                     │
     │ request-email-otp   │                     │                     │
     │ {email}             │                     │                     │
     │────────────────────>│                     │                     │
     │                     │                     │                     │
     │                     │ Generate OTP        │                     │
     │                     │ (6-digit, 10min)    │                     │
     │                     │                     │                     │
     │                     │ INSERT otp_codes    │                     │
     │                     │ (email, code, exp)  │                     │
     │                     │────────────────────>│                     │
     │                     │                     │                     │
     │                     │ Queue email         │                     │
     │                     │────────────────────────────────────────────>
     │                     │                     │                     │
     │ 200 {message,       │                     │                     │
     │      expiresIn}     │                     │                     │
     │<────────────────────│                     │                     │
     │                     │                     │                     │
     │   ... user receives OTP ...               │                     │
     │                     │                     │                     │
     │ POST /auth/         │                     │                     │
     │ verify-email-otp    │                     │                     │
     │ {email, otp}        │                     │                     │
     │────────────────────>│                     │                     │
     │                     │                     │                     │
     │                     │ SELECT otp_codes    │                     │
     │                     │ WHERE email, code,  │                     │
     │                     │ exp > NOW()         │                     │
     │                     │────────────────────>│                     │
     │                     │                     │                     │
     │                     │ Match found         │                     │
     │                     │<────────────────────│                     │
     │                     │                     │                     │
     │                     │ UPDATE users SET    │                     │
     │                     │ email_verified=true │                     │
     │                     │────────────────────>│                     │
     │                     │                     │                     │
     │                     │ DELETE otp_codes    │                     │
     │                     │ (cleanup)           │                     │
     │                     │────────────────────>│                     │
     │                     │                     │                     │
     │ 200 {success}       │                     │                     │
     │<────────────────────│                     │                     │
     │                     │                     │                     │
```

### Token Expiry Handling

```
┌──────────┐          ┌──────────┐
│ Frontend │          │  Backend │
└────┬─────┘          └────┬─────┘
     │                     │
     │ ANY request with    │
     │ expired JWT         │
     │────────────────────>│
     │                     │
     │                     │ JWT.verify() fails
     │                     │ (exp < now)
     │                     │
     │ 401 Unauthorized    │
     │ {error: "TOKEN_     │
     │  EXPIRED"}          │
     │<────────────────────│
     │                     │
     │ Clear localStorage  │
     │ Redirect to /login  │
     │                     │
     │ NO SILENT REFRESH   │
     │ NO RETRY LOOPS      │
     │                     │
```

---

## 4. Resume Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RESUME LIFECYCLE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │                     │
                    │    NO RESUME        │
                    │                     │
                    └──────────┬──────────┘
                               │
                   ┌───────────┴───────────┐
                   │                       │
                   ▼                       ▼
        ┌──────────────────┐    ┌──────────────────┐
        │  Local Upload    │    │  Google Drive    │
        │                  │    │  Reference       │
        │  POST /resumes/  │    │                  │
        │  upload          │    │  POST /resumes/  │
        │  multipart/form  │    │  upload/gdrive   │
        │                  │    │  {fileId, token} │
        └────────┬─────────┘    └────────┬─────────┘
                 │                       │
                 │     Backend fetches   │
                 │     file content      │
                 │                       │
                 └───────────┬───────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │                              │
              │    PENDING_EXTRACTION        │
              │                              │
              │  - File stored in S3/GCS     │
              │  - Version record created    │
              │  - version = prev + 1        │
              │                              │
              └──────────────┬───────────────┘
                             │
                             │ Async AI extraction
                             │ (backend-only)
                             ▼
              ┌──────────────────────────────┐
              │                              │
              │    SKILLS EXTRACTED          │
              │                              │
              │  - extractedSkills[]         │
              │  - skillsConfirmed = false   │
              │                              │
              └──────────────┬───────────────┘
                             │
                             │ Student reviews
                             │ POST /resumes/:id/confirm
                             │ {confirmedSkills}
                             ▼
              ┌──────────────────────────────┐
              │                              │
              │    ACTIVE                    │
              │                              │
              │  - skillsConfirmed = true    │
              │  - Used for matching         │
              │  - Previous version →        │
              │    ARCHIVED                  │
              │                              │
              └──────────────┬───────────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                 │
            ▼                                 ▼
┌───────────────────────┐       ┌───────────────────────┐
│                       │       │                       │
│  USED IN MATCHING     │       │  NEW VERSION          │
│                       │       │  UPLOADED             │
│  - Immutable snapshot │       │                       │
│  - offer.resumeVersion│       │  - Current → ARCHIVED │
│    references this    │       │  - New → ACTIVE       │
│                       │       │                       │
└───────────────────────┘       └───────────────────────┘
```

### Resume Version Rules

| Rule | Description |
|------|-------------|
| Immutability | Once a resume is used in a match, that version is frozen |
| Single Active | Only one resume version can be `status: active` at a time |
| Auto-Archive | Uploading new resume auto-archives the current active |
| Audit Trail | All versions retained for compliance/audit |
| Skill Ownership | `extractedSkills` is AI-generated; `confirmedSkills` is user-modified |

---

## 5. Student Application Lifecycle State Machine

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                     STUDENT APPLICATION STATE MACHINE                                │
│                     (Backend-controlled, Frontend renders)                           │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                 ┌──────────────┐
                                 │   INACTIVE   │
                                 │              │
                                 │ No profile   │
                                 │ submitted    │
                                 └──────┬───────┘
                                        │
                                        │ Profile + Skills + 
                                        │ Preferences submitted
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │    ACTIVE    │◄─────────────────────────┐
                                 │              │                          │
                                 │ In matching  │                          │
                                 │ pool         │                          │
                                 └──────┬───────┘                          │
                                        │                                  │
              ┌─────────────────────────┼─────────────────────────┐        │
              │                         │                         │        │
              ▼                         ▼                         ▼        │
     ┌──────────────┐          ┌──────────────┐          ┌──────────────┐  │
     │  WITHDRAWN   │          │  COMPLETED   │          │   COOLDOWN   │  │
     │              │          │              │          │              │  │
     │ User chose   │          │ Accepted     │          │ Withdrew     │  │
     │ to leave     │          │ offer        │          │ recently     │  │
     └──────┬───────┘          └──────────────┘          └──────┬───────┘  │
            │                         ▲                         │          │
            │                         │                         │ 30 days  │
            │                         │ Offer accepted          │ elapsed  │
            │                         │                         │          │
            │                         │                         ▼          │
            │                  ┌──────┴───────┐          ┌──────────────┐  │
            │                  │   ACTIVE     │          │  CAN_REAPPLY │  │
            │                  │   (again)    │◄─────────│              │──┘
            │                  └──────────────┘          └──────────────┘
            │                                                   ▲
            └───────────────────────────────────────────────────┘
                        After cooldown expires


STATE TRANSITIONS (Backend-enforced):

┌─────────────┬─────────────────────────┬─────────────────────────────────────┐
│ From        │ To                      │ Trigger                             │
├─────────────┼─────────────────────────┼─────────────────────────────────────┤
│ inactive    │ active                  │ All requirements submitted          │
│ active      │ withdrawn               │ POST /application/withdraw          │
│ active      │ completed               │ Offer accepted                      │
│ withdrawn   │ cooldown                │ Immediate (system sets 30d timer)   │
│ cooldown    │ active                  │ POST /application/reapply           │
│             │                         │ (only if cooldownEndsAt < NOW())    │
└─────────────┴─────────────────────────┴─────────────────────────────────────┘

INVARIANTS:
- Frontend NEVER computes canReapply - always from backend
- Cooldown period is system-configured (30 days default)
- Withdrawal reason stored for audit
- No direct inactive → completed transition
```

---

## 6. Matching Engine Flow (CORE)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           MATCHING ENGINE - ALLOCATOR                                │
│                    (Deterministic, Explainable, Auditable)                           │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: INPUT COLLECTION                                                            │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────┐              ┌─────────────────────────┐               │
│  │     STUDENT POOL        │              │      JOB POOL           │               │
│  │                         │              │                         │               │
│  │  WHERE:                 │              │  WHERE:                 │               │
│  │  - app_status = active  │              │  - status = processing  │               │
│  │  - skills_confirmed     │              │  - accepted < intake    │               │
│  │  - preferences_set      │              │                         │               │
│  │                         │              │  ┌───────────────────┐  │               │
│  │  ┌───────────────────┐  │              │  │ Job 1: intake=5   │  │               │
│  │  │ Student A         │  │              │  │ Job 2: intake=3   │  │               │
│  │  │ Student B         │  │              │  │ Job 3: intake=10  │  │               │
│  │  │ Student C         │  │              │  └───────────────────┘  │               │
│  │  │ ...               │  │              │                         │               │
│  │  └───────────────────┘  │              └─────────────────────────┘               │
│  └─────────────────────────┘                                                        │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: SCORING (Per Student-Job Pair)                                              │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                         SCORE CALCULATION                                      │  │
│  │                                                                                │  │
│  │   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐             │  │
│  │   │  SKILL MATCH    │   │   DISTANCE      │   │   PREFERENCE    │             │  │
│  │   │    (40%)        │   │    (25%)        │   │   ALIGNMENT     │             │  │
│  │   │                 │   │                 │   │    (20%)        │             │  │
│  │   │ Jaccard sim     │   │ Haversine       │   │ Domain match    │             │  │
│  │   │ + semantic      │   │ decay function  │   │ Work style      │             │  │
│  │   │ similarity      │   │                 │   │ Stipend fit     │             │  │
│  │   └────────┬────────┘   └────────┬────────┘   └────────┬────────┘             │  │
│  │            │                     │                     │                      │  │
│  │            └─────────────────────┼─────────────────────┘                      │  │
│  │                                  ▼                                            │  │
│  │                    ┌─────────────────────────┐                                │  │
│  │                    │   FAIRNESS ADJUSTMENT   │                                │  │
│  │                    │        (15%)            │                                │  │
│  │                    │                         │                                │  │
│  │                    │  - Local candidate      │                                │  │
│  │                    │    boost                │                                │  │
│  │                    │  - Diversity            │                                │  │
│  │                    │    consideration        │                                │  │
│  │                    │  - Skill gap            │                                │  │
│  │                    │    tolerance            │                                │  │
│  │                    └────────────┬────────────┘                                │  │
│  │                                 │                                             │  │
│  │                                 ▼                                             │  │
│  │                    ┌─────────────────────────┐                                │  │
│  │                    │     FINAL SCORE         │                                │  │
│  │                    │   0.0 - 100.0           │                                │  │
│  │                    └─────────────────────────┘                                │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: ALLOCATION (Gale-Shapley Variant)                                           │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   WHILE unmatched students exist AND jobs have remaining intake:            │   │
│   │                                                                              │   │
│   │     1. Each unmatched student "proposes" to highest-ranked                  │   │
│   │        unrejected job                                                        │   │
│   │                                                                              │   │
│   │     2. Each job tentatively accepts top N students (N = intake)             │   │
│   │        from its proposal pool, rejects rest                                  │   │
│   │                                                                              │   │
│   │     3. Rejected students remove that job from their list                     │   │
│   │                                                                              │   │
│   │     4. Repeat until stable                                                   │   │
│   │                                                                              │   │
│   │   OUTPUT: Ordered candidate queue per job                                    │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│   ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐      │
│   │ Job 1 Queue          │  │ Job 2 Queue          │  │ Job 3 Queue          │      │
│   │ ──────────────────── │  │ ──────────────────── │  │ ──────────────────── │      │
│   │ 1. Student A (92.3)  │  │ 1. Student D (88.1)  │  │ 1. Student G (95.0)  │      │
│   │ 2. Student B (87.5)  │  │ 2. Student E (82.4)  │  │ 2. Student H (91.2)  │      │
│   │ 3. Student C (85.1)  │  │ 3. Student F (79.8)  │  │ 3. Student I (89.7)  │      │
│   │ ... (waitlist)       │  │ ... (waitlist)       │  │ ... (waitlist)       │      │
│   └──────────────────────┘  └──────────────────────┘  └──────────────────────┘      │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: OUTPUT & LOGGING                                                            │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │ MATCH RECORD (Immutable after creation)                                         ││
│  │                                                                                  ││
│  │ {                                                                                ││
│  │   "matchId": "uuid",                                                            ││
│  │   "jobId": "job_123",                                                           ││
│  │   "studentId": "student_456",                                                   ││
│  │   "score": 92.3,                                                                ││
│  │   "rank": 1,                                                                    ││
│  │   "explanation": [                                                              ││
│  │     {"factor": "skill_match", "value": "React, TypeScript", "weight": "high"},  ││
│  │     {"factor": "distance", "value": "12km", "weight": "medium"},                ││
│  │     {"factor": "domain_fit", "value": "Web Development", "weight": "high"}      ││
│  │   ],                                                                            ││
│  │   "fairnessIndicators": {                                                       ││
│  │     "localCandidateBoost": true,                                                ││
│  │     "diversityConsideration": false,                                            ││
│  │     "skillGapTolerance": 0.1                                                    ││
│  │   },                                                                            ││
│  │   "resumeVersionUsed": 3,                                                       ││
│  │   "createdAt": "2024-01-15T10:30:00Z"                                           ││
│  │ }                                                                               ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
│  AUDIT LOG: All inputs, weights, and decisions recorded for reproducibility         │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Matching Invariants

| Rule | Enforcement |
|------|-------------|
| Deterministic | Same inputs → same outputs (seeded randomness if needed) |
| Explainable | Every score has breakdown with factors and weights |
| Immutable | Match records cannot be modified post-creation |
| Auditable | Full input snapshot stored with each run |
| No Cherry-Picking | Companies see proposals, cannot search/filter students directly |

---

## 7. Offer Lifecycle & Auto-Refill

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           OFFER STATE MACHINE                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                 ┌──────────────┐
                                 │   CREATED    │
                                 │              │
                                 │ System       │
                                 │ generated    │
                                 └──────┬───────┘
                                        │
                                        │ Sent to student
                                        ▼
                                 ┌──────────────┐
                          ┌──────│   PENDING    │──────┐
                          │      │              │      │
                          │      │ Grace period │      │
                          │      │ active (72h) │      │
                          │      └──────┬───────┘      │
                          │             │              │
            Student       │             │              │      Grace period
            accepts       │             │              │      expires (batch)
                          │             │              │
                          ▼             │              ▼
                   ┌──────────────┐     │       ┌──────────────┐
                   │   ACCEPTED   │     │       │   EXPIRED    │
                   │              │     │       │              │
                   │ Terminal     │     │       │ Triggers     │
                   │ state        │     │       │ auto-refill  │
                   └──────────────┘     │       └──────────────┘
                                        │              │
                                        │              │
                          Student       │              │
                          declines      │              │
                                        │              │
                          ▼             │              │
                   ┌──────────────┐     │              │
                   │   DECLINED   │     │              │
                   │              │     │              │
                   │ Triggers     │     │              │
                   │ auto-refill  │◄────┘              │
                   └──────┬───────┘                    │
                          │                            │
                          └───────────┬────────────────┘
                                      │
                                      ▼
                   ┌──────────────────────────────────────┐
                   │          AUTO-REFILL TRIGGER         │
                   │                                      │
                   │  IF accepted_count < intake:         │
                   │    1. Lock job row                   │
                   │    2. Get next in waitlist queue     │
                   │    3. Create new PENDING offer       │
                   │    4. Notify student                 │
                   │                                      │
                   └──────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           SUPERSEDED STATE                                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  When a student ACCEPTS one offer:                                                   │
│                                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                         │
│  │  Offer A     │     │  Offer B     │     │  Offer C     │                         │
│  │  (PENDING)   │     │  (PENDING)   │     │  (PENDING)   │                         │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                         │
│         │                    │                    │                                  │
│         │  ACCEPT            │                    │                                  │
│         ▼                    ▼                    ▼                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                         │
│  │  ACCEPTED    │     │  SUPERSEDED  │     │  SUPERSEDED  │                         │
│  │              │     │              │     │              │                         │
│  │  Terminal    │     │  Auto-set    │     │  Auto-set    │                         │
│  └──────────────┘     │  by system   │     │  by system   │                         │
│                       │              │     │              │                         │
│                       │  Triggers    │     │  Triggers    │                         │
│                       │  auto-refill │     │  auto-refill │                         │
│                       └──────────────┘     └──────────────┘                         │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           INTAKE ENFORCEMENT                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Job: intake = 3                                                                    │
│                                                                                      │
│   ┌───────────────────────────────────────────────────────────────────────┐         │
│   │ Timeline                                                              │         │
│   ├───────────────────────────────────────────────────────────────────────┤         │
│   │                                                                       │         │
│   │ T0: Matching complete                                                 │         │
│   │     → 3 offers created (Student A, B, C) = PENDING                    │         │
│   │     → accepted_count = 0                                              │         │
│   │                                                                       │         │
│   │ T1: Student A accepts                                                 │         │
│   │     → A = ACCEPTED                                                    │         │
│   │     → accepted_count = 1                                              │         │
│   │                                                                       │         │
│   │ T2: Student B declines                                                │         │
│   │     → B = DECLINED                                                    │         │
│   │     → AUTO-REFILL: Offer to Student D (next in queue)                 │         │
│   │     → accepted_count = 1 (unchanged)                                  │         │
│   │                                                                       │         │
│   │ T3: Student C's grace period expires                                  │         │
│   │     → C = EXPIRED                                                     │         │
│   │     → AUTO-REFILL: Offer to Student E                                 │         │
│   │     → accepted_count = 1 (unchanged)                                  │         │
│   │                                                                       │         │
│   │ T4: Student D accepts                                                 │         │
│   │     → D = ACCEPTED                                                    │         │
│   │     → accepted_count = 2                                              │         │
│   │                                                                       │         │
│   │ T5: Student E accepts                                                 │         │
│   │     → E = ACCEPTED                                                    │         │
│   │     → accepted_count = 3                                              │         │
│   │     → INTAKE MET: job.status = 'closed'                               │         │
│   │     → No more offers created                                          │         │
│   │                                                                       │         │
│   └───────────────────────────────────────────────────────────────────────┘         │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Locking Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ACCEPT OFFER - Locking Sequence                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   BEGIN TRANSACTION (SERIALIZABLE)                                          │
│   │                                                                         │
│   ├─► SELECT * FROM jobs WHERE id = ? FOR UPDATE                           │
│   │   (Acquire exclusive lock on job row)                                   │
│   │                                                                         │
│   ├─► CHECK: job.accepted_count < job.intake                                │
│   │   IF FALSE → ROLLBACK, return 409 CONFLICT                              │
│   │                                                                         │
│   ├─► SELECT * FROM offers WHERE id = ? FOR UPDATE                         │
│   │   (Acquire exclusive lock on offer row)                                 │
│   │                                                                         │
│   ├─► CHECK: offer.status = 'pending'                                       │
│   │   IF FALSE → ROLLBACK, return 409 CONFLICT                              │
│   │                                                                         │
│   ├─► UPDATE offers SET status = 'accepted', decidedAt = NOW()             │
│   │                                                                         │
│   ├─► UPDATE jobs SET accepted_count = accepted_count + 1                   │
│   │                                                                         │
│   ├─► UPDATE offers SET status = 'superseded'                               │
│   │   WHERE student_id = ? AND status = 'pending' AND id != ?               │
│   │   (Supersede other pending offers for this student)                     │
│   │                                                                         │
│   ├─► IF job.accepted_count = job.intake THEN                               │
│   │     UPDATE jobs SET status = 'closed'                                   │
│   │                                                                         │
│   └─► COMMIT                                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Concurrency & Race Condition Handling

### Scenario 1: Two Students Accept Last Slot

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ RACE: Two students (A, B) try to accept last slot simultaneously                     │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Job: intake = 3, accepted_count = 2                                                │
│   Available slots: 1                                                                 │
│                                                                                      │
│   ┌─────────────┐                    ┌─────────────┐                                 │
│   │  Student A  │                    │  Student B  │                                 │
│   │  Request    │                    │  Request    │                                 │
│   └──────┬──────┘                    └──────┬──────┘                                 │
│          │                                  │                                        │
│          │ T=0ms                            │ T=5ms                                  │
│          ▼                                  ▼                                        │
│   ┌──────────────────────────────────────────────────────────────────────────────┐  │
│   │                         DATABASE (PostgreSQL)                                 │  │
│   │                                                                               │  │
│   │  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐    │  │
│   │  │ Transaction A                   │  │ Transaction B                   │    │  │
│   │  │                                 │  │                                 │    │  │
│   │  │ 1. SELECT jobs FOR UPDATE       │  │ 1. SELECT jobs FOR UPDATE       │    │  │
│   │  │    → Acquires lock ✓            │  │    → BLOCKED (waiting)          │    │  │
│   │  │                                 │  │                                 │    │  │
│   │  │ 2. CHECK accepted < intake      │  │    ... waiting ...              │    │  │
│   │  │    → 2 < 3 = TRUE ✓             │  │                                 │    │  │
│   │  │                                 │  │                                 │    │  │
│   │  │ 3. UPDATE offer A = accepted    │  │                                 │    │  │
│   │  │                                 │  │                                 │    │  │
│   │  │ 4. UPDATE jobs accepted = 3     │  │                                 │    │  │
│   │  │                                 │  │                                 │    │  │
│   │  │ 5. COMMIT                       │  │ ← Lock released                 │    │  │
│   │  │    → Lock released              │  │                                 │    │  │
│   │  │                                 │  │ 2. SELECT jobs (now sees        │    │  │
│   │  │                                 │  │    accepted_count = 3)          │    │  │
│   │  │                                 │  │                                 │    │  │
│   │  │                                 │  │ 3. CHECK 3 < 3 = FALSE ✗        │    │  │
│   │  │                                 │  │                                 │    │  │
│   │  │                                 │  │ 4. ROLLBACK                     │    │  │
│   │  └─────────────────────────────────┘  └─────────────────────────────────┘    │  │
│   │                                                                               │  │
│   └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│   RESULT:                                                                            │
│   - Student A: 200 OK, offer accepted                                                │
│   - Student B: 409 CONFLICT, "Position filled"                                       │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Scenario 2: Accept vs Expiry Collision

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ RACE: Student accepts while batch job expires same offer                             │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Offer: deadline = T+1ms                                                            │
│                                                                                      │
│   ┌─────────────┐                    ┌─────────────┐                                 │
│   │   Student   │                    │ Batch Job   │                                 │
│   │   Accept    │                    │ Expiry      │                                 │
│   └──────┬──────┘                    └──────┬──────┘                                 │
│          │                                  │                                        │
│          │ T=0ms                            │ T=2ms (deadline passed)                │
│          ▼                                  ▼                                        │
│   ┌──────────────────────────────────────────────────────────────────────────────┐  │
│   │                                                                               │  │
│   │  Option A: Student request arrives first                                      │  │
│   │  ─────────────────────────────────────────                                    │  │
│   │  1. Student txn acquires offer lock                                           │  │
│   │  2. Student txn: deadline > NOW()? → YES (just barely)                        │  │
│   │  3. Student txn: UPDATE status = 'accepted'                                   │  │
│   │  4. Student txn: COMMIT                                                       │  │
│   │  5. Batch job: SELECT ... WHERE status = 'pending' → empty (already accepted) │  │
│   │                                                                               │  │
│   │  RESULT: Student wins, offer accepted                                         │  │
│   │                                                                               │  │
│   │  ─────────────────────────────────────────────────────────────────────────    │  │
│   │                                                                               │  │
│   │  Option B: Batch job acquires lock first                                      │  │
│   │  ──────────────────────────────────────────                                   │  │
│   │  1. Batch txn acquires offer lock                                             │  │
│   │  2. Batch txn: deadline < NOW()? → YES                                        │  │
│   │  3. Batch txn: UPDATE status = 'expired'                                      │  │
│   │  4. Batch txn: Trigger auto-refill                                            │  │
│   │  5. Batch txn: COMMIT                                                         │  │
│   │  6. Student txn: SELECT status → 'expired'                                    │  │
│   │  7. Student txn: ROLLBACK                                                     │  │
│   │                                                                               │  │
│   │  RESULT: Batch wins, 409 "Offer expired"                                      │  │
│   │                                                                               │  │
│   └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│   KEY INVARIANT: Whoever acquires lock first determines outcome.                     │
│   Backend is always authoritative - no client-side deadline checking.                │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Scenario 3: Company Action vs Student Action

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ RACE: Company rejects match while student has pending offer                          │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   SYSTEM DESIGN: Company actions on PROPOSALS, not OFFERS                            │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   MATCHING ENGINE                     OFFER SERVICE                          │   │
│   │   ────────────────                    ─────────────                          │   │
│   │                                                                              │   │
│   │   MatchProposal {                     Offer {                                │   │
│   │     status: 'pending' |                 status: 'pending' |                  │   │
│   │             'approved' |                        'accepted' |                 │   │
│   │             'rejected' |                        'declined' |                 │   │
│   │             'hold'                              'expired' |                  │   │
│   │   }                                             'superseded' |               │   │
│   │                                                 'withdrawn'                  │   │
│   │   Company acts HERE                   }                                      │   │
│   │   (pre-offer)                         Student acts HERE                      │   │
│   │                                       (post-offer)                           │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│   FLOW:                                                                              │
│   1. Matching creates MatchProposal (status: pending)                                │
│   2. Company approves → MatchProposal status: approved                               │
│   3. System creates Offer based on approved proposal                                 │
│   4. Student receives Offer                                                          │
│                                                                                      │
│   ONCE OFFER EXISTS:                                                                 │
│   - Company can add systemNote to offer (advisory only)                              │
│   - Company CANNOT revoke offer (legal protection)                                   │
│   - Company CAN close job → remaining pending offers → 'withdrawn'                   │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │ Company closes job while student has pending offer:                          │   │
│   │                                                                              │   │
│   │ BEGIN TRANSACTION                                                            │   │
│   │   UPDATE jobs SET status = 'closed'                                          │   │
│   │   UPDATE offers SET status = 'withdrawn',                                    │   │
│   │                     systemNote = 'Position closed by company'                │   │
│   │     WHERE job_id = ? AND status = 'pending'                                  │   │
│   │ COMMIT                                                                       │   │
│   │                                                                              │   │
│   │ Student request arrives after:                                               │   │
│   │   SELECT * FROM offers WHERE id = ?                                          │   │
│   │   → status = 'withdrawn'                                                     │   │
│   │   → Return 409 "Offer withdrawn"                                             │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Database Transaction Boundaries Summary

| Operation | Isolation Level | Lock Type | Scope |
|-----------|-----------------|-----------|-------|
| Accept offer | SERIALIZABLE | Row exclusive | offers + jobs |
| Decline offer | READ COMMITTED | Row exclusive | offers |
| Auto-refill | SERIALIZABLE | Advisory + Row | jobs + offers |
| Batch expiry | READ COMMITTED | Row exclusive | offers |
| Match creation | SERIALIZABLE | Table | matches |
| Job close | SERIALIZABLE | Row exclusive | jobs + offers |

---

## 9. Company Control Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           COMPANY CONTROL FLOW                                       │
│                    (No cherry-picking, system-driven matching)                       │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: JOB CREATION                                                                │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Company                         Backend                         Database           │
│      │                               │                               │               │
│      │ POST /company/jobs            │                               │               │
│      │ {title, intake,               │                               │               │
│      │  location, originalJD}        │                               │               │
│      │──────────────────────────────>│                               │               │
│      │                               │                               │               │
│      │                               │ Validate:                     │               │
│      │                               │ - Company verified            │               │
│      │                               │ - Required fields             │               │
│      │                               │ - intake > 0                  │               │
│      │                               │                               │               │
│      │                               │ INSERT jobs                   │               │
│      │                               │ status = 'draft'              │               │
│      │                               │──────────────────────────────>│               │
│      │                               │                               │               │
│      │ 201 {job}                     │                               │               │
│      │<──────────────────────────────│                               │               │
│      │                               │                               │               │
└──────┴───────────────────────────────┴───────────────────────────────┴───────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: JD PROCESSING (Backend NLP)                                                 │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Company                         Backend                         AI/NLP             │
│      │                               │                               │               │
│      │ POST /company/jobs/:id/       │                               │               │
│      │ process                       │                               │               │
│      │──────────────────────────────>│                               │               │
│      │                               │                               │               │
│      │                               │ UPDATE jobs                   │               │
│      │                               │ status = 'processing'         │               │
│      │                               │                               │               │
│      │                               │ Extract skills from           │               │
│      │                               │ originalJD                    │               │
│      │                               │──────────────────────────────>│               │
│      │                               │                               │               │
│      │                               │ {extractedSkills,             │               │
│      │                               │  parsedRequirements}          │               │
│      │                               │<──────────────────────────────│               │
│      │                               │                               │               │
│      │                               │ UPDATE jobs SET               │               │
│      │                               │ requiredSkills = [...]        │               │
│      │                               │                               │               │
│      │ 200 {job with skills}         │                               │               │
│      │<──────────────────────────────│                               │               │
│      │                               │                               │               │
└──────┴───────────────────────────────┴───────────────────────────────┴───────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: MATCH VISIBILITY                                                            │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Company                         Backend                         Database           │
│      │                               │                               │               │
│      │ GET /company/jobs/:id/        │                               │               │
│      │ matches                       │                               │               │
│      │──────────────────────────────>│                               │               │
│      │                               │                               │               │
│      │                               │ SELECT matches                │               │
│      │                               │ WHERE job_id = ?              │               │
│      │                               │ ORDER BY score DESC           │               │
│      │                               │──────────────────────────────>│               │
│      │                               │                               │               │
│      │                               │                               │               │
│      │ 200 {matches: [               │                               │               │
│      │   {id, score,                 │ NOTE: Company sees:           │               │
│      │    candidateName,             │ - Anonymized name             │               │
│      │    skills, explanation,       │ - Skills                      │               │
│      │    status}                    │ - Score + explanation         │               │
│      │ ]}                            │                               │               │
│      │                               │ Company does NOT see:         │               │
│      │                               │ - Email/phone                 │               │
│      │                               │ - Exact location              │               │
│      │                               │ - Full resume                 │               │
│      │                               │ (until mutual acceptance)     │               │
│      │<──────────────────────────────│                               │               │
│      │                               │                               │               │
└──────┴───────────────────────────────┴───────────────────────────────┴───────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: PROPOSAL ACTIONS                                                            │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ALLOWED ACTIONS (Company can only validate, not cherry-pick):                      │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   APPROVE: "Yes, proceed with this candidate"                                │   │
│   │   ──────────────────────────────────────────                                 │   │
│   │   POST /company/matches/:id/action {action: 'approve'}                       │   │
│   │   → Creates Offer for student                                                │   │
│   │   → Match status: approved                                                   │   │
│   │                                                                              │   │
│   │   REJECT: "This candidate is not suitable"                                   │   │
│   │   ─────────────────────────────────────────                                  │   │
│   │   POST /company/matches/:id/action {action: 'reject'}                        │   │
│   │   → Match status: rejected                                                   │   │
│   │   → System auto-advances to next candidate                                   │   │
│   │                                                                              │   │
│   │   HOLD: "Need more time to decide"                                           │   │
│   │   ──────────────────────────────────                                         │   │
│   │   POST /company/matches/:id/action {action: 'hold'}                          │   │
│   │   → Match status: hold                                                       │   │
│   │   → System may timeout and auto-advance                                      │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│   FORBIDDEN:                                                                         │
│   ✗ Search all students                                                              │
│   ✗ Filter students by arbitrary criteria                                            │
│   ✗ Contact students directly before mutual acceptance                               │
│   ✗ Exceed intake limit                                                              │
│   ✗ Re-order match queue                                                             │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: INTAKE ENFORCEMENT                                                          │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   Job: intake = 5                                                            │   │
│   │                                                                              │   │
│   │   ┌────────────────────────────────────────────────────────────────────┐    │   │
│   │   │ Match Queue (ordered by score)                                     │    │   │
│   │   ├────────────────────────────────────────────────────────────────────┤    │   │
│   │   │ Rank │ Candidate │ Score │ Proposal │ Offer   │                    │    │   │
│   │   │──────┼───────────┼───────┼──────────┼─────────┤                    │    │   │
│   │   │  1   │ Alice     │ 95.2  │ approved │ pending │ ◄─ Visible         │    │   │
│   │   │  2   │ Bob       │ 92.1  │ approved │ accepted│ ◄─ to company      │    │   │
│   │   │  3   │ Carol     │ 89.5  │ pending  │ -       │ ◄─ (top 5)         │    │   │
│   │   │  4   │ Dave      │ 87.3  │ pending  │ -       │                    │    │   │
│   │   │  5   │ Eve       │ 85.0  │ pending  │ -       │                    │    │   │
│   │   │──────┼───────────┼───────┼──────────┼─────────┤                    │    │   │
│   │   │  6   │ Frank     │ 82.1  │ -        │ -       │ ◄─ Waitlist        │    │   │
│   │   │  7   │ Grace     │ 80.5  │ -        │ -       │    (hidden)        │    │   │
│   │   │  8   │ Hank      │ 78.2  │ -        │ -       │                    │    │   │
│   │   └────────────────────────────────────────────────────────────────────┘    │   │
│   │                                                                              │   │
│   │   When Alice declines:                                                       │   │
│   │   1. Alice's offer → declined                                                │   │
│   │   2. Frank auto-advanced to visible queue                                    │   │
│   │   3. Company sees Frank's proposal                                           │   │
│   │                                                                              │   │
│   │   When accepted_count = 5:                                                   │   │
│   │   1. Job status → closed                                                     │   │
│   │   2. Remaining offers → withdrawn                                            │   │
│   │   3. Waitlist → cleared                                                      │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Review/Flag & Audit Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           REVIEW / FLAG SYSTEM                                       │
│                    (Explainability, Accountability, Auditability)                    │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ STUDENT FLAGS MATCH                                                                  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Student                         Backend                         Database           │
│      │                               │                               │               │
│      │ POST /api/reviews/flag        │                               │               │
│      │ {matchId, reason,             │                               │               │
│      │  otherReason?}                │                               │               │
│      │──────────────────────────────>│                               │               │
│      │                               │                               │               │
│      │                               │ Validate:                     │               │
│      │                               │ - Match exists                │               │
│      │                               │ - Student owns match          │               │
│      │                               │ - No existing review          │               │
│      │                               │   for this match              │               │
│      │                               │                               │               │
│      │                               │ INSERT reviews                │               │
│      │                               │ {matchId, reason,             │               │
│      │                               │  status: 'submitted'}         │               │
│      │                               │──────────────────────────────>│               │
│      │                               │                               │               │
│      │                               │ INSERT audit_logs             │               │
│      │                               │ {action: 'review_created',    │               │
│      │                               │  actor: student_id,           │               │
│      │                               │  payload: {...}}              │               │
│      │                               │──────────────────────────────>│               │
│      │                               │                               │               │
│      │ 201 {reviewId, status}        │                               │               │
│      │<──────────────────────────────│                               │               │
│      │                               │                               │               │
└──────┴───────────────────────────────┴───────────────────────────────┴───────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ FLAG REASONS (Predefined for categorization)                                         │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   skills_misinterpreted      "My skills were incorrectly evaluated"          │   │
│   │   resume_context_ignored     "Important context in resume was missed"        │   │
│   │   domain_mismatch            "This role doesn't match my domain preferences" │   │
│   │   location_logic_incorrect   "Distance/location calculation seems wrong"     │   │
│   │   other                      Free-text (requires otherReason)                │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ MANUAL REVIEW QUEUE (Admin/System)                                                   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │ Review Queue                                                                 │   │
│   ├─────────────────────────────────────────────────────────────────────────────┤   │
│   │ ID       │ Match    │ Reason              │ Status      │ Age              │   │
│   │──────────┼──────────┼─────────────────────┼─────────────┼──────────────────│   │
│   │ REV-001  │ M-12345  │ skills_misinterpreted│ submitted   │ 2h               │   │
│   │ REV-002  │ M-12346  │ domain_mismatch     │ under_review│ 1d               │   │
│   │ REV-003  │ M-12347  │ other               │ submitted   │ 3h               │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│   Admin Actions:                                                                     │
│   ─────────────                                                                      │
│   - View original match inputs (resume, skills, preferences)                         │
│   - View matching algorithm output (scores, weights)                                 │
│   - Compare with similar matches for consistency                                     │
│   - Resolve with explanation                                                         │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ RESOLUTION FLOW                                                                      │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Admin                           Backend                         Database           │
│      │                               │                               │               │
│      │ POST /admin/reviews/:id/      │                               │               │
│      │ resolve                       │                               │               │
│      │ {resolution: "The skill      │                               │               │
│      │  evaluation was correct.      │                               │               │
│      │  'React' was weighted..."}    │                               │               │
│      │──────────────────────────────>│                               │               │
│      │                               │                               │               │
│      │                               │ UPDATE reviews                │               │
│      │                               │ SET status = 'resolved',      │               │
│      │                               │     resolution = '...',       │               │
│      │                               │     resolvedAt = NOW()        │               │
│      │                               │──────────────────────────────>│               │
│      │                               │                               │               │
│      │                               │ INSERT audit_logs             │               │
│      │                               │ {action: 'review_resolved',   │               │
│      │                               │  actor: admin_id,             │               │
│      │                               │  reviewId: ...,               │               │
│      │                               │  resolution: ...}             │               │
│      │                               │──────────────────────────────>│               │
│      │                               │                               │               │
│      │                               │ Notify student                │               │
│      │                               │ (async)                       │               │
│      │                               │                               │               │
│      │ 200 OK                        │                               │               │
│      │<──────────────────────────────│                               │               │
│      │                               │                               │               │
└──────┴───────────────────────────────┴───────────────────────────────┴───────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ IMMUTABLE AUDIT LOG                                                                  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │ audit_logs table                                                             │   │
│   ├─────────────────────────────────────────────────────────────────────────────┤   │
│   │ id          │ UUID PRIMARY KEY                                              │   │
│   │ timestamp   │ TIMESTAMPTZ NOT NULL DEFAULT NOW()                            │   │
│   │ action      │ TEXT NOT NULL                                                 │   │
│   │ actor_id    │ UUID NOT NULL (user, system, or admin)                        │   │
│   │ actor_type  │ ENUM('student', 'company', 'admin', 'system')                 │   │
│   │ entity_type │ TEXT NOT NULL (match, offer, review, job, etc.)               │   │
│   │ entity_id   │ UUID NOT NULL                                                 │   │
│   │ payload     │ JSONB NOT NULL (full snapshot)                                │   │
│   │ ip_address  │ INET                                                          │   │
│   │ user_agent  │ TEXT                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│   INVARIANTS:                                                                        │
│   ─────────────                                                                      │
│   - INSERT ONLY (no UPDATE, no DELETE)                                               │
│   - No foreign key constraints (preserve even if parent deleted)                     │
│   - payload contains full state snapshot at time of action                           │
│   - Retention: permanent (compliance requirement)                                    │
│                                                                                      │
│   EXAMPLE ENTRIES:                                                                   │
│   ─────────────────                                                                  │
│   {action: 'match_created', entity_type: 'match', payload: {score, explanation}}     │
│   {action: 'offer_accepted', entity_type: 'offer', payload: {offerId, studentId}}    │
│   {action: 'review_submitted', entity_type: 'review', payload: {reason, matchId}}    │
│   {action: 'job_closed', entity_type: 'job', payload: {accepted_count, intake}}      │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Batch & Scheduler

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           BATCH JOBS & SCHEDULER                                     │
│                    (Background processes, system-triggered)                          │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ JOB 1: GRACE PERIOD EXPIRY                                                           │
│ Schedule: Every hour                                                                 │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   CRON: 0 * * * * (every hour, on the hour)                                  │   │
│   │                                                                              │   │
│   │   BEGIN TRANSACTION                                                          │   │
│   │   │                                                                          │   │
│   │   ├─► SELECT * FROM offers                                                   │   │
│   │   │   WHERE status = 'pending'                                               │   │
│   │   │   AND decision_deadline < NOW()                                          │   │
│   │   │   FOR UPDATE SKIP LOCKED                                                 │   │
│   │   │                                                                          │   │
│   │   │   (SKIP LOCKED prevents blocking if another process is handling)         │   │
│   │   │                                                                          │   │
│   │   ├─► FOR EACH expired_offer:                                                │   │
│   │   │     │                                                                    │   │
│   │   │     ├─► UPDATE offers SET status = 'expired'                             │   │
│   │   │     │                                                                    │   │
│   │   │     ├─► INSERT audit_logs                                                │   │
│   │   │     │   {action: 'offer_expired', entity_id: offer.id}                   │   │
│   │   │     │                                                                    │   │
│   │   │     └─► CALL auto_refill(offer.job_id)                                   │   │
│   │   │                                                                          │   │
│   │   └─► COMMIT                                                                 │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ JOB 2: AUTO-REFILL                                                                   │
│ Trigger: On decline/expiry/withdrawal                                                │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   FUNCTION auto_refill(job_id UUID)                                          │   │
│   │   │                                                                          │   │
│   │   ├─► SELECT * FROM jobs WHERE id = job_id FOR UPDATE                        │   │
│   │   │   (Acquire exclusive lock)                                               │   │
│   │   │                                                                          │   │
│   │   ├─► IF job.accepted_count >= job.intake THEN                               │   │
│   │   │     RETURN; -- No refill needed                                          │   │
│   │   │                                                                          │   │
│   │   ├─► IF job.status = 'closed' THEN                                          │   │
│   │   │     RETURN; -- Job manually closed                                       │   │
│   │   │                                                                          │   │
│   │   ├─► next_candidate = SELECT * FROM matches                                 │   │
│   │   │   WHERE job_id = job_id                                                  │   │
│   │   │   AND status = 'pending' -- Not yet offered                              │   │
│   │   │   ORDER BY score DESC, created_at ASC                                    │   │
│   │   │   LIMIT 1                                                                │   │
│   │   │   FOR UPDATE                                                             │   │
│   │   │                                                                          │   │
│   │   ├─► IF next_candidate IS NULL THEN                                         │   │
│   │   │     RETURN; -- Waitlist exhausted                                        │   │
│   │   │                                                                          │   │
│   │   ├─► UPDATE matches SET status = 'approved'                                 │   │
│   │   │   WHERE id = next_candidate.id                                           │   │
│   │   │                                                                          │   │
│   │   ├─► INSERT offers                                                          │   │
│   │   │   {match_id, student_id, job_id,                                         │   │
│   │   │    status: 'pending',                                                    │   │
│   │   │    decision_deadline: NOW() + 72 hours}                                  │   │
│   │   │                                                                          │   │
│   │   ├─► INSERT audit_logs                                                      │   │
│   │   │   {action: 'auto_refill', payload: {job_id, new_offer_id}}               │   │
│   │   │                                                                          │   │
│   │   └─► QUEUE notification                                                     │   │
│   │       {type: 'new_offer', student_id, offer_id}                              │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ JOB 3: COOLDOWN EXPIRY                                                               │
│ Schedule: Daily at midnight                                                          │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   CRON: 0 0 * * * (daily at midnight)                                        │   │
│   │                                                                              │   │
│   │   UPDATE application_states                                                  │   │
│   │   SET can_reapply = TRUE                                                     │   │
│   │   WHERE status = 'cooldown'                                                  │   │
│   │   AND cooldown_ends_at < NOW()                                               │   │
│   │                                                                              │   │
│   │   -- Note: We don't auto-transition to 'active'                              │   │
│   │   -- Student must explicitly call /application/reapply                       │   │
│   │                                                                              │   │
│   │   FOR EACH updated_state:                                                    │   │
│   │     QUEUE notification                                                       │   │
│   │     {type: 'cooldown_ended', student_id}                                     │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ JOB 4: JOB AUTO-CLOSE                                                                │
│ Trigger: When accepted_count = intake                                                │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   TRIGGER on_offer_accepted AFTER UPDATE ON offers                           │   │
│   │   WHEN NEW.status = 'accepted'                                               │   │
│   │   │                                                                          │   │
│   │   ├─► SELECT * FROM jobs WHERE id = NEW.job_id FOR UPDATE                    │   │
│   │   │                                                                          │   │
│   │   ├─► IF job.accepted_count >= job.intake THEN                               │   │
│   │   │     │                                                                    │   │
│   │   │     ├─► UPDATE jobs SET status = 'closed', closed_at = NOW()             │   │
│   │   │     │                                                                    │   │
│   │   │     ├─► UPDATE offers SET status = 'withdrawn',                          │   │
│   │   │     │                    system_note = 'Position filled'                 │   │
│   │   │     │   WHERE job_id = NEW.job_id                                        │   │
│   │   │     │   AND status = 'pending'                                           │   │
│   │   │     │                                                                    │   │
│   │   │     └─► INSERT audit_logs                                                │   │
│   │   │         {action: 'job_closed_intake_met'}                                │   │
│   │   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│ SCHEDULER ARCHITECTURE                                                               │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   ┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐ │   │
│   │   │   pg_cron         │     │   Job Queue       │     │   Workers         │ │   │
│   │   │   (PostgreSQL)    │     │   (Redis/SQS)     │     │                   │ │   │
│   │   │                   │     │                   │     │   ┌─────────────┐ │ │   │
│   │   │   ┌─────────────┐ │     │   ┌─────────────┐ │     │   │  Worker 1   │ │ │   │
│   │   │   │ grace_expiry│─┼────>│   │ high_priority│─┼────>│   └─────────────┘ │ │   │
│   │   │   │ (hourly)    │ │     │   └─────────────┘ │     │   ┌─────────────┐ │ │   │
│   │   │   └─────────────┘ │     │   ┌─────────────┐ │     │   │  Worker 2   │ │ │   │
│   │   │   ┌─────────────┐ │     │   │ notifications│─┼────>│   └─────────────┘ │ │   │
│   │   │   │ cooldown    │─┼────>│   └─────────────┘ │     │   ┌─────────────┐ │ │   │
│   │   │   │ (daily)     │ │     │   ┌─────────────┐ │     │   │  Worker 3   │ │ │   │
│   │   │   └─────────────┘ │     │   │ refill      │─┼────>│   └─────────────┘ │ │   │
│   │   │                   │     │   └─────────────┘ │     │                   │ │   │
│   │   └───────────────────┘     └───────────────────┘     └───────────────────┘ │   │
│   │                                                                              │   │
│   │   GUARANTEES:                                                                │   │
│   │   - At-least-once delivery                                                   │   │
│   │   - Idempotent handlers (safe to retry)                                      │   │
│   │   - Dead-letter queue for failed jobs                                        │   │
│   │   - Metrics/monitoring on all queues                                         │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Data Model (ERD)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY RELATIONSHIP DIAGRAM                                │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│       users         │         │   student_profiles  │         │      companies      │
├─────────────────────┤         ├─────────────────────┤         ├─────────────────────┤
│ id           PK     │────1:1──│ user_id       PK,FK │         │ id           PK     │
│ email        UQ     │         │ location      JSONB │         │ email        UQ     │
│ password_hash       │         │ skills        TEXT[]│         │ company_name        │
│ phone               │         │ preferences   JSONB │         │ contact_person      │
│ email_verified      │         │ status        ENUM  │         │ gst_number          │
│ phone_verified      │         │ created_at          │         │ email_verified      │
│ role         ENUM   │         │ updated_at          │         │ status        ENUM  │
│ created_at          │         └──────────┬──────────┘         │ created_at          │
│ updated_at          │                    │                    └──────────┬──────────┘
└─────────────────────┘                    │                               │
                                           │                               │
                              ┌────────────┴────────────┐                  │
                              │                         │                  │
                              ▼                         ▼                  ▼
         ┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
         │        resumes          │     │   application_states    │     │         jobs            │
         ├─────────────────────────┤     ├─────────────────────────┤     ├─────────────────────────┤
         │ id              PK      │     │ user_id       PK,FK     │     │ id              PK      │
         │ user_id         FK      │     │ status        ENUM      │     │ company_id      FK      │
         │ current_version INT     │     │ withdrawn_at            │     │ title                   │
         │ created_at              │     │ cooldown_ends_at        │     │ required_skills  TEXT[] │
         │ updated_at              │     │ can_reapply    BOOL     │     │ location        JSONB   │
         └───────────┬─────────────┘     │ withdrawal_reason       │     │ intake          INT     │
                     │                   │ updated_at              │     │ accepted_count  INT     │
                     │                   └─────────────────────────┘     │ stipend         INT     │
                     │                                                   │ perks           TEXT    │
                     ▼                                                   │ original_jd     TEXT    │
         ┌─────────────────────────┐                                     │ status          ENUM    │
         │    resume_versions      │                                     │ created_at              │
         ├─────────────────────────┤                                     │ processed_at            │
         │ id              PK      │                                     │ closed_at               │
         │ resume_id       FK      │                                     └───────────┬─────────────┘
         │ version         INT     │                                                 │
         │ file_name              │                                                  │
         │ file_url               │◄────── IMMUTABLE after match ──────────┐         │
         │ file_size       INT    │                                        │         │
         │ status          ENUM   │                                        │         │
         │ extracted_skills TEXT[]│                                        │         │
         │ skills_confirmed BOOL  │                                        │         │
         │ uploaded_at            │                                        │         │
         └─────────────────────────┘                                       │         │
                                                                           │         │
                              ┌────────────────────────────────────────────┼─────────┘
                              │                                            │
                              ▼                                            │
         ┌─────────────────────────────────────────────────────────────────┼──────────┐
         │                              matches                            │          │
         ├─────────────────────────────────────────────────────────────────┼──────────┤
         │ id                    PK                                        │          │
         │ job_id                FK ───────────────────────────────────────┘          │
         │ student_id            FK ──────────────────────────────────────────────────┤
         │ score                 DECIMAL(5,2)                                         │
         │ rank                  INT                                                  │
         │ explanation           JSONB[]                                              │
         │ fairness_indicators   JSONB                                                │
         │ resume_version_used   INT  ─────────────────────────────────────────┘      │
         │ status                ENUM (pending, approved, rejected, hold, locked)     │
         │ created_at            TIMESTAMPTZ                                          │
         │ status_changed_at     TIMESTAMPTZ                                          │
         │ UNIQUE(job_id, student_id)                                                 │
         └──────────────────────────────────────────────────────────┬─────────────────┘
                                                                    │
                                          ┌─────────────────────────┴─────────────────┐
                                          │                                           │
                                          ▼                                           ▼
         ┌─────────────────────────────────────────────────┐    ┌─────────────────────────────────────┐
         │                    offers                        │    │              reviews                 │
         ├─────────────────────────────────────────────────┤    ├─────────────────────────────────────┤
         │ id                    PK                         │    │ id                    PK            │
         │ match_id              FK, UQ                     │    │ match_id              FK, UQ        │
         │ job_id                FK                         │    │ reason                ENUM          │
         │ student_id            FK                         │    │ other_reason          TEXT          │
         │ company_name          TEXT                       │    │ status                ENUM          │
         │ role_title            TEXT                       │    │ resolution            TEXT          │
         │ location              TEXT                       │    │ created_at                          │
         │ match_score           DECIMAL                    │    │ resolved_at                         │
         │ status                ENUM                       │    │ CONSTRAINT one_review_per_match     │
         │ decision_deadline     TIMESTAMPTZ                │    └─────────────────────────────────────┘
         │ decided_at            TIMESTAMPTZ                │
         │ resume_version_used   INT                        │
         │ explanation           JSONB[]                    │
         │ system_note           TEXT                       │
         │ created_at            TIMESTAMPTZ                │
         │ updated_at            TIMESTAMPTZ                │
         └─────────────────────────────────────────────────┘

                                          │
                                          ▼
         ┌─────────────────────────────────────────────────────────────────────────────┐
         │                              audit_logs                                      │
         ├─────────────────────────────────────────────────────────────────────────────┤
         │ id                    PK      UUID                                          │
         │ timestamp             TIMESTAMPTZ  NOT NULL DEFAULT NOW()                   │
         │ action                TEXT         NOT NULL                                 │
         │ actor_id              UUID         NOT NULL                                 │
         │ actor_type            ENUM('student', 'company', 'admin', 'system')         │
         │ entity_type           TEXT         NOT NULL                                 │
         │ entity_id             UUID         NOT NULL                                 │
         │ payload               JSONB        NOT NULL (full snapshot)                 │
         │ ip_address            INET                                                  │
         │ user_agent            TEXT                                                  │
         │                                                                             │
         │ -- INSERT ONLY: No UPDATE, No DELETE                                        │
         │ -- No foreign keys (preserves history even if parent deleted)               │
         └─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY MUTABILITY MATRIX                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Entity              │ Mutable Fields              │ Immutable After               │
│   ────────────────────┼─────────────────────────────┼──────────────────────────────│
│   users               │ password, phone, verified   │ email (rarely)                │
│   student_profiles    │ location, skills, prefs     │ -                             │
│   companies           │ contact_person              │ email, gst_number             │
│   resumes             │ current_version             │ -                             │
│   resume_versions     │ skills_confirmed            │ file_*, extracted_skills      │
│   jobs                │ status, accepted_count      │ intake, required_skills       │
│   matches             │ status only                 │ score, explanation, rank      │
│   offers              │ status, system_note         │ score, explanation, deadline  │
│   reviews             │ status, resolution          │ reason, match_id              │
│   application_states  │ status, can_reapply         │ -                             │
│   audit_logs          │ NONE                        │ ALL FIELDS                    │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           CARDINALITY SUMMARY                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   users ──────────────── 1:1 ──────────────── student_profiles                       │
│   users ──────────────── 1:N ──────────────── resumes                                │
│   resumes ────────────── 1:N ──────────────── resume_versions                        │
│   users ──────────────── 1:1 ──────────────── application_states                     │
│   companies ──────────── 1:N ──────────────── jobs                                   │
│   jobs ───────────────── 1:N ──────────────── matches                                │
│   users (student) ────── 1:N ──────────────── matches                                │
│   matches ────────────── 1:1 ──────────────── offers                                 │
│   matches ────────────── 1:0..1 ───────────── reviews                                │
│   * ──────────────────── 1:N ──────────────── audit_logs                             │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

This document provides the complete backend architecture for Aura-Match, an **allocation-based internship matching system**. Key design principles:

1. **Backend Authority**: All state is owned by the backend. Frontend is a thin client.
2. **Concurrency Safety**: Row-level locking, serializable transactions, advisory locks.
3. **Immutability**: Match scores, offers, and audit logs are append-only.
4. **Auditability**: Every state change is logged with full payload snapshots.
5. **Fairness**: Matching algorithm includes explainability and fairness indicators.
6. **No Cherry-Picking**: Companies validate proposals; they cannot search/filter students.
7. **Determinism**: Same inputs always produce same matching outputs.

These diagrams are suitable for:
- Backend implementation reference
- Design review sessions
- Academic submission
- Production readiness assessment
