# HumanFlow AI

HumanFlow AI is an AI-assisted writing workspace for refining drafts for clarity, flow, and context while keeping meaning and evidence in view. It is designed for essays, research writing, reports, technical documentation, business writing, and everyday drafts.

## What works

- A responsive two-column writing workspace with ten writing modes, audience and purpose controls, tone, length, and US/UK/Indian English settings.
- Server-side refinement through Gemini's generateContent API by default, with OpenAI and OpenAI-compatible Responses API as optional alternatives. Keys stay on the server.
- Paragraph-aware chunking for longer documents, with a 30,000 character request ceiling and up to five chunks per rewrite.
- Citation, quantity, and paragraph-count checks that call attention to changes for manual review. Factual claims and sources are clearly marked as unverified.
- Copy, clipboard paste, clear, download, compare, editable output, theme toggle, and optional edit summaries.
- No draft database or browser draft storage. Text is sent to the configured model provider when you select **Refine my writing**. Provider terms and data controls apply to that processing.
- Friendly missing-key, malformed-request, input-limit, timeout, provider, and rate-limit errors.

The writing checks are simple comparisons, not a quality score, fact checker, plagiarism checker, or proof of authorship. This app does not promise to bypass AI detectors. Always review the result and check facts and sources yourself.

## Requirements

- Node.js 22 or later.
- A Gemini API key from Google AI Studio, or an API key for one of the optional supported providers.

## Setup

```bash
npm install
cp .env.example .env.local
```

Put your key in `.env.local`:

```dotenv
AI_PROVIDER=gemini
AI_MODEL=gemini-flash-lite-latest
GEMINI_API_KEY=your-gemini-api-key
MAX_INPUT_CHARS=30000
```

The app accepts the model IDs `gemini-flash-lite-latest`, `gemini-flash-latest`, and `gemini-3.8-flash` via `AI_MODEL`; model availability and free-tier limits depend on your Google AI Studio account and region. For OpenAI, use `AI_PROVIDER=openai` and `OPENAI_API_KEY`. For an OpenAI-compatible provider, use `AI_PROVIDER=openai-compatible`, `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`. Never prefix API keys with `NEXT_PUBLIC_`; keys are only read from server environment variables. Restart the dev server after changing `.env.local`.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without the configured provider key, the interface still loads and the rewrite endpoint returns a clear setup message instead of pretending to refine text.

## Validation

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

The core tests cover blank input validation, mode validation, quantity/citation checks, word counts, and long-text chunking.

## Deployment

Deploy as a Node.js Next.js application. Configure `AI_PROVIDER`, the corresponding server-side API key (`GEMINI_API_KEY` for Gemini), `AI_MODEL`, and optionally `MAX_INPUT_CHARS`. Keep the `/api/rewrite` route on a Node runtime with a request duration limit suitable for up to five sequential model calls. Check the provider's current free-tier availability and usage limits.

The included request limiter is per process and is a basic abuse guardrail. It resets when an instance restarts and does not coordinate across multiple instances. For a public production deployment, replace it with a shared rate limiter, add appropriate authentication or abuse controls, and set provider usage budgets. Do not log submitted document bodies.

## Privacy and retention

The application does not persist drafts, and its client does not save them to browser storage. When a user asks for a rewrite, the server sends the submitted text and writing preferences to the configured model provider. The app itself does not make claims about the provider's retention or data controls; review the provider terms for the account and service you use. Deploy behind HTTPS and use a server-side key store.

## Troubleshooting

- **AI rewriting is not configured:** Set the selected provider's server-side API key and restart.
- **Provider usage limit or busy response:** Check the provider account's model access and usage limits, then retry later.
- **Request too long:** Split the document into smaller sections (up to 30,000 characters and five internal chunks per request).
- **Timeout:** Try a shorter section or check provider availability.
- **The result flags a changed quantity or citation:** Compare it with your original and correct it before using the text.

## Project structure

```text
src/app/api/rewrite/route.ts  Validated server endpoint and provider calls
src/components/workspace.tsx  Accessible writing workspace and interactions
src/lib/schema.ts             Request and response validation
src/lib/provider.ts           Server-only AI provider adapter
src/lib/rewrite.ts            Prompt construction and response parsing
src/lib/quality.ts            Chunking, counts, and deterministic comparisons
src/lib/rate-limit.ts         Per-process request guardrail
tests/core.test.ts            Core validation and comparison tests
```
