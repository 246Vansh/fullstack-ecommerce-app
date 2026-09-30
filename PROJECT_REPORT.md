# E-commerce App — Project Audit & Completion Plan

2026-09-30

## Executive summary

The frontend UI is about 70% done. The backend is 0% done. Every page renders, but only with hard-coded demo data. Nothing talks to a server: there are no API calls, no database, and login does nothing.

The production build passes (`vite build`, 414 kB JS, 118 kB gzipped).

Top 3 priorities:

1. Fix the repo: `node_modules` (33,000+ files) and `backend/.env` are committed to git.
2. Build the backend: `server.js`, the DB config and the Prisma schema are all empty files.
3. Connect the frontend: replace the `constants/*.js` demo data with API calls, and make auth real.

## What is already built

**Stack:** the frontend uses Vue 3, Vite 8, Tailwind 4 and Vue Router 5. The backend is planned as Express 5, Prisma 7 and MySQL, with JWT, bcrypt, helmet, rate-limit and multer installed but not used yet.

| Area | Status | What exists |
| --- | --- | --- |
| Home page | UI done | Hero, categories, featured, sale, favorites sections |
| Product list | UI done | Filters (category, brand, price, color, size, stock), sort, pagination, search. Logic is in `useProducts.js` |
| Product details | UI done | Gallery, color/size/quantity pickers, tabs, reviews, related products |
| Cart | UI done | Items, summary, tax at 8%, shipping banner, recommendations. Uses static data |
| Checkout | UI done | Contact, address, delivery, payment, coupon, notes. `placeOrder()` only logs to the console |
| Order success, track order, invoice | UI done | Static demo data from `constants/` |
| Auth pages | UI only | Sign in/up, forgot/reset password, verify email. Handlers only log to the console |
| Layout | UI done | Header, mega menu, mobile menu, footer, 404 page |
| Backend | Not started | Only `package.json`. Every other file or folder is empty |

## Issues found

There are 12 issues. 3 are critical and must be fixed before any other work.

| # | Severity | Issue | Where | Fix |
| --- | --- | --- | --- | --- |
| 1 | Critical | `node_modules` is committed (33,000+ files) | `backend/node_modules` | Add a root `.gitignore`, then run `git rm -r --cached backend/node_modules` |
| 2 | Critical | `.env` is tracked in git. It is empty now, but secrets added later would leak | `backend/.env` | Add `.env` to `.gitignore`, `git rm --cached backend/.env`, commit a `.env.example` |
| 3 | Critical | The backend has no code | `backend/server.js`, `config/db.js`, empty `controllers/ models/ routes/ middleware/ services/ utils/` | Build it (see roadmap, phase 2) |
| 4 | High | Auth does nothing: `handleSignIn` and the other handlers only call `console.log` | `composables/useAuth.js:109-129` | Call the auth API and store the user in a Pinia store |
| 5 | High | Auth store, service and route guard are empty files | `stores/authStore.js`, `services/authService.js`, `router/authGuard.js` | Implement them. Protect `/checkout`, `/trackOrder` and `/invoice` |
| 6 | High | Pinia is installed but never registered | `main.js` | Add `app.use(createPinia())` |
| 7 | High | The cart is local to each component: it resets on refresh and is not shared with the header | `composables/useCart.js` | Move it to a Pinia store, persist it to localStorage for guests and sync it to the DB after login |
| 8 | High | Placing an order does nothing | `composables/useCheckout.js:135` | POST to `/api/orders` and redirect using the real order id |
| 9 | Medium | 404 route import uses the wrong case (`NotFoundPage.vue` vs `notFoundPage.vue`). It works on Windows but breaks on a Linux server | `router/routes.js` | Rename the file or fix the import |
| 10 | Medium | 23 empty component and constant files, e.g. all brand, payment and social icons, `authMessage.vue`, `validationRules.js` | `components/icons/*`, `constants/auth/*` | Fill them in or delete them |
| 11 | Medium | API URL is hard-coded to `localhost:5000` | `config/api.js` | Use `import.meta.env.VITE_API_URL` |
| 12 | Low | No lazy-loaded routes, so everything ships in one 414 kB bundle. Other issues: duplicate `invoice` import, an unused `fileURLToPathBuffer` import, two icon libraries (`@lucide/vue` and `lucide-vue-next`), a stray `.stackdump` file, backend `pnpm-workspace.yaml` left unfinished, and no tests or linter | `routes.js`, `vite.config.js`, `package.json` | Use `() => import()` for routes, remove duplicates, add ESLint and Vitest |

## What is missing

These are the parts every working store needs that do not exist yet.

- **Database schema** (Prisma): User, Address, Category, Product, ProductVariant (size/color/stock), ProductImage, Cart, CartItem, Wishlist, Order, OrderItem, Payment, Coupon, Review
- **Auth API:** register, login, logout, refresh token (httpOnly cookie), verify email, forgot/reset password, role (customer/admin)
- **Catalog API:** list with filter/sort/pagination/search, product details, categories
- **Cart and wishlist API**
- **Orders API:** create an order with stock check and price recalculated on the server, order history, tracking status, invoice data
- **Payments:** Razorpay or Stripe, with webhook verification. Never trust the total the client sends
- **Coupons:** validated on the server
- **Email:** verification, password reset and order confirmation, e.g. Nodemailer or Resend
- **Image uploads:** multer plus Cloudinary or S3
- **Admin panel:** manage products, orders, users and coupons
- **User account pages:** profile, addresses, order history, wishlist
- **Frontend API layer:** an axios instance, services per domain and Pinia stores. Loading and error states and toasts. `vue-toastification` is installed but unused
- **Quality and ops:** input validation (`express-validator`), central error handler, logging, tests, ESLint, deployment and CI

## Step-by-step roadmap

Work through the phases in order. Each phase depends on the one before it. Tick each task off as you finish it.

**Phase 1: Clean the repo (about 1 hour)**

- [ ] Add a root `.gitignore` covering `node_modules`, `.env`, `dist`, `uploads` and `*.stackdump`
- [ ] Untrack `backend/node_modules` and `backend/.env`, then add `backend/.env.example`
- [ ] Finish `backend/pnpm-workspace.yaml` by setting `allowBuilds` to true for prisma. Add `dev` and `start` scripts
- [ ] Fix the 404 import case, the duplicate `invoice` import and the unused vite import

**Phase 2: Backend foundation (days 1-3)**

- [ ] Run `prisma init` and write the schema from "What is missing". Run `prisma migrate dev` and create a seed script that moves the current `constants/` demo data into MySQL
- [ ] `server.js`: express, helmet, cors (frontend origin, credentials), cookie-parser, morgan, rate limit, a `/api` router and a central error handler
- [ ] Folders: `routes/`, `controllers/`, `services/` (business logic), `middleware/` (auth, validate, admin), `utils/`

**Phase 3: Auth end to end (days 4-6)**

- [ ] Backend: register and login with bcrypt, a short-lived access JWT plus a refresh token in httpOnly cookies, `/me`, logout, verify email, forgot/reset password
- [ ] Frontend: register Pinia, create an axios instance from `config/api.js`, then build `authService.js`, `authStore.js` and `authGuard.js`
- [ ] Replace the `console.log` handlers in `useAuth.js`. Protect the checkout and order routes

**Phase 4: Catalog (days 7-9)**

- [ ] `GET /api/products` with filter, sort, pagination and search done in the DB. Add `GET /api/products/:id` and `GET /api/categories`
- [ ] Make `useProducts.js` fetch from the API. Move filtering to the server once there are more than a few hundred products
- [ ] Home, product list and product details pages read from the API. Add loading skeletons and error states

**Phase 5: Cart, wishlist and checkout (days 10-14)**

- [ ] Cart store in Pinia: localStorage for guests, merged into the DB cart on login. Header shows the item count
- [ ] `POST /api/orders` recalculates prices, tax, shipping and coupon on the server and checks and reserves stock in a transaction
- [ ] Payment gateway: create the payment, verify its signature or webhook, then mark the order paid (open question: Razorpay or Stripe?)
- [ ] Order success, track order and invoice pages load by order id

**Phase 6: Account and admin (days 15-20)**

- [ ] Account pages: profile, addresses, order history, wishlist, reviews
- [ ] Admin: CRUD for products (with image upload), orders and status updates, coupons and users
- [ ] Transactional emails

**Phase 7: Production ready (days 21-25)**

- [ ] Validation on every endpoint. Fill in or delete the 23 empty files
- [ ] Lazy-load routes, add ESLint and Prettier, add Vitest and Supertest tests for auth and orders
- [ ] Use env-based config and deploy the frontend (Vercel/Netlify), the API (Render/Railway/VPS) and a managed MySQL DB. Add CI on GitHub Actions
