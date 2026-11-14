import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { deploymentPrompt, beginMessage } from '../lib/agent-prompt.js';
import { defaultEhr, ehrDynamicVariables } from '../lib/mock-ehr.js';

export const branchName = 'website-mock-ehr-2026-11-14';
const knownPhoneId = 'phnum_1501m4txcas1e3tr2smr1rfbn2wm';
const outputPath = fileURLToPath(new URL('../lib/mock-ehr-agent.js', import.meta.url));
const requireValue = (condition, message) => { if (!condition) throw new PublishError(message); };
const populated = value => value != null && value !== false && value !== '' &&
  (typeof value !== 'object' || Object.keys(value).length > 0);

export class PublishError extends Error {
  constructor(message, status) { super(message); this.name = 'PublishError'; this.status = status; }
}

// Never include the provider's response text or transport error in build logs.
export function makeApi(key, fetcher = fetch) {
  return async (route, { method = 'GET', body } = {}) => {
    let response;
    try {
      response = await fetcher(`https://api.elevenlabs.io${route}`, {
        method, headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
      });
    } catch { throw new PublishError('Provider request failed or timed out; its outcome may be uncertain.'); }
    if (!response.ok) throw new PublishError(`Provider request failed (HTTP ${response.status}).`, response.status);
    try { return await response.json(); } catch { throw new PublishError('Provider returned an invalid response.'); }
  };
}

function rejectActionDependencies(value) {
  if (!value || typeof value !== 'object') return;
  for (const [name, child] of Object.entries(value)) {
    if (/^(api_key|authorization|password|secret|secret_id|webhook_id|post_call_webhook_id|destination_id|conversation_initiation_client_data_webhook|custom_llm|tool_ids|tool_ids_strict|mcp_server_ids|native_mcp_server_ids|knowledge_base)$/.test(name)) {
      requireValue(!populated(child), 'Agent has an unexpected credential, webhook, knowledge source or action dependency.');
    }
    rejectActionDependencies(child);
  }
}

export function verifySafety(agent) {
  const config = agent?.conversation_config;
  const settings = agent?.platform_settings;
  requireValue(settings?.auth?.enable_auth === true, 'Agent must require server-issued session credentials.');
  requireValue(settings.privacy?.record_voice === false && settings.privacy.delete_audio === true &&
    settings.privacy.delete_transcript_and_pii === true && settings.privacy.retention_days <= 1,
  'Agent privacy settings differ from the website requirements.');
  requireValue(config?.conversation?.max_duration_seconds === 120 &&
    settings.call_limits?.agent_concurrency_limit === 2 && settings.call_limits.daily_limit === 10 &&
    settings.call_limits.bursting_enabled === false, 'Agent duration or usage limits differ from the website requirements.');
  requireValue(settings.overrides && !JSON.stringify(settings.overrides).includes(':true'), 'Client configuration overrides must stay disabled.');
  const prompt = config.agent?.prompt;
  requireValue(prompt && (prompt.tools || []).every(tool => tool.type === 'system' && tool.name === 'end_call'),
    'Agent has an action tool other than end_call.');
  requireValue(Object.entries(prompt.built_in_tools || {}).every(([name, tool]) => name === 'end_call' || !populated(tool)),
    'Agent has an active built-in tool other than end_call.');
  requireValue(prompt.built_in_tools?.end_call || prompt.tools?.some(tool => tool.name === 'end_call'), 'Agent must retain end_call.');
  requireValue(!prompt.rag?.enabled, 'Agent must not use a live knowledge base.');
  const workflow = agent.workflow;
  requireValue(!workflow || (Object.keys(workflow.edges || {}).length === 0 &&
    Object.keys(workflow.subgraphs || {}).length === 0 &&
    Object.values(workflow.nodes || {}).every(node => node.type === 'start')), 'Agent must not have a live action workflow.');
  requireValue(!Object.keys(agent.procedures || {}).length, 'Agent must not have live procedures.');
  rejectActionDependencies({ conversation_config: config, platform_settings: settings, workflow });
}

export function buildBranchConfig(source) {
  verifySafety(source);
  const agent = source.conversation_config.agent;
  return { agent: {
    first_message: beginMessage,
    prompt: { prompt: deploymentPrompt() },
    dynamic_variables: { dynamic_variable_placeholders: {
      ...agent.dynamic_variables?.dynamic_variable_placeholders,
      ...ehrDynamicVariables(defaultEhr),
    } },
  } };
}

function expectedConfig(source, changes) {
  const result = structuredClone(source.conversation_config);
  result.agent.first_message = changes.agent.first_message;
  result.agent.prompt.prompt = changes.agent.prompt.prompt;
  result.agent.dynamic_variables = {
    ...result.agent.dynamic_variables,
    ...changes.agent.dynamic_variables,
  };
  return result;
}

// Only these three fields may change. Every other source setting is preserved,
// including tool definitions, analysis references, auth, privacy and limits.
export function verifyReadback(actual, source, changes) {
  verifySafety(actual);
  requireValue(actual.agent_id === source.agent_id && actual.version_id && actual.branch_id,
    'Provider did not return matching agent and pinned version/branch IDs.');
  requireValue(isDeepStrictEqual(actual.conversation_config, expectedConfig(source, changes)),
    'Branch conversation configuration did not match the verified source and EHR changes.');
  for (const field of ['platform_settings', 'workflow', 'procedures']) {
    requireValue(isDeepStrictEqual(actual[field], source[field]), `Branch ${field} changed unexpectedly.`);
  }
  return { agentId: actual.agent_id, versionId: actual.version_id, branchId: actual.branch_id };
}

function verifyPreservedFields(actual, source, changes) {
  const corrected = structuredClone(actual);
  corrected.conversation_config.agent.first_message = changes.agent.first_message;
  corrected.conversation_config.agent.prompt.prompt = changes.agent.prompt.prompt;
  corrected.conversation_config.agent.dynamic_variables = {
    ...corrected.conversation_config.agent.dynamic_variables,
    ...changes.agent.dynamic_variables,
  };
  verifyReadback(corrected, source, changes);
}

export async function publishMockEhrAgent({ env = process.env, api, writeConfig, log = console.log } = {}) {
  if (env.VOICE_EHR_PUBLISH !== 'true') return null;
  for (const key of ['ELEVENLABS_API_KEY', 'ELEVENLABS_AGENT_ID', 'ELEVENLABS_AGENT_VERSION_ID']) {
    requireValue(typeof env[key] === 'string' && env[key].trim(), `${key} is required to publish the EHR branch.`);
  }
  api ||= makeApi(env.ELEVENLABS_API_KEY);
  writeConfig ||= async pin => {
    const contents = '// Verified public provider resource IDs. Generated by the deployment build.\nexport default ' + JSON.stringify(pin, null, 2) + ';\n';
    await fs.writeFile(outputPath, contents, { mode: 0o644 });
  };
  const agentPath = `/v1/convai/agents/${encodeURIComponent(env.ELEVENLABS_AGENT_ID)}`;
  const source = await api(`${agentPath}?version_id=${encodeURIComponent(env.ELEVENLABS_AGENT_VERSION_ID)}`);
  requireValue(source.agent_id === env.ELEVENLABS_AGENT_ID && source.version_id === env.ELEVENLABS_AGENT_VERSION_ID,
    'Source does not match the website agent and version pin.');
  const changes = buildBranchConfig(source);
  const findBranch = async () => {
    const list = await api(`${agentPath}/branches?include_archived=true&limit=100`);
    requireValue(Array.isArray(list.results), 'Provider returned an invalid branch list.');
    requireValue(!list.meta?.total || list.meta.total <= list.results.length, 'Branch listing is incomplete; cannot safely reconcile creation.');
    const matches = list.results.filter(branch => branch.name === branchName);
    requireValue(matches.length <= 1, 'Multiple EHR branches require reconciliation.');
    requireValue(!matches[0]?.is_archived, 'The EHR branch is archived; cannot publish to it.');
    return matches[0];
  };
  let branch = await findBranch();
  if (!branch) {
    try {
      const created = await api(`${agentPath}/branches`, { method: 'POST', body: {
        parent_version_id: source.version_id, name: branchName,
        description: 'Website fictional EHR voice demo. No live clinical actions; existing privacy and limits retained.',
        conversation_config: changes, include_draft: false,
      } });
      requireValue(created.created_branch_id && created.created_version_id, 'Provider did not return created branch/version IDs.');
      branch = { id: created.created_branch_id };
    } catch {
      // A timeout can follow a successful create. Reconcile by the unique name;
      // never retry a POST, including after an ambiguous provider response.
      branch = await findBranch();
      requireValue(branch, 'EHR branch creation outcome is uncertain. No creation retry was attempted.');
    }
  }
  requireValue(branch.id && branch.id !== source.branch_id, 'EHR publishing must use a dedicated branch.');
  const branchPath = `${agentPath}?branch_id=${encodeURIComponent(branch.id)}`;
  let current = await api(branchPath);
  verifyPreservedFields(current, source, changes);
  if (!isDeepStrictEqual(current.conversation_config, expectedConfig(source, changes))) {
    try {
      await api(branchPath, { method: 'PATCH', body: {
        conversation_config: changes, version_description: 'Fictional editable EHR context for browser and requested callback demos.',
      } });
    } catch {
      // Read back an uncertain PATCH instead of repeating it.
    }
    current = await api(branchPath);
  }
  requireValue(current.branch_id === branch.id, 'Provider returned a different branch.');
  verifyReadback(current, source, changes);
  const pinned = await api(`${agentPath}?version_id=${encodeURIComponent(current.version_id)}`);
  requireValue(pinned.version_id === current.version_id && pinned.branch_id === branch.id,
    'Pinned readback returned a different branch/version.');
  const pin = verifyReadback(pinned, source, changes);
  const phoneId = env.ELEVENLABS_PHONE_NUMBER_ID || knownPhoneId;
  try {
    const number = await api(`/v1/convai/phone-numbers/${encodeURIComponent(phoneId)}`);
    if (number.phone_number_id === phoneId && number.provider === 'twilio' && number.supports_outbound !== false) {
      pin.phoneNumberId = phoneId;
    } else log('EHR browser agent verified; a compatible Twilio callback number is unavailable.');
  } catch {
    // Browser conversations do not depend on a telephony integration. Never
    // reassign the number's inbound agent or create a number during this build.
    log('EHR browser agent verified; the callback number could not be verified.');
  }
  await writeConfig(pin);
  log(JSON.stringify({ event: 'mock-ehr-agent-verified', ...pin }));
  return pin;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { await publishMockEhrAgent(); }
  catch (error) {
    console.error(error instanceof PublishError ? error.message : 'EHR provider setup failed; no credential details were logged.');
    process.exitCode = 1;
  }
}
