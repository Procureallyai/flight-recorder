# Flight Recorder Workflow Feedback

## 18 July 2026: Codex App Server preflight blocked by state-database backfill

- Surface: local capture
- What happened: `codex app-server` from installed `codex-cli 0.140.0` could not complete the initialisation handshake within 30 seconds because the shared Codex state database reported an active backfill lock under `LOCAL_HOME/.codex`.
- Why it slowed or risked the work: a live adapter test cannot currently prove the experimental App Server route even though version-matched schemas and command availability are confirmed.
- Suggested fix: add a bounded preflight with explicit lock and backfill reporting, do not kill or alter active Codex processes, and continue through the stable `codex exec --json` fallback until the backfill clears.
- Recommended promotion target: project skill update after the behaviour is reproduced or resolved during a later live-capture attempt.
