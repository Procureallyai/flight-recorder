# Flight Recorder Validation Matrix

| Surface | Required evidence | Current status |
|---|---|---|
| Canonical documents | Required files exist and truth validator passes | Verified locally on 18 July 2026: delivery skill quick validation and `scripts/validate-canonical-truth.sh` both pass. |
| Supplied handoff preservation | Repository copies match supplied SHA-256 hashes | Verified |
| Deterministic passport | Valid bundle verifies; changed bundle fails | Verified locally on 18 July 2026 after independent security review and remediation: strict signed-envelope schema, deterministic seal policy, Ed25519 key enforcement, event chain, Merkle root, artifacts, manifest tamper, artifact tamper, algorithm confusion, prototype-name, and symbolic-link cases pass focused checks. The generated fixture is synthetic and is not final provenance. |
| Codex capture | Genuine observable session captured or supported fallback imported | Verified for fallback Gate B on 18 July 2026: desktop-bundled `codex-cli 0.145.0-alpha.18` completed a genuine synthetic remediation run with exit code 0; 19 sanitised observable events imported with zero issues; raw reasoning was discarded; identifiers and local paths were pseudonymised; approval coverage is correctly `not-observed`; 6 remediation tests pass. Live App Server remains unverified because its handshake is route-blocked by a state backfill lock. |
| GPT-5.6 runtime | Real schema-valid review with evidence references | Partial: current Responses Application Programming Interface request, strict Structured Outputs, four parallel specialists, synthesis, timeouts, `store: false`, evidence boundaries, and deterministic seal policy pass mocked integration tests. No billed runtime call has occurred. |
| Local application | Tested on explicitly claimed platform | Not started |
| Hosted judge route | Public, no-login flow completes twice | Not started |
| Security | Secret scan, threat model, archive safety, and redaction tests | Partial: strict-envelope, seal-policy, Ed25519 algorithm, named-secret, inline-credential, output-bound, malformed-key, traversal-path, prototype-name, and symbolic-link tests pass. Threat model, resource limits, full secret scan, archive safety, and integration validation remain. |
| Quality | Formatting, lint, type check, unit, integration, end-to-end, and build gates pass | Partial: TypeScript build and 23 focused product tests pass; the genuine synthetic remediation workspace passes 6 tests. Formatting, lint, browser end-to-end, and production application build are not yet implemented. |
| GitHub | Correct remote, visibility, licence, release commit, tag, and checks | Unverified |
| Video and screenshots | Final release shown, public YouTube under three minutes, no sensitive data | Not started |
| Devpost | Profile 7 draft saved at final human-only review | Partial: overview saved; release-dependent fields remain |
| Human acceptance | Entrant, authority, ownership, eligibility, terms, and final submit | Not performed |
