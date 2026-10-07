# Warbler Rx website

Marketing website with a fictional GLP-1 patient-support voice demo, hosted on Vercel. Independent of the pharmacy application and presenter sales demo.

## Development

Node 24: `npm ci`, `npm test`, `npm run build`. `npm run dev` previews the interface; use `vercel dev` for server endpoints. Set `.env.example` variables in Vercel or an ignored local file. Never prefix credentials with `VITE_`.

## Voice flow

Choose coverage, side effects, forgotten refill, affordability, delivery, or restart. The visitor plays a fictional GLP-1 patient. An original feather flexes with live microphone or agent audio levels, gathers while connecting/processing, and becomes still when the microphone is muted. State labels follow provider events. The renderer reuses the SDK audio analysis without requesting another microphone stream. Compact windows use a scenario selector; reduced-motion preferences keep the feather static.

`/api/voice/start` accepts a validated scenario ID and obtains an ephemeral ElevenLabs WebRTC token for the pinned website agent/version. The restricted provider key stays on the server. Agent prompt, voice, tools and privacy overrides are disabled. The client sends only a scenario label, treated as untrusted input by the agent, and an HMAC visitor identifier. Only the native end-call tool is enabled; no clinical, pharmacy, messaging or scheduling integrations exist.

The browser supports mute, end, cancellation and microphone errors. Sessions end after two minutes on both client and provider. LiveKit is pinned to 2.16.1 per ElevenLabs plugin compatibility guidance; recheck compatibility before upgrading.

`/api/voice/result` verifies a one-hour signed conversation receipt and the agent/version. It maps actual enum analysis to reviewed GLP-1 labels. Missing analysis remains pending/unavailable; it never substitutes an expected scenario result. No transcript, audio, free-form model output or API key is returned.

## Agent and privacy

`elevenlabs-agent-config.json` records the agent, pinned version, branch and Roger voice. `scripts/configure-elevenlabs.mjs` creates the isolated agent once, refuses duplicates, and saves its readback. Subsequent changes need a new version and verified application pin. The prompt source is `lib/agent-prompt.js`; scenario definitions and analysis enums are in `lib/scenarios.js`.

Audio is processed live by ElevenLabs but audio recording storage is disabled. Conversation text is retained for one day; PII redaction is not enabled on this Free account. The interface discloses this and requests fictional details. Logs include only operation, scenario and status. Usage metadata uses an HMAC identifier, not the raw IP; Vercel retains ordinary request logs.

Clinical symptoms, adverse events, treatment changes, restart, missed-dose and product-condition questions go to a simulated clinician/pharmacist review. No medication instructions, symptom reassurance, coverage guarantees or real follow-up claims are permitted. Immediate emergencies end role-play and direct real-world help.

## Usage and deployment

- The account remains on ElevenLabs Free. The approved key is restricted to ElevenAgents Write, Voices Read and User access, with a 10,000-credit monthly cap. No upgrade or paid bursting is enabled.
- Provider limits: two concurrent conversations, ten daily, 120 seconds per call, 30-second silence timeout. The server additionally checks rolling history, three starts per connection per hour and a 1,500-credit reserve. Quota/history errors fail closed.
- History may lag and per-instance locks/counters are not distributed. User metadata is not a security boundary. These checks reduce abuse; provider limits and the Free allowance are the independent limits. Revisit controls before promoting to high traffic.
- ElevenLabs Free does not include commercial rights; review licensing before commercial promotion. See https://elevenlabs.io/pricing/agents and https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform . Attribution appears beside the demo.
- `VOICE_DEMO_ENABLED=false` plus redeployment disables new calls. Production and preview use the isolated website agent. The previous Retell implementation is preserved in Git history; there is no automatic provider fallback.
- Stage with Vercel `--prod --skip-domain`, verify, then promote. Keep the pharmacy and presenter deployments untouched. Main still serves the previous GitHub Pages export until custom-domain migration is complete.

## Verification

`npm test` covers scenario validation, request restrictions, receipt tampering/expiry, usage/credit admission, clinical routing, unavailable analysis and missing configuration. `npm run build` checks the production bundle.

`scripts/test-elevenlabs.mjs` creates and runs six synthetic conversation tests: coverage, side effects, refill, restart, stop and urgent symptoms. All six passed on the pinned version, including successful end-call tool execution. Provider simulations do not verify human microphone/audio quality or clinical effectiveness. Browser checks cover the compact 761×575 viewport and mobile layout; deployment checks verify session creation and signed-summary access.
