---
name: flight-recorder-delivery
description: Build, continue, review, or release the Flight Recorder OpenAI Build Week project. Use for canonical-truth refreshes, implementation slices, cryptographic passport work, Codex capture, GPT-5.6 review integration, testing, deployment, release evidence, or submission-pack preparation.
---

# Flight Recorder Delivery

## Start with truth

1. Read repository-root `AGENTS.md` and `CANONICAL_TRUTH.md`.
2. Read `memory_bank/projectbrief.md`, `memory_bank/activeContext.md`, `PLANS.md`, `planning/DECISION_LOG.md`, `planning/BLOCKERS.md`, and `planning/VALIDATION_MATRIX.md`.
3. Read the relevant handoff source under `docs/handoff/`. Treat the Product Requirements Document as desired state until implementation evidence exists.
4. Refresh local repository truth before editing. Refresh live GitHub, hosted, browser, or deployment truth only when the task needs that surface.

## Execute one evidence-backed slice

- Prefer the smallest Priority Zero slice that produces a working, testable result.
- Keep memory context, local repository truth, live GitHub truth, browser or hosted truth, deployment truth, and human acceptance separate.
- Preserve user changes. Use a dedicated worktree once a remote and stable `main` branch exist or when parallel lanes begin.
- Do not copy Evidary production code. Prior artificial intelligence assurance expertise may inform decisions only.
- Never persist raw model reasoning, secrets, Codex credentials, private signing keys, or the private `/feedback` Session ID.
- Use advisory GPT-5.6 findings plus deterministic application gates. Never let model output certify correctness, security, compliance, identity, or trusted time.
- Before front-end implementation, invoke `product-design:index`, follow its routed visual-selection workflow, and use accessible shadcn/ui primitives where they accelerate standard component delivery.
- Use sub-agents for bounded parallel research, review, testing, accessibility, security, or documentation work when materially helpful. Keep most core implementation and every final truth claim in the primary task, assign explicit ownership, and never delegate secrets, legal acceptance, purchases, or final submission.

## Validate and close

1. Run the focused tests for the changed behaviour.
2. Run `bash scripts/validate-canonical-truth.sh`.
3. Update active context, validation evidence, decisions, and blockers when their truth changed.
4. Report completed, unactioned, blocked, unverified, validation, blind spots, and the next clean action.
5. Include a Truth Claim Ledger for material completion claims.

## Read detailed sources only when needed

- Product and architecture: `docs/handoff/flight-recorder-build-week-master-prd.md`
- Primary build contract: `docs/handoff/codex-flight-recorder-master-build-prompt.md`
- Current official-rule snapshot: `docs/research/BUILD_WEEK_RULES_SNAPSHOT.md`
- Source map: `references/source-map.md`
