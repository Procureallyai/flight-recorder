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
- A bounded Codex App Server standard-input-and-output client with request correlation, raw-reasoning suppression, approval-response support, output limits, and fail-closed malformed-message handling.
- Secure Hash Algorithm 256-bit artifact hashing and a hash-linked event chain.
- A deterministic Merkle root and detached Ed25519 signature.
- An independent command-line verifier with visible tamper failure and an eight-check result, including signed review provenance.
- A deterministic portable directory bundle with detached signature, public key, evidence projections, covered artifacts, review files, scope limitations, an integrity index, and a self-contained report.
- Four parallel GPT-5.6 specialist-review contracts and a synthesis contract, using strict Structured Outputs, `store: false`, no tools, bounded inputs and outputs, timeouts, and an explicit disabled-by-default runtime switch.
- A deterministic seal-readiness policy that remains separate from model judgement.
- Signed human finding decisions that preserve reasons, timestamps, approval evidence, and the distinction between remediation and accepted risk.
- An unsealed genuine-session candidate containing 19 captured events and two final artifacts.

## Current truth

| Surface | Evidence-backed status |
|---|---|
| Local repository | Core build, 88 product tests, and 6 demonstration tests pass. |
| Local session | Command-line initialisation, the authenticated loopback bridge boundary, Codex App Server protocol initialisation, and ephemeral thread creation are verified against desktop-bundled `codex-cli 0.145.0-alpha.18`. A live model turn, streamed observable-event capture, and live approval exchange remain unverified. |
| Genuine Codex capture | Verified through the JavaScript Object Notation fallback. Raw capture is private; the public fixture is sanitised. |
| GPT-5.6 runtime | Request and schema behaviour are tested with a mocked transport. A real billed call is still pending secure 1Password approval. |
| Passport | Synthetic signed fixture verifies. Genuine candidate is intentionally unsealed pending model review and human approval. |
| User interface | Three Product Design directions exist. Implementation is awaiting the entrant’s visual selection. |
| GitHub, deployment, video, and Devpost | Not yet release-complete. These are separate evidence surfaces. |

See [the validation matrix](planning/VALIDATION_MATRIX.md) and [active context](memory_bank/activeContext.md) for current details.

## Repository structure

```text
apps/bridge             Authenticated loopback bridge and Codex preflight
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
pnpm candidate:generate
pnpm security:secrets
pnpm validate:truth
```

`pnpm verify` checks the synthetic cryptographic fixture. `pnpm candidate:generate` rebuilds the genuine, unsealed candidate from the sanitised captured session and its final artifacts.

To export and independently verify the portable synthetic proof bundle:

```zsh
node packages/cli/dist/index.js export-bundle fixtures/demo-passport/passport.json fixtures/demo-passport/artifacts <output-directory>
node packages/cli/dist/index.js verify-bundle <passport-directory> --json
```

The bundle is a directory rather than an archive. This keeps inspection simple and avoids introducing archive-extraction risk during the Build Week release.

## Secret handling

Real secrets must be injected through 1Password Environments. They must not enter task messages, committed files, persistent `.env` files, command output, screenshots, browser code, or public capture fixtures.

`.env.example` contains variable names and non-secret controls only. Runtime GPT review is disabled unless explicitly enabled for one authorised, bounded execution.

## Build Week provenance

Flight Recorder was created as a new standalone repository during OpenAI Build Week 2026. It draws on prior expertise in artificial intelligence assurance, evidence architecture, and cryptographic verification. No pre-existing Evidary production code was copied into this project.

Codex is the primary engineering partner. Human decisions remain explicit, including the hybrid local and hosted architecture, exclusion of private reasoning, narrow cryptographic semantics, deterministic seal gate, public fixture boundary, entrant ownership, and final submission authority.

See [BUILD_WEEK_EVIDENCE.md](BUILD_WEEK_EVIDENCE.md) for dated provenance.

## Licence

The recommended release licence is Apache License 2.0. The licence file will be added only after the individual entrant confirms that legal choice. Until then, package metadata is `UNLICENSED`, and no licence grant is implied.

Agentic development needs more than faster code. It needs evidence that can survive inspection.
