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
- A review-bound genuine-session candidate containing 17 events, four committed artifacts, 19 evidence-linked findings, and five GPT-5.6 review receipts.
- A browser-compatible verifier that uses Web Cryptography, validates the signed manifest, event chain, Merkle root, review provenance, and covered artifacts, and fails closed when cryptography is unavailable.
- A responsive React verification split view bound to the signed genuine-session passport for the synthetic demonstration, with independent proof details, visible verify and loading states, and a safe memory-only tamper demonstration.
- A final-state evidence envelope and command-line finaliser that bind committed artifact bytes, post-commit test evidence, clean scoped Git state, and one stable final commit before candidate assembly.
- A concrete synthetic password-reset token lifecycle with exact expiry rejection, single-process concurrent redemption control, consume-after-success behaviour, retry after action failure, neutral failure responses, and identifier-free telemetry.

## Current truth

| Surface | Evidence-backed status |
|---|---|
| Local repository | Core build, 126 product tests, 16 demonstration tests, canonical-truth validation, production web build, and public-file secret scan pass. |
| Local session | Command-line initialisation, the authenticated loopback bridge boundary, Codex App Server initialisation, ephemeral thread creation, and a bounded live turn with sanitised observable-event capture are verified against desktop-bundled `codex-cli 0.145.0-alpha.18`. No command or file change occurred in the live probe. Live approval exchange remains unverified. |
| Genuine Codex capture | A final `gpt-5.6-terra` run imported 15 sanitised observable events with zero issues. Finalisation added a passing post-commit test and final Git-state envelope bound to commit `8fd7a35` and four artifacts. Raw capture remains private and gitignored. |
| GPT-5.6 runtime | Four specialist calls and one synthesis call completed with `gpt-5.6-sol`. All specialists passed and synthesis returned `ready`, with four open low-severity scope warnings preserved in the candidate. |
| Passport | Floyd approved the narrow integrity claim and accepted four warning records as demonstration-scope risks. The genuine-session passport contains 18 hash-linked events, four artifacts, five review receipts, and 19 human finding decisions, including 15 resolved decisions and four accepted-risk decisions. Its Ed25519 signature was created without persisting the private key. All eight independent checks pass. |
| User interface | Floyd selected refined Product Design option 3. The verification split view runs the actual browser verifier against the genuine-session passport. Two public no-login hosted runs completed the verified, memory-only alteration, invalid, restore, and reverified sequence with clean browser consoles. |
| GitHub | The public Apache License 2.0 repository is [Procureallyai/flight-recorder](https://github.com/Procureallyai/flight-recorder). Live `main` and local `main` matched when publication was verified on 19 July 2026. |
| Deployment | The public no-login judge route is [flight-recorder-web.vercel.app](https://flight-recorder-web.vercel.app/). Two fresh hosted runs completed verified, invalid after a memory-only artifact change, and verified after restoration. |
| Video and Devpost | Floyd accepted the remediated 163-second public YouTube film and personally completed the final factual and legal review, accepted the applicable terms, and submitted Flight Recorder. Devpost records submission at 16:46:09 British Summer Time on 19 July 2026. The public project page is [Flight Recorder on Devpost](https://devpost.com/software/flight-recorder-jma65p). |

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

The hosted judge route requires no account, Application Programming Interface key, or local code execution.

## Supported platforms and judge instructions

- The local Codex capture route is tested on macOS with desktop-bundled `codex-cli 0.145.0-alpha.18`.
- Local build and verification require Node.js 22 or later and pnpm 8.15.9.
- The judge interface performs verification in the browser through Web Cryptography. The production route is `https://flight-recorder-web.vercel.app/` and completed two no-login verification runs on 19 July 2026.
- To verify the signed judge passport directly after installing dependencies and building, run:

```zsh
node packages/cli/dist/index.js verify fixtures/judge-passport/passport.json fixtures/judge-passport/artifacts --json
```

Judges do not need an OpenAI Application Programming Interface key for the signed replay or independent verifier. New GPT-5.6 reviews and new live captures require separately authorised local credentials and are outside the hosted judge path.

## Local interface preview

```zsh
pnpm --filter web dev --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173/`. The interface is labelled `Genuine signed Codex session` and is bound to the sanitised Build Week capture of the synthetic password-reset demonstration. Verification runs locally in the browser. Its tamper control changes browser memory only and never writes to a covered file.

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
pnpm candidate:bind-review
pnpm security:secrets
pnpm validate:truth
node packages/cli/dist/index.js verify fixtures/judge-passport/passport.json fixtures/judge-passport/artifacts --json
```

`pnpm verify` checks the synthetic cryptographic fixture. `pnpm capture:finalise` binds the genuine capture to one clean committed demonstration state and its passing post-commit test. `pnpm candidate:generate` accepts only that finalised capture and never rereads the mutable working tree. `pnpm candidate:bind-review` validates and binds the five-call GPT-5.6 artifact, then emits an unsealed candidate and a factual human approval request. The final command independently verifies the approved signed judge passport and its exact four covered artifacts.

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

Third-party software and font attributions are recorded in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The static hosted build also
includes the IBM Plex font licence at `/third-party-notices.txt`; public
availability requires fresh deployment proof for the remediated build.

Agentic development needs more than faster code. It needs evidence that can survive inspection.
