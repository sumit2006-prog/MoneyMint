# MoneyMint

**Track · Plan · Save · Grow**

MoneyMint is a responsive personal finance app built around a simple daily overview. It includes account registration, private transaction and budget data, income tracking, recurring items, analytics and insights, statement review, report downloads, Telegram capture, and an optional n8n workflow. The supplied MoneyMint logo is kept as `public/assets/moneymint-logo.png`.

## What works

- Email and password signup/login with bcrypt password hashes, signed JWTs, protected APIs, and owner-scoped database queries.
- Income and expense CRUD, search, category/date/payment filters, sorting, and pagination.
- Daily, weekly, monthly, and category budgets with configurable threshold values and LOW / MEDIUM / HIGH / OVER LIMIT states.
- Dashboard, current and previous month comparisons, category breakdowns, spending trends, savings statistics, and data-based insights.
- CSV, Excel, and text-based PDF statement parsing. Imported entries go to a review screen first; duplicates are highlighted and skipped on confirmation.
- PDF and CSV report downloads plus an Excel workbook with summary and transaction sheets.
- Recurring transaction schedules with pause/resume and a “Record now” action. Scheduled automatic posting needs a scheduler.
- Optional Telegram bot webhook and n8n transaction-capture workflow. Telegram and scheduled notifications need bot/n8n credentials.
- Light/dark/system appearance preference, responsive mobile navigation, and a demo seed account.

Scanned image PDFs need OCR, email password resets need an email provider, and AI categorization is left optional. The import screen explains the PDF limitation before upload.

## Requirements

- Node.js 20 or newer and npm
- MongoDB 4.2 or newer running locally, or a MongoDB Atlas connection string

## Run locally

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` in the repository root. Set `MONGODB_URI` and replace `JWT_SECRET` with a long random value. For a local database, the example URI uses `mongodb://127.0.0.1:27017/moneymint`.

3. Start MongoDB, then seed optional development data:

   ```bash
   npm run seed
   ```

   Set `DEMO_SEED_PASSWORD` in `.env` to a private passphrase of 16–72 UTF-8 bytes before seeding. The demo seed is disabled in production and never overwrites the account's existing transactions.

4. Start the Vite client and Express API:

   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173). The Vite development server proxies `/api` to `http://localhost:4000`. The API health endpoint is [http://localhost:4000/api/health](http://localhost:4000/api/health).

To run only one part, use `npm run dev:client` or `npm run dev:server`. `npm run build` creates the static client in `dist/`; deploy it to a static host and set `VITE_API_URL` to your public API base (for example, `https://api.example.com/api`). Configure `CLIENT_ORIGIN` on the API to the deployed client origin. Terminate TLS at the hosting proxy and keep `.env` outside the web root.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret used to sign login tokens; use a long random value |
| `JWT_EXPIRES_IN` | No | JWT lifetime (defaults to `7d`) |
| `FINANCIAL_TIMEZONE` | No | IANA timezone used for day/week/month boundaries (defaults to `Asia/Kolkata`) |
| `CLIENT_ORIGIN` | No | Allowed browser origin(s), comma-separated; defaults to the Vite URL |
| `PORT` | No | API port (defaults to `4000`) |
| `DEMO_SEED_PASSWORD` | No | Private 16–72-byte passphrase required only to run the development seed |
| `TELEGRAM_BOT_TOKEN` | No | Token from BotFather; used for Telegram replies |
| `TELEGRAM_WEBHOOK_SECRET` | No | Telegram webhook secret and n8n shared header value |
| `N8N_WEBHOOK_URL` | No | Optional configured n8n workflow/webhook URL, shown in Settings status |
| `AI_API_KEY` | No | Reserved for a future optional AI categorizer |
| `VITE_API_URL` | No | Client API base for deployments; defaults to `/api` |

Never commit `.env`. The backend exits with a clear message if the database URI or JWT secret is missing.

## Telegram bot

1. Create a bot through [BotFather](https://core.telegram.org/bots#how-do-i-create-a-bot) and copy its token into `TELEGRAM_BOT_TOKEN`.
2. Generate a random `TELEGRAM_WEBHOOK_SECRET` using a password manager or a cryptographically secure random generator. For Telegram's `secret_token`, use only letters, numbers, `_`, or `-`. Restart the API.
3. Deploy the API to an HTTPS address reachable by Telegram. Register the direct webhook with Telegram's `setWebhook` Bot API method:

   ```bash
   curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
     -d "url=https://YOUR_API/api/integrations/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

   Telegram sends the secret in `X-Telegram-Bot-Api-Secret-Token`.
4. Message your bot with `/start`. It returns the chat ID. In MoneyMint **Settings → Telegram**, save that ID.
5. Try `spent 150 food`, `I spent ₹230 on dinner yesterday`, or `received 5000 from parents`. `/balance`, `/today`, `/week`, `/month`, `/budget`, `/history`, `/report`, `/upcoming`, `/undo`, and `/help` are supported.

Keep the bot token and webhook secret private. Telegram bot chats are not end-to-end encrypted.

### n8n option

Import `n8n/workflows/telegram-transaction.json` into n8n and configure a Telegram credential for the same bot. Set these environment variables on n8n:

- `MONEYMINT_API_URL` — the API origin, such as `https://api.example.com`
- `MONEYMINT_TELEGRAM_WEBHOOK_SECRET` — the same value as `TELEGRAM_WEBHOOK_SECRET`

Activate the workflow and add your Telegram chat ID in MoneyMint Settings. The workflow forwards the Telegram chat ID and message to the authenticated server integration, which maps the chat to exactly one MoneyMint user and replies in Telegram. A Telegram bot can have only one active incoming webhook at a time: use the direct server webhook **or** the n8n Telegram Trigger for this bot, not both.

Budget threshold alerts are sent to Telegram when an expense crosses a configured threshold and Telegram budget alerts are enabled in Settings. For scheduled summaries, import `n8n/workflows/scheduled-summary.json`, configure its Telegram credential, set the same environment variables, and activate it. It runs at 9 PM Asia/Kolkata and sends only to accounts that opted into Telegram daily summaries. To send weekly or monthly summaries instead, change the request's `period` to `week` or `month` and adjust the schedule. n8n is optional; MongoDB and the Express API remain the source of truth.

## API overview

User routes require `Authorization: Bearer <JWT>`. Telegram's direct webhook checks `X-Telegram-Bot-Api-Secret-Token`; n8n integration routes use `x-telegram-webhook-secret`.

| Method and path | Purpose |
| --- | --- |
| `POST /api/auth/register`, `POST /api/auth/login` | Create an account or sign in |
| `GET /api/auth/me`, `PUT /api/auth/me` | Read/update profile and preferences |
| `GET/PUT /api/auth/preferences` | Read/update notification preferences |
| `GET /api/transactions`, `POST /api/transactions` | List and add income/expense transactions |
| `PUT /api/transactions/:id`, `DELETE /api/transactions/:id` | Edit or remove an owned transaction |
| `GET /api/income` | List only the current user's income transactions |
| `GET/POST /api/budgets`, `PUT/DELETE /api/budgets/:id` | Read and manage budgets |
| `GET /api/analytics?range=7d\|30d\|6m\|1y`, `GET /api/insights` | Analytics summaries and derived insights |
| `GET/POST /api/categories` | Read or create categories |
| `POST /api/import/statement`, `POST /api/import/confirm` | Parse a statement, then confirm selected reviewed rows |
| `GET /api/reports?start=YYYY-MM-DD&end=YYYY-MM-DD&format=json\|csv\|pdf\|xlsx` | Read or download a date-range report |
| `GET/POST /api/recurring`, `PUT/DELETE /api/recurring/:id` | Manage recurring entries |
| `POST /api/recurring/:id/record` | Record a due recurring entry as a transaction |
| `POST /api/integrations/telegram/webhook` | Receive Telegram Bot API updates |
| `POST /api/integrations/telegram/process` | Shared-secret endpoint for an n8n Telegram Trigger |
| `POST /api/integrations/telegram/summaries` | Shared-secret endpoint for opt-in scheduled summaries |
| `GET /api/health` | API and MongoDB status |

Example transaction request:

```http
POST /api/transactions
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "amount": 230,
  "type": "expense",
  "category": "Food",
  "description": "Dinner",
  "date": "2026-10-01T12:00:00.000Z",
  "paymentMethod": "UPI",
  "merchant": "Cafe",
  "source": "manual"
}
```

## Data and security notes

MongoDB models live in `server/models/`. Every financial query is scoped to the authenticated user's ID. Passwords are hashed with bcrypt; APIs validate transaction amounts and dates; uploads are held in memory and limited to 8 MB and CSV/XLSX/PDF extensions. Statement content and imported rows are not written to an uploads directory. JWTs are stored in browser local storage for this local app; for a public deployment, use HTTPS, a strict Content Security Policy, dependency updates, and consider moving tokens to secure, HttpOnly cookies behind the API.

User-specific collections: `User`, `Transaction`, `Budget`, `Category`, `RecurringTransaction`, `ImportedStatement`, and `NotificationPreference`.

## Project structure

```text
src/                    React pages, shared components, API and auth state
server/models/           Mongoose data models
server/routes/            Express REST routes and request handling
server/middleware/        Authentication and input validation
n8n/workflows/             Importable optional Telegram workflow
public/assets/             Supplied MoneyMint logo
```
