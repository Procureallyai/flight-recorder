# Flight Recorder Decision Log

| Identifier | Decision | Status | Evidence or rationale |
|---|---|---|---|
| DEC-001 | Product title is `Flight Recorder`; Codex appears only in descriptive copy. | Accepted | Brand-safe handoff and official OpenAI brand guidance. |
| DEC-002 | Target the Developer Tools track. | Accepted | Official track covers testing, developer operations, agentic workflows, and security. |
| DEC-003 | Create a new standalone repository and do not copy Evidary production code. | Accepted | Build Week provenance and ownership clarity. |
| DEC-004 | Use hybrid local capture, hosted replay, and independent verification. | Accepted for implementation | Judge test path and local Codex context require different operating modes. |
| DEC-005 | Treat GPT-5.6 review as advisory and use a deterministic seal gate. | Accepted | Prevent model judgement from becoming a certification claim. |
| DEC-006 | Use precise tamper-evident cryptographic wording. | Accepted | Integrity under a key does not prove correctness, identity, compliance, or trusted time. |
| DEC-007 | Use a public Apache License 2.0 repository by default. | Awaiting human decision | The entrant and repository owner must confirm ownership and commercial position. |
| DEC-008 | Enter as Floyd Livingstone Rowe in an individual capacity, not as Evidary AI Ltd. | Accepted | The official rules permit individual, team, or organisation entry. Floyd selected individual entry. |
| DEC-009 | Deploy through Vercel, existing Azure, or another eligible host. | Awaiting evidence and human decision | Vercel Hobby is restricted to personal, non-commercial use. A prize-bearing deployment may fall within Vercel's broad financial-gain definition, so Hobby eligibility is not assumed. Vercel Pro remains the deadline-safe fallback. |
| DEC-010 | Use separately billed OpenAI Application Programming Interface access for genuine GPT-5.6 runtime calls. | Awaiting billing authority | Build Week Codex credits cannot be used for runtime Application Programming Interface calls. |
| DEC-011 | Use the confirmed US$100 Build Week Codex credit for primary implementation work. | Accepted | Floyd confirmed receipt on 18 July 2026. Actual balance and automatic top-up setting remain account truth until inspected. |
| DEC-012 | Use the Product Design skill before front-end implementation and prefer accessible shadcn/ui primitives for standard components. | Accepted | Floyd directed this on 18 July 2026 to improve design quality and reduce delivery time. The skill's visual-target and selection gates remain mandatory. |
| DEC-013 | Install and use the Devpost Hackathons Plugin as an advisory Build Week aid. | Accepted and verified | Installed and connected on 18 July 2026 through Profile 7. Official rules, the live form, and verified release facts retain precedence. |
| DEC-014 | Route project secrets through the configured 1Password Environments integration. | Accepted | Floyd directed this on 18 July 2026. Raw values must never enter repository files, browser forms, logs, or task messages. |
| DEC-015 | Use public YouTube visibility for the final demonstration unless the official form or rules expressly supersede the conflicting guidance. | Accepted | The participant email permits unlisted visibility, while the live Frequently Asked Questions require public visibility. Public is the safer eligibility setting. |
| DEC-016 | Use multiple sub-agents selectively for bounded parallel research, review, testing, and quality control. | Accepted | Floyd directed this on 18 July 2026. Core implementation, canonical truth, validation integration, secrets, and final completion claims remain with the primary task. |
| DEC-017 | Implement and prove the version-pinned `codex exec --json` importer before retrying live App Server control. | Accepted | Installed `codex-cli 0.140.0` exposes both routes, but the App Server handshake is temporarily blocked by a shared state-database backfill lock. The fallback is part of the planned architecture and preserves the deadline. |
| DEC-018 | Treat the generated signed fixture only as a synthetic cryptographic test fixture. | Accepted | It proves deterministic integrity mechanics, not genuine Codex activity, model review, executed tests, Git provenance, or human approval. Final judge evidence must replace it with a genuine sanitised capture. |
