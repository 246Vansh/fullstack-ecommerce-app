# Production Deployment Runbook

How to deploy the backend (`backend/`, Express 5 + Prisma 7, MySQL 8.4) and the
frontend (`frontend/`, Vue 3 + Vite 8, a static single-page app). Everything here
matches the current code; the file and setting names are the source of truth.

> **Never run any of these against the production database:**
> `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, `pnpm run db:seed`
> (`prisma db seed`). They can drop data, reset the schema, or overwrite user
> passwords and stock. The only production migration command is
> `pnpm run db:migrate`.

## 1. Requirements

- Node.js 22 (developed and tested with 22.17.0).
- pnpm 11.28.2. In `backend/` it is pinned by `packageManager`
  (`pnpm@11.28.2`), `devEngines` and the lockfile: started from pnpm 10 or 11,
  or through Corepack, pnpm switches to 11.28.2 itself (pnpm 9 cannot install
  this project). `frontend/` has **no** pin and uses whichever pnpm runs it, so
  install 11.28.2 on the build machine (e.g. `npm install -g pnpm@11.28.2`)
  and check `pnpm --version` prints `11.28.2` in both directories. Install with
  `--frozen-lockfile` so the committed lockfiles are used exactly.
- MySQL 8.4, an empty database (first deploy) or one migrated by this project,
  and a database user with the privileges to create and alter tables.
- Outbound HTTPS from the backend build machine during `pnpm install`: the
  `@prisma/engines` install script downloads the Prisma schema engine for the
  current platform (it is needed by `pnpm run db:migrate`).

## 2. Backend environment variables

Set these in the hosting environment (or in `backend/.env`, which is not
tracked by Git; existing environment variables take precedence over the file).
The server validates them at startup (`backend/config/env.js`) and exits with
a list of problems, naming variables only, never values.

| Variable | Required in production | Purpose and safe value |
|---|---|---|
| `NODE_ENV` | Yes | `production`. Enables the production checks below, secure cookies and generic 5xx messages. |
| `PORT` | No (default `5000`) | TCP port the API listens on: a whole number from 1 to 65535 (checked at startup). |
| `DATABASE_URL` | Yes | `mysql://USER:PASSWORD@HOST:3306/DATABASE`. Must **not** contain `ssl*` query parameters; TLS is configured only with `DATABASE_SSL`/`DATABASE_SSL_CA` (prisma commands reject them). URL-encode special characters in the password. |
| `DATABASE_SSL` | Yes | **`true`** in production: TLS with certificate and host name verification (see section 5). Leaving it unset is rejected in production. `false` (plaintext) is not a supported production setting; see the security exception in section 5. |
| `DATABASE_SSL_CA` | When the DB certificate is not signed by a public CA | Path to a PEM file with the CA certificate. Only valid with `DATABASE_SSL=true`; must be a readable PEM certificate. |
| `JWT_ACCESS_SECRET` | Yes | Random secret, at least 32 characters. |
| `JWT_REFRESH_SECRET` | Yes | Different random secret, at least 32 characters. |
| `JWT_ACCESS_EXPIRES_IN` | No (default `15m`) | Access-token lifetime, e.g. `15m`. Must be a duration with a unit (`15m`, `1h`, `7d`); bare numbers are rejected at startup (jsonwebtoken would read `900` as milliseconds). |
| `JWT_REFRESH_EXPIRES_IN` | No (default `7d`) | Refresh-token lifetime. Same format rule. |
| `CLIENT_URL` | Yes | The frontend's exact origin for CORS, e.g. `https://shop.example.com`: `https://`, **no trailing slash, no path** (a trailing slash would make browsers reject every API response, so startup rejects anything but an exact origin). |
| `TRUST_PROXY` | Yes | Which proxies may set `X-Forwarded-For` (see section 5). `true` is rejected. |
| `COOKIE_SECURE` | No (defaults to `true` in production) | Leave unset or `true`. `false` is rejected in production. |
| `COOKIE_SAME_SITE` | No (default `lax`) | `lax` when frontend and API share a site; `none` when they do not (see section 7). |
| `COOKIE_DOMAIN` | No | Usually unset (cookie belongs to the API host). |

Generate secrets with, for example,
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
Store them in the host's secret manager; never commit them or put them in the
frontend.

## 3. Frontend environment variable

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | Yes, **at build time** | Full API base URL including `/api`, e.g. `https://api.shop.example.com/api`. It is compiled into the JavaScript bundle; changing it requires a rebuild. `vite build` fails unless it is an `https://` URL ending in `/api` that is not localhost (`frontend/src/config/apiUrl.js`; a local http URL is allowed only for the dev server, never in a build, whatever `--mode`). Public: never put secrets in any `VITE_` variable. |

Do not deploy a `dist/` built on a development machine: it contains
`http://localhost:5000/api`. Check a build with
`grep -l "localhost:5000" dist/assets/*.js` (no output expected).

## 4. Deployment sequence

Take a database backup before every deploy that includes new migrations
(section 8).

**Backend** (in `backend/`, with the production variables set):

```sh
pnpm --version                   # must print 11.28.2
pnpm install --frozen-lockfile   # also runs the approved @prisma/engines / prisma install scripts
pnpm run prisma:generate         # prisma generate: creates the Prisma Client (required; install does not)
pnpm run db:migrate              # prisma migrate deploy: applies only reviewed, committed migrations
pnpm start                       # node server.js
```

- `pnpm run prisma:generate` must run after every install; without it the
  server cannot start (`Cannot find module '.prisma/client/default'`). It does
  not connect to the database, but `prisma.config.js` still requires
  `DATABASE_URL` (and `DATABASE_SSL` when `NODE_ENV=production`) to be set.
- `pnpm run db:migrate` applies the migrations in `backend/prisma/migrations`
  that the database has not run yet, in order, and never resets or drops the
  database. Review new migration SQL before deploying it. With
  `DATABASE_SSL=true` it connects with strict certificate verification.
- Run `db:migrate` once per deploy, from one place (not from every instance at
  startup).

**Frontend** (in `frontend/`):

```sh
pnpm --version                   # must print 11.28.2 (not enforced here; see section 1)
pnpm install --frozen-lockfile
VITE_API_URL=https://api.shop.example.com/api pnpm run build
```

Upload the contents of `frontend/dist/` to the static host. Files in
`dist/assets/` have content hashes in their names and can be cached long-term;
`index.html` must not be cached long-term.

## 5. Database TLS and proxy trust

**MySQL TLS** (`backend/config/db.js`, `backend/prisma.config.js`):

Production requires `DATABASE_SSL=true`. This is the only recommended
production configuration, whatever the network between the API and the
database.

- `DATABASE_SSL=true`: the app connects with `rejectUnauthorized: true`, so the
  server certificate must chain to a trusted CA and match the host name in
  `DATABASE_URL`. There is no setting to skip verification.
- Trust anchor: `DATABASE_SSL_CA` (PEM file) if set, otherwise Node's built-in
  public CAs. Use the CA bundle published by your database provider.
- Migrations get the same policy: `sslaccept=strict` and, when set,
  `sslcert=<DATABASE_SSL_CA>` are added to the URL automatically.
- Use the host name that appears in the certificate in `DATABASE_URL` (not an
  IP address, unless the certificate lists it).
- Before go-live, verify on staging that the app and `pnpm run db:migrate`
  connect with TLS, and that a wrong host name or CA is refused.

**Security exception: `DATABASE_SSL=false`.** The server still starts with
`DATABASE_SSL=false` in production, but this is **not** a recommended or
default configuration. It sends the database password, customer data and
queries in plaintext. A private network, VPC or firewall alone does not make
that safe: anyone with access to that network path (a compromised host,
misrouted traffic, a provider-side tap) can read or alter the traffic. Use it
only as an explicit, documented security exception:

- approved in writing by the person responsible for security, with the reason
  TLS cannot be used;
- limited to a database on the same host (loopback) or an equivalently
  isolated link, with the remaining risk accepted;
- time-limited, with a plan and date to move to `DATABASE_SSL=true`.

Without that approval, treat `DATABASE_SSL=false` in production as a
deployment blocker.

**`TRUST_PROXY`** (`backend/server.js`). It decides which `X-Forwarded-For`
values are believed, which sets each client's IP for logging and rate limits:

| Value | Use when |
|---|---|
| `false` | Clients connect to the Node process directly (no proxy). |
| `1` | Exactly one proxy or load balancer in front (hop count). |
| `2`, `3`, … | That many proxies (e.g. CDN + load balancer). |
| `10.0.0.5,10.0.0.0/8`, `loopback`, `uniquelocal` | The proxies' addresses or ranges. |

Too low and every visitor shares the proxy's IP and rate limit; too high and
clients can spoof their IP. After deploying, confirm the access log shows real
client IPs.

## 6. Frontend SPA history fallback

The frontend uses HTML5 history routing (`createWebHistory`), so URLs like
`/orders/5` or `/admin/products` exist only in the browser. The static host
must answer **any path that is not a file** with `/index.html` (status 200);
the app then shows the page or its own "not found" page.

- nginx: `location / { try_files $uri $uri/ /index.html; }`
- Netlify: a `_redirects` file in `dist/` with `/* /index.html 200`
- Other hosts: configure a "single-page app" rewrite of all routes to
  `/index.html`.

Do not apply the fallback to the API host. Verify by loading
`https://<frontend>/orders/5` directly and reloading the page.

## 7. Cookies, origins and CORS

- Sign-in returns a short-lived access token (kept in memory by the frontend)
  and sets the refresh token as an `httpOnly` cookie named `refreshToken`,
  `Path=/api/auth`, `Secure` in production, `SameSite` from
  `COOKIE_SAME_SITE` (`backend/controllers/authController.js`).
- The frontend sends API requests with credentials; the API allows exactly one
  origin, `CLIENT_URL`, with credentials (`backend/server.js`).
- **Recommended: frontend and API on the same site**, e.g.
  `https://shop.example.com` and `https://api.shop.example.com`, with
  `COOKIE_SAME_SITE=lax` and `COOKIE_DOMAIN` unset.
- Different sites (e.g. two unrelated domains): set `COOKIE_SAME_SITE=none`
  (secure cookies are already on in production). Browsers that block
  third-party cookies may still drop the refresh cookie, which signs users
  out on reload, so prefer the same-site layout.
- Both origins must use HTTPS. `CLIENT_URL` must equal the browser's
  `Origin` exactly (scheme, host, port; no trailing slash).

## 8. Health checks, backups and rollback

**Health check:** `GET /api/health` → `200` with `"status":"ok"` and
`"database":"ok"` when the database answers within 3 seconds, otherwise `503`
with `"status":"unavailable"` (`backend/controllers/healthController.js`). Point the load
balancer or uptime monitor at it. It shares the general rate limit (1000
requests per 15 minutes per client IP), which is ample for one check every
few seconds.

**Shutdown:** on `SIGTERM` the server stops accepting connections, lets
in-flight requests finish for up to 10 seconds, then exits. Give the process
manager a stop timeout above 10 seconds.

**Backups:**

- Take a full backup (e.g. `mysqldump --single-transaction --routines
  --triggers`, or the provider's snapshot) immediately before any deploy that
  runs migrations, and keep regular scheduled backups.
- Test restoring a backup into a separate database before relying on it.

**Rollback:**

- Code-only release (no new migrations): redeploy the previous backend build
  and the previous `frontend/dist`.
- Release with migrations: Prisma has no automatic "down" migrations. If the
  previous code works with the new schema (additive changes), roll back the
  code only. Otherwise restore the pre-deploy backup, accepting the loss of
  data written since, or ship a new forward migration that fixes the problem.
- Never use `prisma migrate reset` or `db push` to "fix" a failed migration.
  If `db:migrate` fails part-way, stop, inspect `_prisma_migrations` and the
  error, and resolve it (`prisma migrate resolve`) only after understanding
  what was applied.

**Operational notes:** rate-limit counters are kept in memory per process:
they reset on restart, and each instance has its own budget when several run
behind a load balancer. Each process opens up to 10 database connections.

## 9. Creating the first production administrator

There is no admin sign-up and no endpoint that grants admin rights, and the
seed refuses to run in production. The first administrator is created by
promoting a normal account in the database, which needs database access:

1. Register the account through the live site (`/register`) with the
   administrator's email and a strong password. It is created as a `CUSTOMER`.
2. Connect to the production database with an administrative client (over
   TLS) and check the stored email (sign-up normalizes it, e.g. to lowercase):

   ```sql
   SELECT id, email, role FROM users WHERE email = 'admin@example.com';
   ```

3. Promote exactly that account:

   ```sql
   UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com' AND role = 'CUSTOMER';
   ```

   It must report **1 row affected**; if not, stop and re-check step 2.
4. Sign out and sign in again on the site; the **Admin** link appears, and
   `/admin/products` loads.

Admin requests re-read the role from the database every time
(`backend/middleware/auth.js`, `requireCurrentAdmin`), so setting `role` back
to `CUSTOMER` revokes access immediately. Record who was promoted and when.
Additional administrators can be added the same way.

## 10. Go-live checks

- [ ] Clean `pnpm install --frozen-lockfile`, `prisma:generate`, `db:migrate`
      and `pnpm start` succeed on the target (Linux) image against staging.
- [ ] `DATABASE_SSL=true` in production (or an approved, documented
      security exception per section 5).
- [ ] TLS to the database verified on staging, including a refused wrong host/CA.
- [ ] Backup taken and a restore tested.
- [ ] Frontend built with the production `VITE_API_URL`; no `localhost:5000`.
- [ ] Direct load and reload of `/orders/5` and `/admin/products` work.
- [ ] Sign in, reload (session kept), sign out and checkout work on the real domains.
- [ ] Access log shows real client IPs (`TRUST_PROXY` correct).
- [ ] Health check wired to `/api/health`.
- [ ] First administrator promoted and verified.
