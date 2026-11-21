# Security design: Tourly v2

Tourly is a **learning project**. Its goal is to show how security can be built into a web
application by hand, layer by layer. Wherever it is realistic, each control is written from scratch,
so you can read exactly how it works. The library you would normally use is named next to it.

> The full review that led to v2, with 19 security findings, evidence, diagrams and the reasoning
> behind every fix, is in [`Security-Review-v1.docx`](Security-Review-v1.docx).

---

## 1. Threat model (short)

| Asset | Why it matters |
|---|---|
| User accounts and sessions | Taking over an account means booking or cancelling in someone's name |
| Admin and manager roles | Control over every trip, every user and the audit log |
| Trip seat counts | The business promise: a 10-seat trip never sells 11 seats |
| Personal data (names, emails, bookings) | Privacy |
| The server's file system | Uploaded files must never become a way in |

| Attacker | What they try | Main controls |
|---|---|---|
| Anonymous visitor | Password guessing, account enumeration, malicious uploads via a stolen manager account | Rate limiting, lockout, constant-time login, upload pipeline |
| Logged-in user | Reading or changing other users' data (IDOR), becoming a manager without approval | Ownership checks on every query, role read from the database on every request |
| Malicious website | Making your logged-in browser send requests (CSRF) | CSRF token, `SameSite=Strict`, CORS allow-list |
| Someone holding a stolen session | Keeping access | Idle + absolute timeouts, re-authentication for sensitive changes, session revocation on password change |
| Two honest users at the same moment | Race conditions | Atomic SQL transactions |

STRIDE coverage: **S**poofing (auth, sessions), **T**ampering (CSRF, validation, re-encoded images),
**R**epudiation (audit log), **I**nformation disclosure (response allow-lists, generic errors, headers),
**D**enial of service (rate limits, upload and body limits, pixel-bomb limit), **E**levation of privilege
(role and ownership checks, admin rules).

---

## 2. The request pipeline

Every request passes through these layers in order (`backend/src/app.js`):

```
request ID → security headers → CORS allow-list → body size limit → session
→ CSRF check → [route] rate limit → authentication → role → validation → service (atomic SQL)
→ central error handler
```

## 3. Controls and where to find them

| Control | How | File |
|---|---|---|
| Fail-fast configuration | Server refuses to start without a strong `SESSION_SECRET`, or with `DEMO_MODE` in production | `src/config/env.js` |
| Password hashing | bcrypt, cost 12; old hashes upgraded on next login | `src/security/password.js` |
| Password policy | NIST SP 800-63B: 8–64 chars, common-password deny-list, not the email, no forced symbols | `src/security/password.js`, `data/common-passwords.txt` |
| Brute-force protection | Fixed-window rate limiter (IP+email, IP) **written from scratch** + account lockout after 5 failures | `src/security/rateLimit.js`, `src/controllers/authController.js` |
| No user enumeration at login | bcrypt always runs (dummy hash for unknown emails) and returns the same message | `src/controllers/authController.js` |
| Session fixation | `session.regenerate()` at login, sign-up and password change | `src/controllers/authController.js` |
| Session cookie | `HttpOnly`, `SameSite=Strict`, `Secure` in production, custom name, 30-min idle + 8-h absolute lifetime | `src/app.js`, `src/middleware/auth.js` |
| Persistent sessions | SQLite session store **written from scratch** (replaces the leaky MemoryStore) | `src/security/sessionStore.js` |
| Session revocation | `auth_version` column: changing the password logs out every other device | `src/middleware/auth.js` |
| Re-authentication | Current password needed to change email or password | `src/controllers/userController.js` |
| CSRF | Synchronizer token **written from scratch**, compared in constant time | `src/security/csrf.js` |
| CORS | Explicit allow-list from `.env`; unknown origins get no CORS headers | `src/app.js` |
| Security headers | CSP, nosniff, X-Frame-Options, Referrer-Policy, COOP/CORP, Permissions-Policy, HSTS (prod), **written by hand** | `src/security/headers.js` |
| Input validation | Hand-written validators with field-level errors + database `CHECK` constraints | `src/validators/index.js`, `src/db/schema.sql` |
| SQL injection | Every value is a bound parameter; dynamic SQL only joins fixed column names | all controllers |
| Authorization | Role read from the DB every request; ownership checks; one `canManageTrip()` policy | `src/middleware/auth.js` |
| Business-logic integrity | Seat check and update in ONE conditional `UPDATE` inside a transaction | `src/controllers/bookingController.js` |
| Data exposure | Responses are built from explicit allow-lists ("views"), never `...row` | `src/views/index.js` |
| File upload | Magic-byte check **written from scratch** → re-encode with sharp (strips EXIF/GPS, kills polyglots) → server-chosen UUID name → private folder → validated route with `nosniff` + CSP sandbox | `src/security/imageType.js`, `src/services/imageService.js`, `src/routes/index.js` |
| Error handling | Generic message + request ID for unexpected errors; details only in server logs | `src/middleware/errorHandler.js` |
| Audit log | Logins, failures, lockouts, role changes, trip and booking changes; visible to admins | `src/security/audit.js` |
| Data history | Foreign keys enforced; cancelling keeps records (status) instead of deleting | `src/db/schema.sql` |

## 4. Demo mode (a deliberate, contained risk)

So that anyone can install the project and explore every role, `npm run seed` creates demo accounts
with **published passwords**. This is safe only because:

- it runs only when `DEMO_MODE=true`;
- the server **refuses to start** with `DEMO_MODE=true` and `NODE_ENV=production`;
- the server prints a warning banner while demo mode is on;
- for a real installation, `npm run create-admin` asks for an admin password (hidden input, policy-checked).

## 5. Known limitations

| Limitation | Why | Mitigation / next step |
|---|---|---|
| Rate-limit counters live in memory | Reset on restart, not shared between several servers | Fine for one instance; use Redis or a DB table to scale |
| Sign-up reveals that an email is already registered | Unavoidable without an email-verification flow | Sign-up is rate-limited; add verification emails later |
| HTTPS is not set up for localhost | TLS belongs to the deployment (reverse proxy, certificates) | App is HTTPS-ready: `Secure` cookie, HSTS, `TRUST_PROXY` |
| The frontend has no Content-Security-Policy yet | It must be sent by the web server that hosts the built files | Example: `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; object-src 'none'; frame-ancestors 'none'` |
| The browser inactivity timer can be bypassed | Anything in the browser is under the user's control | It is UX only; the server enforces idle and absolute timeouts |
| SQLite has one writer at a time | By design | Right for a learning project; PostgreSQL for real traffic |
| Image decoding uses a library (sharp/libvips) | Writing decoders by hand is unsafe | Keep sharp updated (CI runs `npm audit`) |

## 6. How the controls are verified

`cd backend && npm test` runs 31 automated tests. Each one names the finding it proves fixed
(for example *"S-02: 10 parallel bookings for the last 3 seats → exactly one succeeds"*).

## 7. Reporting a vulnerability

This is a learning project, but reports are welcome. Please open a GitHub issue **without** exploit
details, or contact the maintainer through GitHub.
