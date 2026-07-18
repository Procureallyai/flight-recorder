# Flight Recorder Canonical Truth Map

This file defines where truth lives. It does not make planned functionality real.

## Source precedence

1. Current official OpenAI Build Week rules and the authenticated live Devpost form.
2. Final tested release artifacts and direct local validation.
3. Live GitHub repository, Pull Request, review-thread, workflow, and release state.
4. Direct hosted and deployment inspection.
5. `docs/submission/submission-metadata.json` once created from verified release facts.
6. `memory_bank/activeContext.md` for current project status.
7. `planning/DECISION_LOG.md`, `planning/BLOCKERS.md`, and `planning/VALIDATION_MATRIX.md`.
8. `memory_bank/projectbrief.md` for stable product intent.
9. `docs/handoff/flight-recorder-build-week-master-prd.md` for desired scope.
10. Other prompts and historical notes as context only.

## Canonical files

- Stable product truth: `memory_bank/projectbrief.md`
- Current state and continuity: `memory_bank/activeContext.md`
- Execution plan: `PLANS.md`
- Decisions: `planning/DECISION_LOG.md`
- Blockers: `planning/BLOCKERS.md`
- Validation evidence: `planning/VALIDATION_MATRIX.md`
- Current rule snapshot: `docs/research/BUILD_WEEK_RULES_SNAPSHOT.md`
- Imported source documents and hashes: `docs/handoff/`
- Public writing style: `docs/writing/DISCIPLINED_FRONTIER_STYLE.md`
- Repository operating rules: `AGENTS.md`

## Closure rule

A completion claim must identify its evidence surface. Local repository completion does not imply GitHub publication, hosted deployment, Profile 7 browser proof, final Devpost submission, or human acceptance.
