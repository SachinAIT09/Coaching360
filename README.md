# Coaching360 — clickable wireframe (v2)

A clickable prototype of Power Connect AI's QA/Coaching360 (part of Agent360) for City of Lubbock Utilities, built from the supplied mockups and the client's concept documents (Agent Performance Dashboard, Customer Interaction Grading, Coaching Workspace). Client and integration names (Cisco recordings, CIS contact notes) live in `src/data/org.js`. Everything runs on mock data in the browser; edits persist in localStorage only (profile menu → "Reset demo data" restores the seed).

## Run

```
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/ (relative paths + hash routing: host anywhere)
npm run lint       # ESLint
npm test           # Vitest: business-logic regression + UI component tests
npm run test:e2e   # Playwright (builds, serves, tests desktop + mobile; first run: npx playwright install chromium)
npm run check      # all of the above
```

## UI system

- **Tailwind CSS v4** via `@tailwindcss/vite`. The single stylesheet is `src/styles/app.css`: the PowerConnect.AI visual system as CSS variables (brand palette such as `--navy-900`, `--royal-blue`, `--page-bg`, plus semantic tokens like `--surface`, `--fg-muted`, `--success-soft`), exposed as utilities (`bg-surface`, `text-fg-muted`), plus a small component layer for repeated primitives (`btn`, `badge`, `card`, `tbl`, `chip`, `tabs`, `field`).
- Shared React primitives live in `src/components/ui.jsx` (Card, Page, PageHeader, Kpi, Badge, Modal with focus trap, keyboard Tabs, AudioPlayer slider, charts).
- **Themes**: dark (default, the PowerConnect.AI visual system) and light, switched with the sun/moon button in the top bar (Light / Dark / System). A non-default choice is saved in `localStorage` (`coaching360-theme`); the inline script in `index.html` applies it before first paint. Semantic tokens switch on `<html data-theme>`; the navy sidebar stays dark in both themes (`.scope-dark`). Charts use the same CSS variables. To re-brand a tenant, swap `--royal-blue` in `src/styles/app.css` and the logo in `public/brand/`. The sidebar can be collapsed to icons (remembered per browser).
- **Shared UI**: `Card`, `PageHeader`, `Kpi`, `StatGrid`, `Pagination` / `usePages`, `Tabs`, `Modal`, `Badge`, `InitialTile` in `src/components/ui.jsx`; button, input, table, chip, tab and segmented-control styles in the component layer of `app.css`.
- Fonts (Google Fonts): **Ubuntu** for headings, labels and numbers; **Plus Jakarta Sans** for body text, navigation, buttons and inputs.
- Responsive: fixed sidebar from 1024px, slide-in navigation drawer below; tables scroll horizontally inside their card.

## Roles

Sign in at `#/login`. The account decides the role; switch by signing out from the profile menu (top right) and signing in again. All demo accounts use the password `admin`:

| Account | Role |
|---|---|
| `steve@powerconnect.ai` | Supervisor |
| `admin@gmail.com` | Supervisor |
| `agent@gmail.com` | Agent (Camille Dubois) |

These are client-side demo credentials in `src/state/accounts.js`, not real authentication.

| Supervisor (Sophie Laurent) | Agent (Camille Dubois) |
|---|---|
| Sidebar (team level): Home, Review Queue, Call Library, Team Analytics, Reports, QA Template Settings | My Performance, My Calls, My Coaching, My Goals |
| Top nav (one agent, picked with the search box): Agent Performance, Call Grading, Coaching, Goals & Progress | Read-only scores and evidence; can dispute a score and acknowledge or dispute coaching |

Pages that belong to the other role redirect to that role's home.

## Screens

| Route | Screen |
|---|---|
| `#/home` | Today's KPIs, **Ask about your team** (canned answers computed from the data), team table with trends, needs-attention list, coaching due |
| `#/queue` | **Review Queue**: calls from the last 7 days that need a person (low score, negative sentiment, low AI confidence, policy, agent dispute, calibration sample). "Accept AI score" or open in grading |
| `#/performance` | Agent Performance Dashboard: reporting period, KPIs vs prior period (QA, AI-graded, analyzed, coach reviewed, goal compliance) that drill into their calls, weekly/monthly trend with coaching markers, category trends, all goals with RAG status and slipping achieved goals, review activity, recent calls & AI insights, calls impacting the score (overall / category / goal / call type), customer sentiment (situation vs service), trend & risk indicators, quick actions |
| `#/grading` | Customer Interaction Grading: **AI-assisted or manual** grading, AI / Coach / Final columns, required override reasons, Review ID, statuses (AI Graded, In Review, Coach Validated, Coach Graded, Developmental), searchable transcript, AI + coach key moments with timestamps, editable call summary and sentiment, editable highlights / opportunities, tags, evaluation history, scoring guidelines with 1/2/3 definitions, **Save as draft / Finalize / Open in Coaching** |
| `#/coaching` | Opportunities (ranked by gaps) and Sessions history (Draft → Delivered → Acknowledged / Disputed → Resolved) |
| `#/coaching/workspace` | **Coaching Workspace**: agent snapshot, session type (Developmental / Performance / General), reason and employee-request flag, search and link several calls, play recordings with transcript, key moments and the preserved original evaluation, Highlights / Opportunities / Key takeaways notes, action items, active goals with baseline → current, create or update goals, save draft or complete |
| `#/goals` | Goals tied to observable behaviors, measured on every applicable call since assigned: baseline → current and improvement, direction over the last two weeks, update goal (target, due, status) with history, mark achieved, achieved goals monitored for slipping |
| `#/library` | Every call, searchable by Review ID, call ID, topic or tag, with review-type, tag, sentiment and score filters |
| `#/analytics` | Team KPIs, leaderboard, category heatmap, **AI calibration** (reviewer agreement by category), coverage, Agent Assist usage by tenure |
| `#/reports` | QA, sentiment, coverage, top performers, policy alerts, contact notes; CSV export |
| `#/settings` | QA template: edit weights and criteria, then **publish a new version, which re-scores every call**. Also contact-note templates and alert rules |

## How the data works

- About 5,000 calls are generated deterministically (Jan 2 – May 15 2025, "today" = Thu 05/15/2025, 7 agents) in `src/data/calls.js`. Agent profiles hold only generator probabilities. **Every number on screen is derived from the calls** (`src/utils/metrics.js`).
- Transcripts are Alectra-branded and specific to each contact reason (`src/data/intents.js`, `src/data/transcripts.js`). The lines are chosen from the AI scores, so a missed email request, a vague timeframe or a missing recap is visible in the transcript and cited as evidence.
- Finalized reviewer scores replace AI scores everywhere: category %, goals, trends, reports and calibration. Drafts do not count. Developmental (non-graded) reviews, including calls an agent submits for feedback, are excluded from QA averages.
- Scoring: weighted score = sum(weight × score / 3) over the active template criteria (`src/utils/score.js`). Accuracy, Opening and Closing are binary (1 or 3).

**Note:** the mockup's 84% total does not follow from its own scores and weights (they give about 92%), and the two mockups use different weights. The prototype uses the Call Grading matrix weights and computes live, so the sample call 2857391 shows 82%.

## Mocked / out of scope

Real audio and AI scoring, real LLM answers for "Ask", Cisco / CIS / Dashboard360 integrations (the Reports button links to the demo URL), authentication.
