# Flight Recorder Build Week Evidence

## Provenance statement

Flight Recorder was created as a new standalone repository during OpenAI Build Week 2026. It draws on the entrant’s prior expertise in artificial intelligence assurance, evidence architecture, and cryptographic verification. No pre-existing Evidary production code was copied into this project.

The repository history and this primary Codex task identify the work performed during the submission period. The private `/feedback` Session Identifier will be retained in a gitignored submission-secret file and entered into Devpost only when generated.

## Dated repository checkpoints

| Commit | Evidence |
|---|---|
| `ff66444` | Canonical truth, operating contract, handoff preservation, and initial Devpost evidence. |
| `88410fe` | Signed passport and independent verifier core. |
| `2b370e3` | Security-hardened verifier, redaction, evidence digest, model-review contract, and fallback importer. |
| `8405073` | Deliberately defective synthetic password-reset baseline. |
| `b524f0f` | Private capture runner and exact Codex remediation task. |
| `75c0e45` | Genuine sanitised Codex remediation capture and six passing demonstration tests. |
| `0115ed4` | Unsealed genuine passport candidate and resource/path hardening. |

## Codex contribution

Codex has been used in this primary task for protocol research, architecture, schema design, cryptographic implementation, evidence processing, command-line tooling, tests, security remediation, documentation, browser-assisted Devpost preparation, and Product Design exploration.

A separate genuine `codex exec --json` run remediated the synthetic password-reset workspace. The public fixture retains 19 observable events while excluding raw reasoning and private identifiers.

## Human decisions

- Product title: `Flight Recorder`, with Codex used only in descriptive copy.
- Individual entrant: Floyd Livingstone Rowe, not Evidary AI Ltd.
- New standalone codebase with no copied Evidary production code.
- Hybrid local capture, public no-login replay, and independent verification.
- Raw reasoning is never persisted.
- GPT-5.6 findings are advisory; deterministic code decides seal readiness.
- Cryptographic wording is limited to integrity under the corresponding signing key.
- Final legal attestations, acceptance of terms, human acceptance, and Devpost submission remain human-only actions.

## GPT-5.6 truth

The repository contains a tested runtime integration contract for four specialist reviews and one synthesis review. A genuine billed GPT-5.6 call has not yet occurred because secure 1Password approval is pending. No submission or video may claim completed runtime use until [the validation matrix](planning/VALIDATION_MATRIX.md) records direct evidence.

## Validation commands

```zsh
pnpm test
npm test --prefix demo/password-reset-workspace
pnpm demo:generate
pnpm verify
pnpm candidate:generate
pnpm security:secrets
bash scripts/validate-canonical-truth.sh
```

Local repository evidence does not prove live GitHub publication, hosted deployment, browser acceptance, video eligibility, Devpost completion, or human acceptance. Those surfaces remain separate until directly verified.
