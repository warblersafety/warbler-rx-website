import test from 'node:test';
import assert from 'node:assert/strict';
import { branchName, buildBranchConfig, makeApi, publishMockEhrAgent, verifyReadback } from '../scripts/publish-mock-ehr-agent.mjs';
import { deploymentPrompt, beginMessage } from '../lib/agent-prompt.js';
import { defaultEhr, ehrDynamicVariables } from '../lib/mock-ehr.js';

const env = { VOICE_EHR_PUBLISH: 'true', ELEVENLABS_API_KEY: 'private-provider-key',
  ELEVENLABS_AGENT_ID: 'agent_source', ELEVENLABS_AGENT_VERSION_ID: 'version_source' };

function sourceConfig() {
  return {
    agent_id: 'agent_source', version_id: 'version_source', branch_id: 'branch_source',
    conversation_config: {
      agent: { first_message: 'Previous opening', language: 'en',
        dynamic_variables: { dynamic_variable_placeholders: { scenario_id: 'open' } },
        prompt: { prompt: 'Previous prompt', llm: 'existing-model', temperature: 0.2,
          tools: [], tool_ids: [], built_in_tools: { end_call: {}, transfer_to_number: null } } },
      tts: { voice_id: 'existing-voice', model_id: 'existing-tts', speed: 1 },
      conversation: { max_duration_seconds: 120 },
    },
    platform_settings: {
      auth: { enable_auth: true },
      privacy: { record_voice: false, delete_audio: true, delete_transcript_and_pii: true, retention_days: 1 },
      call_limits: { agent_concurrency_limit: 2, daily_limit: 10, bursting_enabled: false },
      overrides: { custom_llm_extra_body: false, conversation_config_override: { agent: { first_message: false, prompt: { prompt: false } } } },
      data_collection: { pain_point: { type: 'string', description: 'Existing extraction' } },
      analysis_items: { data_collection: [{ analysis_item_id: 'existing-analysis' }] },
      testing: { attached_tests: [{ test_id: 'existing-test' }] },
    },
    workflow: { nodes: { start: { type: 'start' } }, edges: {}, subgraphs: {} },
  };
}

function applyChanges(source, changes) {
  const current = structuredClone(source);
  Object.assign(current, { version_id: 'version_ehr', branch_id: 'branch_ehr' });
  current.conversation_config.agent.first_message = changes.agent.first_message;
  current.conversation_config.agent.prompt.prompt = changes.agent.prompt.prompt;
  current.conversation_config.agent.dynamic_variables = changes.agent.dynamic_variables;
  return current;
}

function provider(options = {}) {
  const source = sourceConfig();
  const state = { source, current: options.existing ? applyChanges(source, buildBranchConfig(source)) : null,
    creates: 0, patches: 0, writes: [], requests: [], logs: [] };
  if (options.stale) state.current.conversation_config.agent.prompt.prompt = 'Earlier EHR prompt';
  const api = async (route, request = {}) => {
    const method = request.method || 'GET';
    state.requests.push({ route, method, body: request.body });
    if (route.endsWith('?version_id=version_source')) return structuredClone(source);
    if (route.includes('/branches?')) return { results: state.current && !options.hideCreated ?
      [{ id: 'branch_ehr', name: branchName, agent_id: source.agent_id, is_archived: false }] : [] };
    if (route.endsWith('/branches') && method === 'POST') {
      state.creates++;
      assert.equal(request.body.parent_version_id, source.version_id);
      assert.equal(request.body.name, branchName);
      assert.equal(request.body.platform_settings, undefined);
      state.current = applyChanges(source, request.body.conversation_config);
      if (options.ambiguousCreate) throw Error('Network error with secret details');
      return { created_branch_id: 'branch_ehr', created_version_id: 'version_ehr' };
    }
    if (route.endsWith('?branch_id=branch_ehr')) {
      if (method === 'PATCH') {
        state.patches++;
        state.current = applyChanges(source, request.body.conversation_config);
        if (options.ambiguousPatch) throw Error('Network error with secret details');
      }
      return structuredClone(state.current);
    }
    if (route.endsWith('?version_id=version_ehr')) {
      const value = structuredClone(state.current);
      if (options.mutateReadback) options.mutateReadback(value);
      return value;
    }
    if (route.includes('/phone-numbers/')) {
      if (options.phoneUnavailable) throw Error('404 details');
      return { phone_number_id: route.split('/').at(-1), provider: options.phoneProvider || 'twilio', supports_outbound: true };
    }
    throw Error(`Unexpected test route ${route}`);
  };
  return { state, run: overrides => publishMockEhrAgent({ env, api, writeConfig: pin => state.writes.push(pin), log: text => state.logs.push(text), ...overrides }) };
}

test('publisher is a strict no-op unless explicitly enabled', async () => {
  const { state, run } = provider();
  assert.equal(await run({ env: {} }), null);
  assert.equal(await run({ env: { ...env, VOICE_EHR_PUBLISH: 'false' } }), null);
  assert.equal(state.requests.length, 0);
  assert.equal(state.writes.length, 0);
});

test('branch payload changes only prompt, opening and per-session variable defaults', () => {
  const source = sourceConfig();
  const changes = buildBranchConfig(source);
  assert.equal(changes.agent.prompt.prompt, deploymentPrompt());
  assert.equal(changes.agent.first_message, beginMessage);
  assert.deepEqual(changes.agent.dynamic_variables.dynamic_variable_placeholders, ehrDynamicVariables(defaultEhr));
  assert.equal(source.conversation_config.agent.prompt.prompt, 'Previous prompt');
  const actual = applyChanges(source, changes);
  assert.deepEqual(verifyReadback(actual, source, changes), {
    agentId: 'agent_source', versionId: 'version_ehr', branchId: 'branch_ehr',
  });
  assert.deepEqual(actual.platform_settings, source.platform_settings);
  assert.equal(actual.conversation_config.tts.voice_id, 'existing-voice');
});

test('new branch is verified at its pinned version before saving public resource IDs', async () => {
  const { state, run } = provider();
  const pin = await run();
  assert.equal(state.creates, 1);
  assert.equal(state.patches, 0);
  assert.equal(state.writes.length, 1);
  assert.equal(pin.phoneNumberId, 'phnum_1501m4txcas1e3tr2smr1rfbn2wm');
  assert.deepEqual(Object.keys(pin).sort(), ['agentId', 'branchId', 'phoneNumberId', 'versionId']);
  assert.doesNotMatch(JSON.stringify(state.writes), /private-provider-key|Existing extraction/);
  assert.doesNotMatch(state.logs.join('\n'), /private-provider-key/);
  assert.ok(state.requests.some(r => r.route.endsWith('?version_id=version_ehr')));
  assert.ok(state.requests.filter(r => r.route.includes('phone-numbers')).every(r => r.method === 'GET'));
});

test('existing matching branch is reused without any write to ElevenLabs', async () => {
  const { state, run } = provider({ existing: true });
  await run();
  assert.equal(state.creates, 0);
  assert.equal(state.patches, 0);
});

test('an earlier EHR prompt is updated on the dedicated branch and uncertain PATCH is reconciled', async () => {
  const { state, run } = provider({ existing: true, stale: true, ambiguousPatch: true });
  await run();
  assert.equal(state.creates, 0);
  assert.equal(state.patches, 1);
  assert.equal(state.current.conversation_config.agent.prompt.prompt, deploymentPrompt());
});

test('uncertain branch creation is reconciled by unique name and never retried', async () => {
  const recovered = provider({ ambiguousCreate: true });
  await recovered.run();
  assert.equal(recovered.state.creates, 1);
  const uncertain = provider({ ambiguousCreate: true, hideCreated: true });
  await assert.rejects(uncertain.run(), /uncertain/);
  assert.equal(uncertain.state.creates, 1);
  assert.equal(uncertain.state.writes.length, 0);
});

test('missing or non-Twilio number leaves verified browser setup available without callbacks', async () => {
  for (const options of [{ phoneUnavailable: true }, { phoneProvider: 'sip_trunk' }]) {
    const { state, run } = provider(options);
    const pin = await run();
    assert.equal(pin.phoneNumberId, undefined);
    assert.equal(state.writes.length, 1);
  }
});

test('readback rejects changed safety, voice, model, tools or extraction before saving', async () => {
  for (const mutateReadback of [
    a => { a.platform_settings.auth.enable_auth = false; },
    a => { a.platform_settings.privacy.record_voice = true; },
    a => { a.platform_settings.call_limits.daily_limit = 100; },
    a => { a.conversation_config.tts.voice_id = 'different'; },
    a => { a.conversation_config.agent.prompt.llm = 'different'; },
    a => { a.conversation_config.agent.prompt.tool_ids = ['live-tool']; },
    a => { a.platform_settings.data_collection = {}; },
    a => { a.platform_settings.workspace_overrides = { webhooks: { post_call_webhook_id: 'live-webhook' } }; },
    a => { a.platform_settings.overrides.custom_llm_extra_body = true; },
  ]) {
    const { state, run } = provider({ mutateReadback });
    await assert.rejects(run());
    assert.equal(state.writes.length, 0);
  }
});

test('existing branch settings cannot be overwritten when someone changed preserved fields', async () => {
  const { state, run } = provider({ existing: true, stale: true });
  state.current.conversation_config.tts.voice_id = 'human-change';
  await assert.rejects(run(), /configuration/);
  assert.equal(state.patches, 0);
});

test('API failures are sanitized, bounded and never print upstream response bodies', async () => {
  let bodyRead = false;
  const api = makeApi('private-provider-key', async (url, request) => {
    assert.equal(request.signal.aborted, false);
    assert.equal(request.headers['xi-api-key'], 'private-provider-key');
    return { ok: false, status: 401, json() { bodyRead = true; return { detail: 'private-provider-key' }; } };
  });
  await assert.rejects(api('/v1/convai/agents/test'), error => /401/.test(error.message) && !error.message.includes('private-provider-key'));
  assert.equal(bodyRead, false);
  await assert.rejects(makeApi('private-provider-key', async () => { throw Error('private-provider-key'); })('/v1/convai/agents/test'),
    error => !error.message.includes('private-provider-key'));
});
