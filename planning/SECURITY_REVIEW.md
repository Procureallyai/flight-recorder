# Flight Recorder Security Review

## 18 July 2026 cryptographic-core review

A bounded read-only sub-agent review reproduced material flaws in the first Gate A implementation. Gate A was reopened until fixes and focused regression tests passed.

| Finding | Initial evidence | Resolution | Verification |
|---|---|---|---|
| Unknown fields were stripped before signature verification, permitting unsigned claims. | Reproduced against the compiled verifier. | All signed-envelope schemas now reject unknown fields, and evidence payloads are restricted to safe recursive JSON values. | Unknown-field regression test fails schema validation. |
| Contradictory seal decisions could be signed and verified. | Reproduced with a recorded blocking reason and unresolved blocking finding. | One deterministic seal-policy validator is used during both sealing and verification. | Contradictory ready-state test fails the `seal-policy` check. |
| Ed448 keys were accepted under an Ed25519 label. | Reproduced with an Ed448 key and signature. | Signing and verification require actual Ed25519 key types; signatures must decode to 64 bytes. | Ed448 algorithm-confusion regression test fails signature verification. |
| Prototype-named artifact paths could crash verification. | Reproduced with `toString`, `constructor`, and `__proto__`. | Artifact lookup uses an own-property check or a `Map`, and the complete verifier fails closed. | All three paths return a controlled invalid result. |
| The command-line verifier followed symbolic links outside the artifact root. | Confirmed by code inspection. | Imported artifacts reject symbolic links and enforce real-path containment. | Temporary outside-root symlink regression test is rejected before reading. |
| The generated fixture implied tests, a model review, repository provenance, and human approval that had not occurred. | Confirmed in fixture source and event text. | The fixture is signed as `synthetic-test-fixture`; every simulated event says what is and is not claimed. | Generator output warns that it is not genuine session evidence. It remains prohibited as final public provenance. |

## 18 July 2026 release-foundation review

- Resource-count, payload-size, individual-artifact, total-artifact, and passport-size limits are implemented and regression-tested.
- Unicode normalisation, reserved-name rejection, and portable case-fold collision policy are implemented and regression-tested.
- The public-file secret scanner passed across 87 files without printing candidate values.
- `pnpm audit --audit-level=moderate` reported no known vulnerabilities across production and development dependencies. The package manager emitted a deprecation warning from its own audit request path; this is not evidence of application use of the deprecated interface.
- Archive ingestion is not implemented, so archive-bomb exposure is currently outside the supported product surface. It must be threat-modelled before any future archive-import feature.

Remaining hardening includes streaming artifact hashing, final threat-model confirmation and write-up, browser-level security validation of the selected interface, hosted-route controls, and post-deployment inspection.

## 18 July 2026 seal-gate review

A bounded read-only sub-agent reproduced a Priority One deterministic-gate failure. Unsupported acceptance criteria could pass, one passing test could hide another failed required test, and review calls were not bound to the current evidence digest.

The gate now requires every criterion to be supported, every declared required test to pass, non-empty criteria and test sets, all four unique specialist identities, five unique response identifiers, and every specialist and synthesis call to match the current evidence digest. Focused stale-review, duplicate-review, unsupported-evidence, empty-set, and mixed-test regressions pass.

Commit `cd6c5cd` added verifier-visible review provenance. A genuine passport cannot be sealed without a signed five-call receipt. Independent verification recomputes the evidence digest from recorded events and rejects missing, stale, duplicated, or mixed review receipts even when the enclosing signature is otherwise valid.

Commit `2bea430` separated human decisions from original model findings. Decisions require a reason, timestamp, human actor, declared finding, and approval event. A resolution cannot rewrite an unresolved original finding, and accepted risk cannot clear a blocking finding.
