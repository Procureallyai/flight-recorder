# Flight Recorder demonstration script

**Target duration:** 2 minutes 43 seconds

## 0:00 to 0:06: thesis

Code generation creates output. Serious engineering needs evidence that survives inspection.

## 0:06 to 0:51: genuine Codex capture

Introduce Flight Recorder as a verifiable engineering passport. Explain the split view: observable engineering evidence on the left and independent verification on the right. State that the replay comes from a genuine, sanitised Codex session and excludes private reasoning.

Explain the synthetic password-reset task. Codex used GPT-5.6 Terra to find and repair a stalled audit path, pass sixteen deterministic tests, and bind the result to a clean commit, a passing post-commit test, and four committed artifacts.

## 0:51 to 2:03: assurance and cryptographic proof

Explain that GPT-5.6 is part of the runtime product, not only the build process. Four structured reviewers assess requirements traceability, security, test adequacy, and evidence completeness. A fifth call synthesises the findings. The model remains advisory, while deterministic application logic controls seal readiness.

Show the five signed review receipts, twenty-two findings, eighteen resolved findings, and four visible accepted demonstration-scope warnings.

Explain that the browser verifier independently recomputes the Secure Hash Algorithm 256-bit artifact hashes, hash-linked event chain, deterministic Merkle root, and Ed25519 signature without relying on a Flight Recorder server, Codex account, or OpenAI Application Programming Interface key.

State the narrow integrity claim and its limits.

## 2:03 to 2:19: safe in-memory change

Change one covered artifact safely in browser memory. Show that the manifest signature remains valid, while the artifact comparison fails and the passport becomes invalid. State that nothing is uploaded.

## 2:19 to 2:43: restore and close

Restore the original artifact and show successful independent verification. Explain why the green-to-red-to-green transition matters: reviewers receive the engineering evidence and the means to verify it.

Disclose that Codex scripted, assembled, synchronised, and validated the demonstration, and that OpenAI's speech model generated the synthetic narration.

## Recording checklist

- Local review video: `output/video/flight-recorder-openai-build-week-demo.mp4`.
- YouTube thumbnail: `docs/submission/assets/flight-recorder-video-thumbnail-16x9.jpg`.
- Reviewed upload copy: `docs/submission/YOUTUBE_DESCRIPTION.md`.
- Generate narration with the `gpt-4o-mini-tts` speech model and the `cedar` voice.
- Keep the visible and written synthetic-voice disclosure.
- Record the production route: `https://flight-recorder-web.vercel.app/`.
- Keep the final public YouTube video below three minutes.
- Make the narration audible and explicitly retain the Codex and GPT-5.6 sections.
- Show the initial verified state, proof details, accepted warnings, in-memory artifact change, invalid state, mismatch, and restoration.
- Do not show browser bookmarks, private tabs, Application Programming Interface keys, local paths, billing details, or the private `/feedback` Session Identifier.
- Publish the YouTube video as Public, then verify it in a private browsing window before entering the address in Devpost.
