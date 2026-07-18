# Architecture Decision Record 004: advisory model review and deterministic seal gate

- Status: accepted
- Date: 18 July 2026

## Decision

GPT-5.6 performs requirements, security, test-adequacy, and evidence-completeness reviews, followed by synthesis. Findings must cite stable evidence identifiers or state that support is unavailable.

Model output remains advisory. Deterministic code requires complete reviews, no unresolved high or critical blocker, criterion status, a passing required test, final Git state, secret-scan clearance, and explicit human approval.

## Consequences

Model judgement cannot become a certification claim. A failed or incomplete model call is never interpreted as a pass.
