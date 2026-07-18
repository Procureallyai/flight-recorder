# Flight Recorder — Build Week Handoff Index

## Included files

### 1. `flight-recorder-build-week-master-prd.md`

The product and technical source of truth. It contains:

- verified Build Week constraints;
- product positioning and judging strategy;
- functional and non-functional requirements;
- hybrid local/hosted architecture;
- Codex App Server integration and fallback design;
- GPT-5.6 runtime review pipeline;
- evidence schema, passport structure and cryptographic design;
- security/privacy threat model;
- demonstration repository and three-minute video plan;
- delivery schedule, tests, release gates and definition of done;
- draft Devpost narrative and legal/factual review boundaries.

### 2. `codex-flight-recorder-master-build-prompt.md`

Give this prompt to the primary Codex build thread. It directs Codex to:

- reverify the official rules;
- create a new standalone repository;
- implement, test and deploy Flight Recorder;
- preserve Build Week provenance;
- record a genuine Codex session;
- integrate GPT-5.6 at runtime;
- generate final judge assets and submission documents;
- run `/feedback` in the primary thread;
- stop with a tested release and browser hand-off pack.

### 3. `codex-devpost-draft-completion-prompt.md`

Use this only after the final build, deployment, public YouTube video and `/feedback` Session ID exist. Give it to Codex with browser control through the Codex Chrome extension in **Chrome profile 7**. It directs Codex to:

- inspect the final repository and submission metadata;
- reverify the live official requirements;
- open the existing Devpost draft;
- complete and save every safe, verified form field;
- upload the final assets;
- verify all public links;
- stop at final review or the first legal declaration;
- never accept legal terms or submit the project.

## Execution order

1. Open one primary Codex thread for the build.
2. Attach or paste the master build prompt and make the master PRD available in the repository or thread.
3. Keep most core implementation work in that primary thread.
4. Complete the tested release, hosted judge sandbox, repository, video and submission assets.
5. Run `/feedback` in the primary thread and store the resulting Session ID in the gitignored local submission-secret file.
6. Review Codex’s final validation report and resolve every Priority Zero blocker.
7. Start the browser-use task with the Devpost prompt in Chrome profile 7.
8. Review the completed draft, entrant identity, repository/licence position, ownership and eligibility declarations personally.
9. Accept the applicable terms and click the final submit button personally before the deadline.

## Human-only decisions

Floyd Livingstone Rowe must personally confirm:

- whether the entrant is an individual or Evidary AI Ltd;
- authority to represent Evidary AI Ltd;
- ownership and contributor rights;
- licence and repository-access choice;
- eligibility and compliance with the rules;
- acceptance of the Devpost/OpenAI terms;
- the final submission action.

## Deadline control

- Official deadline: **Tuesday, 21 July 2026 at 5:00 p.m. Pacific Daylight Time**, equivalent to **Wednesday, 22 July 2026 at 1:00 a.m. British Summer Time**.
- Internal target: complete the user’s final submit action by **Wednesday, 22 July 2026 at 12:15 a.m. British Summer Time**.
- Do not use the final 45 minutes for building, deployment, uploads or video processing.

## Recommended repository status

Default recommendation, subject to Floyd’s final decision:

- New standalone repository created during Build Week.
- Public repository with Apache License 2.0.
- Product title: **Flight Recorder**.
- Track: **Developer Tools**.
- Built by Evidary AI Ltd.
- No pre-existing Evidary production code copied into the project.

## Final stop condition

The browser agent leaves the Devpost draft saved and open at final review. Floyd reviews and performs the final legal agreement and submission action himself.
