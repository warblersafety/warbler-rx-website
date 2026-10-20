# Move the website voice demo to another ElevenLabs workspace

Use Node 24+. The helper prepares an agent; it does not change Vercel, replace the website's pinned IDs, make a call, or start a paid test.

1. Export the original agent's **exact pinned version**, including `agent_id`, `version_id`, `branch_id`, `conversation_config`, `platform_settings`, and `workflow`, to `.elevenlabs-source.local.json`. Use the IDs in `elevenlabs-agent-config.json`. A full sanitized agent GET response works. Optionally include `source_workspace_id` from the original workspace's `/v1/user` response to verify that the new key is from a different workspace. Never include API keys, transcripts, or user details.
2. Put the destination key in `.env.elevenlabs-new.local` as `ELEVENLABS_API_KEY=...`, using the local editor. Set that file's permissions to `600`. Do not put the key in chat, a command argument, browser JavaScript, or a `VITE_` variable. Both `.env*` and `*.local.json` are already ignored by Git.
3. Validate the export without network access:

   ```sh
   node scripts/prepare-elevenlabs-workspace.mjs --offline
   ```

4. Validate the new key, workspace identity, available voice, quota reserve, and any existing migration candidate without remote writes:

   ```sh
   node scripts/prepare-elevenlabs-workspace.mjs
   ```

5. Create and read back the candidate:

   ```sh
   node scripts/prepare-elevenlabs-workspace.mjs --create
   ```

The source must match the current addiction prompt, opening, and all 17 extraction definitions. The voice, model, conversation behavior, guardrails, privacy, authentication, client override restrictions, two-session concurrency limit, ten-call daily limit, and two-minute duration are preserved. The old workspace's analysis-item IDs and attached test IDs are omitted; extraction definitions and scopes are carried over so the provider can generate new analysis items. Existing test cases in `tests/addiction-agent-cases.json` remain available for separately authorized provider testing. The helper refuses other active tools, knowledge bases, custom endpoints, or nontrivial agent workflows that need their own migration.

On success, `elevenlabs-agent-config.next.local.json` contains the candidate's verified agent, version, branch, and voice IDs. `.elevenlabs-next-verified.local.json` holds the readback. The original `elevenlabs-agent-config.json` stays unchanged.

The checkpoint `.elevenlabs-migration.local.json` and a deterministic candidate name prevent duplicate creation on retries. A request whose outcome is uncertain is never automatically repeated. Re-run to discover the original candidate; if it remains absent, inspect the destination workspace before manually reconciling the checkpoint. If a process was killed, confirm no migration is still running before removing a stale `.elevenlabs-migration-lock.local.json`. Never clear these files simply to bypass an uncertain outcome.

After verification and any desired conversation tests, install **all three** production values together: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, and `ELEVENLABS_AGENT_VERSION_ID`. Use the candidate IDs, not IDs from the previous workspace. Keep the current session secret, quota/visitor controls, and kill switch. Update the tracked config only when switching the website, redeploy, and verify the public voice-start endpoint. A successful configuration readback does not prove microphone/audio quality or a completed conversation; verify those separately.

The setup key needs read access to user/subscription, voices, agents, and create-agent access. The deployed key also needs the conversation/token access required by `api/voice/start.js` and `api/voice/result.js`. Keys restricted from reading `/v1/user` or subscription cannot pass this helper or the website's quota gate.

API references checked during implementation: [create agent](https://elevenlabs.io/docs/api-reference/agents/create), [get agent](https://elevenlabs.io/docs/api-reference/agents/get), [list agents](https://elevenlabs.io/docs/api-reference/agents/list), [get user](https://elevenlabs.io/docs/api-reference/user/get), [subscription](https://elevenlabs.io/docs/api-reference/user/subscription/get).
