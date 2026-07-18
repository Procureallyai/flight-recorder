# Architecture Decision Record 006: hosted fixture-only judge mode

- Status: accepted
- Date: 18 July 2026

## Decision

The public no-login judge route replays a sanitised recording of a genuine Codex session and loads a previously generated review and passport. It does not accept arbitrary repositories, execute shell commands, expose local Codex control, or place an OpenAI Application Programming Interface key in browser code.

Any optional hosted model call must be server-side, explicitly bounded, rate-limited, and protected by a budget kill switch. A cached genuine result remains the deterministic judging path.

## Consequences

Hosted replay truth, local capture truth, and genuine runtime-model truth remain distinct. The public route can demonstrate the complete workflow reliably without granting judges privileged execution access.
