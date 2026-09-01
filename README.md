# Model Council

Four models. One verdict.

One question is answered independently by three models from three different
labs. They then critique each other's answers blind and revise their own. A
fourth model, which wrote no draft, synthesizes the result and reports where
the council disagreed.

That disagreement report is the point. It is a signal a single model cannot
structurally produce.

## The protocol

```
R1  DISPATCH   3 drafters answer in parallel, in isolation.
R2  CRITIQUE   Each drafter sees the others anonymized and shuffled,
               critiques them, then revises its own answer.
R3  JUDGE      A fourth model synthesizes drafts, critiques, and revisions.
```

Anonymization matters: models measurably favour their own and familiar
outputs. Peer drafts are labelled `Draft A` / `Draft B`, shuffled
independently per critic, with self-identifying phrases stripped. The judge
sees seat numbers, never model names.

## Roster

| Seat | Model | Lab |
| --- | --- | --- |
| 1 | `anthropic/claude-sonnet-5` | Anthropic |
| 2 | `openai/gpt-5.4` | OpenAI |
| 3 | `google/gemini-3.1-pro-preview` | Google |
| Judge | `x-ai/grok-4.6` | xAI |

Four labs, so no lab both drafts and judges. About $0.08 per run.

## Setup

```bash
npm install
cp .env.example .env      # add your OPENROUTER_API_KEY
npx prisma migrate dev
npm run dev
```

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Start the app on :3000 |
| `npm test` | Full suite, no network calls |
| `npm run test:live` | One real four-model run (costs ~$0.08) |

## Architecture

The council engine depends only on a narrow `Provider` interface, so the
whole protocol is tested against deterministic fakes with no network access.
`app/api/council/route.ts` is a thin SSE adapter over it. Wrapping the same
engine as a CLI or MCP server needs no changes to its logic.

Local persistence uses SQLite via Prisma; production should swap the Prisma
datasource to the documented Postgres provider.

Failure policy: a single seat failing degrades the run rather than killing
it. Quorum is two drafters plus the judge. If the judge fails, the run fails
— promoting a drafter would reintroduce the self-preference bias the roster
exists to prevent.

Design: `docs/specs/2026-09-01-model-council-design.md`
