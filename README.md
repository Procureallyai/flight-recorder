# Flight Recorder

**A verifiable engineering passport for software built with Codex.**

A pull request records a result. It rarely preserves the task, commands, approvals, tests, independent review, and final artifact integrity that made the result reviewable.

Flight Recorder captures externally observable engineering activity, applies evidence-linked GPT-5.6 assurance review, and seals the covered record into a portable tamper-evident passport. Verification fails visibly when a covered artifact changes.

The cryptographic claim is deliberately narrow: a valid passport shows that the covered evidence has not changed since it was sealed by the holder of the corresponding signing key. It does not prove software correctness, signer identity, security certification, legal compliance, or trusted time.

## What is implemented

- Strict TypeScript schemas for evidence events, findings, manifests, and signatures.
- Pre-persistence secret redaction, output bounds, identifier pseudonymisation, and raw-reasoning exclusion.
- A genuine sanitised `codex exec --json` capture from `codex-cli 0.145.0-alpha.18`.
- Policy-gated local session initialisation with allowed-root enforcement, Git baseline capture, private permissions, and symbolic-link rejection.
- An authenticated `127.0.0.1` bridge boundary with a random 256-bit session token, one-time fragment pairing, strict loopback origins, and no generic command endpoint.
- A bounded Codex App Server standard-input-and-output client with request correlation, raw-reasoning suppression, command and file approval-response support, output limits, and fail-closed malformed-message handling.
- A fail-closed App Server evidence normaliser for authoritative plans, completed commands and tests, file changes, approval requests and decisions, and terminal turn state.
- Secure Hash Algorithm 256-bit artifact hashing and a hash-linked event chain.
- A deterministic Merkle root and detached Ed25519 signature.
- An independent command-line verifier with visible tamper failure and an eight-check result, including signed review provenance.
- A deterministic portable directory bundle with detached signature, public key, evidence projections, covered artifacts, review files, scope limitations, an integrity index, and a self-contained report.
- Four parallel GPT-5.6 specialist-review contracts and a synthesis contract, using strict Structured Outputs, `store: false`, no tools, bounded inputs and outputs, timeouts, and an explicit disabled-by-default runtime switch.
- A deterministic seal-readiness policy that remains separate from model judgement.
- Signed human finding decisions that preserve reasons, timestamps, approval evidence, and the distinction between remediation and accepted risk.
- An unsealed pre-remediation genuine-session candidate containing 19 captured events and two final artifacts.
- A browser-compatible verifier that uses Web Cryptography, validates the signed manifest, event chain, Merkle root, review provenance, and covered artifacts, and fails closed when cryptography is unavailable.
- A responsive React verification split view bound to the real signed synthetic fixture, with independent proof details, visible verify and loading states, and a safe memory-only tamper demonstration.
- A final-state evidence envelope and command-line finaliser that bind committed artifact bytes, post-commit test evidence, clean scoped Git state, and one stable final commit before candidate assembly.
- A concrete synthetic password-reset token lifecycle with exact expiry rejection, single-process concurrent redemption control, consume-after-success behaviour, retry after action failure, neutral failure responses, and identifier-free telemetry.

## Current truth

| Surface | Evidence-backed status |
|---|---|
| Local repository | Core build, 114 product tests, 10 demonstration tests, canonical-truth validation, production web build, and public-file secret scan pass. |
| Local session | Command-line initialisation, the authenticated loopback bridge boundary, Codex App Server initialisation, ephemeral thread creation, and a bounded live turn with sanitised observable-event capture are verified against desktop-bundled `codex-cli 0.145.0-alpha.18`. No command or file change occurred in the live probe. Live approval exchange remains unverified. |
| Genuine Codex capture | Verified through the JavaScript Object Notation fallback. Raw capture is private; the public fixture is sanitised. |
| GPT-5.6 runtime | Four real specialist calls and one synthesis call completed with `gpt-5.6-sol`. The hardened evidence-bound review returned `not-ready` with 26 findings; a post-remediation rerun remains required. |
| Passport | Synthetic signed fixture verifies. Final-state evidence binding and finalisation are implemented and tested, but the pre-remediation genuine candidate remains intentionally unsealed until a new capture, post-remediation review, and human approval exist. |
| User interface | Floyd selected refined Product Design option 3. The local verification split view runs the actual browser verifier against the signed synthetic fixture and is production-built and interaction-checked through `in-app browser proof`. Public hosted proof remains open. |
| GitHub, deployment, video, and Devpost | Not yet release-complete. These are separate evidence surfaces. |

See [the validation matrix](planning/VALIDATION_MATRIX.md) and [active context](memory_bank/activeContext.md) for current details.

## Repository structure

```text
apps/bridge             Authenticated loopback bridge and Codex preflight
apps/web                Responsive judge replay and independent verifier interface
packages/schema          Signed-envelope and evidence schemas
packages/crypto          Canonicalisation, hashing, Merkle tree, and Ed25519
packages/evidence        Redaction, normalisation, event chaining, and review digest
packages/codex-adapter   Version-pinned Codex App Server client and fallback importer
packages/review          GPT-5.6 review contracts and deterministic seal gate
packages/passport        Genuine manifest assembly
packages/session         Policy-gated local session and Git baseline initialisation
packages/verifier        Independent verification
packages/cli             Capture import, candidate assembly, and verification commands
demo/password-reset-workspace
                         Synthetic defect and genuine Codex remediation
fixtures/demo-session    Public sanitised capture and unsealed candidate
planning                 Decisions, blockers, validation, security review, and continuity
```

## Requirements

- Node.js 22 or later for the tested demonstration workspace.
- pnpm 8.15.9.
- macOS for the currently tested live Codex capture route.
- A compatible signed-in Codex installation for new captures.
- Separately billed OpenAI Application Programming Interface access for genuine runtime GPT-5.6 review.

The hosted judge route will not require an account, an Application Programming Interface key, or local code execution.

## Local interface preview

```zsh
pnpm --filter web dev --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173/`. The current interface is explicitly labelled `Signed synthetic cryptographic fixture` until a new genuine post-remediation capture is bound. Verification runs locally in the browser. Its tamper control changes browser memory only and never writes to a covered file.

## Initialise a local session

Create a private request file outside the public repository after the redaction and storage policies have been displayed and acknowledged:

```json
{
  "repositoryPath": "/absolute/path/to/repository",
  "allowedRoot": "/absolute/path/to/allowed-root",
  "task": "Implement the agreed change.",
  "acceptanceCriteria": ["The required behaviour is tested."],
  "policy": {
    "redactionPolicyDisplayed": true,
    "storagePolicyDisplayed": true,
    "acknowledged": true
  }
}
```

Then initialise the session:

```zsh
node packages/cli/dist/index.js init-session /absolute/path/to/request.json --json
```

Private state is written under the selected repository’s `.flight-recorder/` directory with restrictive permissions. Initialisation fails unless that directory is already ignored by Git. The tool does not silently change the target repository’s ignore rules. Session identifiers, local paths, raw captures, and signing keys must not be committed.

## Local verification

```zsh
pnpm install --frozen-lockfile
pnpm test
npm test --prefix demo/password-reset-workspace
pnpm demo:generate
pnpm verify
pnpm capture:finalise
pnpm candidate:generate
pnpm security:secrets
pnpm validate:truth
```

`pnpm verify` checks the synthetic cryptographic fixture. `pnpm capture:finalise` will bind a new genuine capture to one clean committed demonstration state and its passing post-commit test. Do not run it against the historical pre-remediation capture. `pnpm candidate:generate` accepts only that finalised capture and never rereads the mutable working tree.

To export and independently verify the portable synthetic proof bundle:

```zsh
node packages/cli/dist/index.js export-bundle fixtures/demo-passport/passport.json fixtures/demo-passport/artifacts <output-directory>
node packages/cli/dist/index.js verify-bundle <passport-directory> --json
```

The bundle is a directory rather than an archive. This keeps inspection simple and avoids introducing archive-extraction risk during the Build Week release.

## Secret handling

Real secrets must be injected through 1Password Environments or an explicitly approved permission-restricted local fallback when the value-hiding integration cannot provide a regular-file boundary. They must not enter task messages, committed files, persistent `.env` files, command output, screenshots, browser code, or public capture fixtures.

`.env.example` contains variable names and non-secret controls only. Runtime GPT review is disabled unless explicitly enabled for one authorised, bounded execution.

## Build Week provenance

Flight Recorder was created as a new standalone repository during OpenAI Build Week 2026. It draws on prior expertise in artificial intelligence assurance, evidence architecture, and cryptographic verification. No pre-existing Evidary production code was copied into this project.

Codex is the primary engineering partner. Human decisions remain explicit, including the hybrid local and hosted architecture, exclusion of private reasoning, narrow cryptographic semantics, deterministic seal gate, public fixture boundary, entrant ownership, and final submission authority.

See [BUILD_WEEK_EVIDENCE.md](BUILD_WEEK_EVIDENCE.md) for dated provenance.

## Licence

Floyd approved Apache License 2.0 for the public individual-entry repository. The repository licence file and package metadata record that decision.

Agentic development needs more than faster code. It needs evidence that can survive inspection.
