# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # local dev: tsx server.ts (Express + Vite middleware), http://localhost:3000
npm run build    # vite build only -> dist/ (used for both local preview and Vercel)
npm run preview  # vite preview of the built dist/
npm run lint     # tsc --noEmit (no separate test suite exists in this repo)
```

There is no test runner configured — `lint` (`tsc --noEmit`) is the only automated check. Type-check after any non-trivial change.

## Architecture

**Two deploy targets share the same API logic.** `npm run dev` runs `server.ts`, a local-only Express server (Vite in middleware mode + the API routes) used purely for development. In production the app deploys to **Vercel**: `vite build` produces the static SPA in `dist/`, and `api/*.ts` files become Serverless Functions via Vercel's file-based routing (`api/ia/insights.ts` → `/api/ia/insights`, etc.). Both environments call into the same handler functions in `api/_lib/handlers.ts` — never duplicate route logic in `server.ts`; add it to `api/_lib/handlers.ts` and wire both entry points to it.

**Client talks to Firestore directly, not through the API.** All CRUD for contas, cartões, categorias, lançamentos and faturas goes straight from the React client to Firestore via the Firebase Web SDK (`src/services/firebase/firestore.service.ts`: `subscribeContas`, `subscribeLancamentos`, `salvarLancamento`, etc. — real-time `onSnapshot` subscriptions, not one-off fetches). Data lives under `users/{userId}/{collection}/{docId}`; `firestore.rules` enforces per-user ownership (`request.auth.uid == userId`) with a default-deny for everything else.

**The only server-side routes are the Gemini-backed ones**, because `GEMINI_API_KEY` must never reach the client bundle: `POST /api/ia/extrair-fatura` (parses a fatura PDF/image/text via `GeminiService`), `POST /api/ia/insights` (generates financial insights from a client-computed `DashboardResumo`), and `GET /api/schema-sql` (serves `src/services/schema_financepro.sql` for the in-app "view schema" modal). All three require a Firebase ID token (`Authorization: Bearer <token>`, obtained client-side via `obterTokenAtual()` in `auth.service.ts`) verified in `api/_lib/auth.ts` — this exists to stop the deployed URL being used as a free, unauthenticated proxy to the paid Gemini API. `api/_lib/auth.ts` initializes `firebase-admin` with a `FIREBASE_SERVICE_ACCOUNT` env var JSON when present (needed on Vercel, which has no Application Default Credentials) and falls back to bare `initializeApp()` (works automatically only on GCP infra like Cloud Run/Functions).

**Domain logic for parcelamentos (installment purchases) is centralized in `src/utils/parcelas.ts` (`ParcelamentoService`)**, not spread across components. It parses installment info out of free-text descriptions (`extrairInfoDescricao` — handles several bank statement formats via regex), groups raw `Lancamento` records into `CompraParceladaAgrupada` objects (`agruparComprasParceladas`), and projects future months of installments (`gerarProjecaoMeses`). `FaturasParcelamentosView.tsx` and `LancamentosView.tsx` both render off these grouped/projected structures rather than raw lançamentos. `src/services/domain/recorrencia.service.ts` (`RecorrenciaService`) owns date-rollover math for recurring/installment due dates (handles short months correctly) — reuse it instead of doing manual `Date` arithmetic for anything periodic.

**Company/domain model**: `tipo: 'receita' | 'despesa' | 'transferencia'` lançamentos, optionally tied to a `contaId` (bank account) or `cartaoId` (credit card). A card purchase imported from a fatura is tagged `apenasVisualizacao: true` + `item_fatura`/`detalhamento_cartao` (see `isItemInformativoFatura` in `src/utils/format.ts`) so it shows in the detailed extract without double-counting against the consolidated "Conta a Pagar" fatura lançamento. Fatura re-import reconciliation (matching an incoming item against an existing lançamento) is keyed on `construirChaveLancamento` (normalized descrição + valor + dataVencimento, in `src/utils/format.ts`) — this is intentionally an exact match, not fuzzy, and is shared between the import path and the duplicate-cleanup path in `App.tsx`; don't reintroduce a separate/fuzzy matching rule for one of the two.

**`App.tsx` is the top-level state container** — it owns all Firestore subscriptions and mutation handlers and passes them down as props to the view components in `src/components/` (one component per tab: `DashboardView`, `LancamentosView`, `ContasCartoesView`, `FaturasParcelamentosView`, `ImportacaoFaturaView`, `OrcamentosView`, `IaInsightsView`) plus modal components. Navigation is a plain `currentTab` string in state, not a router — there is no URL-based deep-linking of tabs or open modals.

**Firebase config lives in `firebase-applet-config.json`** (project id, apiKey, etc. — the client-side Firebase Web config, safe to be public) and `.firebaserc` (which project the Firebase CLI targets). If these ever stop matching an actual owned Firebase project (they have before — the repo pointed at AI-Studio-managed projects the account had no IAM rights on), `firebase deploy --only firestore:rules` and any `firebase firestore:databases:*`/`firebase apps:*` CLI command will fail with 403s even though the Firebase console UI still partially works.
