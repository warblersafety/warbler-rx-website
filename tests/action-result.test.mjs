import test from 'node:test';
import assert from 'node:assert/strict';
import { publicResult } from '../lib/voice-server.js';
const result = values => publicResult({analysis:{data_collection_results:Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]))}});
test('all logistical barriers map only matching accepted actions and retain independent support consent',()=>{
 for(const [barrier,id] of [['coverage','coverage_checklist'],['routine','routine_reminder'],['renewal','renewal_outreach'],['refill','refill_outreach'],['delivery','delivery_information']]) {
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

test('administrative prescriber reminders remain autonomous and never imply an issued prescription',()=>{
 const r=result({barrier:'refill',review_team:'pharmacy_support',clinical_routing:'not_discussed',autonomous_action:'refill_outreach'});
 assert.equal(r.autonomous.status,'accepted');
 assert.match(r.autonomous.description,/Preview a reminder to the pharmacist or prescribing clinician/);
 assert.match(r.autonomous.description,/if appropriate/);
 assert.equal(r.clinicalOnly,false);
});

test('insurance filing needs its own explicit action permission and remains unresolved',()=>{
 for (const [choice,accepted] of [['insurance_request',true],['renewal_outreach',false],['declined',false],['unclear',false],[undefined,false]]) {
  const r=result({barrier:'renewal',pain_point:'authorization_pending',unresolved_need:'authorization',autonomous_action:choice,handoff_permission:'accepted'});
  assert.equal(r.autonomous.title,'Insurance-team request');
  assert.equal(r.autonomous.status==='accepted',accepted);
  assert.match(r.autonomous.description,/No request has been filed/);
  assert.equal(r.discovery.route,'Insurance authorization team');
  assert.equal(r.discovery.resolved,false);
 }
});

test('insurance filing cannot replace a prescription renewal or clinical review',()=>{
 const renewal=result({barrier:'renewal',pain_point:'renewal_needed',unresolved_need:'prescription_renewal',autonomous_action:'insurance_request'});
 assert.equal(renewal.discovery.route,'Prescribing office');
 assert.notEqual(renewal.autonomous.status,'accepted');
 const clinical=result({barrier:'renewal',pain_point:'authorization_pending',treatment_impact:'missed_or_stopped',autonomous_action:'insurance_request'});
 assert.equal(clinical.autonomous,null);
 assert.equal(clinical.discovery.route,'Clinical care team');
});

test('financial link text does not imply an appointment or resolved affordability',()=>{
 const r=result({barrier:'cost',pain_point:'cost_share',cost_resources:'accepted',cost_appointment:'declined',unresolved_need:'affordability_review'});
 assert.equal(r.autonomous.title,'Financial-resource link by text');
 assert.match(r.autonomous.description,/link to financial resources/);
 assert.equal(r.autonomous.status,'accepted');
 assert.equal(r.support.status,'declined');
 assert.equal(r.discovery.resolved,false);
});
