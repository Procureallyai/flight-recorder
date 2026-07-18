# Architecture Decision Record 002: Codex transport and fallback

- Status: accepted
- Date: 18 July 2026

## Decision

Codex App Server over standard input and output is isolated behind an adapter because it offers the richest event and approval surface but remains experimental. The operational deadline fallback is version-pinned `codex exec --json` JavaScript Object Notation Lines import.

The verified fallback uses the desktop-bundled `codex-cli 0.145.0-alpha.18`. Completed items are authoritative. Reasoning items are dropped. Non-interactive capture records approval coverage as `not-observed`.

## Consequences

The core passport, review, and verifier product does not depend on experimental live control. App Server proof remains a separate route-specific gate.
