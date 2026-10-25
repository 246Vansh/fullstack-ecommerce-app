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
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | No (both or neither) | Razorpay API keys from the dashboard (`rzp_test_…` on staging, `rzp_live_…` in production). Unset: only cash on delivery is offered. |
| `RAZORPAY_WEBHOOK_SECRET` | Yes, when the Razorpay keys are set | The secret typed into the webhook in the Razorpay dashboard (section 11). At least 16 characters and **different from `RAZORPAY_KEY_SECRET`** (both checked at startup). Without it the webhook endpoint answers 503 and processes nothing. |
| `RESERVATION_CREATED_CUTOFF` | No (default `2h`) | How long past its deadline an online order whose only open Razorpay payments are `created` keeps its stock (section 11). A duration with a unit from `1m` to `24h` (e.g. `90m`, `2h`); anything else is rejected at startup. **Must be identical on every instance**: each instance reads its own value, so if they differ the shortest one effectively wins. |
| `RESERVATION_EXPIRY_WORKER` | No (default `true`) | `false` stops the reservation worker in this instance: expiry sweeps, deadline assignment, late-payment checks and the hourly Razorpay reconciliation (section 11). Keep it `false` on **every** instance until the migration and this code are both deployed and the overdue orders have been reviewed (section 11, checklist); after that, at least one running instance must keep it on. |

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

**Reservation worker: keep it off until the review is done.** The server runs
the reservation expiry worker by default, and its first sweep starts as soon
as the server does. Before migrating and throughout the deployment, set
`RESERVATION_EXPIRY_WORKER=false` on **every** application instance. Turn it
on only after:
- the migration and the new code are both deployed;
- the overdue online orders have been reviewed and approved, using section
  11's "Staging and production checklist" (steps 4 and 9).

If the worker starts too early, its first sweep may expire legacy unpaid online
orders (the migration gives each a deadline 30 minutes after it was placed) and
return their stock, before anyone has reviewed them.

**Backend** (in `backend/`, with the production variables set):

```sh
pnpm --version                   # must print 11.28.2
pnpm install --frozen-lockfile   # also runs the approved @prisma/engines / prisma install scripts
pnpm run prisma:generate         # prisma generate: creates the Prisma Client (required; install does not)
pnpm run db:migrate              # prisma migrate deploy: applies only reviewed, committed migrations
RESERVATION_EXPIRY_WORKER=false pnpm start   # node server.js, worker off (set it in the instance's environment)
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
- **Releases with online payments and reservations (section 11):** roll back
  the code only, and keep the schema. Restoring a backup taken before the
  release silently discards everything written since. That includes:
  - captured payments applied to orders, and reservation expiries and
    reinstatements (with their stock changes);
  - `unapplied_payments`: refunds owed to customers, and which of them
    Razorpay has confirmed;
  - `razorpay_webhook_events`: webhook history.

  Money taken by Razorpay stays taken, but the record that it must be refunded
  is lost. So any restore or schema rollback needs an **explicit, recorded
  operator decision**, made only after:
  - exporting `unapplied_payments`, `razorpay_webhook_events` and the affected
    orders;
  - reconciling every open refund against the Razorpay dashboard.

  Never drop the new tables or columns; see **Rollback** at the end of section
  11's "Staging and production checklist".
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
- [ ] `RESERVATION_EXPIRY_WORKER=false` on every instance before the migration
      and throughout the deployment (section 4).
- [ ] Overdue online orders reviewed and approved with section 11's "Staging
      and production checklist" (step 4) before the worker is enabled on one
      instance (step 9); enabling it earlier may expire legacy orders and
      return their stock.
- [ ] Razorpay webhook configured and its test delivery answered 200 (section 11).

## 11. Online payments: 30-minute reservations and the Razorpay webhook

### Reservation policy

- Placing an online (Razorpay) order takes its items from stock immediately
  and holds them for **30 minutes**. The deadline is stored on the order
  (`orders.reservationExpiresAt` = placement time + 30 minutes, server clock);
  the browser's clock is never used. Cash-on-delivery orders have no deadline
  and never expire.
- An order is **due** when the deadline has been reached (the deadline itself
  counts) and it is still `PENDING` with no confirmed payment. From then on no
  new payment can be started for it, and Razorpay Checkout closes itself when
  the deadline arrives.
- The expiry worker cancels due orders: status `CANCELLED`, `expiredAt` set,
  and every item's quantity returned to stock, all in one transaction. Paid,
  progressed, cancelled and refunded orders are never touched.
- A payment confirmed before the expiry commits wins: the order is paid and
  keeps its stock. Payment and expiry are opposite conditional updates on the
  same order row, so exactly one of them can succeed.

### The expiry worker

- It runs inside the API process (`backend/services/reservationService.js`):
  a sweep at startup, then every 60 seconds, at most 500 orders per sweep in
  batches of 50 (anything left waits for the next sweep). It stops cleanly on
  `SIGTERM`/`SIGINT`.
- Before expiring an order that has a Razorpay order, it asks Razorpay for that
  order's payments, outside any database transaction. A captured payment of the
  order's amount pays the order instead. The order expires only on a complete,
  final answer: no payments at all, or every payment `failed` or `refunded`.
  It is kept for the next sweep when:
  - a payment is still in flight (`created`, e.g. a pending UPI request;
    `authorized`; or a status the code does not recognise);
  - Razorpay is unreachable;
  - the payment list is incomplete or malformed (its `count` does not match
    its items).

  Without Razorpay keys, such orders are left alone (they are not expired
  blindly). An order kept more than an hour past its deadline is logged
  (`Reservation kept: order … minutes past its deadline …`, hourly), so check
  that payment in the Razorpay dashboard.

  **Created-payment cutoff (`RESERVATION_CREATED_CUTOFF`, default `2h`, at
  most `24h`):**
  - **When it applies:** the order is still pending and unpaid, and every open
    payment of its Razorpay order is `created` (the customer started paying,
    e.g. a UPI request they have not approved, and nothing has been
    authorized). Payments that `failed` or were `refunded` don't count.
  - **What happens:** once the order is that long past its deadline, it is
    released like any expiry: `CANCELLED`, `expiredAt` set, stock returned
    once, in the same locked transaction. It is logged as
    `Reservation released after the created-payment cutoff …`.
  - **When it never applies:**
    - any payment is `authorized`, `captured` (even of the wrong amount) or in
      a status the code does not recognise;
    - Razorpay is unreachable, or its payment list is incomplete or malformed;
    - cash-on-delivery, paid, cancelled and refunded orders.
  - **A capture after the cutoff** is a late payment (see "Late payments and
    refunds"):
    - the order is reinstated if every item is still in stock and that payment
      has no refund record;
    - otherwise the payment is recorded as owed back, and the order is never
      fulfilled with it.

    No refund is issued automatically.
  - **Trade-off:** a shorter cutoff frees stock sooner, but a customer who
    approves a very late UPI request is more likely to find the stock gone and
    get a refund instead of the order.
  - **`authorized` payments** are left to Razorpay, which auto-refunds them if
    not captured within 3 days; the order then expires normally. The customer
    still cannot cancel while a payment is in flight, and there is no admin
    release action; watch the `Reservation kept` log line.
- **Late-payment check:** for 24 hours after an order expires, if it has a
  Razorpay order and no payment recorded for a refund, the worker asks Razorpay
  again (at most every 15 minutes per order, 20 orders per sweep). A capture
  found then is handled like any late payment (see below). This works without
  the webhook, and also retries a late payment whose recording failed.
- **Reconciliation with Razorpay (hourly):** the worker lists every payment
  Razorpay holds for the **last 4 days** (`GET /payments` with `from`/`to`,
  100 per page, at most 50 pages, `to` fixed when the run starts). Each
  captured payment of a local order then goes through the same settlement as
  every other path (`paymentService.reconcileRecentPayments`):
  - still payable: the order is paid;
  - expired: the order is reinstated if its stock is there, otherwise the
    payment is recorded for a refund;
  - cancelled by the customer, already paid by another payment, or the wrong
    amount or currency: the payment is recorded for a refund.

  A payment that already paid its order, or already has a refund record, is
  skipped without a write. Reruns, several instances and a concurrent webhook
  change nothing twice. Payments of gateway orders this shop does not know
  are logged (`Razorpay reconciliation: payment for an unknown order`). Each
  run logs a summary line (`Razorpay reconciliation {…}`).

  Retries and failures:
  - A page that fails or is malformed ends the listing for that run; the
    payments already listed are still processed.
  - Nothing is ever concluded from a payment's absence. The next hourly run
    lists the window again.
  - One payment that fails does not stop the others.
  - It runs only with Razorpay keys set.

  **Coverage limits.** Razorpay documents the page size (at most 100), but not
  the sort order or whether `from`/`to` are inclusive. Runs overlap almost
  completely, so each payment is seen by many runs. Still:
  - one run reads at most 50 pages of 100, i.e. **5,000 payments of any
    status** (failed and created attempts count too). A 4-day window with more
    is processed only partly, logged as `more than 50 pages`; the next hourly
    run starts again from the newest page, so a busy shop may never reach the
    oldest part of the window;
  - captures older than 4 days are not reconciled automatically. Check the
    Razorpay dashboard for those (e.g. after an outage longer than 4 days).
- **Orders without a deadline:** an online order that is still pending and
  unpaid but has no `reservationExpiresAt` was placed by code without
  reservations (e.g. between running the migration and deploying this code).
  It is not cancelled on sight. The worker gives it 30 minutes from the moment
  it first sees it, logs its order number (`Reservation deadline assigned …`),
  and then handles it by the normal rules. Cash-on-delivery and paid orders are
  never given one.
- **Several instances:** the worker runs in every instance where it is on.
  That is safe: each order is expired by one conditional update, so stock is
  returned exactly once. It only costs duplicate queries; set
  `RESERVATION_EXPIRY_WORKER=false` on extra instances if you want, but keep
  it on in at least one.
- Nothing is kept in memory: after a restart or deploy, the first sweep finds
  every order that became due in the meantime.
- Logs: one line per sweep that changed something
  (`Reservation expiry sweep {"expired":…,"paid":…,"kept":…,"skipped":…,"failed":…}`),
  and the order number for any order that failed (it is retried next sweep).

**Deploying the migration** `20261025000000_add_reservation_expiry_and_razorpay_webhooks`
gives every existing online order the same 30-minute window from when it was
placed. Online orders that are still unpaid and `PENDING` and older than 30
minutes therefore become due on the first sweep after deployment. Each is
checked with Razorpay first, and then cancelled with its stock returned. Follow
the "Staging and production checklist" below so these orders can be reviewed
before the worker runs.

### Instances, clocks and configuration

- **Clocks: run NTP on every application instance.**
  - The deadline is set from the clock of the instance that placed the order.
  - Expiry, the created-payment cutoff, the late-payment window and the
    reconciliation window are all judged by the clock of whichever instance
    runs the worker.
  - A clock that is N minutes fast releases reservations N minutes early;
    a slow one holds them longer.
- **`RESERVATION_CREATED_CUTOFF` must be identical on every instance.** Each
  instance reads its own value, and any instance running the worker can
  release an order. With different values, the shortest cutoff effectively
  wins. The value is not logged; compare it in your deployment configuration.
- **What `RESERVATION_EXPIRY_WORKER=false` stops** on that instance:
  - expiry sweeps, including the created-payment cutoff;
  - deadline assignment for orders without one;
  - the 24-hour late-payment checks;
  - the hourly reconciliation.

  **What it does not stop:** checkout, browser payment verification, refresh
  and the webhook keep working on every instance. Payments are still settled
  while the worker is off, and a late capture for an already-expired order is
  still reinstated or recorded for a refund.
- **Monitoring reservations that are being held.** The worker keeps an
  overdue order, and its stock, whenever Razorpay's answer is uncertain. Alert
  on these log lines:
  - `Reservation kept: order … minutes past its deadline with a Razorpay payment still in flight`
    (hourly per order, from 1 hour past the deadline): a payment `authorized`,
    `created` before the cutoff, or in an unrecognised status;
  - `Razorpay payment status not recognised for order …`;
  - `Razorpay order payments fetch for order … was incomplete or malformed`;
  - `Razorpay order payments fetch failed for order …: <status> <code>`
    (Razorpay unreachable or erroring);
  - `Reservation expiry failed for order …` and `Reservation expiry sweep failed`.

  To list what is currently held, run this read-only query. Stored times are
  UTC, so compare with `UTC_TIMESTAMP(3)`, never `NOW(3)` (see checklist step 1):
  ```sql
  SELECT orderNumber, reservationExpiresAt, razorpayOrderId,
         TIMESTAMPDIFF(MINUTE, reservationExpiresAt, UTC_TIMESTAMP(3)) AS minutes_overdue
  FROM orders
  WHERE paymentMethod = 'RAZORPAY' AND status = 'PENDING'
    AND paymentStatus IN ('UNPAID', 'FAILED') AND reservationExpiresAt <= UTC_TIMESTAMP(3)
  ORDER BY reservationExpiresAt;
  ```
  Then check each `razorpayOrderId` in the Razorpay dashboard. There is no
  admin action to release one, and customers cannot cancel while a payment is
  in flight.

### Razorpay webhook

Endpoint: `POST https://<api-host>/api/webhooks/razorpay`

1. In the Razorpay dashboard (**test mode** first), open
   *Account & Settings → Webhooks → Add New Webhook*.
2. Webhook URL: the endpoint above. It must be reachable over the public
   internet with HTTPS. For local testing, use a tunnel to your dev API and
   test-mode keys only.
3. Secret: generate one (e.g. the `node -e` command in section 2), paste it in
   the dashboard, and set the same value as `RAZORPAY_WEBHOOK_SECRET` in the
   host's secret manager. Never reuse the API key secret, and never commit it.
4. Active events: **`payment.captured`**, **`order.paid`**,
   **`payment.failed`** and **`refund.processed`**. Other events are
   acknowledged and ignored.
5. Save, then use the dashboard's test delivery (or a test-mode payment) and
   check that the API answered 200.

How it is handled (`backend/services/razorpayWebhookService.js`):

- **Signature first.** `X-Razorpay-Signature` must be the HMAC-SHA256 of the
  exact raw request body with the webhook secret, compared in constant time.
  Missing or wrong signatures get 400, and nothing in the body is read before
  the check.
- **Idempotency.** Each event's `X-Razorpay-Event-Id` (or a hash of the body if
  the header is missing) is recorded in `razorpay_webhook_events` after its
  changes commit. A redelivery is answered `duplicate` without being processed.
  Every effect is also a conditional database update, so even two concurrent
  deliveries change an order once.
- **Same rules as the browser.** The payment is matched to the local order by
  the Razorpay order id stored when payment started, and must match the
  order's stored amount and currency. It then goes through the same code that
  verifies browser payments. A failed-payment event never changes an order.
- **Retries.** An unexpected error (e.g. the database is down) returns 500
  without recording the event, so Razorpay retries it. Business refusals, such
  as an amount mismatch or an order that can no longer be paid, are final
  answers: they are recorded, return 200, and are reported for a refund when
  money was taken.
- **Razorpay's delivery rules** (from Razorpay's webhook best practices):
  - **5-second timeout.** A response that takes longer counts as failed and is
    sent again. That is harmless here, because processing is idempotent, but
    sustained slowness causes failures.
  - **Duplicates and order.** The same event can arrive more than once, and
    events can arrive out of order. A `payment.failed` never undoes a capture.
    A `refund.processed` that arrives before the capture it refunds is not
    matched: the refund record created afterwards stays open until someone
    checks it against the dashboard.
  - **Retry window, then disabled.** Failed deliveries are retried with
    exponential backoff for **24 hours** after the event. If the webhook keeps
    failing for 24 hours, Razorpay **disables it** and emails the account's
    alert address.

  **Monitoring:**
  - Alert on that email.
  - Alert on 5xx responses from `/api/webhooks/razorpay`, and on
    `Razorpay reconciliation` lines with `"failed"` > 0 or a `"stopped"` value
    other than `null`.

  **Re-enabling after a fix:** in *Account & Settings → Webhooks*, re-enable the
  webhook. Payments from the outage are picked up by the hourly reconciliation
  (if within 4 days). Do not assume events from the disabled period are
  delivered later. Refund confirmations are not recovered by reconciliation, so
  check open **Refund due** records against the dashboard after an outage.

### Late payments and refunds

A customer can finish paying just as the 30 minutes run out, so Razorpay may
report a captured payment for an order that has already expired:

- **Stock still available:** in one transaction, the order is reinstated as
  `PENDING` + `PAID` and its items are taken from stock again (only if every
  item is still active and in stock). It is then fulfilled normally. Its
  `expiredAt` stays on record.
- **Stock gone (or a product withdrawn):** the order stays cancelled and
  unpaid, and the payment is recorded in `unapplied_payments`. The decision and
  the record are made in one transaction under the order's row lock: a failure
  records nothing and changes nothing, and the payment is decided again later
  (webhook retry, refresh, or the late-payment check).
- **Once recorded for a refund, that payment never fulfils the order**, even if
  the stock comes back and the same payment is reported again (browser,
  refresh, `payment.captured`, `order.paid`).
- The same recording happens for any captured payment that cannot be applied:
  - an order the customer cancelled;
  - a second payment for an order that is already paid;
  - an amount or currency mismatch.

  Each payment is recorded once (unique per Razorpay payment), however often it
  is reported. A log line `Razorpay refund required {…}` is also written.

**No refund is issued automatically.** Operators must:

1. In *Admin → Orders*, tick **Refund due only** (or call
   `GET /api/admin/orders?refundDue=true`; combinable with `status`). This lists
   exactly the orders with a captured payment whose refund Razorpay has not yet
   confirmed. Each one's detail page lists the payment (Razorpay payment id,
   amount, reason) under **Payments to refund**. Also alert on
   `Razorpay refund required` in the logs.
2. Refund that payment in the Razorpay dashboard (*Transactions → Payments →
   the payment id → Issue Refund*, for the full amount).
3. Nothing else: when Razorpay sends `refund.processed` for the full amount,
   the record is marked refunded (with the refund id) and the marker clears. A
   partial refund leaves it open. If the marker stays after a refund, check
   that the webhook is subscribed to `refund.processed` and that its
   deliveries succeed.

The customer's order page says the payment will be refunded. It never says a
refund has happened before Razorpay confirms it.

Automated reconciliation only **decides and records**: it pays or reinstates an
order, or records money that must go back. Every refund is issued by a person
in the Razorpay dashboard, and is shown as done only after Razorpay's
`refund.processed` confirms it.

### Staging and production checklist

Nothing below has been run. Steps marked **[read-only]** only read (use a
read-only database account, or `START TRANSACTION READ ONLY;` … `ROLLBACK;`).
Steps marked **[approval]** change something and need explicit sign-off.
Never print secret values while doing any of them.

**Notes on the read-only SQL:**
- **It opens a transaction.** `START TRANSACTION READ ONLY` changes your
  session state. While it is open, it holds metadata locks on the tables it
  has read, and a schema change (the migration's `ALTER TABLE`, `CREATE
  INDEX`) waits for it. End it with `ROLLBACK;` as soon as you're done, and
  never keep one open while a migration runs.
- **Privileges:** the queries need `SELECT` on the app's tables, including
  `_prisma_migrations`. `information_schema` shows only tables the account can
  access, and `SHOW PROCESSLIST` lists other sessions only with the `PROCESS`
  privilege.
- **Confirm the target first:** run `SELECT @@hostname, DATABASE(),
  CURRENT_USER();` and stop if it isn't the intended staging database.

**Times in SQL are UTC.** The app's database adapter writes every `DATETIME`
as UTC, so every query here compares with `UTC_TIMESTAMP(3)`. `NOW(3)`
returns the session's time zone (often the server's local time), and would
shift results by the UTC offset; for example, 5½ hours on an IST server.

**Before deploying (staging first, then production)**

1. **[read-only] Database engine and version.**
   ```sql
   SELECT VERSION(), @@version_comment, @@innodb_version, @@transaction_isolation,
          @@session.time_zone, @@global.time_zone, UTC_TIMESTAMP(3), NOW(3);
   ```
   It must be MySQL 8.x: the code uses `FOR UPDATE` / `FOR SHARE`. MariaDB has
   not been verified. Any isolation level works, because the code relies on
   locking reads and conditional updates.

   Record both time zones. If `NOW(3)` differs from `UTC_TIMESTAMP(3)`, the
   session is not on UTC; that is harmless for the app, but it is why this
   runbook's queries use `UTC_TIMESTAMP(3)`.

   **Is `createdAt` stored as UTC? (diagnostic, no new order)** The step 4
   counts and the migration's `createdAt + 30 minutes` backfill assume it is.
   1. List the most recent existing orders:
      ```sql
      SELECT id, orderNumber, createdAt FROM orders ORDER BY id DESC LIMIT 5;
      ```
   2. Find the matching `POST /api/orders` requests with status `201` in the
      API's access log. With `NODE_ENV=production`, the server logs each
      request in the `combined` format, whose timestamp is UTC, e.g.
      `[25/Oct/2026:09:12:34 +0000]`; the development format has no
      timestamp. Match each order to its request by time order.
   3. If each `createdAt` is within a few seconds of its request's
      timestamp, it is stored in UTC. If they differ by a whole time-zone
      offset (for example 5 h 30 min), the database's local time is being
      stored instead, and the step 4 counts and the backfill are off by that
      offset.

   This is a diagnostic check of recent rows, not proof for every historical
   record. Rows written by earlier code or by hand could differ. Do not place
   a test order for this.
2. **[read-only] Size of what the migration touches.**
   ```sql
   SELECT COUNT(*) FROM orders;
   SELECT COUNT(*) FROM orders WHERE paymentMethod = 'RAZORPAY';  -- rows the backfill updates
   SELECT table_rows, data_length, index_length FROM information_schema.TABLES
   WHERE table_schema = DATABASE() AND table_name = 'orders';
   ```
   **Migration status** (read-only: `prisma migrate status` only reads the
   `_prisma_migrations` table). Run it from `backend/` on a machine that can
   reach the staging database:
   ```sh
   cd backend
   read -rs STAGING_DATABASE_URL       # paste the staging URL; nothing is echoed or saved to history
   DATABASE_URL="$STAGING_DATABASE_URL" DATABASE_SSL=true pnpm exec prisma migrate status
   unset STAGING_DATABASE_URL
   ```
   - The URL is passed only to this one command. Its value is never printed:
     Prisma prints the database name and host, not the password. Don't
     `echo` it or run with `set -x`.
   - Use `DATABASE_SSL=false` only if staging is reached over a trusted
     private network (section 5).
   - Expect `20261025000000_add_reservation_expiry_and_razorpay_webhooks`
     listed as not yet applied.

   On Windows PowerShell:
   ```powershell
   cd backend
   $secure = Read-Host -AsSecureString "Staging DATABASE_URL"
   $env:DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
   $env:DATABASE_SSL = "true"; pnpm exec prisma migrate status
   Remove-Item Env:DATABASE_URL, Env:DATABASE_SSL; Remove-Variable secure
   ```
   The same information in SQL:
   ```sql
   SELECT migration_name, finished_at, rolled_back_at
   FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;
   ```
3. **[read-only] Lock impact of
   `prisma/migrations/20261025000000_add_reservation_expiry_and_razorpay_webhooks/migration.sql`.**
   Review it against the sizes above:
   - **`ALTER TABLE orders ADD COLUMN …` (two nullable columns, appended):**
     normally a metadata-only (instant) change on MySQL 8. It still needs a
     brief metadata lock, so a long-running transaction on `orders` delays it
     (check `SHOW PROCESSLIST` first).
   - **`UPDATE orders SET reservationExpiresAt = … WHERE paymentMethod = 'RAZORPAY'`**
     (the backfill): a single statement, and the main locking risk.
     - **It can scan the whole table.** No index supports
       `paymentMethod`; the only `orders` indexes are on `status` and on
       `(status, reservationExpiresAt)`. So MySQL can read every order, not
       just online ones.
     - **What it locks depends on the environment:** the MySQL version, the
       actual execution plan, the isolation level, the table size and the
       concurrent traffic. Under InnoDB's default `REPEATABLE READ`, an
       `UPDATE` that scans without a supporting index can take extensive row
       and gap (next-key) locks on the rows it scans, and keep them until the
       statement commits. Don't assume the exact footprint (which rows or
       gaps, or for how long) until staging has shown it.
     - **While it runs, other work may wait:** customer payments and
       cancellations, admin status changes, and new orders, not only changes
       to online orders.
     - **Check the access path** (read-only: `EXPLAIN` never runs or locks):
       ```sql
       EXPLAIN FORMAT=TREE SELECT id FROM orders WHERE paymentMethod = 'RAZORPAY';
       ```
       A table scan (`Table scan on orders`) confirms the full scan. Compare
       the estimated rows with the counts in step 2.
     - **Measure on staging:** time the real migration there (**[approval]**,
       step 7) on a copy of production-sized data, and note anything waiting
       during it, before planning production.
   - **`CREATE INDEX orders_status_reservationExpiresAt_idx`:** online
     (concurrent reads and writes allowed). Its time grows with the table.
   - **Two `CREATE TABLE`s and a foreign key on a new, empty table:** no impact
     on existing data.
   - **Failure handling:** MySQL schema changes are not transactional. If a
     statement fails part-way, Prisma marks the migration failed; fix the cause
     and use `prisma migrate resolve` **[approval]** before retrying.
   - **Timing:** until staging has shown the backfill's lock duration is
     acceptable, run the migration in a maintenance window (step 7).
4. **[read-only] Overdue online orders and the stock the first sweep could
   return.**
   - **What the worker selects:** online orders (`paymentMethod =
     'RAZORPAY'`) that are `PENDING`, have `paymentStatus` `UNPAID` or
     `FAILED`, and whose `reservationExpiresAt` has passed. Orders that are
     pending and unpaid but have no deadline are not expired on the first
     sweep; they get a deadline 30 minutes later.
   - **Clocks:** these queries use the database's `UTC_TIMESTAMP(3)`, while
     the worker uses its app server's clock. With NTP on both, they agree to
     within seconds.

   **Before the migration** (the new columns don't exist yet; the backfill
   will set each deadline to `createdAt + 30 minutes`, so the same condition
   is written on `createdAt`):
   ```sql
   -- a. Counts by payment status and Razorpay order
   SELECT paymentStatus, (razorpayOrderId IS NOT NULL) AS has_razorpay_order,
          COUNT(*) AS orders, MIN(createdAt) AS oldest
   FROM orders
   WHERE paymentMethod = 'RAZORPAY' AND status = 'PENDING' AND paymentStatus IN ('UNPAID', 'FAILED')
     AND createdAt + INTERVAL 30 MINUTE <= UTC_TIMESTAMP(3)
   GROUP BY paymentStatus, has_razorpay_order;

   -- b. The list to review (Razorpay order ids are not secret; no customer details)
   SELECT orderNumber, createdAt, paymentStatus, total, currency, razorpayOrderId
   FROM orders
   WHERE paymentMethod = 'RAZORPAY' AND status = 'PENDING' AND paymentStatus IN ('UNPAID', 'FAILED')
     AND createdAt + INTERVAL 30 MINUTE <= UTC_TIMESTAMP(3)
   ORDER BY createdAt;

   -- c. Stock the first sweep could return, per variant
   SELECT oi.variantId,
          SUM(CASE WHEN o.razorpayOrderId IS NULL THEN oi.quantity ELSE 0 END) AS returned_without_razorpay_check,
          SUM(oi.quantity) AS returned_at_most
   FROM orders o JOIN order_items oi ON oi.orderId = o.id
   WHERE o.paymentMethod = 'RAZORPAY' AND o.status = 'PENDING' AND o.paymentStatus IN ('UNPAID', 'FAILED')
     AND o.createdAt + INTERVAL 30 MINUTE <= UTC_TIMESTAMP(3)
     AND oi.variantId IS NOT NULL   -- items whose variant was deleted return nothing
   GROUP BY oi.variantId
   ORDER BY oi.variantId;
   ```

   **After the migration, with the worker still off** (uses the new
   `reservationExpiresAt` column; `expiredAt` stays NULL until the worker
   expires an order):
   ```sql
   -- a. Counts, including orders still without a deadline (created by the old code in a deploy gap)
   SELECT paymentStatus, (razorpayOrderId IS NOT NULL) AS has_razorpay_order,
          (reservationExpiresAt IS NULL) AS missing_deadline,
          COUNT(*) AS orders, MIN(createdAt) AS oldest
   FROM orders
   WHERE paymentMethod = 'RAZORPAY' AND status = 'PENDING' AND paymentStatus IN ('UNPAID', 'FAILED')
     AND (reservationExpiresAt IS NULL OR reservationExpiresAt <= UTC_TIMESTAMP(3))
   GROUP BY paymentStatus, has_razorpay_order, missing_deadline;

   -- b. The list to review
   SELECT orderNumber, createdAt, reservationExpiresAt, paymentStatus, total, currency, razorpayOrderId
   FROM orders
   WHERE paymentMethod = 'RAZORPAY' AND status = 'PENDING' AND paymentStatus IN ('UNPAID', 'FAILED')
     AND (reservationExpiresAt IS NULL OR reservationExpiresAt <= UTC_TIMESTAMP(3))
   ORDER BY reservationExpiresAt IS NULL, reservationExpiresAt, createdAt;

   -- c. Stock the first sweep could return (orders with a deadline only)
   SELECT oi.variantId,
          SUM(CASE WHEN o.razorpayOrderId IS NULL THEN oi.quantity ELSE 0 END) AS returned_without_razorpay_check,
          SUM(oi.quantity) AS returned_at_most
   FROM orders o JOIN order_items oi ON oi.orderId = o.id
   WHERE o.paymentMethod = 'RAZORPAY' AND o.status = 'PENDING' AND o.paymentStatus IN ('UNPAID', 'FAILED')
     AND o.reservationExpiresAt <= UTC_TIMESTAMP(3)
     AND oi.variantId IS NOT NULL
   GROUP BY oi.variantId
   ORDER BY oi.variantId;
   ```

   **What the first sweep will do with them:**
   - **no Razorpay order:** cancelled and its stock returned
     (`returned_without_razorpay_check`);
   - **with a Razorpay order:** Razorpay is asked first:
     - a capture of the right amount pays the order instead;
     - a payment that is authorized, `created` (until the
       `RESERVATION_CREATED_CUTOFF`), in an unknown status, or an
       unreachable or incomplete answer keeps it;
     - otherwise it expires.

     So `returned_at_most` is an upper bound. Look each one up in the
     Razorpay dashboard (viewing only) to see which will be paid, kept or
     released.
   - **missing deadline:** not expired on the first sweep; it gets 30 minutes
     from when the worker first sees it.

   Approve this list, and the stock it may return, before step 9.
5. **[read-only] Configuration on every instance.** Run these in each
   instance's environment, from `backend/`. They load `backend/.env` if the
   instance uses one (variables already set by the platform take precedence),
   print no values, and connect to no database.
   ```sh
   # a. Required variables: prints only "set" or "unset"
   node -e 'require("dotenv").config({ quiet: true }); for (const k of ["NODE_ENV","DATABASE_URL","DATABASE_SSL","JWT_ACCESS_SECRET","JWT_REFRESH_SECRET","CLIENT_URL","TRUST_PROXY","RAZORPAY_KEY_ID","RAZORPAY_KEY_SECRET","RAZORPAY_WEBHOOK_SECRET","RESERVATION_CREATED_CUTOFF","RESERVATION_EXPIRY_WORKER"]) console.log(k, process.env[k] ? "set" : "unset")'

   # b. The same validation the server runs at startup (config/env.js): exits listing
   #    only the names of invalid variables, or prints "configuration valid"
   node -e 'require("dotenv").config({ quiet: true }); import("./config/env.js").then(() => console.log("configuration valid"))'

   # c. The worker must be off until the migration and code are deployed and the
   #    overdue orders (step 4) are approved
   node -e 'require("dotenv").config({ quiet: true }); console.log("reservation worker:", process.env.RESERVATION_EXPIRY_WORKER === "false" ? "OFF" : "ON - must be OFF until step 9")'

   # d. Fingerprint of the effective RESERVATION_CREATED_CUTOFF (unset and "2h" give the same one)
   node -e 'require("dotenv").config({ quiet: true }); import("./config/reservations.js").then(({ createdCutoffMs }) => { const ms = createdCutoffMs(process.env.RESERVATION_CREATED_CUTOFF); console.log("cutoff fingerprint:", ms === null ? "INVALID" : require("crypto").createHash("sha256").update(String(ms)).digest("hex").slice(0, 12)); })'
   ```
   - Every instance must print the same cutoff fingerprint. A match confirms
     the instances are consistent; it does not confirm the value is the one
     you intended. Check that in the deployment configuration.
   - **Clock synchronisation** on every instance (or its host; containers use
     the host's clock):
     - Linux: `timedatectl show -p NTPSynchronized --value` should print
       `yes`, or `chronyc tracking` should show a small "System time" offset;
     - Windows: `w32tm /query /status` should show a recent "Last Successful
       Sync Time".

6. **[approval] Backup and restore drill.**
   - Take a consistent backup: `mysqldump --single-transaction --routines
     --triggers <database>`, or a provider snapshot. It contains customer data,
     so store it encrypted.
   - Restore it into a **separate scratch** database or instance, never over
     the source.
   - Compare the row counts from step 2, and run `prisma migrate status`
     against the restored copy.

**Deploying (staging first; repeat for production after it passes)**

7. **[approval] Migration and code without a gap.**
   - **Preferred: a short maintenance window.** This is the safest option,
     and the one to use until staging has measured the backfill's lock
     duration (step 3). With no traffic, nothing waits behind its locks.
     1. Stop the old instances, or block checkout, so no orders are created.
     2. Run `pnpm run db:migrate` once, from one place.
     3. Start the new code with `RESERVATION_EXPIRY_WORKER=false` on every
        instance.
     4. Re-open.
   - **Without a window:** orders the old code places between the migration
     and the new code have no deadline. The worker gives them 30 minutes from
     first sight later (logged as `Reservation deadline assigned …`), so this
     is handled, but it is not gap-free.
   - **Never start the new code before the migration:** order pages return 500
     until it runs.
8. **[approval] Razorpay test mode** (test keys and test dashboard only; never
   live keys). Create the webhook with the four events, check its test
   delivery returns 200, then run:
   | Scenario | Expected |
   |---|---|
   | Successful payment | Order `PAID`; success page; webhook event outcome `paid` |
   | Failed payment | Order stays `PENDING`/`UNPAID` and payable; webhook outcome `failed_ignored` |
   | Tab closed right after paying | The webhook marks it `PAID` within seconds. If the webhook is off, the hourly reconciliation does |
   | Late payment, stock available or gone | See the procedure below (it needs the worker on, so run it after step 9) |
   | Refund | Refund the refund-due payment in the dashboard. `refund.processed` sets `refundedAt` and the filter clears |
   | Duplicate webhook | Resend an event from the dashboard. The response says `duplicate` and nothing changes |
   | Invalid webhook signature | Send any body to the staging endpoint with a wrong `X-Razorpay-Signature` and a test id in `X-Razorpay-Event-Id`, e.g. `evt_staging_sigcheck_1` (this only reaches your own staging API). Expect **HTTP 400** `Invalid webhook signature`, and no row: `SELECT COUNT(*) FROM razorpay_webhook_events WHERE eventKey = 'evt_staging_sigcheck_1'` returns 0 |
   | Worker disabled | On an instance with `RESERVATION_EXPIRY_WORKER=false`, from startup on: no `Razorpay reconciliation {…}`, `Reservation expiry sweep`, `Reservation deadline assigned` or `Reservation released …` lines. (With the worker on and Razorpay keys set, a `Razorpay reconciliation {…}` line appears right after startup, so its absence is the signal; the sweep line only appears when something changed.) Checkout, payment and the webhook still work there: a test-mode payment is still marked `PAID` |
   | Reconciliation paging | From the first `Razorpay reconciliation {…}` line after the worker is enabled, record `pages`, `complete`, `stopped`, `listed` and `captured`. Expect `"complete":true` and `"stopped":null`. A test-mode account rarely has more than 100 payments in 4 days, so this usually shows one page. Multi-page, duplicate, failed-page and malformed-page handling are validated by the automated tests (`backend/tests/reservations.test.js`, the "reconciliation: …" tests), not here |
   | Created-payment cutoff; Razorpay unreachable or returning incomplete or unknown data | Not reproduced in test mode (no reliable way to hold a payment in `created` for hours, or to make Razorpay fail). Covered by the automated tests in `backend/tests/reservations.test.js` ("cutoff: …" and "in flight: …"). In staging, only confirm `RESERVATION_CREATED_CUTOFF` is identical on every instance |

   **Late-payment procedure** (staging only, after step 9, with the worker on
   in the staging instance):
   1. Place a test-mode online order for a variant whose current stock you
      note, and click **Pay**. Razorpay Checkout opens while the reservation
      is still valid. Do not submit payment details yet: while no payment
      exists, the worker can expire the order. Once you submit, the payment
      is `created` and the order is kept until the cutoff.
   2. **[approval, staging database write]** Move only this order's deadline
      into the past:
      ```sql
      UPDATE orders SET reservationExpiresAt = UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE
      WHERE orderNumber = '<the test order>' AND paymentMethod = 'RAZORPAY'
        AND status = 'PENDING' AND paymentStatus = 'UNPAID';  -- expect 1 row
      ```
   3. Wait up to a minute for the worker's sweep. Expect the log line
      `Reservation expiry sweep {… "expired":1 …}`. Then check (read-only)
      `SELECT status, expiredAt FROM orders WHERE orderNumber = '<the test order>'`:
      it should be `CANCELLED` with `expiredAt` set, and the variant's stock
      back to its noted value. Do not continue until this is confirmed.
   4. **Stock available:** complete the payment in the still-open Checkout.
      Expect the order to be reinstated `PENDING` + `PAID` with
      `razorpayPaymentId` set, stock taken again once, and the log line
      `Razorpay late payment applied`. The webhook event's outcome is `paid`,
      and nothing appears under **Refund due only**.
   5. **Stock gone** (a second test order; repeat steps 1–3 first):
      - **[approval, staging database write]** Set the variant's stock below
        the order's quantity, noting the original value.
      - Complete the payment.
      - Expect: the order stays `CANCELLED`/`UNPAID`; one `unapplied_payments`
        row with reason `expired_stock_unavailable` and `refundedAt` NULL;
        the order under **Refund due only**; the customer page saying the
        payment will be refunded; and a `Razorpay refund required` log line.
      - **[approval]** Restore the stock, then press **Refresh payment
        status** (or resend the webhook). Expect it is **not** reinstated: a
        payment owed back is never used for the order.
      - Finish with the "Refund" scenario above.

   Checkout closes when the order's original reservation ends (its `timeout`
   was set when it opened), so complete each run within 30 minutes of step 1.
9. **[approval] Enable the worker on one instance**
   (`RESERVATION_EXPIRY_WORKER=true`).
   - Watch it for at least an hour, covering several sweeps and one
     reconciliation run: `Reservation expiry sweep {…}`, `Reservation deadline
     assigned …`, `Reservation released after the created-payment cutoff …`
     and `Razorpay reconciliation {…}`.
   - The releases should match step 4.
   - **Turn it off again if:** `"failed"` > 0; `"stopped"` other than `null`
     in reconciliation runs, repeatedly; or anything is released that step 4
     did not predict.
   - Only then enable it on other instances, if wanted.
10. **[read-only] After deployment.**
    ```sql
    SELECT outcome, COUNT(*) FROM razorpay_webhook_events
    WHERE processedAt > UTC_TIMESTAMP(3) - INTERVAL 1 DAY GROUP BY outcome;
    SELECT COUNT(*) FROM unapplied_payments WHERE refundedAt IS NULL;
    ```
    Also check:
    - the online orders still held (query in "Instances, clocks and
      configuration");
    - **Refund due only** in the admin;
    - webhook 5xx responses and the alert email.

**Rollback:** roll back the **code** only, and keep the schema.
- Older code ignores the new columns and tables, so it runs.
- But while it runs:
  - refund obligations are visible only in `unapplied_payments`;
  - the webhook endpoint answers 404, so Razorpay retries and then disables it;
  - nothing expires reservations;
  - new online orders get no deadline.
- After rolling forward again, the worker gives those orders deadlines, and
  the reconciliation job picks up payments from the last 4 days.

**Never drop** `unapplied_payments`, `razorpay_webhook_events` or the new
order columns. There is no down migration.

**Restoring a backup** taken before the release, or any other schema
rollback, discards payment, webhook and refund-owed records written since.
Do it only after:
- an explicit, recorded operator decision;
- exporting `unapplied_payments`, `razorpay_webhook_events` and the affected
  orders;
- reconciling every open refund against the Razorpay dashboard.

(Section 8 says the same.)

### Running the tests

The webhook, expiry and late-payment tests are in
`backend/tests/reservations.test.js`. Like the other database tests, they run
only against a dedicated test database named by `TEST_DATABASE_URL`, never the
development database:

```sh
cd backend
TEST_DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/ecommerce_test" pnpm test
```

The test database must have every migration applied
(`DATABASE_URL=<test url> pnpm run db:migrate`). The tests use a fake
Razorpay and fake keys; they never contact Razorpay. Servers started by tests
run with the expiry worker off (`tests/helpers.js`).

`tests/config.test.js` checks `prisma migrate status` against the test database
named by `TEST_DATABASE_URL`, not the development database, and skips only that
check when the variable is unset.
