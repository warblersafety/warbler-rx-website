import test from 'node:test';
import assert from 'node:assert/strict';
import { publicResult } from '../lib/voice-server.js';
const result = values => publicResult({analysis:{data_collection_results:Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]))}});
test('all logistical barriers map only matching accepted actions and retain independent support consent',()=>{
 for(const [barrier,id] of [['coverage','coverage_checklist'],['routine','routine_reminder'],['renewal','renewal_reminder'],['refill','refill_reminder'],['delivery','delivery_information']]) {
  const r=result({barrier,autonomous_action:id,support_routing:'declined'});
  assert.equal(r.autonomous.status,'accepted');assert.equal(r.support.status,'declined');
  for(const value of [undefined,'unclear','not_discussed','declined','malicious','cost_resources']) {
   const r=result({barrier,autonomous_action:value,support_routing:'accepted'});
   assert.notEqual(r.autonomous.status,'accepted');assert.equal(r.support.status,'accepted');
  }
 }
});
test('adverse events, medication questions and emergency suppress all autonomous actions',()=>{
 for(const clinical of [{barrier:'side_effects'},{barrier:'treatment_question'},{barrier:'cost',review_team:'clinical'},{barrier:'delivery',clinical_routing:'emergency'}]){
  const r=result({...clinical,autonomous_action:'delivery_information',cost_resources:'accepted',support_routing:'accepted'});
  assert.equal(r.autonomous,null);assert.equal(r.clinicalOnly,true);
 }
});
test('cost choices use their specific permissions, unknown barriers never invent actions',()=>{
 for(const cost_resources of ['accepted','declined','unclear',undefined])for(const cost_appointment of ['accepted','declined',undefined]){
  const r=result({barrier:'cost',cost_resources,cost_appointment});
  assert.equal(r.autonomous.status==='accepted',cost_resources==='accepted');
  assert.equal(r.support.status==='accepted',cost_appointment==='accepted');
 }
 for(const barrier of ['unclear','no_barrier','__proto__','<script>']){
  const r=result({barrier,autonomous_action:'routine_reminder',support_routing:'accepted'});
  assert.equal(r.autonomous,null);assert.equal(r.support.status,'not_discussed');
 }
});
