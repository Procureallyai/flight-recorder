# Flight Recorder demonstration script

**Target duration:** 2 minutes 50 seconds

## 0:00 to 0:15: thesis

Code generation creates output. Serious engineering also needs evidence that can survive inspection.

Flight Recorder is a verifiable engineering passport for software built with Codex. It records what changed, what was tested, reviewed, and approved.

## 0:15 to 0:38: the product

This public, no-login interface replays a sanitised genuine Codex session for a synthetic password-reset task. It preserves observable engineering events without storing private reasoning, and binds the task, commands, tests, final Git state, and four committed artifacts.

## 0:38 to 1:05: how Codex was used

Codex was the primary engineering partner throughout Build Week. The final run used GPT-5.6 Terra. It found a stalled audit-response path, repaired it, and completed sixteen deterministic tests. Flight Recorder then bound the capture to one clean commit and one passing post-commit test.

## 1:05 to 1:34: GPT-5.6 inside the product

GPT-5.6 is also part of the runtime product. Four structured specialists review requirements traceability, security, test adequacy, and evidence completeness. A fifth call synthesises the result. Findings cite stable evidence identifiers, but deterministic application logic decides whether the passport is ready to seal.

This passport contains five signed review receipts and twenty-two findings. Eighteen were resolved. Four remain visible as accepted demonstration-scope risks for durable audit delivery and distributed token atomicity.

## 1:34 to 2:02: cryptographic proof

The independent browser verifier recomputes the Secure Hash Algorithm 256-bit artifact hashes, hash-linked event chain, deterministic Merkle root, and Ed25519 signature. It needs no Flight Recorder server, Codex account, or OpenAI Application Programming Interface key.

The claim is narrow: the covered evidence has not changed since sealing by the corresponding key holder. It does not claim correctness, certified security, signer identity, legal compliance, or trusted time.

## 2:02 to 2:26: the central demonstration

I will alter one covered artifact safely in browser memory. The signature remains valid, but the artifact hash no longer matches. Verification turns red immediately and identifies the mismatch. Nothing is uploaded.

## 2:26 to 2:40: restoration

Restoring the artifact returns the passport to verified. That green-to-red transition is the core proof: the evidence is portable, independently checkable, and sensitive to a covered change.

## 2:40 to 2:50: close

Flight Recorder does not ask reviewers to trust an engineering story. It gives them the evidence, the limits, and the means to verify both.

## Recording checklist

- Record the production route: `https://flight-recorder-web.vercel.app/`.
- Keep the final public YouTube video below three minutes.
- Make the narration audible and explicitly retain the Codex and GPT-5.6 sections.
- Show the initial verified state, proof details, accepted warnings, in-memory artifact change, invalid state, mismatch, and restoration.
- Do not show browser bookmarks, private tabs, Application Programming Interface keys, local paths, billing details, or the private `/feedback` Session Identifier.
- Publish the YouTube video as Public, then verify it in a private browsing window before entering the address in Devpost.
