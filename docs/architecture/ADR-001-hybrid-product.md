# Architecture Decision Record 001: hybrid product boundary

- Status: accepted
- Date: 18 July 2026

## Decision

Flight Recorder separates local capture, hosted judge replay, and independent verification.

The local mode may observe a user-authorised repository and Codex session. The hosted route replays only a sanitised, synthetic-data recording and never executes arbitrary repositories or shell commands. The verifier checks exported passports without trusting the Flight Recorder server or requiring Codex or GPT-5.6.

## Consequences

This gives judges a reliable no-login path while keeping privileged repository access local. It also requires clear truth separation: a working replay does not prove live capture, and local capture does not prove deployment.
