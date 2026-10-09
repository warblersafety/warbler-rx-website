# Warbler Health website

Marketing website with a fictional GLP-1 patient-support voice demo, hosted on Vercel. Independent of the pharmacy application and presenter sales demo.

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

Audio is processed live by ElevenLabs but audio recording storage is disabled. Conversation text is retained for one day; PII redaction is not enabled on this Free account. The interface discloses this and requests fictional details. Failure logs include bounded request-stage labels, error categories, HTTP status and elapsed time, excluding credentials, query values and provider response bodies. Usage metadata uses an HMAC identifier, not the raw IP; Vercel retains ordinary request logs.

Side effects receive brief empathy and a request for permission to route to the clinical care team, with no symptom, dose, medication-name or callback-time questions. An explicit request for clinical follow-up already counts as permission. Accepted routing highlights **Automatic scheduling** based on the clinical care team’s availability, clearly labeled as a demo preview with no appointment booked. Declined, unanswered and missing consent do not display scheduling; immediate emergencies instead direct real-world help. Other treatment, restart, missed-dose and product-condition questions go to simulated clinician/pharmacist review. No medication instructions, symptom reassurance, coverage guarantees or real follow-up claims are permitted. Immediate emergencies end role-play and direct real-world help.

## Usage and deployment

- The account remains on ElevenLabs Free. The approved key is restricted to ElevenAgents Write, Voices Read and User access, with a 10,000-credit monthly cap. No upgrade or paid bursting is enabled.
- Provider limits: two concurrent conversations, ten daily, 120 seconds per call, 30-second silence timeout. The server additionally checks rolling history, three starts per connection per hour and a 1,500-credit reserve. Quota/history errors fail closed.
- History may lag and per-instance locks/counters are not distributed. User metadata is not a security boundary. These checks reduce abuse; provider limits and the Free allowance are the independent limits. Revisit controls before promoting to high traffic.
- ElevenLabs Free does not include commercial rights; review licensing before commercial promotion. See https://elevenlabs.io/pricing/agents and https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform . The optional attribution link is omitted from the demo interface.
- `VOICE_DEMO_ENABLED=false` plus redeployment disables new calls. Production and preview use the isolated website agent. The previous Retell implementation is preserved in Git history; there is no automatic provider fallback.
- Stage with Vercel `--prod --skip-domain`, verify, then promote. Keep the pharmacy and presenter deployments untouched. The canonical site is https://warbler-health.com; both old warblersafety.com hosts, the new www host and stable Vercel aliases redirect there with paths and queries preserved. GoDaddy remains the registrar/DNS provider; Vercel hosts the site. Existing email addresses remain unchanged until replacement mailboxes are configured. GitHub Pages is retired.

## Verification

`npm test` covers direct orb initiation, duplicate-click prevention, mute/end, cancellation during token fetch and SDK setup, microphone denial, page exit, scenario validation, request restrictions, receipt tampering/expiry, usage/credit admission, clinical routing, unavailable analysis and missing configuration. `npm run build` checks the production bundle.

`scripts/test-elevenlabs.mjs` runs the six existing synthetic conversation tests (coverage, side effects, refill, restart, stop and urgent symptoms) plus four side-effect response regressions from `tests/side-effect-agent-cases.json`: no symptom probing, accepted routing, declined routing and a non-GLP-1 medication. All ten passed on version `agtvrsn_5101m4ece99yfmhsj6jhja8ceq6s` (suite `suite_7101m4echhn4e3ktxdq4as5v1991`). The provider editor normalizes prompt whitespace; readback verified identical prompt content and preservation of voice, tools, privacy, limits and unrelated settings. Provider simulations do not verify human microphone/audio quality or clinical effectiveness. Browser checks cover the compact 761×575 viewport and mobile layout; deployment checks verify session creation and signed-summary access.

## October 9 Sites copy update

Imported the approved ChatGPT Sites copy revisions: simplified demo and founder captions, customized-agent messaging, new workflow and closing headings, and generic voice-service privacy wording. The Vercel site retains its embedded live voice demo. The idle orb says “Tap to speak”; microphone guidance appears while starting a call.

## Call analysis and next-step choices

The post-call card now uses a warm glow and staggered reveal, with a Barrier ID above accessible Autonomous Action / Route to Support tabs. The agreed choice is selected first; each tab separately reports acceptance, refusal, or unconfirmed permission. Reduced-motion preferences disable decorative motion. Clinical concerns hide autonomous actions.

| Barrier | Autonomous demo option | Support demo route |
| --- | --- | --- |
| Side effects / adverse events | None | Clinical care team |
| Cost | Cost-support resource text | Customer success financial-support appointment |
| Coverage | Coverage-review checklist text | Pharmacy insurance support |
| Routine changes | Reminder for the existing prescribed routine | Pharmacy support |
| Renewal / prior authorization delay | Status-check reminder | Pharmacy renewal team |
| Forgotten refill | Refill-request reminder | Pharmacy support |
| Pickup / delivery | Pharmacy information text | Fulfillment support |

All actions remain simulated. The agent cannot send texts, set reminders, contact support, check status or book appointments. Medication-use questions, symptoms and emergencies override logistical choices. The server returns reviewed text and enumerated permission states, not free-form extracted patient details. `autonomous_action` and `support_routing` supplement the existing independent cost and clinical permission fields. The deployment must pin `ELEVENLABS_AGENT_VERSION_ID` to the tested version in `elevenlabs-agent-config.json`.
