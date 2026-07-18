# Architecture Decision Record 005: precise cryptographic semantics

- Status: accepted
- Date: 18 July 2026

## Decision

Flight Recorder describes a verified passport as tamper-evident and cryptographically signed. Verification proves that the covered evidence matches the manifest sealed by the holder of the corresponding Ed25519 signing key.

It does not prove software correctness, independently verified signer identity, certified security, legal compliance, regulatory approval, or trusted time. The recorded timestamp is local recorded time unless a future independent timestamp authority is added.

## Consequences

Every user interface, report, demonstration, and submission statement must preserve this boundary. A valid signature cannot override failed tests, unsupported evidence, an unresolved blocker, or missing human approval.
