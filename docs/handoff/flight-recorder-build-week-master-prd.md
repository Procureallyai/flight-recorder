# Flight Recorder
## OpenAI Build Week 2026 — Master Product Requirements Document, Technical Plan and Submission Plan

**Document status:** Build-ready  
**Version:** 1.0  
**Prepared for:** Floyd Livingstone Rowe / Evidary AI Ltd  
**Target track:** Developer Tools  
**Planning date:** Saturday, 18 July 2026  
**Official deadline:** Tuesday, 21 July 2026 at 5:00 p.m. Pacific Daylight Time (PDT), which is Wednesday, 22 July 2026 at 1:00 a.m. British Summer Time (BST)  
**Recommended internal submission cutoff:** Wednesday, 22 July 2026 at 12:15 a.m. BST  
**Submission product name:** **Flight Recorder**  
**Descriptor:** **A verifiable engineering passport for software built with Codex**  
**Primary tagline:** **Prove what your coding agent changed, tested and approved.**

---

# 1. Executive decision

Build **Flight Recorder** as a new, standalone developer tool created during OpenAI Build Week.

Flight Recorder observes a Codex engineering session, records externally observable development evidence, uses GPT-5.6 to assess whether the implementation is supported by that evidence, and produces a cryptographically signed **AI Engineering Passport**. A separate verifier detects whether the passport or bound source artifacts have changed after sealing.

The product is not another generic code reviewer. Its differentiator is the combination of:

1. **Codex session provenance** — commands, file changes, approvals, plans, tests and review activity.
2. **GPT-5.6 assurance analysis** — requirements traceability, security review, test adequacy and evidence completeness.
3. **Tamper-evident sealing** — canonical manifests, Secure Hash Algorithm 256-bit (SHA-256) hashes, an event hash chain, a Merkle root and an Ed25519 signature.
4. **Independent verification** — a browser verifier and command-line interface (CLI) can verify a passport and detect tampering.
5. **A reliable judge path** — a hosted, no-login replay sandbox works without rebuilding the project, installing Codex or providing an OpenAI Application Programming Interface (API) key.

The architecture is deliberately **hybrid**:

- **Local live mode** runs beside the developer’s repository and starts Codex App Server over its default standard input/output (`stdio`) transport.
- **Hosted judge mode** replays a sanitised, genuine recorded session and demonstrates review, sealing and verification through a public website.
- **Offline verification mode** validates an exported passport independently of the hosted service.

This is the correct architecture because OpenAI does not host entrants’ projects, Build Week credits are Codex credits rather than runtime API credits, judges are not required to build the repository, and Codex App Server’s coding context resides locally with the source repository.

---

# 2. Official Build Week constraints

The implementation and submission must be checked against the current official sources again immediately before submission. The official rules and Hackathon website override this document and any plugin-generated guidance.

## 2.1 Verified constraints

| Area | Verified requirement | Product response |
|---|---|---|
| Deadline | 21 July 2026, 5:00 p.m. PDT | Internal cutoff at 12:15 a.m. BST on 22 July, 45 minutes before the official deadline |
| Track | One track only | Developer Tools |
| Required tools | Project must meaningfully use Codex and GPT-5.6 | Codex builds the project and powers the live engineering workflow; GPT-5.6 performs runtime assurance reviews |
| Functionality | Product must run consistently as depicted | Deterministic replay mode, tested local live mode and hosted judge sandbox |
| New work | New project or clearly documented meaningful extension during the Submission Period | New repository during Build Week; no Evidary production code copied |
| Video | Public YouTube video, three minutes or under, clear working demo, voiceover explaining project, Codex and GPT-5.6 | Target 2:40–2:55; briefly show Codex and the tamper-detection moment |
| Repository | Public with relevant licence, or private and shared with the two required judging addresses | Default: public Apache-2.0 repository; private fallback documented |
| README | Setup, sample data, testing, Codex collaboration, decisions and GPT-5.6 integration | Dedicated Build Week and technical sections |
| Codex evidence | `/feedback` Session ID from the primary thread where most core work was built | Use one primary Codex thread; store ID only in a gitignored submission file |
| Developer tool judge path | Installation, supported platforms and a way to test without rebuilding | Hosted no-login sandbox plus replay data and verifier |
| Availability | Product free and unrestricted throughout judging | Keep deployment live through at least 6 August 2026 BST, preferably through the winner announcement |
| Judging | Equal weighting: technological implementation, design, potential impact and idea quality | Scope and narrative explicitly map to all four |
| API credits | Build Week credits are Codex credits, not separate OpenAI API credits | Budget separate API billing; add rate limits and cached demo results |
| Devpost plugin | Optional helper, not source of truth | Use direct Devpost website; plugin only as a cross-check |
| Ownership | Original work, solely owned by entrant; comply with third-party licences | New repository, dependency audit and Build Week provenance document |
| Branding | Do not imply OpenAI endorsement or use model names as the product title | Product title is “Flight Recorder”; Codex and GPT-5.6 appear only in precise descriptions |

## 2.2 Prize target

The target is **first place in Developer Tools**:

- $15,000 cash.
- Up to two DevDay or Exchange passes.
- Promotion by OpenAI Developers.
- A meeting with the Codex team.
- One year of ChatGPT Pro.

The relationship, distribution and Codex-team access may be strategically more valuable to Evidary AI Ltd than the cash prize.

## 2.3 Judging optimisation

The official Stage Two criteria are equally weighted. Ties are broken first by technological implementation. Do not produce a polished mock-up with shallow technical depth.

| Criterion | Winning evidence |
|---|---|
| Technological implementation | Real Codex App Server integration; structured GPT-5.6 runtime reviews; deterministic evidence pipeline; cryptographic sealing; CLI and browser verification; meaningful tests |
| Design | Complete workflow, clear states, coherent visual system, responsive dashboard, reliable replay and no-login judge experience |
| Potential impact | Specific audience: engineering leaders, security reviewers, maintainers and regulated organisations accepting agent-authored code |
| Quality of idea | “Evidence passport for agent-authored software” is materially different from a pull-request summary or conventional code review |

---

# 3. Product identity and positioning

## 3.1 Name

**Flight Recorder**

Do not use “Codex Flight Recorder” as the registered product title. OpenAI’s brand guidance does not permit model names in application titles where they may confuse users or imply endorsement. The submission can accurately say:

> Flight Recorder is a verifiable engineering passport for software built with Codex.

## 3.2 One-sentence pitch

> Flight Recorder turns a Codex engineering session into a signed, independently verifiable record of what was requested, changed, executed, tested, reviewed and approved.

## 3.3 Thirty-second pitch

Coding agents can produce large software changes quickly, but a pull request normally preserves only the output. It does not provide a complete evidentiary chain showing the task, commands, file changes, approvals, tests, review findings and final artifact integrity. Flight Recorder observes Codex, builds a structured evidence record, asks GPT-5.6 to test implementation claims against that evidence, and seals the result into an AI Engineering Passport that can be verified independently and fails visibly when an artifact is altered.

## 3.4 Category

Developer assurance infrastructure for agentic software engineering.

## 3.5 Product principles

1. **Evidence before assertion.** Every material claim cites a captured event, test, diff or artifact.
2. **Observable facts, not hidden reasoning.** Never persist private model chain-of-thought. Record externally observable actions and concise summaries only.
3. **Local by default.** Source code, Codex control and raw session evidence remain local unless the user invokes a runtime review.
4. **Verification is independent.** A passport remains verifiable without trusting the Flight Recorder server.
5. **Precise security claims.** The product is tamper-evident, not tamper-proof. A signature proves integrity under a key; it does not certify correctness, identity, compliance or trusted time.
6. **Demonstration reliability.** The live integration works, but judging does not depend on a fresh agent run completing inside three minutes.
7. **No compliance theatre.** Do not claim certification, formal conformity, legal compliance or safety guarantees.
8. **Narrow and complete.** Finish one end-to-end workflow rather than a broad platform.

---

# 4. Problem definition

## 4.1 Problem statement

Software teams are beginning to accept changes produced by coding agents. Existing source-control systems preserve commits and diffs, but usually do not preserve a coherent, portable answer to:

- What exactly was the agent asked to implement?
- Which acceptance criteria governed the work?
- Which files and commands were involved?
- Which commands required human approval?
- Which tests actually ran, and with what result?
- What risks did an independent model review identify?
- Were identified problems fixed and retested?
- Does the evidence still correspond to the final source state?
- Has the evidence bundle changed since approval?

This creates a trust gap for engineering managers, security reviewers, open-source maintainers and organisations operating in regulated or high-assurance environments.

## 4.2 Why existing tools are insufficient

- **Git history** records source changes but not the complete agent activity or approval chain.
- **Pull-request summaries** are narratives, not independently verifiable evidence.
- **Code reviewers** offer opinions but do not seal the underlying evidence.
- **Continuous integration (CI)** proves selected checks ran, but often lacks direct traceability to the task and agent session.
- **Screen recordings** are difficult to query, compare or verify cryptographically.
- **Agent logs** may be proprietary, mutable, incomplete or contain private reasoning and secrets.

## 4.3 Opportunity

As coding agents become normal engineering participants, organisations will need a machine-readable evidence layer binding:

> **Intent → agent actions → source changes → tests → review → human decision → final artifact**

Flight Recorder demonstrates that layer in a focused form.

---

# 5. Target users and jobs to be done

## Primary: engineering lead

**Job:** “Before I merge a substantial agent-authored change, show me what the agent did and whether the evidence supports the claim that the task is complete.”

**Success:** A concise passport with traceability, open findings, test evidence and final integrity status.

## Secondary: security reviewer

**Job:** “Show me approvals, commands, data-handling risks and security findings without making me reconstruct the entire agent conversation.”

## Secondary: open-source maintainer

**Job:** “Let a contributor prove how an agent-generated change was produced and tested.”

## Secondary: regulated organisation

**Job:** “Retain a defensible engineering record for a material AI-assisted software change.”

## Non-target users for v0.1

- Non-technical consumers.
- Teams seeking a full compliance management system.
- Organisations requiring production public-key infrastructure, identity attestation or trusted timestamping.
- Teams needing multi-tenant access control, billing or enterprise single sign-on.

---

# 6. Goals, hypotheses and success measures

## 6.1 Product goals

1. Capture a real Codex development session through official Codex interfaces.
2. Convert observable events into a stable evidence schema.
3. Use GPT-5.6 meaningfully at runtime.
4. Produce a signed AI Engineering Passport.
5. Verify it independently and detect a changed artifact.
6. Give judges a complete, no-login, no-build path.
7. Make the value understandable within fifteen seconds and memorable within three minutes.

## 6.2 Core hypotheses

- A green verification state becoming red after one file changes is the fastest explanation of value.
- Parallel specialist reviews are more legible than one undifferentiated model response.
- A replayed genuine Codex session is reliable for judging when full live integration is present and documented.
- Evidence-passport positioning is more differentiated than “AI code reviewer.”
- A narrow local-first tool can demonstrate enterprise assurance without enterprise infrastructure.

## 6.3 Hackathon success metrics

| Metric | Required result |
|---|---|
| Hosted judge route | Loads without authentication and completes the replay flow |
| Local live route | Captures at least one real Codex task on the tested platform |
| Runtime model use | At least one real GPT-5.6 structured review call in the recorded demo and code path |
| Evidence coverage | Task, criteria, commands, changes, tests, approvals, review and final artifact represented |
| Integrity | Valid bundle verifies; modified bundle or workspace fails |
| Test quality | Unit, integration and end-to-end suites pass |
| Video | Public YouTube, 3:00 or shorter, working demo and clear voiceover |
| Submission | All fields completed; user alone performs legal review and final submit |
| Reliability | No critical error in two consecutive clean judge-path runs |
| Performance | Replay interactive in under three seconds; demo verification under two seconds |

---

# 7. Scope

## 7.1 Priority zero (P0): must ship

### Capture

- Start a new Codex thread or attach to a controlled Flight Recorder thread through Codex App Server.
- Record thread and turn lifecycle events.
- Record final plan items, commands, working directory, status, exit code and bounded redacted output.
- Record file-change paths, change kind and diffs.
- Record command and file approval requests and decisions.
- Record safe tool-call metadata where available.
- Record Git baseline and final state.
- Detect and classify likely test commands.
- Explicitly discard raw reasoning events.

### Analysis

- Build a compact evidence digest.
- Run four parallel GPT-5.6 specialist reviews:
  1. Requirements and traceability.
  2. Security and risky behaviour.
  3. Test adequacy.
  4. Evidence completeness.
- Run a GPT-5.6 synthesis pass.
- Require all model outputs to conform to JSON Schema through Structured Outputs.
- Display references from findings to event, file, test or criterion identifiers.
- Apply a deterministic seal-readiness gate.

### Passport and verification

- Build an exportable passport.
- Hash included artifacts with SHA-256.
- Maintain an event hash chain.
- Calculate a deterministic Merkle root.
- Sign the canonical manifest with Ed25519.
- Verify the signature, Merkle root, artifact hashes, event chain and optional workspace binding.
- Show an unmistakable valid/invalid result.
- Support a deliberate tamper demonstration.

### Product experience

- Landing and mode selection.
- Hosted demonstration mode.
- Local live mode instructions and connection state.
- Session timeline.
- Evidence and review dashboard.
- Passport view.
- Verification view.
- Export action.
- Responsive, coherent visual design.
- Accessible keyboard/focus states and semantic labels.

### Judge and submission readiness

- Public hosted sandbox.
- Public or correctly shared repository.
- Apache-2.0 licence by default.
- Complete README.
- Supported-platform statement based only on testing.
- Build Week provenance document.
- Test and deployment instructions.
- Demo script and shot list.
- Submission copy generated from verified repository facts.
- `/feedback` Session ID from the primary Codex thread stored outside the public repository.

## 7.2 Priority one (P1): only after P0 is stable

- Import fallback from stable `codex exec --json` newline-delimited JavaScript Object Notation (JSONL) output.
- GitHub Action that verifies a passport.
- Downloadable static Hypertext Markup Language (HTML) report.
- A self-passport for Flight Recorder’s own Build Week build.
- Quick response (QR) code to a public verifier.
- “Before remediation / after remediation” comparison.
- One-click copy of verification result.
- Local key rotation and named signing keys.
- Redaction preview.
- Automated Playwright demo-recording helper.

## 7.3 Explicitly out of scope

- Full Evidary integration.
- European Union Artificial Intelligence Act or International Organization for Standardization (ISO) control mappings.
- Formal certification or audit reports.
- Multi-tenant organisations.
- Accounts, subscriptions and payments.
- Enterprise identity management.
- Remote execution of arbitrary public code.
- General-purpose agent observability.
- Multiple source-control providers.
- Trusted timestamp authority.
- Hardware-backed signing.
- Sigstore/Rekor transparency-log integration.
- Software Supply Chain Levels for Software Artifacts (SLSA) or in-toto production attestations.
- Windows support unless actually tested before submission.
- Mobile application.
- Broad Evidary marketing functionality.

---

# 8. User experience

## 8.1 Product modes

### Mode A — Hosted judge demo

Purpose: satisfy the no-build judge requirement and give a reliable three-minute product story.

- No account.
- No API key supplied by the judge.
- No arbitrary repository upload.
- Uses a bundled, sanitised session recorded from a real Codex run.
- Replays events, shows GPT-5.6 findings, seals a passport and triggers a safe tamper simulation.
- May offer a rate-limited “Run live GPT-5.6 review” button, with a previously generated genuine response as a documented fallback.
- Never runs shell commands.

### Mode B — Local live capture

Purpose: prove the actual developer-tool integration.

- Runs on the developer machine.
- Connects only to a loopback local bridge.
- Spawns `codex app-server --listen stdio://`.
- Uses the developer’s existing Codex authentication.
- Uses workspace-write or read-only sandboxing and normal approvals.
- Records observable events from a dedicated Flight Recorder thread.
- Uses a local/server-side `OPENAI_API_KEY` for runtime GPT-5.6 reviews.
- Redacts before transmission.

### Mode C — Verify

Purpose: independent validation.

- Accepts a passport bundle.
- Recomputes hashes and roots.
- Verifies the Ed25519 signature.
- Optionally compares the passport to a local workspace.
- Returns machine-readable and human-readable results.
- Does not require Codex or GPT-5.6.

## 8.2 Main screens

### 1. Landing / choose mode

Primary message:

> Every AI-authored change should ship with proof.

Actions:

- **Try the recorded demo**
- **Connect local Codex**
- **Verify a passport**

Supporting line:

> Capture observable Codex activity, test implementation claims with GPT-5.6, and seal the evidence into a portable engineering passport.

### 2. Session intake

- Repository path.
- Task title and statement.
- Acceptance criteria as separate items.
- Capture mode.
- Redaction/storage summary.
- Sandbox and approval summary.

### 3. Live session timeline

Event types:

- Task recorded.
- Plan updated.
- Command started/completed.
- Approval requested/accepted/declined.
- File change proposed/completed.
- Test detected/passed/failed.
- Tool call.
- Codex review entered/exited.
- Git state captured.
- GPT-5.6 review started/completed.
- Human resolution recorded.
- Passport sealed.

Each item exposes a stable evidence identifier, time, type, status, safe detail and related file/test/criterion.

### 4. Assurance review

Four specialist cards and one synthesis card. Each finding displays:

- Severity.
- Status: open, resolved or accepted with reason.
- Claim.
- Rationale.
- Evidence references.
- Recommended remediation.
- Model identity and timestamp.

Synthesis displays:

- Acceptance-criteria coverage.
- Test-evidence status.
- Open blockers.
- Seal readiness.
- Explicit limitations.

### 5. Passport

- Task and acceptance criteria.
- Repository baseline/final state.
- Event summary.
- Approvals.
- Tests.
- GPT-5.6 reviews.
- Human decisions.
- Artifact inventory.
- Integrity and signing information.
- Limitations.
- Export.

### 6. Verifier

States:

- **Verified** — signature and all covered evidence match.
- **Verified with workspace mismatch** — bundle is intact but current local source differs.
- **Invalid** — signature, Merkle root, event chain or artifact hash failed.
- **Unsupported** — schema or algorithm not supported.
- **Malformed** — unsafe or invalid bundle structure.

## 8.3 Visual system

Avoid OpenAI’s logo and do not imitate its product chrome.

- Black-box recorder metaphor.
- Dark graphite background, warm off-white surfaces and restrained signal colours.
- Amber for active recording, green for verified, red for invalid, neutral grey for unreviewed.
- Monospaced evidence identifiers with a legible sans-serif body typeface.
- Horizontal or vertical flight-recorder timeline.
- Strong information hierarchy; no dashboard clutter.
- Motion limited to timeline progression, seal generation and verification result.
- Never rely on colour alone; provide icons and text.
- Visible focus rings, reduced-motion support and AA contrast intent.

---

# 9. Functional requirements

## FR-001 — Project and session creation

The user can initialise a Flight Recorder session against a Git repository.

**Acceptance criteria**

- Repository exists and is a Git worktree.
- Path resolves inside an allowed root.
- Baseline commit and dirty state are captured.
- Task and at least one acceptance criterion are stored.
- A session identifier is generated.
- Capture cannot start until redaction and storage policy are displayed.

## FR-002 — Codex connection

The local bridge starts Codex App Server using the default JSONL-over-`stdio` transport.

**Acceptance criteria**

- Detect Codex executable and version.
- Run a diagnostic preflight.
- Initialise the JSON Remote Procedure Call (JSON-RPC) connection.
- Start or resume the dedicated session.
- Display clear guidance for missing authentication, unsupported version or usage limit.
- Never expose App Server on a non-loopback interface.
- Never use unauthenticated remote WebSocket transport.

## FR-003 — Event capture

Capture authoritative item lifecycle events and relevant turn events.

**Acceptance criteria**

- Persist final `item/completed` states as authoritative.
- Capture command execution, file changes, approvals, plans, safe agent messages, tool-call metadata and review states.
- Capture `turn/diff/updated` as aggregate diff while retaining item events as source of truth.
- Store sequence numbers and previous event hashes.
- Ignore raw reasoning text.
- Bound and redact command output.
- Recover cleanly from interrupted or failed turns.

## FR-004 — Fallback import

A fallback importer accepts genuine `codex exec --json` JSONL output.

**Acceptance criteria**

- Mark import clearly as “non-interactive capture.”
- Preserve safe unsupported events as opaque metadata or reject explicitly.
- Never imply approval evidence absent from the source format.
- Feed the same normalisation, review and passport pipeline.

This is P1 unless App Server integration threatens the schedule, when it becomes mandatory.

## FR-005 — Evidence normalisation

Raw events map to a versioned internal schema.

**Acceptance criteria**

- Stable identifier on every evidence object.
- Deterministic normalisation.
- Source type/identifier retained locally.
- Relative normalised file paths.
- UTC timestamps.
- Schema validation on write/read.
- Unknown schema versions fail safely.

## FR-006 — Test detection and evidence

Recognise likely test commands and permit explicit confirmation.

**Acceptance criteria**

- Recognise `pnpm test`, `npm test`, `vitest`, `pytest`, `go test`, `cargo test` and configurable patterns.
- Store command, exit code, duration and redacted bounded output.
- Never mark passed from textual output when exit code failed.
- Permit manual marking as test evidence.
- Link to acceptance criteria through the review, not unsupported inference.

## FR-007 — Evidence digest

Create a compact, model-ready evidence digest.

**Acceptance criteria**

- Include task, criteria, changed-file inventory, bounded diff, command/test summary, approvals and relevant outcomes.
- Enforce token and size budgets.
- Exclude secrets, raw reasoning and unrelated files.
- Include explicit untrusted-data boundaries.
- Produce a digest hash for cache lookup.
- Show local users which evidence categories will be sent to the API.

## FR-008 — GPT-5.6 specialist reviews

Call GPT-5.6 through the Responses API.

**Acceptance criteria**

- Explicit configurable model identifier defaulting to `gpt-5.6`.
- Four specialists run in parallel with independent prompts/schemas.
- No tools exposed to review calls.
- Code, comments, diffs and logs treated as untrusted data, never instructions.
- Structured Outputs enforce JSON Schema.
- Requests use `store: false`.
- Send a privacy-preserving safety identifier where appropriate for hosted end users.
- Failure is visible/retryable and never silently treated as pass.
- Record model, response identifier, input digest and timestamp.

## FR-009 — GPT-5.6 synthesis

A final GPT-5.6 call synthesises specialist outputs.

**Acceptance criteria**

- Inputs are structured specialist results and deterministic evidence statistics.
- Output includes coverage, blockers, warnings, gaps, remediation and proposed readiness.
- It cannot override deterministic failures such as a failed test.
- It cites evidence identifiers.
- It contains a visible limitation statement.

## FR-010 — Deterministic seal-readiness gate

Minimum conditions:

- All required specialist reviews completed.
- No unresolved critical/high blocker.
- Every acceptance criterion has evidence or is explicitly unsupported.
- At least one required test command passed.
- Git final state captured.
- No secret-scanning blocker.
- Human reviewer explicitly approved the seal.

The model proposes findings; deterministic code applies the gate.

## FR-011 — Human decisions

- Resolution requires a reason.
- Accepted-risk and resolved are distinct.
- Decisions are timestamped and included.
- A decision cannot rewrite the original finding.
- P0 should disallow sealing while a blocker remains open.

## FR-012 — Passport generation

Required bundle:

```text
flight-recorder-passport/
├── manifest.json
├── signature.ed25519
├── public-key.pem
├── task.json
├── events.jsonl
├── git.json
├── diff.patch
├── approvals.json
├── tests.json
├── reviews/
│   ├── requirements.json
│   ├── security.json
│   ├── tests.json
│   ├── evidence.json
│   └── synthesis.json
├── artifacts/
│   └── [covered safe snapshots]
└── report.html
```

**Acceptance criteria**

- Manifest validates against public schema.
- Covered artifacts and omissions are explicit.
- Export deterministic except deliberate timestamps/identifiers.
- No API key, Codex token, raw reasoning or secret.
- Bundle size and file-count limits enforced.

## FR-013 — Cryptographic sealing

1. Canonicalise structured artifacts.
2. Compute SHA-256 for every covered file.
3. Build sorted leaves from normalised path plus digest.
4. Compute deterministic Merkle root.
5. Verify event-chain head.
6. Canonicalise manifest without signature bytes.
7. Sign with Ed25519.
8. Store detached signature and public key.

**Acceptance criteria**

- Fresh valid bundle verifies.
- One-byte modification fails.
- Removing/adding a covered file fails.
- Reordering/changing events fails.
- Wrong public key fails.
- UI explains the key is not identity-attested.
- Timestamp is local recorded time, not a trusted timestamp.

## FR-014 — Verification

CLI and hosted verifier produce equivalent results.

- Verify schema.
- Reject path traversal and zip-slip.
- Enforce limits before extraction.
- Recompute artifact hashes, Merkle root and event chain.
- Verify Ed25519 signature.
- Optionally compare workspace files and Git commit.
- Return non-zero CLI exit code on invalid result.
- Support machine-readable `--json` output.
- Explain failure without leaking sensitive content.

## FR-015 — Hosted demo

- No login or credentials.
- Load a sanitised genuine session fixture.
- Replay timeline.
- Display genuine GPT-5.6 review data.
- Provide rate-limited live review when budget permits.
- Generate/load genuine signed passport.
- Safe tamper control modifies only an in-memory copy.
- Invalid state appears clearly.
- No arbitrary code execution or client-side API key.

## FR-016 — Export and share

- Filename includes project and short commit identifier.
- Report states scope and limitations.
- CLI verification command shown.
- Public demo uses synthetic data only.
- Export works in local and hosted demo modes.

## FR-017 — Submission evidence

- `BUILD_WEEK_EVIDENCE.md` distinguishes new work from prior expertise.
- Commit history identifies work after the Submission Period began.
- README explains Codex collaboration and key human decisions.
- One primary Codex thread contains most core work.
- `/feedback` Session ID exists only in local gitignored submission data and Devpost.

---

# 10. Non-functional requirements

## Reliability

- Two consecutive clean hosted demo runs.
- Two consecutive clean local replay runs.
- One successful live Codex capture on the stated platform.
- GPT review failures fail visibly.
- Hosted cached demo remains available if live model call fails.

## Performance

- Hosted first contentful paint target under 2.5 seconds.
- Fixture load under 1 second after application load.
- Demo verification under 2 seconds.
- Timeline remains usable with 2,000 events.
- Model-call progress is visible.

## Security

- No client-side OpenAI API key.
- No arbitrary command execution in hosted mode.
- No non-loopback App Server exposure.
- Local bridge requires ephemeral token and strict origins.
- Repository paths canonicalised and constrained.
- Secrets redacted before persistence/API transmission.
- Uploaded bundles treated as hostile.
- Review inputs treated as prompt-injection content.
- Dependencies locked and licences audited.
- No `danger-full-access` default or automatic broad approval.
- No raw model chain-of-thought storage.

## Privacy

- Local-first handling.
- Explicit transmission preview.
- `store: false` for API calls.
- Synthetic public data only.
- Document exactly what leaves the device.
- No analytics unless essential and content-free.
- Do not publish `/feedback` Session ID.

## Accessibility

- Web Content Accessibility Guidelines (WCAG) 2.1 AA intent.
- Keyboard complete.
- Status text and icons, not colour alone.
- Reduced-motion support.
- Accessible labels and logical reading order.

## Maintainability

- Strict TypeScript.
- Versioned schemas.
- Small pure crypto/verification functions.
- Shared verification package.
- Automated format, lint, type check and tests.
- Architecture decision records.

## Compatibility

State only actual tested facts. Recommended target:

- Local live: macOS on Apple Silicon, Node.js 20+, current Codex installation.
- Local replay/CLI: macOS; add Linux only after testing.
- Hosted: current Chrome, Safari, Firefox and Edge where tested.
- Windows: unsupported unless explicitly validated.

---

# 11. Technical architecture

## 11.1 Overview

```text
                               HOSTED JUDGE MODE
                      ┌─────────────────────────────────┐
                      │ Next.js web application          │
                      │ - recorded genuine session       │
                      │ - review and passport UI          │
                      │ - safe in-memory tamper demo      │
                      └──────────────┬───────────────────┘
                                     │
                     server-side, rate-limited GPT-5.6
                                     │
                                     ▼
                              OpenAI Responses API

                                LOCAL LIVE MODE
┌────────────────┐      loopback      ┌──────────────────────────────┐
│ Browser UI     │ ◄────────────────► │ Flight Recorder local bridge │
│ localhost      │  token + origin    │ Node.js / TypeScript         │
└────────────────┘                    └──────────────┬───────────────┘
                                                    │ JSONL over stdio
                                                    ▼
                                         ┌──────────────────────┐
                                         │ Codex App Server     │
                                         │ local repository     │
                                         │ normal approvals     │
                                         └──────────┬───────────┘
                                                    │ observable events
                                                    ▼
                                         ┌──────────────────────┐
                                         │ Evidence normaliser  │
                                         │ redaction + JSONL    │
                                         └──────┬───────────────┘
                                                │
                           ┌────────────────────┴─────────────────────┐
                           ▼                                          ▼
                 GPT-5.6 review pipeline                    crypto/seal package
                 Responses + schemas                        SHA-256/Merkle/Ed25519
                           │                                          │
                           └────────────────────┬─────────────────────┘
                                                ▼
                                     AI Engineering Passport
                                                │
                           ┌────────────────────┴─────────────────────┐
                           ▼                                          ▼
                    browser verifier                           CLI verifier
```

## 11.2 Recommended monorepo

```text
flight-recorder/
├── apps/
│   ├── web/                 # Next.js hosted demo and local user interface
│   └── bridge/              # local Codex App Server bridge
├── packages/
│   ├── codex-adapter/       # JSON-RPC, event mapping and fallback importer
│   ├── schema/              # Zod and JSON Schema definitions
│   ├── evidence/            # normalisation, redaction, event chain and digest
│   ├── review/              # GPT-5.6 prompts, Responses API and synthesis
│   ├── crypto/              # canonicalisation, hashes, Merkle and Ed25519
│   ├── verifier/            # shared verification engine
│   ├── cli/                 # flight-recorder verify / inspect
│   └── ui/                  # shared visual components
├── fixtures/
│   ├── demo-repo/           # synthetic password-reset service
│   ├── demo-session/        # sanitised genuine captured events
│   └── demo-passport/       # signed reference passport
├── docs/
│   ├── architecture/
│   ├── security/
│   ├── submission/
│   └── demo/
├── submission-assets/
│   ├── thumbnail/
│   ├── screenshots/
│   └── video/
├── .github/workflows/
├── BUILD_WEEK_EVIDENCE.md
├── PLANS.md
├── README.md
├── LICENSE
└── pnpm-workspace.yaml
```

## 11.3 Technology choices

| Concern | Choice | Reason |
|---|---|---|
| Language | TypeScript | One language across bridge, web, schemas, CLI and verifier |
| Runtime | Node.js 20+ | Modern crypto, streaming and OpenAI SDK support |
| Package manager | pnpm | Fast monorepo workflow |
| Web | Next.js + React | Rapid hosted full-stack delivery and polished interface |
| Styling | Tailwind CSS or CSS modules | Use the fastest coherent route; avoid unnecessary UI dependencies |
| Local bridge | Node HTTP plus Server-Sent Events (SSE) or WebSocket, loopback only | Separates the long-running local process from the hosted app |
| Codex control | Codex App Server over `stdio` | Deep event and approval access without remote exposure |
| Fallback | `codex exec --json` JSONL | Stable non-interactive capture path |
| Model API | OpenAI Responses API | Recommended GPT-5.6 workflow |
| Model | `gpt-5.6` alias by default | Explicit flagship GPT-5.6 runtime use |
| Model output | Structured Outputs with JSON Schema | Typed, predictable review results |
| Validation | Zod plus JSON Schema | Runtime and compile-time safety |
| Storage | Append-only JSONL plus filesystem session directory | Faster and more inspectable than a database for this scope |
| Testing | Vitest plus Playwright | Unit/integration and end-to-end coverage |
| Signing | Node crypto and a shared browser-compatible Ed25519 implementation after a day-one spike | Equivalent CLI/web results |
| Deployment | Vercel by default; Azure Container Apps acceptable if already faster | OpenAI does not host the project |
| CI | GitHub Actions | Reproducible quality gate |

## 11.4 Codex App Server integration

Primary path:

1. Local bridge spawns `codex app-server --listen stdio://`.
2. Send `initialize`, then `initialized`.
3. Start a dedicated thread and turn.
4. Read JSON-RPC notifications continuously.
5. Treat `item/completed` as authoritative.
6. Capture:
   - `turn/started`, `turn/completed`, `turn/diff/updated`, `turn/plan/updated`.
   - `commandExecution`.
   - `fileChange`.
   - command/file approval requests and decisions.
   - safe `mcpToolCall`, `dynamicToolCall` and `collabToolCall` metadata.
   - review mode events.
7. Drop `item/reasoning/textDelta` and raw reasoning content.
8. Store readable reasoning summaries only with explicit opt-in; P0 default is not to store them.
9. Generate protocol schemas from the installed Codex version during development where useful, while maintaining Flight Recorder’s stable normalised schema.

Codex App Server is documented as experimental. Therefore:

- Isolate protocol details in `packages/codex-adapter`.
- Pin and display the tested Codex version.
- Add fixture-driven contract tests.
- Implement `codex exec --json` import if live App Server control threatens the deadline.
- Use an already captured genuine fixture for the demo rather than a fresh live run.

## 11.5 Local bridge security

- Bind to `127.0.0.1` only.
- Generate a random 256-bit session token at start.
- Pass it through a one-time launch URL or pairing code.
- Strictly allow known localhost origins.
- Reject requests without the token.
- Never expose a generic command endpoint.
- Expose only a narrow protocol: status, start, submit task/turn, answer a specific pending approval, stop, read events, review, seal and export.
- Canonicalise repository path and require explicit initial consent.
- Keep process logs free of secrets.

## 11.6 Storage layout

```text
.flight-recorder/
├── config.json
├── keys/
│   ├── signing-private.pem      # chmod 600, gitignored
│   └── signing-public.pem
└── sessions/
    └── fr_<id>/
        ├── session.json
        ├── events.jsonl
        ├── task.json
        ├── git-baseline.json
        ├── git-final.json
        ├── diff.patch
        ├── approvals.json
        ├── tests.json
        ├── reviews/
        ├── artifacts/
        └── export/
```

The private signing key never enters the passport or public repository.

## 11.7 Evidence envelope

```json
{
  "schemaVersion": "0.1.0",
  "sessionId": "fr_01...",
  "sequence": 42,
  "evidenceId": "ev_01...",
  "recordedAt": "2026-07-19T14:03:22.104Z",
  "source": {
    "provider": "codex-app-server",
    "threadId": "local-only-or-redacted",
    "turnId": "turn_...",
    "itemId": "item_..."
  },
  "type": "command.completed",
  "payload": {
    "command": "pnpm test",
    "cwd": ".",
    "status": "completed",
    "exitCode": 0,
    "durationMs": 4872,
    "output": "[redacted and bounded]"
  },
  "previousHash": "sha256:...",
  "eventHash": "sha256:..."
}
```

Public export can pseudonymise or omit thread identifiers while retaining local cross-reference data.

## 11.8 Passport manifest

```json
{
  "schemaVersion": "0.1.0",
  "passportId": "frp_01...",
  "createdAt": "2026-07-20T18:40:00Z",
  "product": { "name": "Flight Recorder", "version": "0.1.0" },
  "project": {
    "name": "demo-password-reset",
    "repository": "synthetic-demo",
    "baselineCommit": "...",
    "finalCommit": "...",
    "workspaceDirtyAtSeal": false
  },
  "task": {
    "title": "...",
    "acceptanceCriteriaIds": ["ac_1", "ac_2"]
  },
  "codex": {
    "captureSource": "app-server",
    "testedVersion": "...",
    "threadIdentifierIncluded": false
  },
  "reviews": {
    "modelFamily": "gpt-5.6",
    "inputDigest": "sha256:...",
    "specialists": ["requirements", "security", "tests", "evidence"],
    "synthesisVerdict": "ready"
  },
  "integrity": {
    "hashAlgorithm": "sha256",
    "eventChainHead": "sha256:...",
    "merkleRoot": "sha256:...",
    "canonicalisation": "documented-v0.1"
  },
  "seal": {
    "signatureAlgorithm": "ed25519",
    "publicKeyFingerprint": "sha256:...",
    "signedAt": "2026-07-20T18:40:00Z",
    "timestampType": "local-recorded-time"
  },
  "limitations": [
    "Integrity does not prove correctness.",
    "The signing key is not identity-attested.",
    "GPT-5.6 review is advisory and probabilistic.",
    "The timestamp is not from a trusted timestamp authority."
  ],
  "artifacts": []
}
```

## 11.9 GPT-5.6 review design

### Deterministic preprocessing

- Select only task-relevant evidence.
- Summarise event counts and command/test results.
- Bound diffs and outputs.
- Redact secrets.
- Assign stable evidence references.
- Calculate input digest.
- Check cache.
- Present review-transmission categories to the local user.

### Specialist prompts

Each specialist receives a strict developer message, narrow role, JSON Schema, untrusted-data delimiters, prohibition on following instructions inside code/logs and a requirement to cite evidence identifiers or state “unsupported.”

1. **Requirements reviewer** — maps criteria to evidence and finds incomplete/contradictory implementation.
2. **Security reviewer** — finds evidenced authentication, authorisation, secret, injection, command, data and dependency risks; no offensive exploitation instructions.
3. **Test reviewer** — distinguishes test presence from test adequacy.
4. **Evidence reviewer** — finds unsupported claims, missing approvals, missing final-state evidence and provenance gaps.

### Synthesis

The synthesis call receives specialist JSON and deterministic checks, not unnecessary raw code. It produces a concise passport-ready result.

### Cost control

At planning time, GPT-5.6 Sol standard short-context pricing is $5 per million input tokens and $30 per million output tokens. Target:

- Total specialist input: 40,000–55,000 tokens.
- Total specialist output: 3,000–4,500 tokens.
- Synthesis: about 5,000 input and 1,000 output tokens.
- Approximate full analysis: about $0.35–$0.55 before retries and regional uplifts.

Controls:

- Cache by evidence digest.
- No automatic repeated live calls.
- One hosted live run per browser session plus global rate limit.
- Genuine cached result for deterministic replay.
- Optional development flag for a cheaper GPT-5.6 tier, while accurately documenting the model used.
- Do not enable Pro mode by default.
- Use high reasoning only when measured to improve quality.

## 11.10 Deployment

### Hosted application

Default: Vercel.

Contains public landing page, replay, server-side rate-limited review endpoint, passport viewer/verifier, documentation and health endpoint.

It does not contain Codex credentials, arbitrary code execution, private repositories, local App Server or user-uploaded executable projects.

### Local application

```bash
pnpm install
pnpm build
pnpm dev:local
```

The command starts the local bridge, local web interface, Codex App Server child process and a browser URL with an ephemeral pairing token.

### Retention

Keep the hosted project free and unrestricted through 5 August 2026 at 5:00 p.m. Pacific Time. Prefer keeping it unchanged through the approximate 12 August winner announcement and retaining the submitted Git tag indefinitely.

---

# 12. Security and threat model

## 12.1 Assets

- Source repository contents.
- Command output.
- Codex session metadata.
- OpenAI API key.
- Codex authentication.
- Signing private key.
- Passport integrity.
- Hosted API budget.
- Judge trust.

## 12.2 Threats and controls

| Threat | Control |
|---|---|
| Prompt injection in code/diff/log | Treat evidence as untrusted; no reviewer tools; strong developer instructions; Structured Outputs |
| Secret exposure | Pattern/entropy scanning, ignore rules, preview and redaction before persistence/transmission |
| API key reaches browser | Server-side route only |
| Arbitrary public code execution | Hosted fixture identifiers only; no uploads or commands |
| Local bridge exposed | Loopback bind, random token and strict origins |
| App Server WebSocket weakness | Child-process `stdio`; no remote listener |
| Path traversal | Resolve, canonicalise and constrain to repository root |
| Malicious ZIP | Count/size limits, no symlinks, zip-slip checks and safe extraction |
| Ambiguous signature scope | Versioned canonicalisation and detached signature |
| Misleading crypto claim | Plain-language limitations in UI/report |
| Signing key leakage | Local permissions, gitignore and no private-key export |
| Model output treated as certification | Advisory label, evidence references and deterministic gate |
| Hosted cost abuse | Rate limits, fixture-only input, cache and kill switch |
| Supply-chain issue | Lockfile, minimal dependencies, licence/security scan |
| Raw chain-of-thought retention | Drop raw reasoning event types |
| Fabricated submission claim | Generate final copy from tested metadata and preserve placeholders until verified |

## 12.3 Approved language

Approved:

- “Tamper-evident.”
- “Cryptographically signed.”
- “Verifies that covered evidence has not changed since it was sealed by the holder of this key.”
- “GPT-5.6 found an evidence-supported security risk.”
- “Advisory assurance review.”

Not approved:

- “Tamper-proof.”
- “Certified secure.”
- “Guaranteed correct.”
- “Legally compliant.”
- “OpenAI approved” or “OpenAI certified.”
- “Trusted timestamp” without a genuine authority.
- “Identity verified” without key identity attestation.

---

# 13. Demonstration design

## 13.1 Synthetic task

Use a deliberately incomplete TypeScript password-reset service.

> Implement a password-reset endpoint using expiring, single-use reset tokens. The endpoint must prevent account enumeration, must not log raw tokens, must record a safe audit event and must include automated tests for known and unknown accounts.

The first captured implementation contains one or two realistic issues:

- Different response for an unknown account, enabling enumeration.
- Raw reset token logged.
- Tests cover only the known-account path.

GPT-5.6 identifies the evidenced defects. Codex fixes them and reruns tests. All data is synthetic.

## 13.2 Three-minute story

Target duration: 2:45.

### 0:00–0:15 — Problem

> “A pull request tells us what changed. It rarely proves what an agent was asked to do, which commands it ran, what was approved, what tests passed or whether the evidence was altered later.”

### 0:15–0:50 — Capture

Show task, criteria, plan, commands, approval, file changes and tests. State that live mode connects to Codex App Server and the demo is a sanitised recording of a genuine session for reliability.

### 0:50–1:25 — GPT-5.6 blocker

Show four specialist reviewers and a blocking finding. State that GPT-5.6 is a runtime component that maps requirements, security, tests and evidence completeness to captured evidence identifiers.

### 1:25–1:50 — Remediation

Advance to the next captured turn: uniform response, safe audit log, new tests and passing test command. Finding resolves and criteria become covered.

### 1:50–2:15 — Seal

Show criteria, tests, approvals, review, commit, Merkle root, signature and limitations.

### 2:15–2:35 — Tamper moment

Verify green. Alter one covered artifact in memory. Verify red.

### 2:35–2:50 — Build provenance

Briefly show Codex or the primary build thread.

> “Codex built the core event adapter, evidence pipeline, verifier and tests in one primary thread. Flight Recorder applies that process to create proof for agent-authored software.”

End:

> “Agentic software development needs more than faster code. It needs verifiable evidence.”

## 13.3 Video constraints

- Three minutes maximum; target below 2:55.
- Public YouTube.
- English voiceover.
- Explain product, Codex usage and GPT-5.6 runtime use.
- Brief Codex view strongly recommended.
- No copyrighted music.
- No third-party marks without permission.
- No secrets, API keys, private IDs or unrelated repositories.
- Record the final verified commit.
- Add captions if time permits.

---

# 14. Delivery plan

## 14.1 Workstream order

1. Repository, schemas and deterministic replay skeleton.
2. Passport generation and verification.
3. GPT-5.6 runtime review.
4. Codex App Server live adapter.
5. Coherent interface.
6. Hosted deployment.
7. Security hardening and tests.
8. Submission assets and video.
9. Devpost draft.
10. User legal/factual review and final submission.

This order guarantees a demonstrable product if the experimental App Server path needs a fallback.

## 14.2 Schedule

### Saturday, 18 July 2026 — architecture and thin slice

- Create new repository.
- Add `PLANS.md`, `AGENTS.md`, architecture decision records and Build Week evidence file.
- Scaffold monorepo.
- Define schemas and fixture format.
- Implement deterministic passport manifest.
- Spike canonicalisation, Merkle and Ed25519 across Node/browser.
- Build minimal verifier and web shell.
- Make meaningful commits from the primary Codex thread.

**Exit:** a fixture becomes a signed passport and verifies locally.

### Sunday, 19 July 2026 — real capture and model review

- Implement local bridge.
- Integrate App Server `stdio`.
- Record a genuine small Codex session.
- Implement redaction and normalisation.
- Implement evidence digest.
- Implement four GPT-5.6 specialists and synthesis.
- Add seal gate.
- Add demo-repository session and replay timeline.

**Exit:** a genuine session is reviewed by GPT-5.6 and produces structured findings.

### Monday, 20 July 2026 — complete product and deploy

- Complete main screens and tamper demonstration.
- Complete browser/CLI verification.
- Add fallback importer if needed.
- Deploy public judge sandbox.
- Add rate limits and cached result.
- Complete unit, integration and end-to-end tests.
- Run security, secret and dependency review.
- Complete README and submission docs.
- Capture screenshots.

**Exit:** public no-login demo works twice from a clean browser and local live mode works on the stated platform.

### Tuesday, 21 July 2026 — freeze and prepare submission

Suggested BST milestones:

| Time | Milestone |
|---|---|
| 09:00 | Full regression and judge-path rehearsal |
| 12:00 | Fix only release blockers |
| 15:00 | Feature freeze |
| 16:00 | Tag release candidate and generate final passport |
| 17:00 | Record final video |
| 19:00 | Edit, caption and upload public YouTube video |
| 20:30 | Final README and links |
| 21:00 | Run `/feedback` in primary Codex thread and store Session ID |
| 21:30 | Run Chrome-profile-7 Devpost draft prompt |
| 23:00 | Factual, trademark, licence and secret review |
| 23:45 | User opens final review |
| 00:15, 22 July | Internal submission cutoff |
| 01:00, 22 July | Official deadline |

Never reserve the final 45 minutes for building or uploading.

---

# 15. Test and quality plan

## 15.1 Unit tests

- Schema validation.
- Path normalisation.
- Secret redaction.
- Test-command detection.
- Event-chain creation/verification.
- SHA-256 hashing.
- Deterministic leaf ordering.
- Merkle odd/even cases.
- Canonical manifest generation.
- Ed25519 signing/verification.
- Seal-gate state machine.
- Reviewer schema parsing.
- Token/size budget.
- Unsafe ZIP path rejection.

## 15.2 Integration tests

- App Server fixture maps to normalised events.
- Approval request/decision sequence.
- Failed/interrupted turn handling.
- Digest excludes raw reasoning and secrets.
- Mock Responses API returns valid specialist/synthesis objects.
- Invalid model response fails closed.
- Passport export/import round trip.
- Workspace mismatch.
- CLI exit codes.

## 15.3 End-to-end tests

Hosted:

1. Open demo.
2. Start replay.
3. Inspect blocker.
4. Advance remediation.
5. Seal.
6. Verify valid.
7. Trigger tamper.
8. Verify invalid.

Local:

1. Start local application.
2. Connect bridge.
3. Load controlled repository.
4. Run minimal Codex task.
5. Capture event.
6. Generate passport.
7. Verify.

## 15.4 Manual release tests

- Fresh/incognito hosted test.
- Mobile-width readability.
- Keyboard-only demo.
- No console errors.
- No secret in static assets or network logs.
- Public links work without sign-in.
- Repository clone and documented commands work.
- Public YouTube plays without sign-in.
- Devpost preview shows correct thumbnail and links.
- Every claim matches final functionality.

## 15.5 Continuous integration checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm licences:check
pnpm secrets:scan
```

Document any platform-specific step that cannot run in hosted CI.

---

# 16. Repository and documentation requirements

## 16.1 README structure

1. Hero and one-sentence value.
2. Demo link.
3. Thirty-second explanation.
4. Screenshots.
5. How it works.
6. Hosted, local and verify modes.
7. Quick start.
8. Installation.
9. Supported platforms — tested facts only.
10. Sample data.
11. Testing.
12. GPT-5.6 runtime integration.
13. How Codex built the project.
14. Key human decisions.
15. Architecture.
16. Security/privacy.
17. Cryptographic scope and limitations.
18. Build Week provenance.
19. Licence.
20. Known limitations and roadmap.

## 16.2 Build Week evidence file

`BUILD_WEEK_EVIDENCE.md` must contain:

- Submission Period.
- New repository creation date.
- Commit range/tag.
- Statement that the concept uses prior domain expertise in AI assurance but no Evidary production code was copied.
- Primary Codex workflow summary.
- Significant Codex-generated or assisted components.
- Significant human decisions.
- GPT-5.6 runtime features.
- Test evidence.
- Release commit.
- Non-sensitive artifact links.

Suggested disclosure:

> Flight Recorder was created as a new standalone repository during OpenAI Build Week 2026. It draws on the entrant’s prior expertise in AI assurance, evidence architecture and cryptographic verification. No pre-existing Evidary production code was copied into this project. The repository’s dated commit history and the primary Codex session identify the work completed during the Submission Period.

## 16.3 Architecture decision records

- ADR-001: hybrid local/hosted architecture.
- ADR-002: App Server `stdio` plus JSONL fallback.
- ADR-003: no raw reasoning persistence.
- ADR-004: deterministic gate around advisory GPT findings.
- ADR-005: cryptographic scope and limitation.
- ADR-006: hosted fixture-only judge mode.
- ADR-007: public repository/licence decision.

## 16.4 Submission metadata

Create:

```text
docs/submission/submission-metadata.json
docs/submission/DEVPOST_SUBMISSION.md
docs/submission/FINAL_CHECKLIST.md
docs/submission/submission-secrets.local.json   # gitignored
```

`submission-secrets.local.json` holds the `/feedback` Session ID, any private judge credential and unpublished administrative notes. Never commit it.

---

# 17. Submission asset plan

## 17.1 Thumbnail

- 3:2 ratio; recommended 1200 × 800 pixels.
- Portable Network Graphics (PNG) or Joint Photographic Experts Group (JPEG).
- Under the current Devpost size limit.
- Actual interface, not concept art.
- “Flight Recorder” and optional tagline.
- No OpenAI logo or implied endorsement.

## 17.2 Gallery

At least four screenshots:

1. Session timeline.
2. GPT-5.6 blocker linked to evidence.
3. Signed passport.
4. Tamper-detection failure.

Optional:

5. Requirements-to-evidence matrix.
6. Local connection state.

## 17.3 Links

- Public hosted demo.
- Repository.
- Public YouTube video.
- Optional documentation route.
- No judge API key.
- No temporary tunnel URL.

## 17.4 Built-with tags

Use only technologies actually present, likely:

- Codex.
- GPT-5.6.
- OpenAI Responses API.
- TypeScript.
- Next.js.
- React.
- Node.js.
- JSON-RPC.
- Ed25519.
- SHA-256.
- Playwright.
- Vitest.
- Vercel or Azure, whichever is deployed.
- GitHub.

---

# 18. Draft Devpost narrative

This is a starting point. The final repository must generate a fact-checked version based on what actually shipped. Remove every unverified feature claim.

## Project name

**Flight Recorder**

## Tagline

**Prove what your coding agent changed, tested and approved.**

Shorter alternative:

**A verifiable passport for agent-authored code.**

## Track

**Developer Tools**

## Inspiration

Coding agents can now complete substantial engineering tasks, but the evidence around those changes has not kept pace. A normal pull request shows the resulting diff. It rarely preserves a coherent record of the original task, commands, approvals, tests, independent review and final artifact integrity.

I work on AI assurance and evidence infrastructure. Flight Recorder applies that discipline directly to agentic software development: every material AI-authored change should be able to ship with proof.

## What it does

Flight Recorder observes a Codex engineering session and turns its externally observable activity into a portable AI Engineering Passport.

It captures the task and acceptance criteria, plans, command executions, file changes, approval decisions, tests and final Git state. GPT-5.6 performs four structured specialist reviews covering requirements traceability, security, test adequacy and evidence completeness. A final synthesis identifies blockers and whether the evidence is ready to seal.

When ready, Flight Recorder hashes covered artifacts, builds an event hash chain and Merkle root, and signs the canonical passport manifest with Ed25519. The passport can be checked in the browser or command-line verifier. Altering a covered artifact changes the verification result immediately.

The public judge sandbox replays a sanitised recording of a genuine Codex session, so the complete product can be tested without rebuilding the repository, installing Codex or supplying an API key.

## How it was built

The local capture bridge is written in TypeScript and connects to Codex App Server through JSON-RPC over local `stdio`. It normalises authoritative turn and item events into an append-only, hash-linked evidence stream while deliberately excluding raw model reasoning.

The review pipeline uses the OpenAI Responses API and GPT-5.6. Each reviewer returns Structured Outputs conforming to JSON Schema and cites stable evidence identifiers. Model findings remain advisory; deterministic logic decides seal readiness from test outcomes, criteria coverage, blockers, Git state and human approval.

The passport pipeline uses SHA-256 artifact hashes, a deterministic Merkle tree and an Ed25519 detached signature. A shared library powers the web and CLI verifiers.

The hosted Next.js demonstration uses synthetic data and a sanitised genuine session fixture. It never executes arbitrary public code and keeps the OpenAI API key server-side.

## How Codex was used

Codex was the primary engineering partner. The majority of core functionality was developed in one primary build thread, including the event adapter, evidence schema, passport pipeline, verifier, tests and interface.

Codex accelerated scaffolding, protocol exploration, implementation, test generation, debugging and security review. I retained the product and assurance decisions: hybrid architecture, exclusion of private reasoning, deterministic seal gate, exact cryptographic claim, hosted fixture-only judge path and the boundary between evidence integrity and software correctness.

The submitted `/feedback` Session ID identifies the primary build thread.

## How GPT-5.6 is integrated

GPT-5.6 is a runtime component, not only a development tool. Four specialist passes inspect captured evidence for requirements coverage, security risks, test adequacy and missing evidence. A fifth synthesis pass produces the structured passport review.

The model receives a bounded, redacted evidence digest, treats source code and logs as untrusted data, has no tools, and returns schema-constrained findings with evidence references. Deterministic code applies the final seal-readiness policy.

## Challenges

The hardest part was preserving useful engineering evidence without becoming a private-reasoning recorder or secret-leakage risk. Flight Recorder stores observable actions and bounded redacted outputs, not hidden chain-of-thought.

A second challenge was defining honest cryptographic semantics. The signature proves that covered evidence has not changed since sealing by the holder of a key. It does not prove software correctness, independently verify the signer’s identity or provide a trusted timestamp.

The third challenge was making a local Codex integration easy for judges to evaluate. The solution combines a real local integration with a hosted replay sandbox and independent verifier.

## Accomplishments

Use only confirmed final statements. Candidate points:

- Captured a genuine Codex engineering session end to end.
- Linked requirements, commands, diffs, approvals, tests and review findings.
- Integrated GPT-5.6 into a structured runtime workflow.
- Produced a signed portable engineering passport.
- Detected a changed artifact through browser and CLI verification.
- Delivered a no-login judge sandbox and documented local live mode.
- Built the project in a traceable primary Codex thread during Build Week.

## What was learned

Provenance and correctness are related but different. Cryptographic integrity can show evidence has not changed; it cannot establish every claim is true. Model review can identify gaps and risks; it should not be treated as certification. The strongest system combines observable events, deterministic checks, model judgement, human approval and precise limitations.

## What is next

- Pull-request and CI verification.
- Sigstore/Rekor and in-toto/SLSA-compatible attestations.
- Trusted timestamping.
- Organisation signing identities and key rotation.
- Policy packs for security and regulated engineering.
- Additional coding-agent adapters.
- Integration with Evidary as a developer evidence source.

---

# 19. Risks and mitigations

| Risk | Probability | Impact | Mitigation |
|---|---:|---:|---|
| App Server protocol changes | Medium | High | Adapter isolation, pinned version, generated schemas, genuine fixture, JSONL fallback |
| Live GPT request fails in demo | Medium | High | Genuine cached result, retry, visible failure and recorded successful run |
| UI scope consumes build time | Medium | High | Fixed six-screen architecture; no account/billing system |
| Browser crypto incompatibility | Medium | High | Day-one spike, shared tested library, CLI/server fallback |
| Secret leakage | Medium | Critical | Synthetic demo, redaction tests, no raw reasoning and secret scan |
| Submission claim exceeds product | Medium | High | Generate final copy from repository facts and retain placeholders |
| Video exceeds time | Medium | Medium | 2:45 target and rehearsed shot list |
| Hosted API abuse | Medium | Medium | Fixture-only inputs, rate limit, cache and kill switch |
| Public repo exposes commercial IP | Low/Medium | Medium | Narrow open-source core or private judging share |
| Final submit missed | Low | Critical | Browser stops on final review, explicit user checklist and 45-minute buffer |
| Brand conflict | Low | Medium | “Flight Recorder” title, precise descriptor and no OpenAI logo |
| Judges do not test | High | Medium | Entire value visible in video, screenshots and first 15 seconds |

---

# 20. Go/no-go gates

## Gate 1 — Sunday, 19 July at 12:00 BST

Continue with App Server live control only if a thread starts, command/file events are captured, approval sequence is captured or fixture-tested, and the protocol is isolated behind the adapter.

Otherwise switch task execution to `codex exec --json`, retain App Server as an experimental adapter, and protect the passport/review/verifier product.

## Gate 2 — Monday, 20 July at 12:00 BST

Continue browser-side crypto only if the same bundle verifies in Node and browser and tamper cases are deterministic. Otherwise retain CLI independence and use server-side hosted verification, documenting the architecture honestly.

## Gate 3 — Monday, 20 July at 18:00 BST

Keep hosted live GPT calls only if rate limiting exists, a full request succeeds, no key appears client-side and cost is bounded. Otherwise use a labelled cached genuine GPT-5.6 result in hosted replay while retaining live local integration and recording a successful runtime call for the video.

## Gate 4 — Tuesday, 21 July at 15:00 BST

No new features. Only release blockers, factual documentation corrections, accessibility blockers and security/secret remediation.

---

# 21. Definition of done

## Product

- [ ] Public hosted demo loads without sign-in.
- [ ] Hosted replay completes.
- [ ] Genuine Codex fixture documented.
- [ ] Local live capture works on stated platform.
- [ ] GPT-5.6 runtime call returns schema-valid results.
- [ ] Findings cite evidence identifiers.
- [ ] Deterministic seal gate works.
- [ ] Passport exports.
- [ ] Valid passport verifies.
- [ ] One-byte tamper fails.
- [ ] CLI returns correct exit code.
- [ ] Raw reasoning is not stored.
- [ ] Secret scan passes.

## Engineering

- [ ] Lint, type check, unit, integration and end-to-end tests pass.
- [ ] Production build passes.
- [ ] Dependency licence check passes.
- [ ] Deployment health check passes.
- [ ] Release tag and commit recorded.
- [ ] Supported-platform claims match tests.

## Documentation

- [ ] README, installation, sample data and judge path complete.
- [ ] Codex collaboration and GPT-5.6 integration documented.
- [ ] Key human decisions documented.
- [ ] Security and cryptographic limitations documented.
- [ ] `BUILD_WEEK_EVIDENCE.md` complete.
- [ ] No private `/feedback` ID committed.

## Submission

- [ ] Developer Tools selected.
- [ ] Thumbnail and at least four screenshots ready.
- [ ] Repository access confirmed.
- [ ] Public demo confirmed.
- [ ] Public YouTube confirmed and under three minutes.
- [ ] Voiceover covers product, Codex and GPT-5.6.
- [ ] `/feedback` run in primary thread and stored locally.
- [ ] Final copy contains no unshipped claim.
- [ ] Devpost draft saved.
- [ ] User reviews eligibility, ownership, terms and final submission.
- [ ] User alone clicks final submit.

---

# 22. Final legal and factual review points

The browser agent must not decide or attest:

1. Whether the entrant is Floyd Livingstone Rowe individually or Evidary AI Ltd as an organisation.
2. Whether the user is authorised to represent the organisation.
3. Whether contributors assigned necessary rights.
4. Whether the public/private licence choice is acceptable.
5. Whether all eligibility statements are true.
6. Whether third-party marks, media or code require permission.
7. Whether video/screenshots expose private information.
8. Whether to agree to terms.
9. Whether to submit.

Recommended default commercial position, subject to user confirmation:

- Entrant type: **Organisation**.
- Organisation: **Evidary AI Ltd**.
- Authorised representative: **Floyd Livingstone Rowe**.
- Country: **United Kingdom**.
- Repository: public Apache-2.0 unless sensitivity dictates private sharing.
- Attribution: “Built by Evidary AI Ltd.”
- Product remains standalone; Evidary integration appears only under “What’s next.”

---

# 23. Official sources to re-check

- OpenAI Build Week overview: https://openai.devpost.com/
- Official rules: https://openai.devpost.com/rules
- Frequently asked questions: https://openai.devpost.com/details/faqs
- Resources: https://openai.devpost.com/resources
- Submission announcement: https://openai.devpost.com/updates/45282-openai-build-week-submissions-are-open-plugin-launch
- Codex App Server: https://developers.openai.com/codex/app-server
- Codex developer commands: https://developers.openai.com/codex/developer-commands
- Codex approvals/security: https://developers.openai.com/codex/agent-approvals-security
- GPT-5.6 guidance: https://developers.openai.com/api/docs/guides/latest-model
- GPT-5.6 Sol: https://developers.openai.com/api/docs/models/gpt-5.6-sol
- Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- API pricing: https://developers.openai.com/api/docs/pricing
- Brand guidance: https://openai.com/brand/
- Chrome extension guidance: https://learn.chatgpt.com/docs/chrome-extension

Authenticated Devpost draft:

https://devpost.com/submit-to/30223-openai-build-week/manage/submissions/1100007/project-overview

---

# 24. Final product statement

> **Flight Recorder gives agent-authored software a verifiable chain of engineering evidence. It captures what Codex did, uses GPT-5.6 to test implementation claims against that evidence, and seals the result into a portable passport that fails visibly when covered artifacts change.**
