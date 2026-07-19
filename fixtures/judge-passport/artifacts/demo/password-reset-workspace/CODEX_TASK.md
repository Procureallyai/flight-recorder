# Codex remediation task

Work only in this fully synthetic password-reset workspace.

Repair the existing implementation so that it satisfies all of these acceptance criteria:

1. Password-reset tokens expire and are single use. The workspace must include an actual token store with an injected clock and token generator, and reject redemption at or after expiry.
2. Known and unknown accounts receive the same neutral public response. Account lookup, token issuance, and delivery must run behind one explicitly injected asynchronous scheduler or queue boundary, and every request must schedule the same amount of work before returning so response timing does not disclose account existence.
3. Raw reset tokens never enter logs or audit events.
4. A safe audit event is recorded without exposing direct account or token identifiers.
5. Concurrent attempts produce exactly one successful redemption through a deterministic state transition.
6. A token is consumed only after the reset action succeeds. A failed reset action permits a later retry while the token remains valid. The reset callback must roll back partial durable changes or be idempotent before rejecting, because rejection reactivates the token and permits that retry.
7. Scheduling, lookup, issuance, delivery, logging, and audit dependency failures retain the neutral public response and do not leak failure details into telemetry.
8. Automated tests deterministically cover known and unknown accounts, equal scheduling, absence of lookup and delivery on the response path, response equality, complete safe telemetry, invalid token lifetimes, empty and duplicate generated tokens, unknown-token callback exclusion, the exact expiry boundary, repeated and concurrent redemption, retry after action failure, and every dependency failure listed above.

## Scheduler boundary

The injected scheduler must enqueue the supplied work and return before invoking it. The request handler enqueues exactly one job for every request and performs no account lookup, token issuance, or delivery before producing the neutral response. The synthetic tests use a deterministic deferred scheduler. A production implementation should use a durable queue with bounded retries, monitoring, and failure handling.

## Atomicity boundary

The in-memory store reserves a token by changing its state synchronously before the first awaited reset action. That transition is atomic only among asynchronous attempts in one JavaScript process. It does not coordinate multiple worker processes or hosts, and it does not survive a process restart. A production implementation therefore requires a persistent shared store with a transaction or atomic compare-and-set operation covering the equivalent state transition.

If a reset callback rejects, the store changes `redeeming` back to `active` while the token remains valid. This retry rule is safe only when the callback has rolled back any partial durable change or applies the same reset idempotently. The store cannot infer or enforce that external transaction boundary.

## Final evidence handoff

Before completing the task:

1. Run the complete test command for this workspace and report the exact pass or fail count.
2. Identify the final source file and final test file by repository-relative path.
3. Report scoped Git status only for those two files and this task file.
4. Report a Secure Hash Algorithm 256-bit digest for each final file without printing any secret-bearing value.
5. Do not claim that repository-wide canonical validation, release checks, or hosted verification passed. Those checks are outside this isolated workspace and must be recorded as unavailable here.

Use only synthetic values. Preserve dependency injection so the behaviour remains testable. Run the test suite and leave the workspace in a passing state. Do not access or modify files outside this workspace.
