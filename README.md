# Warbler Health website

Marketing website with a fictional addiction-clinic support voice demo, hosted on Vercel. Independent of the pharmacy application and presenter sales demo.

## Development

Node 24: `npm ci`, `npm test`, `npm run build`. `npm run dev` previews the interface; use `vercel dev` for server endpoints. Set `.env.example` variables in Vercel or an ignored local file. Never prefix credentials with `VITE_`.

## Homepage design

The public homepage implements the supplied **Warbler Rx v2** design from “Warbler Safety design review.zip” (October 8, 2026): Geist typography, a simplified header, gold animated voice orb, numbered barriers, study context, process cards, founder photo, security section and closing call to action. The original calendar destination remains connected. All three Learn more buttons reveal the existing founder photo on mouse hover or keyboard focus, with reduced-motion support and no layout shift. The “Read the security overview” section link is removed; footer policy access remains available. Privacy, demo terms and security overview links open accessible dialogs with factual information about the current website demo.

The prototype’s simulated call is replaced with the real voice controller. Mute/end controls, error recovery, duration, and actual post-call analysis remain available. The gold connector and result-card reveal are retained. Reduced-motion preferences disable animation. The demo caption reflects browser role-play rather than implying that this demo makes phone calls or sends texts.

The study reports 61.2% median 30-day retention among Medicaid patients at opioid treatment programs (DeLisle et al., JAMA Network Open, 2026); it is context, not evidence of Warbler’s effectiveness. The separate “Why patients stop” study breakdown was removed at Noah’s request on October 9, 2026.

## Voice flow

Click the gold orb to talk about a fictional addiction-treatment barrier in your own words. There is no scenario picker or second demo interface. An open check-in starts the pinned agent; actual conversation analysis determines the summary. The orb blends gold and pale-yellow currents with a soft highlight. Hover, keyboard focus and press provide feedback; connecting, listening, processing and speaking change its movement, while mute desaturates and pauses it. State labels follow provider events; reduced-motion preferences keep the orb static. The SDK alone owns microphone access. Repeated clicks cannot create duplicate sessions, cancellation ignores late connection callbacks, and leaving the page ends the session. The SDK loads before interaction to install its iOS audio-unlock listener.

`/api/voice/start` accepts a validated scenario ID and obtains a single-use ElevenLabs signed WebSocket URL for the pinned website agent/version. The provider key stays on the server. Agent prompt, voice, tools and privacy overrides are disabled. The client sends only a scenario label, treated as untrusted input by the agent, and an HMAC visitor identifier. Only the native end-call tool is enabled; no clinical, pharmacy, messaging or scheduling integrations exist.

The browser supports mute, end, cancellation and microphone errors. Sessions end after two minutes on both client and provider. LiveKit is pinned to 2.16.1 per ElevenLabs plugin compatibility guidance; recheck compatibility before upgrading.

`/api/voice/result` verifies a one-hour signed conversation receipt and the agent/version. It maps actual enum analysis to reviewed labels. Side effects use the medication explicitly reported by the visitor, including methadone, buprenorphine and other supported medications; an unknown or unlisted medication stays generic rather than being relabeled GLP-1. Missing analysis remains pending/unavailable; it never substitutes an expected scenario result. No transcript, audio, free-form model output or API key is returned.

## Agent and privacy

`elevenlabs-agent-config.json` records the agent, pinned version, branch and Roger voice. `scripts/configure-elevenlabs.mjs` creates the isolated agent once, refuses duplicates, and saves its readback. Subsequent changes need a new version and verified application pin. The prompt source is `lib/agent-prompt.js`; scenario definitions and analysis enums are in `lib/scenarios.js`.

Audio is processed live by ElevenLabs but audio recording storage is disabled. Conversation text is retained for one day; PII redaction is not enabled on this account. The interface discloses this and requests fictional details. Failure logs include bounded request-stage labels, error categories, HTTP status and elapsed time, excluding credentials, query values and provider response bodies. Usage metadata uses an HMAC identifier, not the raw IP; Vercel retains ordinary request logs.

Side effects receive brief empathy and at most one missing impact question before a focused clinical handoff. An explicit clinician request, refusal or emergency skips ordinary discovery. Medication-use, restart, missed-dose and product-condition questions remain clinical; the agent gives no medication instructions or symptom treatment guidance. No clinical treatment content has been supplied for this demo. All external actions remain conditional previews; no appointment, message, reminder or contact actually occurs.

## Usage and deployment

- The website key remains server-only. The active agent and durable website admission controls below enforce call limits; no key-level monthly credit cap is claimed for the new workspace. No provider plan changes are part of this release.
- Provider limits: two concurrent conversations, ten daily, 120 seconds per call, 30-second silence timeout. The server additionally checks rolling history and a 1,500-credit reserve. Quota/history errors fail closed.
- A dedicated Neon database atomically reserves at most ten website starts and three starts per visitor and network in any rolling 24 hours. Production and Preview must use the same database and agent. The database clock and row lock enforce the limits across concurrent requests, serverless instances and deployments. A token issuance attempt counts even if connection setup later fails; uncertain failures are never refunded.
- The visitor uses a signed, HttpOnly, Secure, SameSite cookie. A separate HMAC of the trusted Vercel IP (IPv6 grouped by /64) limits cookie clearing and browser switching; people sharing a network also share that three-start limit. Only hashes and admission timestamps are stored, with at most ten entries per agent; expired entries are removed on the next request. Missing database configuration or an unavailable database prevents new sessions. Provider limits remain an independent backstop.
- Review the account's applicable licensing before commercial promotion. See https://elevenlabs.io/pricing/agents and https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform . The optional attribution link is omitted from the demo interface.
- `VOICE_DEMO_ENABLED=false` plus redeployment disables new calls. Production and preview use the isolated website agent. The previous Retell implementation is preserved in Git history; there is no automatic provider fallback.
- Stage with Vercel `--prod --skip-domain`, verify, then promote. Keep the pharmacy and presenter deployments untouched. The canonical site is https://warbler-health.com; both old warblersafety.com hosts, the new www host and stable Vercel aliases redirect there with paths and queries preserved. GoDaddy remains the registrar/DNS provider; Vercel hosts the site. The public contact is noah@warbler-health.com, verified against the completed Google Workspace email update. GitHub Pages is retired.

## Verification

`npm test` covers direct orb initiation, duplicate-click prevention, mute/end, cancellation during token fetch and SDK setup, microphone denial, page exit, scenario validation, request restrictions, receipt tampering/expiry, usage/credit admission, clinical routing, unavailable analysis and missing configuration. `npm run build` checks the production bundle.

`node scripts/test-addiction-agent.mjs` runs 12 fictional conversations covering clinic transport, work and childcare, return to use, clinic discharge/access, missed methadone, medication concerns, privacy, fees, insurance, emergencies and housing/phone access using existing restricted credentials. `scripts/test-elevenlabs.mjs` delegates to that current suite; earlier test JSON files are historical release records. `node scripts/verify-discovery-analysis.mjs` verifies provider extraction and the public mapping using fictional seeded conversations against the main branch, and refuses a mismatched main version. Simulations do not verify human microphone/audio quality or clinical effectiveness.

## October 9 Sites copy update

Imported the approved ChatGPT Sites copy revisions: simplified demo and founder captions, customized-agent messaging, new workflow and closing headings, and generic voice-service privacy wording. The Vercel site retains its embedded live voice demo. The idle orb says “Tap to speak”; microphone guidance appears while starting a call.

## Discovery and support during the call

The dialogue identifies the specific obstacle, its reported treatment impact, prior attempts and relevant support preference. It provides a bounded explanation or organizational plan, checks the patient's response, then chooses an appropriate owner for unresolved work. Examples include covered patient cost versus a coverage gap, authorization versus prescription renewal, refill-request forgetfulness versus dosing questions, and stock shortages versus failed delivery.

The post-call card retains the animated reveal and shows **What we learned**, **Support on this call**, **What remains**, and **Recommended next step**, followed by separately consented action/support previews. The eight new fields in `lib/discovery-result.js` use reviewed enums, independent extraction instructions, and explicit unknown states. No arbitrary generated patient narrative is exposed. The server chooses the next team from the discovered obstacle and remaining dependency. Clinical evidence in any classification overrides logistical previews. Text/reminder consent is not staff-handoff consent.

Only explicit patient confirmation of an informational/organizational barrier, substantive support, a matching nonclinical obstacle and no remaining external dependency can display **Barrier addressed — patient report**. An accepted referral or clearer plan never counts as resolved; it is not evidence of adherence. Renewals, approval, affordability, stock, delivery and clinical review remain unfinished. Null or unknown analysis stays visibly unestablished.

The prompt, extraction schema and website version pin must ship together. Provider voice/model, privacy, controls and tools stay unchanged. Revert the website deployment and agent version pin together for rollback; the previous website agent version was `agtvrsn_3501m4hb827wfrtst7ya5vtxvz3x`.

Affordability conversations conclude by offering a text with a link to financial resources, with independent permission and no implied appointment or resolution. Insurance-related refill delays offer to file an insurance-team review request on the patient's behalf using the reported blocker, prior attempts and supply if stated. Prescription renewals still belong to the prescribing office. The result card distinguishes the financial-resource text from an insurance-team request and records acceptance or refusal; both remain previews, because no messaging or request-filing tool is connected. `node scripts/test-resource-insurance-agent.mjs` exercises these revised offers and related regressions. `ANALYSIS_CASE=financial-link,insurance-request,insurance-declined,insurance-clinical,renewal node scripts/verify-discovery-analysis.mjs` verifies the affected extraction paths and records the selected cases separately.

## Addiction-treatment demo — October 13, 2026

The visitor role-plays a patient; the agent remains a clinic assistant. It discovers attendance and medication-access barriers, responds without blame, and previews clinic support with permission. Missed counseling visits alone do not imply missed doses. Actual medication interruption, withdrawal, return to substance use and medication decisions receive clinical review. Transport, scheduling, access, privacy and financial barriers map to the appropriate clinic team. No ride, appointment, readmission or external contact is promised.

The deployed version lives on the isolated addiction-treatment branch recorded in `elevenlabs-agent-config.json`; Vercel production and preview pin that exact version. The prior production version for rollback is `agtvrsn_0301m4rgkxm6ebtt6eavvbn5zqfk`. The existing voice, provider model, privacy settings, usage controls, visual design and animation remain unchanged.

Validation: 45 local checks pass. Initial synthetic suite passed 11/12; the clinic-fee explanation was improved. The final suite passed emergency and privacy checks, but ten conversations were interrupted by exhausted account credits (30,000/30,000). `tests/addiction-agent-verification.json` records this limitation. Live voice availability requires restored credits; no allowance or billing controls were changed.


## Treatment-retention positioning — October 19, 2026

The homepage now leads with helping patients stay in opioid treatment, followed immediately by the existing sourced 30-, 90-, and 180-day retention statistics. The study notes distinguish program-level medians, differing episode populations, and transfers from universal completion rates. Four treatment moments describe proposed clinic pilot workflows; the measurement section separates published research from unestablished Warbler outcomes.

A scripted fictional conversation is shown beside an illustrative staff handoff, separate from actual post-conversation analysis. Recording generation was blocked by exhausted ElevenLabs credits, so this release uses an honest “Read a sample conversation” CTA and no audio player or missing asset. The voice agent, server admission controls, privacy policy and clinical routing are unchanged. The existing calendar URL and booking portrait treatment are retained.

Visual styling continues Geist, Instrument Serif, neutral rounded cards and the existing gold accent. The footer and privacy dialog use the verified noah@warbler-health.com mailbox.


## Copy simplification — October 19, 2026

Removed hero and section subtitles, eyebrow labels, repeated demo explanations, the peripheral trust and founder promotion blocks, and closing support copy. Journey and pilot cards retain one title and one useful sentence. Research context, fictional-example labels, demo privacy disclosures and all functional voice/result elements remain.


## Immediate voice demo — October 19, 2026

The existing interactive voice demo now follows the main headline directly, before the booking/sample links and retention statistics. The centered orb and tighter spacing make the start controls immediately accessible on desktop and mobile. Its redundant visible heading is now screen-reader-only. Voice controller, results, provider configuration and privacy behavior are unchanged.

## Visible conversation-to-workflow demo — October 20, 2026

The homepage now pairs the voice controls with a persistent workflow panel. Three explicitly illustrative examples cover transportation, work-schedule conflicts and pharmacy renewal delays. Each demonstrates conversation completion, summary, permission, a care request and pending staff review. The explanatory section reflects the deployed care product's summary, request and patient-status workflow.

During real voice sessions, only observed connection state is shown. After the call, the existing signed-receipt endpoint supplies reviewed analysis. A browser-memory demo care request is created only for an agreed staff handoff with a known owner and an unresolved need. Refusals, unclear permission, missing analysis, resolved concerns and emergencies never create a routine request. These records are examples within the website session, not writes to the private care product. No messages, appointments or staff notifications are executed. Full existing call details remain available in an expandable section.

The public website intentionally does not share the private care app's records or credentials. Replay and scenario switching cannot overwrite an active voice workflow. Example playback supports skipping to results and reduced-motion preferences. Voice errors expose examples as a microphone-free alternative.

For a new ElevenLabs workspace, follow `scripts/elevenlabs-workspace-migration.md`. The helper validates the exact existing agent source, preserves privacy/limits and prepares a separately verified destination candidate. It does not replace production credentials automatically. Save the new key only in the ignored `.env.elevenlabs-new.local` file or Vercel Secrets; never put it in the frontend.

## ElevenLabs workspace migration — October 20, 2026

The website now pins the recreated addiction-demo agent in the new ElevenLabs workspace. Production and Preview use the destination key as a Vercel Secret and the matching agent/version IDs. Prompt, opening, voice/model, 17 extraction definitions, privacy, client override restrictions and usage limits were read back against the source. The destination has no configured initiation webhook, post-call webhook or cloud-storage export destination. The prior agent and its test attachments remain in the original workspace.

Validation includes 60 local checks and two fictional provider analysis cases covering accepted transportation handoff and declined scheduling handoff; the record is `tests/workspace-migration-verification.json`. Provider tool readback may add optional null defaults; verification permits these within equal-length arrays while rejecting modified or additional tools. No patient phone calls or microphone sessions were used for migration verification.

Previous website deployment for rollback: `dpl_GN8XUE3FYaMAHbye1NbTmpEs9cjj`. The prior config is preserved locally in the ignored `.elevenlabs-previous-config.local.json` and in Git history. Roll back the deployment as a unit; do not mix a workspace's key with another workspace's agent/version IDs.

## Durable voice admission

Apply `lib/voice-limits.sql` once to a dedicated Neon database, then set `VOICE_LIMIT_DATABASE_URL` as a server-only secret for Production and Preview to the same database branch. `DATABASE_URL` is accepted as a fallback. Never use a deployment-specific database branch for these counters. The global ledger is keyed by agent ID, so changing the pinned version or redeploying does not reset allowances. `VOICE_DAILY_LIMIT` may lower the global cap but cannot raise it above ten. The limit is a rolling 24-hour window, preventing extra bursts around midnight; 429 responses include a computed `Retry-After`.

The website uses the free `warbler-voice-limits` Neon resource. October 20 verification passed 74 local checks and five opt-in database integration tests: 24 concurrent requests admitted exactly ten, visitor and network groups admitted three each, expired entries reopened only their slots, and lowering the cap preserved existing reservations. Set `VOICE_LIMIT_TEST_DATABASE_URL` to run `tests/voice-limits.integration.test.mjs`; fixtures use random test-only agent rows and remove only those rows. The staged endpoint returned the expected 400/403/405 rejections and one valid single-use grant with a secure cookie and signed receipt. That verification reserved one start without connecting audio. Prior deployment URLs require Vercel authentication.

## Concise website copy — October 20, 2026

Removed repeated demo headings, generic workflow descriptions, section eyebrows and marketing-card subtext. The main page emphasizes the headline, voice controls, examples and workflow steps. Completed workflows show the substantive concern and owner in the request card without repeating them in each step. Privacy, usage limits and study methods remain accessible through links and disclosures. Desktop and mobile previews, example playback, 74 local checks and the production build passed; the final display-only refinements also passed the 20 workflow/voice UI checks.

## Homepage v2 — October 20, 2026

Rebuilt the homepage from the supplied `Voice Agent Workflow Demo.zip` / `Warbler Homepage v2.dc.html` design reference: Public Sans and Source Serif 4, cream and navy surfaces, a blue-and-gold live voice orb, four workflow cards, the sourced retention chart, guardrails and closing booking links. Both original photos remain on each Book a demo link and reveal on pointer hover or keyboard focus without moving the button. The calendar destination is unchanged.

The prototype's scripted call is replaced with the existing real ElevenLabs controller. Four stages show the barrier, agreed next step, demo request and pending follow-up. Live sessions display only observed connection state until reviewed analysis arrives. Fictional examples remain explicitly labeled and usable without a microphone. Requests require explicit handoff permission, a recognized owner and a confirmed unresolved need; emergencies and refusals never enter a routine queue. No agent configuration, credentials, privacy settings or admission limits changed.

Validation: 79 unit/lifecycle tests pass, plus all five real-database admission tests. Browser checks cover 360–1440 px layouts, both portraits, keyboard focus, all three example workflows, dialogs, and reduced motion. Provider readback confirms the pinned agent configuration and available credits. The pre-release production deployment for rollback is `dpl_5LWQQoCWXT5Hb3Biqjws9qKsKYHa`.
