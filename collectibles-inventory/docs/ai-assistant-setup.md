# AI Assistant: Architecture and Setup

## Overview

- **Purpose**: Natural‑language query assistant that can generate safe SQL for the inventory schema and return tabular/summary/chart results.
- **Frontend**: Next.js (app directory) UI under `app/ai-assistant`, calls backend over `BACKEND_URL` with prefix `/api/v1/ai`.
- **Backend**: Django + DRF app `assistant/` exposing chat, SQL generation, SQL execution, and FAQ (vector) endpoints.
- **Intelligence**:
  - LLM: OpenAI Chat Completions (`gpt-4o-mini`) for chat and SQL fallback.
  - Semantic search: Sentence-Transformers embeddings + `pgvector` in Postgres to cache and retrieve FAQ SQL by similarity.

## Frontend

- **Entry/UI**: `app/ai-assistant/components/ai-assistant-interface.tsx`

  - Renders tabs: suggestions, results, FAQ manager, etc.
  - On submit: uses `askSQL` from `@/lib/ai` to obtain SQL (via backend), then POSTs to backend `POST {BACKEND_URL}/api/v1/ai/execute-sql`.
  - Interprets backend response as one of:
    - Table: `{ columns: string[], data: any[][], totalRows?: number, summary?: object }`.
    - Chart: `{ labels: string[], datasets: { label: string, data: number[] }[], summary?: object }`.
    - Summary (fallback): `{ text: string, ... }`.
  - Types: `app/ai-assistant/types/ai-assistant.ts` defines `QueryResult`, `ChartData`, etc.

- **Backend URL**:

  - Defaults to `https://www.conejocoin.net` if `process.env.BACKEND_URL` is undefined.
  - Set `BACKEND_URL` in frontend env for local/dev (e.g., `.env.local`).

- **Settings UI (Secrets)**: `app/settings/components/system-settings-tab.tsx`
  - Persists secrets via backend endpoint `POST {BACKEND_URL}/api/v1/auth/secrets/` with `{ secret_id, secret_value }`.
  - Manages: `OPENAI_API_KEY`, NGC credentials, eBay sandbox/prod keys, DB creds, etc. (AI assistant depends on `OPENAI_API_KEY`).

## Backend (Django app: assistant)

- **Endpoints**: `backend/assistant/urls.py`

  - `POST /api/v1/ai/chat` → non‑streaming chat (LLM): `assistant.views.chat`.
  - `POST /api/v1/ai/chat/stream` → SSE streaming chat: `assistant.streams.sse_chat_stream`.
  - `POST /api/v1/ai/sql` → generate SQL from question: `assistant.views.sql_from_question`.
  - `POST /api/v1/ai/execute-sql` → run safe SELECT SQL: `assistant.views.execute_sql`.
  - `GET/POST /api/v1/ai/faqs` → list/create FAQ SQL entries with embeddings.
  - `GET/PUT/DELETE /api/v1/ai/faqs/<id>` → manage a specific FAQ.
  - `POST /api/v1/ai/faqs/query` → semantic similarity search over cached FAQ SQL.

- **Chat**: `assistant/views.py::chat`

  - Uses OpenAI `gpt-4o-mini` with a system prompt tailored to inventory analytics.
  - Returns `QueryResult` shape with `type: "summary"` and `data.text` as the reply.

- **SQL Generation (RAG‑ish)**

  - Primary path: `assistant/faq_manager.get_faq_sql(question)`
    - Embed question with Sentence-Transformers (`assistant/embeddings.py`).
    - Vector search on `FAQSQLCache.embedding` (pgvector cosine distance).
    - If similar enough (≤ `CACHE_HIT_DISTANCE=0.15`), returns cached SQL.
    - Else fallback to OpenAI (via `assistant/sql_gen.get_sql_query`) with schema prompt, then cache the new Q→SQL with its embedding.

- **SQL Execution**: `assistant/views.py::execute_sql`

  - Accepts body `{ sql: string }`.
  - Validations: trims input; only allows `SELECT`; forbids destructive keywords (`drop`, `delete`, `truncate`, `update`, `insert`, `alter`, `create`).
  - Executes via `django.db.connection.cursor()` and returns either:
    - Table: `{ columns, data, totalRows, summary }`.
    - Chart (heuristic when 2 columns and <= 10 rows and numeric y): `{ labels, datasets, summary }`.

- **FAQ/Vector Models**: `assistant/models.py`

  - `FAQSQLCache(question, sql, embedding: Vector(384), category, created_at)` — 384 dims match MiniLM family.
  - Optional conversation/message models exist but are not wired in by default.

- **Embeddings**: `assistant/embeddings.py`

  - Default model: `all-MiniLM-L6-v2` (configurable via `EMBEDDING_MODEL`).
  - Lazy‑loaded with `lru_cache`.

- **Streaming**: `assistant/streams.py`
  - SSE stream with OpenAI chat for token‑by‑token updates.

## Environment Variables

- **Required**
  - `OPENAI_API_KEY` — used by `assistant/views.py`, `assistant/sql_gen.py`, `assistant/streams.py`.
- **Optional**
  - `EMBEDDING_MODEL` — overrides default Sentence-Transformer.
  - Database connection vars (standard Django `DATABASE_URL` or individual settings) to enable Postgres with pgvector.
  - Frontend: `BACKEND_URL` for API base.

## Data Flow

1. User enters question in UI.
2. Frontend requests SQL from backend (`/api/v1/ai/sql` via `askSQL` path, through FAQ cache + LLM fallback).
3. Frontend posts generated SQL to `/api/v1/ai/execute-sql`.
4. Backend executes safe SELECT and returns tabular/chart/summary payload.
5. UI renders ResultsDisplay; history is kept client‑side in a simple ref.

## Security & Auth

- `chat`, `sql`, `execute-sql`, and `faqs/query` are marked `AllowAny` in code samples for ease of testing; protect in production (JWT/session, CSRF, RBAC).
- FAQ CRUD endpoints require `IsAuthenticated`.
- Secrets are stored server‑side (recommended: GCP Secret Manager) and set as environment variables during deployment.

## Postgres & pgvector

- Model field: `VectorField(dimensions=384)`; cosine similarity used for nearest neighbor search.
- Ensure Postgres extension `pgvector` is installed and Django configured.

## Deployment Notes

- Cloud Run services for backend and frontend; HTTP(S) LB routes `/api/v1/*` to backend and `/` to frontend.
- Use Cloud SQL for Postgres with `pgvector` extension.
- Store `OPENAI_API_KEY` and other credentials in Secret Manager; inject to Cloud Run.
- Monitor token usage and set budgets/alerts.

## Local Development

- Frontend: set `BACKEND_URL=http://localhost:<backend_port>`.
- Backend: set `OPENAI_API_KEY`, DB settings (pg + pgvector), and optional `EMBEDDING_MODEL`.
- Run DB migrations to create `FAQSQLCache`.

## API Contracts (Summary)

- `POST /api/v1/ai/sql` → `{ question, category? }` → `{ sql }`.
- `POST /api/v1/ai/execute-sql` → `{ sql }` → table/chart/summary payloads.
- `POST /api/v1/ai/chat` → `{ query, history? }` → `QueryResult(summary)`.
- `POST /api/v1/ai/chat/stream` → SSE stream of `token` events and `done`.
- `GET/POST /api/v1/ai/faqs` → list/create FAQs.
- `GET/PUT/DELETE /api/v1/ai/faqs/<id>` → manage FAQ.
- `POST /api/v1/ai/faqs/query` → `{ query, category?, limit? }` → top‑k similar FAQs.

## Extensibility

- LLM result typing: add schema/tooling to return explicit chart/table classifications and metadata for visualization.
- Query history: persist user query/SQL/result history with RBAC and retention policies.
- Caching and cost controls: cache SQL results (keyed by normalized SQL + params) and log/token-meter LLM usage per request.
- pgvector indexing: create an ANN index for scale (example)
  - Ensure extension enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
  - For cosine distance: `CREATE INDEX faq_embedding_ivfflat ON assistant_faqsqlcache USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);`
  - Then `ANALYZE assistant_faqsqlcache;` Adjust `lists` with data size; IVFFlat benefits when row count is large.
- Config knobs: expose `CACHE_HIT_DISTANCE` via env (e.g., `RAG_CACHE_HIT_DISTANCE=0.15`) and document tuning trade‑offs.
- SQL execution safety: enforce read‑only transactions, `statement_timeout` (e.g., 5–10s), and a max rows limit; keep SELECT‑only guard and improve parsing if needed.
- Security hardening: change open endpoints to authenticated (JWT/session) and add rate limiting/abuse prevention, especially for `/sql` and `/execute-sql`.
- Infra tuning: set Cloud Run min instances for cold‑start mitigation, allocate memory for embeddings model, and use Cloud SQL connection pooling.
- Dev tooling: provide cURL examples for all endpoints; add unit tests for SQL sanitizer, distance threshold logic, and endpoint permissions.
- Monitoring/telemetry: track cache hit/miss, LLM call counts/latency, SQL execution time, and error rates; set alerts.
- Initialization & ops: document `init_faqs` management command and optional bulk import/export of FAQs.
