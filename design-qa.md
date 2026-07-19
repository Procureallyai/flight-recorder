# Flight Recorder Design Quality Assurance

## Source and implementation

- Approved direction: refined option 3, Verification Split View.
- Source image: `LOCAL_HOME/.codex/generated_images/<private-feedback-session-identifier>/exec-af0cb316-f0fc-4ae4-85af-d3cc419b9b72.png`
- Implementation: `apps/web/`
- Desktop viewport: 1440 by 1024 pixels.
- Verified-state capture: `apps/web/.design-qa/01-verified.png`
- Invalid-state capture: `apps/web/.design-qa/02-invalid.png`
- Mobile capture: `apps/web/.design-qa/03-mobile.png`
- Combined full-view comparison: `apps/web/.design-qa/04-source-vs-implementation.png`

## Comparison result

The implementation preserves the source hierarchy and core visual language: a dark graphite verification surface, five-step engineering timeline, independent verifier, covered-artifact inventory, hash-linked proof, green verified state, safe tamper control, and explicit limitations. IBM Plex Sans and IBM Plex Mono provide the intended technical hierarchy. Phosphor icons replace generated icon approximations with one consistent icon family. Radix primitives provide accessible disclosure, accordion, and tooltip behaviour.

The implementation deliberately replaces the source's final-session claims with `Integration preview` and `Build Week checkpoint` until a new genuine post-remediation capture is bound. This is a factual-integrity correction, not an accidental fidelity drift. Artifact sizes match the current local demonstration files. Proof details are open by default to match the approved source.

No separate focused crop was required because the complete source and implementation both remain legible in the same combined comparison image. The verifier, timeline, status colour, controls, icon treatment, typography, borders, radii, and content density were inspected there together.

## Interaction and state checks

- Default verifier state: `VERIFIED` with four matching covered artifacts.
- Verify action: enters a disabled `VERIFYING` state, then returns to `VERIFIED`.
- Safe tamper action: changes only browser memory, reports `INVALID`, marks `src/password-reset.ts` as a hash mismatch, and changes the signature status to invalid.
- Restore action: returns the artifact and verifier to the verified state.
- Proof details: disclose the event-chain head, evidence-leaf count, signer public key, and local timestamp type.
- Accordion controls: open and close the five replay steps through semantic buttons.
- Mobile viewport: 390 by 844 pixels, with no horizontal overflow, clipped controls, or overlapping content.
- Browser console: no warnings or errors during the checked flows.
- Reduced motion: animation duration is reduced through the `prefers-reduced-motion` media query.
- Keyboard focus: buttons and disclosure controls have visible focus treatment and semantic accessible names.

## Quality history

1. The first mobile full-page capture retained a scrolled sticky-header position and visually overlaid the header. Reloading at the page origin proved this was a capture-state artifact; the replacement mobile capture starts at scroll position zero and has no overlap.
2. The first preview used a stale commit identifier and called the refreshed demonstration a genuine capture. Those labels were replaced with truthful integration-preview language before this quality gate passed.
3. The desktop comparison initially used a full-page capture after a viewport change, which retained the old mobile capture width. The comparison was regenerated from an exact 1440 by 1024 viewport capture.

final result: passed
