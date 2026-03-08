
# ReplyMind

ReplyMind is a prototype/experimental app that helps LinkedIn creators write better posts by simulating audience reactions, surfacing analytics, and offering coaching edits based on your real audience data.

At its core, the service ingests a draft post and predicts how different audience personas (derived from your own LinkedIn Audience Analytics exports) will respond. Simulations return a score and a set of detailed feedback items grouped by strengths, weaknesses, and suggested fixes. Over time runs are aggregated to surface trends, recurring themes, and weekly signals to keep you focused on what matters.

---

## 🚀 Key Features

- **LinkedIn Analytics Import** – Upload your audience export (`.xlsx` or `.xls`) and the system builds persona profiles, demographic breakdowns, and affinity categories.
- **Audience Simulation** – Draft a post and run it through the simulator; the AI returns a normalized score along with detailed, persona‑aware feedback.
- **Deterministic & Auditable Scoring** – The scoring logic is stable and traceable, allowing you to compare iterations of the same post and track improvements.
- **Quota & Billing Protection** – API key usage is guarded with both authenticated and anonymous quotas enforced via Supabase RLS and a service-role client.
- **Dashboard & Trends** – A personalized dashboard replaces raw run counts with analytics‑derived affinities, recurring strengths/weaknesses, and curated weekly signals.
- **Coaching Guidance** – Feedback is reformatted into concise, actionable edits instead of verbose explanations.
- **Persona Caching** – Once your LinkedIn file is processed, persona packs are cached for faster subsequent simulations.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 15 with React 19, Tailwind CSS, Clerk authentication
- **Backend:** Next.js API routes (App Router), Supabase PostgreSQL with RLS, service-role server client
- **AI:** Google Gemini via `@google/genai` for simulation and coaching prompts
- **Parsing:** `xlsx` library for Excel exports
- **Hosting/Deployment:** (not documented here – presumably Vercel or similar)

---

## 📁 Repository Structure

- `/app` – Next.js pages and API route handlers
- `/lib` – Domain logic (scoring, parsing, persona generation, Supabase helpers)
- `/data` – Static assets such as weekly signals and persona templates
- `/hooks` – React hooks for auth and mobile detection
- `/supabase_schema.sql` – Database schema migrations and additions

---

## ✅ Progress to Date

1. **Initial Simulation MVP** – Basic draft input, AI response, scoring framework
2. **Analytics Import & Persona Modelling** – Support for LinkedIn export, demographics parsing, persona creation
3. **Quota Enforcement & Billing Prep** – Anonymous and authenticated usage limits, intent to add real billing later
4. **UI Improvements** – Upload flow, results styling, coaching reformatting
5. **Dashboard Build** – Added `/dashboard` page; originally displayed simulation history, later refactored into analytics summaries and weekly signals per latest design
6. **Weekly Signals** – Static dataset with topical prompts and writing tips surfaced in the dashboard
7. **Documentation** – Readme trimmed and iteratively improved with every milestone

Areas still on the short‑term roadmap include run tagging, experiment labeling, comparison views between simulations, and an administrative interface for editing weekly signals.

---

## 🧭 Roadmap & Next Steps

- Add **tagging/hypothesis fields** so users can track iterations against a goal
- Build **comparison view** to diff two earlier simulations and highlight improvements
- Develop **admin UI** for managing weekly signals and persona templates
- Integrate real **billing/paid tiers** once usage patterns justify it
- Explore **export options** (CSV, PDF) for simulation histories and dashboard reports

---

## 📄 Getting Started Locally

1. Clone the repo and `cd` into it.
2. Install dependencies: `npm install`.
3. Set up a Supabase project, enable RLS, and update `.env` with keys.
4. Run migrations using `supabase` CLI or apply `supabase_schema.sql` manually.
5. Start the dev server: `npm run dev`.
6. Navigate to `http://localhost:3000` and sign in via Clerk.

> ⚠️ This project is experimental; design decisions are in flux and the schema may change frequently.

---

## 📝 Notes

- The simulation scoring logic lives in `lib/scoring.ts` and is intentionally deterministic to make comparisons easy.
- Persona generation is in `lib/linkedin-analytics.ts`; it handles multi‑sheet exports and caches results per user.
- Dashboard analytics summaries are served by `/api/simulations/user/[userId]` and rely on JSONB aggregates stored alongside each run.

---

Thank you for exploring ReplyMind! Contributions and ideas are welcome – just open an issue or pull request.


