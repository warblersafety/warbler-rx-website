import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { deploymentPrompt, beginMessage } from '../lib/agent-prompt.js';
import { dataCollection } from '../lib/scenarios.js';
const cfg=JSON.parse(await fs.readFile(new URL('../elevenlabs-agent-config.json',import.meta.url)));
const branch=process.env.DISCOVERY_BRANCH_ID;
if (!branch) throw Error('DISCOVERY_BRANCH_ID required');
async function api(method,path,body) {
 const r=await fetch('https://api.elevenlabs.io'+path,{method,headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(!r.ok) throw Error(`ElevenLabs ${method} failed: ${r.status}`);
 return r.json();
}
const path=`/v1/convai/agents/${cfg.agentId}?branch_id=${encodeURIComponent(branch)}`;
const before=await api('GET',path);
assert.equal(before.branch_id,branch);
await fs.writeFile(new URL('../.discovery-before.local.json',import.meta.url),JSON.stringify(before));
await api('PATCH',path,{conversation_config:{agent:{prompt:{prompt:deploymentPrompt()}}}});
await api('PATCH',path,{conversation_config:{agent:{first_message:beginMessage}}});
await api('PATCH',path,{platform_settings:{data_collection:{...before.platform_settings.data_collection,...dataCollection}}});
const after=await api('GET',path);
assert.equal(after.conversation_config.agent.prompt.prompt,deploymentPrompt());
assert.equal(after.conversation_config.agent.first_message,beginMessage);
for(const [name,field] of Object.entries(dataCollection)) {
 assert.equal(after.platform_settings.data_collection[name].description,field.description);
 if(field.enum) assert.deepEqual(after.platform_settings.data_collection[name].enum,field.enum);
}
for(const key of ['privacy','auth','call_limits','overrides']) assert.deepEqual(after.platform_settings[key],before.platform_settings[key]);
for(const key of ['tts','asr','turn','conversation']) assert.deepEqual(after.conversation_config[key],before.conversation_config[key]);
assert.deepEqual(after.conversation_config.agent.prompt.tool_ids,before.conversation_config.agent.prompt.tool_ids);
assert.deepEqual(after.conversation_config.agent.prompt.built_in_tools,before.conversation_config.agent.prompt.built_in_tools);
assert.equal(after.conversation_config.agent.prompt.llm,before.conversation_config.agent.prompt.llm);
assert.deepEqual(after.workflow,before.workflow);
await fs.writeFile(new URL('../elevenlabs-agent-config.json',import.meta.url),JSON.stringify({...cfg,versionId:after.version_id,branchId:branch},null,2)+'\n');
console.log(JSON.stringify({branch,version:after.version_id,fields:Object.keys(dataCollection).length,preserved:'voice, model, tools, privacy, admission and workflow'}));
