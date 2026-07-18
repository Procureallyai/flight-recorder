# Codex remediation task

Work only in this fully synthetic password-reset workspace.

Repair the existing implementation so that it satisfies all of these acceptance criteria:

1. Password-reset tokens expire and are single use.
2. Known and unknown accounts receive the same neutral public response, preventing account enumeration.
3. Raw reset tokens never enter logs or audit events.
4. A safe audit event is recorded without exposing direct account or token identifiers.
5. Automated tests cover known and unknown accounts, response equality, safe logging and audit behaviour, token expiry configuration, and the single-use contract.

Use only synthetic values. Preserve dependency injection so the behaviour remains testable. Run the test suite and leave the workspace in a passing state. Do not access or modify files outside this workspace.
