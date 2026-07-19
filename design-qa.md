# Flight Recorder Design Quality Assurance

## Source and implementation

- Approved direction: refined option 3, Verification Split View.
- Source image: `LOCAL_HOME/.codex/generated_images/<private-feedback-session-identifier>/exec-af0cb316-f0fc-4ae4-85af-d3cc419b9b72.png`
- Implementation: `apps/web/`
- Desktop viewport: 1280 by 720 pixels, with full-page captures at 1280 by 1181 pixels.
- Verified-state capture: `apps/web/.design-qa/01-verified.png`
- Invalid-state capture: `apps/web/.design-qa/02-invalid.png`
- Mobile capture: `apps/web/.design-qa/03-mobile.png`
- Combined full-view comparison: `apps/web/.design-qa/04-source-vs-implementation.png`

## Comparison result

The implementation preserves the source hierarchy and core visual language: a dark graphite verification surface, five-step engineering timeline, independent verifier, covered-artifact inventory, hash-linked proof, green verified state, safe tamper control, and explicit limitations. IBM Plex Sans and IBM Plex Mono provide the intended technical hierarchy. Phosphor icons replace generated icon approximations with one consistent icon family. Radix primitives provide accessible disclosure, accordion, and tooltip behaviour.

The implementation deliberately replaces the source's genuine-session claims with `Signed synthetic cryptographic fixture` until a new genuine post-remediation capture is bound. This is a factual-integrity correction, not accidental fidelity drift. The two displayed artifacts, five observable records, identifiers, sizes, digests, signature status, and timestamps come from the signed fixture rather than placeholder values. Proof details are open by default to match the approved source.

No separate focused crop was required because the complete source and implementation both remain legible in the same combined comparison image. The verifier, timeline, status colour, controls, icon treatment, typography, borders, radii, and content density were inspected there together.

## Interaction and state checks

- Default verifier state: `VERIFIED` with two matching covered artifacts from the signed fixture.
- Verify action: enters a visible, disabled `VERIFYING` state, performs the browser-native cryptographic checks, then returns to `VERIFIED`.
- Safe tamper action: changes only browser memory, reports `INVALID`, and marks `src/password-reset.ts` as a hash mismatch. The signed manifest and its declared Merkle root remain unchanged, so the manifest signature correctly stays valid while the artifact comparison fails.
- Restore action: returns the artifact and verifier to the verified state.
- Proof details: disclose the passport identifier, event-chain head, observable-record count, and local timestamp type.
- Accordion controls: open and close the five replay steps through semantic buttons.
- Mobile viewport: 390 by 844 pixels, with no horizontal overflow, clipped controls, or overlapping content.
- Browser console: no warnings or errors during the checked flows.
- Network inspection: every request observed during reload remained on `http://127.0.0.1:5187/`; no external request or Application Programming Interface call occurred.
- Reduced motion: animation duration is reduced through the `prefers-reduced-motion` media query.
- Keyboard focus: buttons and disclosure controls have visible focus treatment and semantic accessible names.

## Quality history

1. The first mobile full-page capture retained a scrolled sticky-header position and visually overlaid the header. Reloading at the page origin proved this was a capture-state artifact; the replacement mobile capture starts at scroll position zero and has no overlap.
2. The first preview used a stale commit identifier and called the refreshed demonstration a genuine capture. Those labels were replaced with truthful integration-preview language before this quality gate passed.
3. The desktop comparison initially used a full-page capture while temporary mobile emulation remained active. The viewport override was reset, the implementation was recaptured at 1280 by 720 pixels, and the side-by-side comparison was regenerated.
4. The first invalid-state design incorrectly changed the Ed25519 signature status to invalid when only an external artifact changed. The corrected interface keeps the signed manifest valid, reports the artifact comparison as a mismatch, and makes only the overall passport result invalid.
5. Manual verification completed too quickly for the transition to be perceptible. A bounded 220-millisecond presentation floor now exposes the disabled `VERIFYING` state without changing the underlying verification result.

## Browser evidence

- Route: `in-app browser proof`.
- Chrome Profile 7 was not required for this unauthenticated local preview. Profile 7-dependent Devpost and operator-handoff work remains a separate open surface.

final result: passed
