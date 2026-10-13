# Warbler Health website

Marketing website for same-day follow-up in opioid treatment programs and outpatient MOUD clinics, hosted on Vercel. The homepage uses a fictional static sample conversation. Independent of the pharmacy application and presenter sales demo.

## Development

Node 24: `npm ci`, `npm test`, `npm run build`. `npm run dev` previews the interface; use `vercel dev` for server endpoints. Set `.env.example` variables in Vercel or an ignored local file. Never prefix credentials with `VITE_`.

## Homepage design

The public homepage implements the supplied **Warbler Rx v2** design from “Warbler Safety design review.zip” (October 8, 2026): Geist typography, a simplified header, gold animated voice orb, numbered barriers, study context, process cards, founder photo, security section and closing call to action. The original calendar destination remains connected. All three Learn more buttons reveal the existing founder photo on mouse hover or keyboard focus, with reduced-motion support and no layout shift. The “Read the security overview” section link is removed; footer policy access remains available. Privacy, demo terms and security overview links open accessible dialogs with factual information about the current website demo.

The prototype’s simulated call is replaced with the real voice controller. Mute/end controls, error recovery, duration, and actual post-call analysis remain available. The gold connector and result-card reveal are retained. Reduced-motion preferences disable animation. The demo caption reflects browser role-play rather than implying that this demo makes phone calls or sends texts.

The 53.6% first-year discontinuation statistic from JAMA Network Open is paired with Warbler’s intended role in addressing barriers; it is not evidence of Warbler’s effectiveness. The separate “Why patients stop” study breakdown was removed at Noah’s request on October 9, 2026.

## Voice flow

Click the gold orb to talk about a fictional GLP-1 prescription barrier in your own words. There is no scenario picker or second demo interface. The existing default coverage label starts the pinned agent; actual conversation analysis determines the summary. The orb blends gold and pale-yellow currents with a soft highlight. Hover, keyboard focus and press provide feedback; connecting, listening, processing and speaking change its movement, while mute desaturates and pauses it. State labels follow provider events; reduced-motion preferences keep the orb static. The SDK alone owns microphone access. Repeated clicks cannot create duplicate sessions, cancellation ignores late connection callbacks, and leaving the page ends the session. The SDK loads before interaction to install its iOS audio-unlock listener.

`/api/voice/start` accepts a validated scenario ID and obtains an ephemeral ElevenLabs WebRTC token for the pinned website agent/version. The restricted provider key stays on the server. Agent prompt, voice, tools and privacy overrides are disabled. The client sends only a scenario label, treated as untrusted input by the agent, and an HMAC visitor identifier. Only the native end-call tool is enabled; no clinical, pharmacy, messaging or scheduling integrations exist.

The browser supports mute, end, cancellation and microphone errors. Sessions end after two minutes on both client and provider. LiveKit is pinned to 2.16.1 per ElevenLabs plugin compatibility guidance; recheck compatibility before upgrading.

`/api/voice/result` verifies a one-hour signed conversation receipt and the agent/version. It maps actual enum analysis to reviewed labels. Side effects use the medication explicitly reported by the visitor, including supported non-GLP-1 medications; an unknown or unlisted medication stays generic rather than being relabeled GLP-1. Missing analysis remains pending/unavailable; it never substitutes an expected scenario result. No transcript, audio, free-form model output or API key is returned.

## Agent and privacy

`elevenlabs-agent-config.json` records the agent, pinned version, branch and Roger voice. `scripts/configure-elevenlabs.mjs` creates the isolated agent once, refuses duplicates, and saves its readback. Subsequent changes need a new version and verified application pin. The prompt source is `lib/agent-prompt.js`; scenario definitions and analysis enums are in `lib/scenarios.js`.

Audio is processed live by ElevenLabs but audio recording storage is disabled. Conversation text is retained for one day; PII redaction is not enabled on this account. The interface discloses this and requests fictional details. Failure logs include bounded request-stage labels, error categories, HTTP status and elapsed time, excluding credentials, query values and provider response bodies. Usage metadata uses an HMAC identifier, not the raw IP; Vercel retains ordinary request logs.

Side effects receive brief empathy and at most one missing impact question before a focused clinical handoff. An explicit clinician request, refusal or emergency skips ordinary discovery. Medication-use, restart, missed-dose and product-condition questions remain clinical; the agent gives no medication instructions or symptom treatment guidance. No clinical treatment content has been supplied for this demo. All external actions remain conditional previews; no appointment, message, reminder or contact actually occurs.

## Usage and deployment

- The existing account reports the Starter tier (October 12 readback); this update does not change the plan. The approved key is restricted to ElevenAgents Write, Voices Read and User access, with a 10,000-credit monthly cap.
- Provider limits: two concurrent conversations, ten daily, 120 seconds per call, 30-second silence timeout. The server additionally checks rolling history, three starts per connection per hour and a 1,500-credit reserve. Quota/history errors fail closed.
- History may lag and per-instance locks/counters are not distributed. User metadata is not a security boundary. These checks reduce abuse; provider limits and the account allowance are the independent limits. Revisit controls before promoting to high traffic.
- Review the account's applicable licensing before commercial promotion. See https://elevenlabs.io/pricing/agents and https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform . The optional attribution link is omitted from the demo interface.
- `VOICE_DEMO_ENABLED=false` plus redeployment disables new calls. Production and preview use the isolated website agent. The previous Retell implementation is preserved in Git history; there is no automatic provider fallback.
- Stage with Vercel `--prod --skip-domain`, verify, then promote. Keep the pharmacy and presenter deployments untouched. The canonical site is https://warbler-health.com; both old warblersafety.com hosts, the new www host and stable Vercel aliases redirect there with paths and queries preserved. GoDaddy remains the registrar/DNS provider; Vercel hosts the site. Existing email addresses remain unchanged until replacement mailboxes are configured. GitHub Pages is retired.

## Verification

`npm test` covers direct orb initiation, duplicate-click prevention, mute/end, cancellation during token fetch and SDK setup, microphone denial, page exit, scenario validation, request restrictions, receipt tampering/expiry, usage/credit admission, clinical routing, unavailable analysis and missing configuration. `npm run build` checks the production bundle.

`node scripts/test-discovery-agent.mjs` runs synthetic discovery scenarios plus restart, stop and emergency regressions using the existing restricted ElevenLabs credentials. `scripts/test-elevenlabs.mjs` delegates to that current suite; earlier test JSON files are historical release records. `node scripts/verify-discovery-analysis.mjs` verifies provider extraction and the public mapping using fictional seeded conversations against the main branch, and refuses a mismatched main version. Simulations do not verify human microphone/audio quality or clinical effectiveness.

## October 9 Sites copy update

Imported the approved ChatGPT Sites copy revisions: simplified demo and founder captions, customized-agent messaging, new workflow and closing headings, and generic voice-service privacy wording. The Vercel site retains its embedded live voice demo. The idle orb says “Tap to speak”; microphone guidance appears while starting a call.

## Discovery and support during the call

The dialogue identifies the specific obstacle, its reported treatment impact, prior attempts and relevant support preference. It provides a bounded explanation or organizational plan, checks the patient's response, then chooses an appropriate owner for unresolved work. Examples include covered patient cost versus a coverage gap, authorization versus prescription renewal, refill-request forgetfulness versus dosing questions, and stock shortages versus failed delivery.

The post-call card retains the animated reveal and shows **What we learned**, **Support on this call**, **What remains**, and **Recommended next step**, followed by separately consented action/support previews. The eight new fields in `lib/discovery-result.js` use reviewed enums, independent extraction instructions, and explicit unknown states. No arbitrary generated patient narrative is exposed. The server chooses the next team from the discovered obstacle and remaining dependency. Clinical evidence in any classification overrides logistical previews. Text/reminder consent is not staff-handoff consent.

Only explicit patient confirmation of an informational/organizational barrier, substantive support, a matching nonclinical obstacle and no remaining external dependency can display **Barrier addressed — patient report**. An accepted referral or clearer plan never counts as resolved; it is not evidence of adherence. Renewals, approval, affordability, stock, delivery and clinical review remain unfinished. Null or unknown analysis stays visibly unestablished.

The prompt, extraction schema and website version pin must ship together. Provider voice/model, privacy, controls and tools stay unchanged. Revert the website deployment and agent version pin together for rollback; the previous website agent version was `agtvrsn_3501m4hb827wfrtst7ya5vtxvz3x`.

Affordability conversations conclude by offering a text with a link to financial resources, with independent permission and no implied appointment or resolution. Insurance-related refill delays offer to file an insurance-team review request on the patient's behalf using the reported blocker, prior attempts and supply if stated. Prescription renewals still belong to the prescribing office. The result card distinguishes the financial-resource text from an insurance-team request and records acceptance or refusal; both remain previews, because no messaging or request-filing tool is connected. `node scripts/test-resource-insurance-agent.mjs` exercises these revised offers and related regressions. `ANALYSIS_CASE=financial-link,insurance-request,insurance-declined,insurance-clinical,renewal node scripts/verify-discovery-analysis.mjs` verifies the affected extraction paths and records the selected cases separately.

## October 13 addiction treatment pivot

Replaced the homepage copy with the approved addiction treatment positioning, workflow, fictional Daniel conversation, privacy commitments, and Medicaid OTP retention reference. The sample link scrolls to the static conversation; the homepage no longer loads the GLP-1 voice demo or requests microphone access. Existing provider configuration, voice endpoints, admission controls, and their tests are preserved. Earlier voice-demo sections above document the retained implementation, not the current homepage experience. Booking and email destinations, fonts, colors, logo, and existing booking hover effects are retained.
