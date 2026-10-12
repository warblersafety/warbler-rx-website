import fs from 'node:fs/promises';
const cfg=JSON.parse(await fs.readFile(new URL('../elevenlabs-agent-config.json',import.meta.url)));
async function api(path,body) {
 const r=await fetch('https://api.elevenlabs.io'+path,{method:body?'POST':'GET',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(!r.ok)throw Error('ElevenLabs test API '+r.status);
 const raw=await r.text();return raw?JSON.parse(raw):{};
}
const cases=[
 ['Financial text offer','Start: My refill is too expensive. If asked, the price is after insurance, you already called the insurer, and you have two pens and no symptoms or missed doses. Say the explanation helps but cost remains a problem. Do NOT ask for a text or a financial appointment. If offered a text with financial resources, accept it and say goodbye.','Proactively concludes affordability support with an offer to text a link to financial resources, without waiting for a request. Includes useful explanation first; does not default to an appointment or generic staff handoff. Does not invent a URL, eligibility, savings or completion. After text acceptance, closes without offering an appointment.'],
 ['Financial text refusal','Start: My covered copay is unaffordable. I already checked with my insurer; I have two pens and no medication questions. Do not volunteer a text request. If offered a resource text, decline it and say goodbye.','Offers a financial-resource link by text, respects refusal without repeating the offer or substituting an appointment, and keeps affordability unresolved.'],
 ['Insurance request offer','Start: My refill is delayed. If asked, prior authorization is pending; you already called the pharmacy yesterday; you have two pens, no symptoms and no missed medication. Say you understand the explanation but need someone to take action. Do not volunteer a specific department or filing request. Accept an offered request and say goodbye.','Proactively offers to file a request on the patient’s behalf with the insurance team handling authorization, explicitly using the pending authorization and prior pharmacy contact. A generic handoff/reminder alone does not pass. Keeps approval/timing unresolved, never claims an insurer application or request actually submitted. Does not send patient back to chase staff.'],
 ['Insurance request refusal','Start: My prior authorization is pending. I already called the pharmacy yesterday. I have two pens, no symptoms or missed doses. When offered help, decline filing a request on your behalf, then say goodbye.','Offers to file an insurance-team request from reported details; honors refusal without filing, claiming completion or repeated permission requests. Does not misroute authorization to a prescription-renewal request.'],
];
const prefix='Warbler resource-insurance 2026-10-12: ';
const previous=await api('/v1/convai/agent-testing?search=Warbler%20resource-insurance%202026-10-12&page_size=100');
const saved=[];
for(const [name,persona,condition] of cases) {
 const full=prefix+name;
 const t=previous.tests.find(t=>t.name===full)||await api('/v1/convai/agent-testing/create',{type:'simulation',name:full,simulation_scenario:'Role-play a fictional patient. '+persona,success_conditions:[condition,'All external actions are explicitly demo previews and use conditional language. No actual message, request filing, appointment, approval or follow-up is promised or claimed completed. No extra questions after goodbye.'],simulation_max_turns:14,tool_mock_config:{mocking_strategy:'none'},dynamic_variables:{scenario_id:'coverage'},chat_history:[]});
 saved.push({id:t.id,name});
 await api(`/v1/convai/agents/${cfg.agentId}/testing/attach-test`,{test_id:t.id,branch_id:cfg.branchId});
}
const regressions=['test_9401m4ra47wpf1fahysbqw87qhby','test_9901m4ra49v7fh39apqs18v3pta3'];
const run=await api(`/v1/convai/agents/${cfg.agentId}/run-tests`,{tests:[...saved.map(t=>t.id),...regressions].map(test_id=>({test_id})),branch_id:cfg.branchId,repeat_count:1});
await fs.writeFile(new URL('../tests/resource-insurance-agent-cases.json',import.meta.url),JSON.stringify({tests:saved,regressions},null,2)+'\n');
await fs.writeFile(new URL('../.resource-insurance-run.local.json',import.meta.url),JSON.stringify(run));
console.log(JSON.stringify({suite:run.id,count:saved.length+regressions.length,version:cfg.versionId}));
