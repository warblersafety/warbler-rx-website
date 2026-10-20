import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildCandidate, makeApi, prepareWorkspace, verifyCandidate } from '../scripts/prepare-elevenlabs-workspace.mjs';
import { deploymentPrompt, beginMessage } from '../lib/agent-prompt.js';
import { dataCollection } from '../lib/scenarios.js';

const expected = { agentId: 'old_agent', versionId: 'old_version', branchId: 'old_branch', voiceId: 'same_voice' };
function sourceConfig() {
  return {
    agent_id: expected.agentId, version_id: expected.versionId, branch_id: expected.branchId,
    source_workspace_id: 'original_workspace',
    conversation_config: {
      agent: { first_message: beginMessage, prompt: { prompt: deploymentPrompt(), llm: 'existing-model',
        tool_ids: [], built_in_tools: { end_call: { type: 'system', name: 'end_call' }, transfer_to_number: null } } },
      tts: { voice_id: expected.voiceId, model_id: 'existing-tts', stability: 0.65 },
      conversation: { max_duration_seconds: 120 },
    },
    platform_settings: {
      data_collection: structuredClone(dataCollection),
      analysis_items: { data_collection: [{ analysis_item_id: 'workspace_bound_item' }] },
      testing: { attached_tests: [{ test_id: 'workspace_bound_test' }] },
      auth: { enable_auth: true },
      privacy: { record_voice: false, delete_audio: true, delete_transcript_and_pii: true, retention_days: 1 },
      call_limits: { agent_concurrency_limit: 2, daily_limit: 10, bursting_enabled: false },
      overrides: { custom_llm_extra_body: false },
    },
    workflow: { edges: {}, nodes: { start: { type: 'start' } }, subgraphs: {} },
  };
}

test('migration preserves exact addiction behavior and removes cross-workspace analysis/test references', () => {
  const source = sourceConfig();
  const body = buildCandidate(source, expected);
  assert.deepEqual(body.conversation_config, source.conversation_config);
  assert.deepEqual(body.platform_settings.data_collection, dataCollection);
  assert.deepEqual(body.platform_settings.privacy, source.platform_settings.privacy);
  assert.deepEqual(body.platform_settings.call_limits, source.platform_settings.call_limits);
  assert.equal(body.platform_settings.analysis_items, undefined);
  assert.equal(body.platform_settings.testing, undefined);
  assert.ok(source.platform_settings.analysis_items);
  assert.doesNotMatch(JSON.stringify(body), /workspace_bound_item|workspace_bound_test/);
});

test('migration rejects stale extraction, unpinned source, relaxed limits and workspace action dependencies', () => {
  for (const mutate of [
    s => { s.version_id = 'other_version'; },
    s => { s.platform_settings.data_collection.pain_point.enum = ['outdated']; },
    s => { s.conversation_config.agent.prompt.prompt = 'Old GLP-1 prompt'; },
    s => { s.platform_settings.call_limits.daily_limit = 1000; },
    s => { s.platform_settings.auth.enable_auth = false; },
    s => { s.conversation_config.agent.prompt.tool_ids = ['a_live_webhook']; },
    s => { s.conversation_config.agent.prompt.built_in_tools.transfer_to_number = { number: 'not_for_migration' }; },
    s => { s.platform_settings.workspace_overrides = { webhooks: { webhook_id: 'old_workspace_webhook' } }; },
  ]) {
    const source = sourceConfig(); mutate(source);
    assert.throws(() => buildCandidate(source, expected));
  }
});

test('provider failures never include credentials or upstream response bodies', async () => {
  let bodyRead = false;
  const api = makeApi('private-key', async () => ({ ok: false, status: 401,
    json() { bodyRead = true; return { detail: 'private-key upstream-private-body' }; } }));
  await assert.rejects(api('/v1/user'), error => {
    assert.match(error.message, /401/);
    assert.doesNotMatch(error.message, /private-key|upstream-private-body/);
    return true;
  });
  assert.equal(bodyRead, false);
  await assert.rejects(makeApi('private-key', async () => { throw Error('private-key connection details'); })('/v1/user'),
    error => !error.message.includes('private-key'));
});

test('readback rejects changes to voice, privacy and provider-added action tools', () => {
  const body = buildCandidate(sourceConfig(), expected);
  for (const mutate of [
    a => { a.conversation_config.tts.voice_id = 'different'; },
    a => { a.platform_settings.privacy.record_voice = true; },
    a => { a.conversation_config.agent.prompt.built_in_tools.transfer_to_agent = { agent_id: 'other' }; },
  ]) {
    const actual = { ...structuredClone(body), agent_id: 'new', version_id: 'version', branch_id: 'branch' };
    mutate(actual);
    assert.throws(() => verifyCandidate(actual, body));
  }
});

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'warbler-migration-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'elevenlabs-agent-config.json'), JSON.stringify(expected));
  await fs.writeFile(path.join(directory, '.elevenlabs-source.local.json'), JSON.stringify(sourceConfig()));
  return directory;
}

function fakeProvider({ ambiguous = false, remaining = 4000, workspace = 'new_workspace' } = {}) {
  const state = { creates: 0, actual: null, visible: true, remaining, workspace };
  const api = async (route, body) => {
    if (route === '/v1/user') return { workspace_id: state.workspace };
    if (route === '/v1/user/subscription') return { character_limit: 10000, character_count: 10000 - state.remaining };
    if (route === `/v1/voices/${expected.voiceId}`) return { voice_id: expected.voiceId };
    if (route.startsWith('/v1/convai/agents?')) return { agents: state.actual && state.visible && !route.includes('archived=true')
      ? [{ agent_id: state.actual.agent_id, name: state.actual.name, archived: false }] : [], has_more: false };
    if (route === '/v1/convai/agents/create') {
      state.creates++;
      state.actual = { ...structuredClone(body), agent_id: 'new_agent', version_id: 'new_version', branch_id: 'new_branch' };
      if (ambiguous) throw Error('Connection interrupted after provider accepted creation');
      return { agent_id: state.actual.agent_id };
    }
    if (route.startsWith('/v1/convai/agents/new_agent')) return state.actual;
    throw Error('Unexpected route in test');
  };
  return { api, state };
}

test('default is read-only; creation verifies a pinned version and leaves active config untouched', async t => {
  const directory = await fixture(t);
  const { api, state } = fakeProvider();
  await prepareWorkspace({ directory, api, log() {} });
  assert.equal(state.creates, 0);
  assert.deepEqual((await fs.readdir(directory)).sort(), ['.elevenlabs-source.local.json', 'elevenlabs-agent-config.json']);
  const next = await prepareWorkspace({ directory, api, create: true, log() {} });
  assert.equal(state.creates, 1);
  assert.equal(next.agentId, 'new_agent');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, 'elevenlabs-agent-config.json'))), expected);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, 'elevenlabs-agent-config.next.local.json'))), next);
  await prepareWorkspace({ directory, api, create: true, log() {} });
  assert.equal(state.creates, 1);
});

test('ambiguous creation never retries POST; later discovery recovers the same agent', async t => {
  const directory = await fixture(t);
  const { api, state } = fakeProvider({ ambiguous: true });
  await assert.rejects(prepareWorkspace({ directory, api, create: true, log() {} }));
  state.visible = false;
  await assert.rejects(prepareWorkspace({ directory, api, create: true, log() {} }), /uncertain outcome/);
  assert.equal(state.creates, 1);
  state.visible = true;
  const next = await prepareWorkspace({ directory, api, create: true, log() {} });
  assert.equal(next.agentId, 'new_agent');
  assert.equal(state.creates, 1);
});

test('insufficient reserve and mismatched workspace prevent agent creation', async t => {
  const directory = await fixture(t);
  const { api, state } = fakeProvider({ remaining: 100 });
  await assert.rejects(prepareWorkspace({ directory, api, create: true, log() {} }), /reserve/);
  assert.equal(state.creates, 0);
  state.remaining = 5000;
  state.workspace = 'original_workspace';
  await assert.rejects(prepareWorkspace({ directory, api, create: true, log() {} }), /original workspace/);
  assert.equal(state.creates, 0);
  state.workspace = 'new_workspace';
  await prepareWorkspace({ directory, api, create: true, log() {} });
  state.workspace = 'different_new_workspace';
  await assert.rejects(prepareWorkspace({ directory, api, create: true, log() {} }), /another workspace/);
  assert.equal(state.creates, 1);
});
