# Flight Recorder Workflow Feedback

## 18 July 2026: Codex App Server preflight blocked by state-database backfill

- Surface: local capture
- What happened: `codex app-server` from installed `codex-cli 0.140.0` could not complete the initialisation handshake within 30 seconds because the shared Codex state database reported an active backfill lock under `~/.codex`.
- Why it slowed or risked the work: a live adapter test cannot currently prove the experimental App Server route even though version-matched schemas and command availability are confirmed.
- Suggested fix: add a bounded preflight with explicit lock and backfill reporting, do not kill or alter active Codex processes, and continue through the stable `codex exec --json` fallback until the backfill clears.
- Recommended promotion target: project skill update after the behaviour is reproduced or resolved during a later live-capture attempt.

Resolution note: on 18 July 2026, the desktop-bundled `codex-cli 0.145.0-alpha.18` completed protocol initialisation, created an ephemeral thread, and completed a bounded live turn through the implemented Flight Recorder client and event normaliser. The earlier lock was route-specific and temporary. Live approval exchange remains a separate unverified boundary.

## 18 July 2026: Homebrew-linked Codex binary was older than the desktop-bundled binary

- Surface: local capture
- What happened: `/opt/homebrew/bin/codex` exposed `codex-cli 0.140.0`, which the service rejected for the configured GPT-5.6 Sol model. `/Applications/ChatGPT.app/Contents/Resources/codex` exposed `codex-cli 0.145.0-alpha.18`.
- Why it slowed or risked the work: relying on the first executable in `PATH` produced a false capture failure and stale protocol assumptions.
- Suggested fix: discovery must inspect all candidate binaries, prefer the signed-in desktop-bundled binary when version-compatible, and record the exact tested path and version.
- Recommended promotion target: local capture preflight and delivery skill.

## 18 July 2026: managed sandbox denied loopback test binding

- Surface: validation
- What happened: bridge tests that bind an ephemeral `127.0.0.1` port failed with `EPERM` in the default managed sandbox and passed unchanged through the narrow approved loopback route.
- Why it slowed or risked the work: an ordinary test failure could be misreported as an application defect even though compilation and the same runtime checks pass outside the socket-restricted sandbox.
- Suggested fix: label loopback-runtime proof separately, request only ephemeral loopback permission for this test group, and retain conventional continuous integration execution as the portable gate.
- Recommended promotion target: project skill update if the restriction recurs in later bridge or browser integration work.

## 18 July 2026: secure key writer and OnePassword local mount were incompatible

- Surface: secret configuration
- What happened: OnePassword created its local Environment file as a permission-restricted named pipe. The OpenAI secure key helper correctly refused to write the key because its destination contract permits only a regular non-symbolic-link file.
- Why it slowed or risked the work: the two individually safe tools had incompatible destination contracts. The first encrypted key was created but could not be persisted, leaving an orphaned Platform credential that now requires revocation.
- Suggested fix: add a connector-to-OnePassword encrypted handoff or a OnePassword import operation that accepts locally encrypted key material without exposing plaintext to Codex.
- Recommended promotion target: OpenAI key skill and OnePassword Environments skill update.
