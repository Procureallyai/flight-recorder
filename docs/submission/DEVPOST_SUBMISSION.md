# Flight Recorder Devpost Submission

## Elevator pitch

Prove what your coding agent changed, tested, and approved.

## Inspiration

A pull request records a result. It rarely preserves the task, commands, tests, approvals, independent review, and final artifact integrity that made an agent-authored change reviewable.

Flight Recorder was built around a simple distinction: code generation creates output, but serious engineering also needs evidence that can survive inspection.

## What it does

Flight Recorder creates a portable, tamper-evident engineering passport for software built with Codex. It captures externally observable engineering activity, links that activity to the final committed artifacts, applies evidence-referenced GPT-5.6 assurance review, records human finding decisions, and seals the canonical record with an Ed25519 signature.

The public judge interface replays a sanitised genuine Codex session for a synthetic password-reset task. Judges can inspect the evidence timeline, review findings, accepted limitations, covered artifacts, event-chain head, Merkle root, and signature. Verification runs independently in the browser. Changing one covered artifact safely in browser memory turns the passport from verified to invalid immediately, while leaving the signed manifest intact.

The claim is deliberately narrow. A valid passport shows that the covered evidence has not changed since it was sealed by the holder of the corresponding signing key. It does not prove software correctness, signer identity, security certification, legal compliance, or trusted time.

## How it was built

Codex was the primary engineering partner throughout Build Week. The final genuine Codex capture used GPT-5.6 Terra and recorded sanitised observable events rather than private reasoning. That run identified and repaired a stalled audit-path issue and completed 16 deterministic demonstration tests. A finaliser then bound the passing post-commit test, one clean Git state, and four committed artifacts before candidate assembly.

GPT-5.6 Sol is also integrated into the product's assurance workflow through the OpenAI Responses Application Programming Interface. Four structured specialists review requirements traceability, security, test adequacy, and evidence completeness. A fifth call synthesises the result. Review findings cite stable evidence identifiers, but deterministic application logic controls seal readiness.

The signed passport contains 18 hash-linked events, four covered artifacts, five GPT-5.6 review receipts, 22 findings, and 22 human decisions. Eighteen findings are recorded as resolved. Four warning records remain accepted demonstration-scope risks covering durable audit delivery and distributed token atomicity. They remain visible and are not presented as resolved production capabilities.

The implementation uses TypeScript, Node.js, React, Vite, Vitest, Web Cryptography, Secure Hash Algorithm 256-bit, deterministic Merkle trees, and Ed25519 signatures. The public repository is licensed under Apache License 2.0.

## Challenges

The hardest problem was preserving honest evidence boundaries. A genuine session can still contain synthetic task data. A model review can be useful without becoming a certification. A signature can prove integrity without proving identity, correctness, or trusted time. Flight Recorder makes those distinctions visible in its schema, verifier, user interface, and public claims.

Another challenge was ensuring that sealing was resistant to mutation and path redirection. The final workflow binds the reviewed candidate, finalised capture, complete review artifact, human approval request, exact typed approval, and artifact bytes. Output staging rejects symbolic-link ancestors, verifies staged bytes independently, publishes the artifact root atomically, and writes the passport last. The private signing key is generated in memory and is never persisted.

## Accomplishments

- A sanitised genuine Codex session is bound to one final committed state.
- Four GPT-5.6 specialist reviews and one synthesis review are evidence-linked and signed into the passport.
- Independent command-line and browser verifiers recompute the signed evidence without trusting the Flight Recorder server.
- The hosted experience requires no account, OpenAI Application Programming Interface key, or arbitrary code execution.
- The product suite passes 126 tests, and the synthetic password-reset demonstration passes 16 deterministic tests locally.
- Four residual warnings remain visible as accepted risks rather than disappearing behind a green status.

## What was learned

Agentic engineering needs more than a transcript. Evidence has to be bounded, sanitised, linked to immutable artifacts, reviewed against stable identifiers, and approved under a precise claim. Trust becomes useful when a reviewer can see what was covered, what was excluded, and what would cause verification to fail.

## What is next

The demonstration intentionally proves one-process token atomicity and best-effort audit delivery. Production hardening would add persistent shared token infrastructure, a durable transactional outbox or queue, managed signing-key custody, independent signer identity, and trusted timestamping. Those controls would extend the product's operating scope without changing the narrow integrity claim.

## Repository and installation

- Repository: `https://github.com/Procureallyai/flight-recorder`
- Public judge route: `https://flight-recorder-web.vercel.app/`
- Licence: Apache License 2.0
- Tested local capture platform: macOS with desktop-bundled `codex-cli 0.145.0-alpha.18`
- Local requirements: Node.js 22 or later and pnpm 8.15.9

```zsh
pnpm install --frozen-lockfile
pnpm test
npm test --prefix demo/password-reset-workspace
node packages/cli/dist/index.js verify fixtures/judge-passport/passport.json fixtures/judge-passport/artifacts --json
```

## Built with

Codex, GPT-5.6, OpenAI Responses Application Programming Interface, TypeScript, Node.js, React, Vite, Vitest, Codex App Server, Web Cryptography, Secure Hash Algorithm 256-bit, Ed25519, GitHub, and Vercel.

## Judge instructions

Open `https://flight-recorder-web.vercel.app/` in a modern browser. No account or Application Programming Interface key is required. Confirm the initial `VERIFIED` state, inspect the proof details and accepted warnings, select **Alter covered artifact in memory**, confirm the `INVALID` state and artifact mismatch, then select **Restore original artifact** and confirm that verification returns to `VERIFIED`.

## Release-dependent fields

The public YouTube address, final release tag, and private `/feedback` Session Identifier must be added only after direct verification. The private Session Identifier must never enter this public document or repository.
