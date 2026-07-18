# Genuine sanitised Codex capture

`capture.json` is derived from a genuine `codex exec --json` remediation session run on 18 July 2026 with the desktop-bundled `codex-cli 0.145.0-alpha.18`.

The session operated only on `demo/password-reset-workspace`, which contains synthetic data and a deliberately defective baseline. The committed public capture:

- retains completed observable agent messages, commands, file changes, plans, test results, and turn completion;
- drops reasoning items and streaming deltas;
- pseudonymises source identifiers;
- replaces the absolute repository path with `<repository>`;
- applies secret-pattern redaction and output bounds before event-chain hashing;
- records approval coverage as `not-observed`, because non-interactive capture does not prove a human approval decision;
- contains no private `/feedback` Session Identifier.

The raw JavaScript Object Notation Lines stream and standard-error log remain under the gitignored `.flight-recorder/sessions/raw/` directory. They are not submission assets.

This capture proves the fallback import path. It does not prove the experimental Codex App Server route, a GPT-5.6 runtime review, deployment, or human acceptance.
