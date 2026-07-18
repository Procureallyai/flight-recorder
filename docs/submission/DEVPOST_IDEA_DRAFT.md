# Flight Recorder Devpost Idea Draft

**Status:** Pre-build narrative. Rewrite against the final tested release before entering it as shipped product copy.

## Project name

Flight Recorder

## Elevator pitch

Prove what your coding agent changed, tested and approved.

## About the project

## Inspiration

A pull request records a result. It rarely preserves the evidence that made the result reviewable.

Coding agents can now complete substantial engineering work, but the surrounding record has not kept pace. Teams can inspect a diff, read a summary, and see a Continuous Integration result. They still have to reconstruct the original task, acceptance criteria, commands, approvals, tests, review findings, remediation, and final artifact state across several disconnected systems.

I work on artificial intelligence assurance and evidence infrastructure. Flight Recorder applies that discipline to agentic software development. The central idea is simple: material agent-authored changes should be able to ship with verifiable engineering evidence, not only an assertion that the work is complete.

## What it is designed to do

Flight Recorder is a developer tool that turns externally observable Codex activity into a portable Artificial Intelligence Engineering Passport.

The local mode is designed to record the task and acceptance criteria, plans, command executions, file changes, approval decisions, tests, review activity, and final Git state. It deliberately excludes raw model reasoning and applies redaction before evidence is persisted or sent for review.

GPT-5.6 is designed to operate as a runtime assurance component. Four structured specialist reviews assess requirements traceability, security, test adequacy, and evidence completeness. A fifth synthesis brings those findings together. The model must cite stable evidence identifiers, but deterministic application logic decides whether the evidence is ready to seal.

When the gate is satisfied, Flight Recorder will hash covered artifacts with Secure Hash Algorithm 256-bit, build a hash-linked event chain and deterministic Merkle root, and sign a canonical manifest with Ed25519. A browser and command-line verifier will recompute the evidence and fail visibly when a covered artifact changes.

The hosted judge mode will replay a sanitised recording of a genuine Codex session. It will not execute arbitrary public code or require judges to provide an Application Programming Interface key. The demonstration will show a realistic defect, an evidence-linked GPT-5.6 finding, Codex remediation, passing tests, human approval, a valid passport, and the decisive transition from valid to invalid after one covered artifact is altered safely in memory.

## How it will be built

The planned implementation uses TypeScript, Node.js, Next.js, and React. A local bridge will isolate Codex App Server behind an adapter and communicate through JavaScript Object Notation Remote Procedure Call messages over standard input and output. A stable `codex exec --json` importer remains the deadline fallback if the experimental integration threatens the core product.

The review pipeline will use the OpenAI Responses Application Programming Interface, GPT-5.6 Structured Outputs, bounded evidence digests, `store: false`, response caching, and explicit prompt-injection boundaries. The hosted route will use synthetic data, server-side secrets, request limits, and a budget kill switch.

Cryptographic claims will remain narrow. A valid signature can show that covered evidence has not changed since it was sealed by the holder of the corresponding key. It cannot prove software correctness, verify the signer's identity, certify security, establish legal compliance, or provide trusted time.

## How Codex is being used

Codex is the primary engineering partner for the Build Week project. One primary task is being used to preserve the majority of core implementation and the required feedback provenance. Codex is responsible for implementation, testing, security scepticism, documentation, release preparation, and truth verification. I retain product intent, assurance policy, ownership, legal decisions, spending authority, and final acceptance.

## Challenges

The hardest boundary is deciding what evidence is useful without turning the product into a private-reasoning recorder or a secret-leakage risk.

The second challenge is preserving honest cryptographic semantics. Integrity is valuable precisely because its limits are explicit.

The third is judge reliability. A real local integration matters, but the three-minute evaluation path cannot depend on a fresh agent run finishing on demand. The hybrid design preserves technical depth without making the demonstration brittle.

## What comes next

The Build Week release is deliberately narrow: one complete evidence chain, one memorable tamper transition, and one independent verification path. Later work could add Pull Request verification, Continuous Integration integration, organisation signing identities, trusted timestamping, transparency logs, and Evidary integration as a separate future capability.

Agentic software development does not only need faster code. It needs evidence that can survive inspection.
