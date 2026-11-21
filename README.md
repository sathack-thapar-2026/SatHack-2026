# PayZorr

Milestone-based freelance contracts with AI-assisted delivery review and secure payments.

A client and a freelancer agree on a project split into milestones, each with a price and acceptance
criteria. The freelancer submits work, Gemini checks it against the criteria (advisory only), the client
approves, and payment is released through the checkout. Every step is recorded in an activity log and ledger.

## Tech stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend:** Next.js route handlers (`src/app/api`)
- **Database and auth:** Supabase (PostgreSQL + Auth)
- **AI:** Google Gemini API (audits and invoices)
- **Payments:** hosted checkout (sandbox by default), orders are created and captured server-side

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev                  # http://localhost:3000
```

Database setup: run the files in `supabase/` in order — `schema.sql`, then `migrations/002` … `005`
(005 aligns the schema with what the app writes and is safe to run repeatedly).

## How access control works

- Every protected API route verifies the caller's **Supabase access token** on the server
  (`src/server/auth.ts`). The browser sends it automatically through `authFetch` (`src/lib/api-client.ts`).
- Who you are is never read from a request body, query string or custom header.
- A user can only see and change projects where they are the client or the freelancer, and each action
  is limited to the right side (for example only the client can approve work or pay; only the freelancer
  can submit work).
- Milestones follow a strict order: `not started → in progress → submitted → approved → paid`. The server
  rejects out-of-order actions, so a paid milestone can never be re-opened or paid twice.
- Payment amounts always come from the stored contract, and the server inspects an order before capturing it.

## Project layout

| Path | What lives there |
| --- | --- |
| `src/app` | Pages (landing, auth, dashboard, invitations) and API routes |
| `src/server` | Server-only code: auth, database layer, payments, Gemini, identity lookup |
| `src/lib` | Shared types and data, the dashboard state store, the authenticated fetch helper |
| `src/components` | Landing page and dashboard UI |
| `supabase` | SQL schema and migrations |
| `scripts` | Older ad-hoc API scripts. They were written before token authentication and send identity in the request, so they need updating before they can be used again. |

## Notes

- Uploaded files are limited to 5 MB each and 8 MB per submission.
- Checkout currencies: USD, EUR, GBP, CAD, AUD. Contracts in other currencies must be changed before payment.
- This is a hackathon prototype running against a payment **sandbox**.
