import { readFile, writeFile } from 'node:fs/promises';
import Retell from 'retell-sdk';
import { agentPrompt, beginMessage } from '../lib/agent-prompt.js';
import { analysisFields, scenarios } from '../lib/scenarios.js';

// Provision only this website's independent agent. Credentials are supplied in
// the environment, never copied into tracked configuration or printed.
if (!process.env.RETELL_API_KEY) throw new Error('RETELL_API_KEY is required');
const retell = new Retell({ apiKey: process.env.RETELL_API_KEY, maxRetries: 0 });
const name = 'Warbler Rx Website — GLP-1 Demo';
const path = new URL('../agent-config.json', import.meta.url);
let saved;
try { saved = JSON.parse(await readFile(path, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
if (saved) {
  const current = await retell.agent.retrieve(saved.agentId, { version: saved.version });
  if (current.agent_name !== name) throw new Error('Refusing to modify another agent');
  console.log(JSON.stringify({ agentId: current.agent_id, version: current.version, published: current.is_published, message: 'Existing website agent verified; no changes applied.' }));
  process.exit(0);
}
const existing = await retell.agent.list({ limit: 100 });
if (existing.items.some(a => a.agent_name === name)) throw new Error('Website agent already exists. Reconcile its ID before provisioning again.');
const llm = await retell.llm.create({
  model: 'gpt-4.1', model_temperature: 0.2,
  general_prompt: agentPrompt, begin_message: beginMessage, start_speaker: 'agent',
  default_dynamic_variables: { scenario_context: scenarios[0].context, scenario_opening: scenarios[0].opening },
  general_tools: [{ type: 'end_call', name: 'end_call', description: 'End after the role-play closing, an opt-out, goodbye, silence, or urgent real-world concern. Do not continue after a request to stop.' }],
});
// Save the non-secret engine ID immediately to make partial provisioning visible.
await writeFile(new URL('../.agent-provisioning.local.json', import.meta.url), JSON.stringify({ llmId: llm.llm_id }));
const agent = await retell.agent.create({
  agent_name: name, response_engine: { type: 'retell-llm', llm_id: llm.llm_id, version: llm.version },
  voice_id: 'retell-Cimo', language: 'en-US', voice_speed: 1,
  max_call_duration_ms: 180000, end_call_after_silence_ms: 30000,
  interruption_sensitivity: 0.8, responsiveness: 0.95, denoising_mode: 'noise-cancellation',
  begin_message_delay_ms: 500, reminder_trigger_ms: 10000, reminder_max_count: 1,
  data_storage_setting: 'everything_except_pii', data_storage_retention_days: 1,
  post_call_analysis_data: analysisFields, post_call_analysis_model: 'gpt-4.1-mini',
  webhook_events: [],
});
await writeFile(path, JSON.stringify({ agentId: agent.agent_id, version: agent.version, llmId: llm.llm_id, voiceId: agent.voice_id }, null, 2) + '\n');
try { await retell.agent.publish(agent.agent_id, { version: agent.version }); }
catch (error) {
  // Some Retell releases return an empty successful publication response.
  // Reconcile with a read; never blindly retry a publication.
  const readback = await retell.agent.retrieve(agent.agent_id, { version: agent.version });
  if (!readback.is_published) throw error;
}
const verified = await retell.agent.retrieve(agent.agent_id, { version: agent.version });
if (!verified.is_published || verified.max_call_duration_ms !== 180000 || verified.data_storage_retention_days !== 1) throw new Error('Agent publication read-back failed');
console.log(JSON.stringify({ agentId: verified.agent_id, version: verified.version, published: verified.is_published, voiceId: verified.voice_id, retentionDays: verified.data_storage_retention_days }));
