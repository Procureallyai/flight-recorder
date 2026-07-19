# Codex remediation task

Work only in this fully synthetic password-reset workspace.

Repair the existing implementation so that it satisfies all of these acceptance criteria:

1. Password-reset tokens expire and are single use. The workspace must include an actual token store with an injected clock and token generator, and reject redemption at or after expiry.
2. Known and unknown accounts receive the same neutral public response, preventing account enumeration.
3. Raw reset tokens never enter logs or audit events.
4. A safe audit event is recorded without exposing direct account or token identifiers.
5. Concurrent attempts produce exactly one successful redemption through a deterministic state transition.
6. A token is consumed only after the reset action succeeds. A failed reset action permits a later retry while the token remains valid.
7. Lookup, issuance, delivery, logging, and audit dependency failures retain the neutral public response and do not leak failure details into telemetry.
8. Automated tests deterministically cover known and unknown accounts, response equality, complete safe telemetry, the exact expiry boundary, repeated and concurrent redemption, retry after action failure, and every dependency failure listed above.

## Atomicity boundary

The in-memory store reserves a token by changing its state synchronously before the first awaited reset action. That transition is atomic only among asynchronous attempts in one JavaScript process. It does not coordinate multiple worker processes or hosts, and it does not survive a process restart. A production implementation therefore requires a persistent shared store with a transaction or atomic compare-and-set operation covering the equivalent state transition.

Use only synthetic values. Preserve dependency injection so the behaviour remains testable. Run the test suite and leave the workspace in a passing state. Do not access or modify files outside this workspace.
