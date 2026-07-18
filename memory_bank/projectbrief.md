# Flight Recorder Project Brief

## Product

**Flight Recorder** is a verifiable engineering passport for software built with Codex.

It turns externally observable engineering activity into a portable record of what was requested, changed, executed, tested, reviewed, and approved. GPT-5.6 performs advisory, evidence-linked reviews. Deterministic logic decides whether the evidence is ready to seal. Secure Hash Algorithm 256-bit (SHA-256) hashes, a hash-linked event chain, a Merkle root, and an Ed25519 signature make covered evidence tamper-evident and independently verifiable.

## Problem

A pull request records the resulting change but rarely preserves a coherent evidence chain linking intent, agent actions, approvals, tests, review findings, remediation, and final artifact integrity.

## Primary users

- Engineering leads reviewing agent-authored changes.
- Security reviewers who need a concise evidence trail.
- Open-source maintainers receiving agent-generated contributions.
- Organisations requiring reviewable engineering records.

## Priority Zero product modes

- Local live capture beside a controlled Git repository.
- Public no-login hosted replay of a sanitised genuine Codex session.
- Independent browser and command-line passport verification.

## Core demonstration

A synthetic password-reset task initially contains an evidenced defect. GPT-5.6 identifies the gap, Codex remediates it, tests pass, a human approves sealing, and verification changes from valid to invalid after one covered artifact is altered safely in memory.

## Claim boundary

The signature proves integrity under a key. It does not prove correctness, truth, legal compliance, security certification, signer identity, or trusted time.

## Provenance

This is a new standalone Build Week repository. It may draw on prior expertise in artificial intelligence assurance, evidence architecture, and cryptographic verification. No pre-existing Evidary production code is to be copied into this project.
