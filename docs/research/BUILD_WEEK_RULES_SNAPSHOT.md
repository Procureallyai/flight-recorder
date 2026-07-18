# OpenAI Build Week Rules Snapshot

**Checked:** 18 July 2026
**Authority:** Current official OpenAI Build Week and official provider documentation. Recheck before final submission.

## Confirmed controls

- Submission deadline: Tuesday, 21 July 2026 at 5:00 p.m. Pacific Daylight Time, equivalent to Wednesday, 22 July 2026 at 1:00 a.m. British Summer Time.
- Submission Period began 13 July 2026 at 9:00 a.m. Pacific Daylight Time.
- Project must use both Codex and GPT-5.6 meaningfully and explain both in text, repository documentation, and the public demonstration video.
- Developer Tools is one of four tracks, and each project selects one track.
- Video must be publicly visible on YouTube, shorter than three minutes, and include audio explaining the product, Codex use, and GPT-5.6 use.
- Repository must be public with relevant licensing or private and shared with `testing@devpost.com` and `build-week-event@openai.com`.
- The README must explain Codex collaboration, key human decisions, and GPT-5.6 use.
- The primary build task must provide a `/feedback` Codex Session ID.
- A developer tool must provide installation instructions, tested supported platforms, and a judge route that does not require rebuilding.
- The working project must remain free and unrestricted through the judging period ending 5 August 2026 at 5:00 p.m. Pacific Time.
- Devpost final submission creates a legal agreement. Codex must not accept it for the entrant.

## Entrant and ownership clarification

- The official rules permit an eligible individual, a team, or an organisation to enter. There is no requirement to submit through a company.
- An individual who participates in a team or organisation may still enter separately as an individual.
- A representative-authority warranty applies only when a team or organisation is the entrant.
- An individual prize is payable to the individual entrant; an organisation prize is payable to the organisation.
- The submission must be the entrant's original work and solely owned by that entrant. The individual-entry plan therefore requires a standalone project with no Evidary AI Ltd production code, no unlicensed company assets, and no third-party ownership interest.
- Whether an employment, director, shareholder, consultancy, or intellectual-property agreement gives Evidary AI Ltd rights in newly created work is a human legal-review question. The hackathon rules do not resolve that private contractual question.

## Cost and infrastructure clarification

- OpenAI supplies approved Build Week Codex credits only. The credit-request deadline was 17 July 2026 at noon Pacific Time. The event does not supply separate OpenAI Application Programming Interface credits.
- GPT-5.6 Sol currently costs US$5 per million input tokens and US$30 per million output tokens; the `gpt-5.6` alias routes to GPT-5.6 Sol.
- OpenAI does not require or supply Vercel hosting. The rule is a working, free-to-judges project path.
- GitHub Free supports public repositories, so the required code repository does not inherently require payment.
- Vercel Hobby is free but restricted to personal, non-commercial use. Vercel Pro currently starts at US$20 per month and includes US$20 of usage credit. Do not assume Hobby is valid for an Evidary AI Ltd organisation entry.
- Vercel defines commercial use broadly as deployment for the purpose of financial gain by anyone involved in producing the project. A prize-bearing hackathon deployment is not expressly classified, so Hobby eligibility remains ambiguous even for an individual entry. Obtain Vercel confirmation or use Pro for the deadline-safe route.

## Technical documentation check

- Codex App Server is intended for deep client integrations involving authentication, history, approvals, and streamed events.
- Its default `stdio` transport uses newline-delimited JavaScript Object Notation (JSONL).
- WebSocket transport is documented as experimental and unsupported. Plain WebSockets are appropriate only for local or secure forwarded connections.
- GPT-5.6 Sol supports the Responses Application Programming Interface and Structured Outputs.

## Participant email received 18 July 2026

- Devpost and OpenAI reiterated that Tuesday, 21 July 2026 at 5:00 p.m. Pacific Daylight Time is the correct deadline.
- Free Codex access is sufficient to participate; Floyd separately confirmed receipt of the US$100 Build Week Codex credit.
- The email recommends batching Codex work and reserving GPT-5.6 usage for the build work that will be cited.
- A private repository must be shared with both judging addresses before the deadline. Flight Recorder still recommends a public repository with relevant licensing for the cleanest judging route.
- Team-invitation guidance is not applicable while Floyd remains the sole individual entrant.
- The Devpost draft should be started early and may be edited until the deadline. Flight Recorder's draft already exists and has its stable overview fields saved.
- The email says an unlisted YouTube video is acceptable, while the live Frequently Asked Questions state that the demonstration must be public. Until the official surfaces converge, use the stricter public visibility setting and verify it in a private browser window.
- The Devpost Hackathons Plugin was installed and connected on 18 July 2026 through Profile 7. It is advisory and does not replace official-source verification.

## Official sources

- https://openai.devpost.com/rules
- https://openai.devpost.com/details/faqs
- https://openai.devpost.com/resources
- https://developers.openai.com/codex/app-server
- https://developers.openai.com/api/docs/models/gpt-5.6-sol
- https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories
- https://vercel.com/docs/plans/hobby
- https://vercel.com/pricing
