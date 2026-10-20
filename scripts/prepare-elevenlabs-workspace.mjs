import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseEnv, isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { deploymentPrompt, beginMessage } from '../lib/agent-prompt.js';
import { dataCollection } from '../lib/scenarios.js';

// Run with Node 24+. This helper never changes the deployed website or its key.
const root = fileURLToPath(new URL('../', import.meta.url));
export class MigrationError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new MigrationError(message); };
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const populated = value => value != null && value !== false && value !== '' &&
  (typeof value !== 'object' || Object.keys(value).length > 0);

function rejectDependencies(value, key = '') {
  if (!value || typeof value !== 'object') return;
  for (const [name, child] of Object.entries(value)) {
    if (/^(api_key|authorization|password|secret|secret_id|webhook_id|post_call_webhook_id|destination_id|conversation_initiation_client_data_webhook|url|custom_llm|tool_ids|tool_ids_strict|mcp_server_ids|native_mcp_server_ids|knowledge_base|pronunciation_dictionary_locators|supported_voices)$/.test(name)) {
      requireValue(!populated(child), 'Source contains a credential or workspace dependency; migrate it explicitly first.');
    }
    rejectDependencies(child, `${key}.${name}`);
  }
}

export function buildCandidate(source, expected) {
  requireValue(source?.agent_id === expected.agentId && source?.version_id === expected.versionId &&
    source?.branch_id === expected.branchId, 'Source must be the exact agent, branch and version pinned by this website.');
  const conversation = structuredClone(source.conversation_config);
  const settings = structuredClone(source.platform_settings);
  requireValue(conversation?.agent?.prompt?.prompt === deploymentPrompt(), 'Source prompt differs from the checked-in addiction prompt.');
  requireValue(conversation.agent.first_message === beginMessage, 'Source opening differs from the checked-in addiction opening.');
  requireValue(conversation.tts?.voice_id === expected.voiceId, 'Source voice differs from the pinned website voice.');
  requireValue(isDeepStrictEqual(Object.keys(settings?.data_collection || {}).sort(), Object.keys(dataCollection).sort()),
    'Source extraction field names differ from the current website definitions.');
  for (const [name, definition] of Object.entries(dataCollection)) {
    for (const [field, value] of Object.entries(definition)) {
      requireValue(isDeepStrictEqual(settings.data_collection[name][field], value),
        'Source extraction differs from the current website definitions.');
    }
  }
  requireValue(settings.auth?.enable_auth === true, 'Source must require server-issued voice credentials.');
  requireValue(settings.privacy?.record_voice === false && settings.privacy?.delete_audio === true &&
    settings.privacy?.delete_transcript_and_pii === true && settings.privacy.retention_days <= 1,
  'Source privacy settings do not match the public-demo requirements.');
  requireValue(settings.call_limits?.agent_concurrency_limit === 2 && settings.call_limits?.daily_limit === 10 &&
    settings.call_limits?.bursting_enabled === false && conversation.conversation?.max_duration_seconds === 120,
  'Source usage limits differ from the existing website limits.');
  const overrideValues = JSON.stringify(settings.overrides);
  requireValue(settings.overrides && !overrideValues.includes(':true'), 'Client overrides must remain disabled.');
  const prompt = conversation.agent.prompt;
  requireValue((prompt.tools || []).every(tool => tool.type === 'system' && tool.name === 'end_call'),
    'Source has a tool other than end_call.');
  requireValue(Object.entries(prompt.built_in_tools || {}).every(([name, tool]) => name === 'end_call' || !populated(tool)),
    'Source has an active built-in tool other than end_call.');
  requireValue(prompt.built_in_tools?.end_call || prompt.tools?.some(tool => tool.name === 'end_call'), 'Source must retain end_call.');
  requireValue(!prompt.rag?.enabled, 'Source uses a knowledge base that needs a separate migration.');
  const workflow = structuredClone(source.workflow);
  requireValue(workflow && Object.keys(workflow.edges || {}).length === 0 && Object.keys(workflow.subgraphs || {}).length === 0 &&
    Object.values(workflow.nodes || {}).every(node => node.type === 'start'), 'Source has a conversation workflow that needs a separate migration.');

  // These are workspace IDs, not extraction definitions. The provider creates
  // new analysis items from data_collection; old test attachments cannot move.
  delete settings.analysis_items;
  delete settings.testing;
  if (settings.simulation_library) {
    requireValue(settings.simulation_library.enabled === false, 'Source has an enabled simulation library.');
    settings.simulation_library.test_ids = [];
  }
  rejectDependencies({ conversation_config: conversation, platform_settings: settings, workflow });
  return {
    name: 'Warbler Health Website — Addiction Demo',
    tags: ['warbler-website', 'addiction-demo'],
    conversation_config: conversation,
    platform_settings: settings,
    workflow,
  };
}

function compareSubset(actual, expected) {
  if (expected === null || typeof expected !== 'object') return isDeepStrictEqual(actual, expected);
  // Providers may add optional defaults to a tool (for example tool_call_sound:
  // null). Preserve array length/order and every requested field while allowing
  // the same harmless extra object fields that are allowed outside arrays.
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length &&
    expected.every((value, index) => compareSubset(actual[index], value));
  return actual && typeof actual === 'object' && Object.entries(expected).every(([key, value]) => compareSubset(actual[key], value));
}

export function verifyCandidate(actual, body) {
  requireValue(actual?.agent_id && actual?.version_id && actual?.branch_id, 'Provider did not return pinned agent/version/branch IDs.');
  for (const field of ['conversation_config', 'platform_settings', 'workflow']) {
    requireValue(compareSubset(actual[field], body[field]), `Created agent failed ${field} readback verification; no website config was changed.`);
  }
  // The provider may add defaults, but not new operational tools or extraction.
  requireValue(isDeepStrictEqual(Object.keys(actual.platform_settings.data_collection).sort(), Object.keys(dataCollection).sort()),
    'Created agent has unexpected extraction fields.');
  const prompt = actual.conversation_config.agent.prompt;
  requireValue(!(prompt.tool_ids?.length || prompt.mcp_server_ids?.length || prompt.native_mcp_server_ids?.length || prompt.knowledge_base?.length),
    'Created agent has unexpected workspace dependencies.');
  requireValue(Object.entries(prompt.built_in_tools || {}).every(([name, tool]) => name === 'end_call' || !populated(tool)),
    'Created agent has an unexpected active built-in tool.');
  requireValue((prompt.tools || []).every(tool => tool.type === 'system' && tool.name === 'end_call'),
    'Created agent has an unexpected action tool.');
  rejectDependencies({ conversation_config: actual.conversation_config, platform_settings: actual.platform_settings, workflow: actual.workflow });
  return { agentId: actual.agent_id, versionId: actual.version_id, branchId: actual.branch_id, voiceId: actual.conversation_config.tts.voice_id };
}

export function makeApi(key, fetcher = fetch) {
  return async (route, body) => {
    let response;
    try {
      response = await fetcher(`https://api.elevenlabs.io${route}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000),
        redirect: 'error',
      });
    } catch {
      throw new MigrationError('ElevenLabs request interrupted. Any pending creation must be reconciled before another attempt.');
    }
    requireValue(response.ok, `ElevenLabs request failed (HTTP ${response.status}). Response details were withheld.`);
    try { return await response.json(); }
    catch { throw new MigrationError('ElevenLabs returned an unreadable response. Any pending creation must be reconciled.'); }
  };
}

async function readJson(filename, optional = false) {
  try { return JSON.parse(await fs.readFile(filename, 'utf8')); }
  catch (error) {
    if (optional && error.code === 'ENOENT') return null;
    throw new MigrationError('A required local configuration file is missing or invalid.');
  }
}

async function saveJson(filename, value) {
  const temporary = `${filename}.${process.pid}.local.json`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  await fs.rename(temporary, filename);
}

async function findCandidate(api, name) {
  const matches = [];
  // Check both active and archived results before any new creation.
  for (const archived of [false, true]) {
    let cursor;
    const seen = new Set();
    do {
      const query = new URLSearchParams({ page_size: '100', archived: String(archived), search: name });
      if (cursor) query.set('cursor', cursor);
      const page = await api(`/v1/convai/agents?${query}`);
      requireValue(Array.isArray(page.agents), 'Agent listing was incomplete; creation was not attempted.');
      matches.push(...page.agents.filter(agent => agent.name === name));
      if (!page.has_more) break;
      requireValue(page.next_cursor && !seen.has(page.next_cursor), 'Agent pagination was incomplete; creation was not attempted.');
      cursor = page.next_cursor;
      seen.add(cursor);
    } while (true);
  }
  const unique = [...new Map(matches.map(agent => [agent.agent_id, agent])).values()];
  requireValue(unique.length <= 1, 'Multiple migration agents exist; reconcile their IDs before continuing.');
  requireValue(!unique[0]?.archived, 'The migration agent was archived; reconcile it before continuing.');
  return unique[0];
}

export async function prepareWorkspace({ directory = root, sourcePath = path.join(directory, '.elevenlabs-source.local.json'),
  create = false, offline = false, api: injectedApi, log = console.log } = {}) {
  const expected = await readJson(path.join(directory, 'elevenlabs-agent-config.json'));
  const source = await readJson(sourcePath);
  const body = buildCandidate(source, expected);
  if (offline) {
    log(JSON.stringify({ status: 'source_verified', extractionFields: Object.keys(dataCollection).length,
      preserved: 'prompt, voice, model, privacy, authentication, overrides and usage limits' }));
    return { status: 'source_verified' };
  }
  let api = injectedApi;
  if (!api) {
    let handle;
    try {
      handle = await fs.open(path.join(directory, '.env.elevenlabs-new.local'), constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat();
      requireValue(stat.isFile() && (stat.mode & 0o077) === 0, 'New-key file must be a regular file readable only by its owner (chmod 600).');
      const values = parseEnv(await handle.readFile('utf8'));
      const key = values.ELEVENLABS_API_KEY;
      requireValue(typeof key === 'string' && key.trim().length >= 20 && !key.includes('\n') && !/replace|paste|your[_ -]?key/i.test(key),
        'Save the new key as ELEVENLABS_API_KEY in .env.elevenlabs-new.local first.');
      api = makeApi(key.trim());
    } catch (error) {
      if (error instanceof MigrationError) throw error;
      throw new MigrationError('Cannot read the new-key file securely. Check that it exists and has mode 600.');
    } finally { await handle?.close(); }
  }
  const user = await api('/v1/user');
  requireValue(typeof user.workspace_id === 'string' && user.workspace_id, 'The key did not identify a workspace.');
  if (source.source_workspace_id) requireValue(user.workspace_id !== source.source_workspace_id, 'The supplied key belongs to the original workspace.');
  const quota = await api('/v1/user/subscription');
  const remaining = Number(quota.character_limit) - Number(quota.character_count);
  requireValue(Number.isFinite(remaining) && remaining >= 1500, 'The new workspace does not have the 1,500-credit reserve required by the website.');
  const voice = await api(`/v1/voices/${encodeURIComponent(expected.voiceId)}`);
  requireValue(voice.voice_id === expected.voiceId, 'The current website voice is not available in the new workspace.');
  const workspaceHash = digest(user.workspace_id);
  const sourceHash = digest(body);
  body.name += ` [${digest([workspaceHash, sourceHash]).slice(0, 12)}]`;
  const checkpointPath = path.join(directory, '.elevenlabs-migration.local.json');
  const readbackPath = path.join(directory, '.elevenlabs-next-verified.local.json');
  const outputPath = path.join(directory, 'elevenlabs-agent-config.next.local.json');
  const lockPath = path.join(directory, '.elevenlabs-migration-lock.local.json');
  let lock;
  try {
    if (create) {
      try { lock = await fs.open(lockPath, 'wx', 0o600); }
      catch { throw new MigrationError('Another migration holds the local lock. Confirm it is stopped before removing a stale lock.'); }
    }
    let checkpoint = await readJson(checkpointPath, true);
    requireValue(!checkpoint || (checkpoint.workspaceHash === workspaceHash && checkpoint.sourceHash === sourceHash),
      'Saved migration belongs to another workspace or source version. Reconcile it before continuing.');
    const found = await findCandidate(api, body.name);
    if (found && checkpoint?.agentId) requireValue(found.agent_id === checkpoint.agentId, 'Saved and discovered migration IDs disagree.');
    if (!create) {
      if (found) verifyCandidate(await api(`/v1/convai/agents/${encodeURIComponent(found.agent_id)}`), body);
      log(JSON.stringify({ status: found ? 'existing_candidate_verified' : 'ready_to_create', remainingCredits: remaining,
        extractionFields: Object.keys(dataCollection).length, ...(found ? { agentId: found.agent_id } : {}) }));
      return { status: found ? 'existing_candidate_verified' : 'ready_to_create' };
    }
    let agentId = found?.agent_id || checkpoint?.agentId;
    if (!agentId) {
      requireValue(!checkpoint?.creationAttempted, 'Previous creation has an uncertain outcome. No duplicate was created; inspect ElevenLabs before resetting the checkpoint.');
      checkpoint = { workspaceHash, sourceHash, name: body.name, creationAttempted: true, status: 'creation_pending' };
      await saveJson(checkpointPath, checkpoint);
      const result = await api('/v1/convai/agents/create', body);
      requireValue(typeof result.agent_id === 'string' && result.agent_id, 'Creation did not return an agent ID. Reconcile the pending checkpoint.');
      agentId = result.agent_id;
      checkpoint = { ...checkpoint, agentId, status: 'created' };
      await saveJson(checkpointPath, checkpoint);
    }
    const actual = await api(`/v1/convai/agents/${encodeURIComponent(agentId)}`);
    const next = verifyCandidate(actual, body);
    // Pin and read the exact immutable version, not only the current branch head.
    const pinned = await api(`/v1/convai/agents/${encodeURIComponent(agentId)}?version_id=${encodeURIComponent(next.versionId)}`);
    requireValue(isDeepStrictEqual(verifyCandidate(pinned, body), next), 'Pinned version readback differs from the candidate.');
    await saveJson(readbackPath, { conversation_config: pinned.conversation_config, platform_settings: pinned.platform_settings,
      workflow: pinned.workflow, agent_id: next.agentId, version_id: next.versionId, branch_id: next.branchId });
    await saveJson(outputPath, next);
    await saveJson(checkpointPath, { workspaceHash, sourceHash, name: body.name, creationAttempted: true, agentId, status: 'verified', ...next });
    log(JSON.stringify({ status: 'candidate_verified', ...next, next: 'elevenlabs-agent-config.next.local.json', websiteChanged: false }));
    return next;
  } finally {
    if (lock) { await lock.close(); await fs.unlink(lockPath); }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  while (args.length) {
    const arg = args.shift();
    if (arg === '--create') options.create = true;
    else if (arg === '--offline') options.offline = true;
    else if (arg === '--source') {
      requireValue(args[0] && !args[0].startsWith('--'), '--source requires a sanitized JSON path.');
      options.sourcePath = path.resolve(args.shift());
    } else throw new MigrationError('Usage: node scripts/prepare-elevenlabs-workspace.mjs [--offline | --create] [--source PATH]');
  }
  requireValue(!(options.create && options.offline), 'Choose either --offline or --create.');
  await prepareWorkspace(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error instanceof MigrationError ? error.message : 'Migration stopped because a local operation failed. No secret or provider response was logged.');
    process.exitCode = 1;
  });
}
