# Flight Recorder Validation Matrix

| Surface | Required evidence | Current status |
|---|---|---|
| Canonical documents | Required files exist and truth validator passes | In progress |
| Supplied handoff preservation | Repository copies match supplied SHA-256 hashes | Verified |
| Deterministic passport | Valid bundle verifies; changed bundle fails | Verified locally on 18 July 2026: `pnpm test` passed 5 tests; `pnpm demo:generate` created the fixture; `pnpm verify` passed schema, Ed25519 signature, event-chain, chain-head, Merkle-root, and artifact checks. Tampered artifact and modified-manifest tests fail verification as required. |
| Codex capture | Genuine observable session captured or supported fallback imported | Not started |
| GPT-5.6 runtime | Real schema-valid review with evidence references | Not started |
| Local application | Tested on explicitly claimed platform | Not started |
| Hosted judge route | Public, no-login flow completes twice | Not started |
| Security | Secret scan, threat model, archive safety, and redaction tests | Not started |
| Quality | Formatting, lint, type check, unit, integration, end-to-end, and build gates pass | Partial: TypeScript build and 5 focused unit tests pass. Formatting, lint, integration, browser end-to-end, and production application build are not yet implemented. |
| GitHub | Correct remote, visibility, licence, release commit, tag, and checks | Unverified |
| Video and screenshots | Final release shown, public YouTube under three minutes, no sensitive data | Not started |
| Devpost | Profile 7 draft saved at final human-only review | Partial: overview saved; release-dependent fields remain |
| Human acceptance | Entrant, authority, ownership, eligibility, terms, and final submit | Not performed |
