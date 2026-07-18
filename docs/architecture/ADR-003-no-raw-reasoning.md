# Architecture Decision Record 003: no raw reasoning persistence

- Status: accepted
- Date: 18 July 2026

## Decision

Flight Recorder stores externally observable activity and concise evidence. It drops raw reasoning items, reasoning deltas, reasoning summaries, raw tool arguments, and unknown raw payloads before public persistence.

Unknown events retain only safe envelope metadata and a digest. Aggregate token counts may be retained without reasoning content.

## Consequences

The record supports auditability without becoming a private-reasoning recorder. Some internal model process details are deliberately unavailable and cannot be used as evidence.
