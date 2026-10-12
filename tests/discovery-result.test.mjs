import test from 'node:test';
import assert from 'node:assert/strict';
import { publicResult } from '../lib/voice-server.js';
const result = values => publicResult({analysis:{data_collection_results:Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]))}});
test('discovery distinguishes owners within a broad barrier without implying completed work',()=>{
 for(const [pain,need,route] of [['renewal_needed','prescription_renewal','Prescribing office'],['authorization_pending','authorization','Authorization team'],['stock_shortage','stock_confirmation','Pharmacy inventory team'],['failed_delivery','delivery_arrangement','Fulfillment support'],['cost_share','affordability_review','Customer success financial support']]) {
  const r=result({barrier:'refill',pain_point:pain,unresolved_need:need,support_provided:'refill_dependency_explained',barrier_response:'addressed',handoff_permission:'accepted'}).discovery;
  assert.equal(r.route,route);assert.equal(r.resolved,false);assert.match(r.routingStatus,/preview/);assert.doesNotMatch(r.outcome,/Barrier addressed/);
 }
});
test('a confirmed informational routine barrier can be addressed without staff work',()=>{
 const r=result({barrier:'routine',pain_point:'routine_memory',treatment_impact:'no_change',support_provided:'routine_plan_developed',support_preference:'after_work_reminder',barrier_response:'addressed',unresolved_need:'none'}).discovery;
 assert.equal(r.resolved,true);assert.equal(r.route,'No staff follow-up identified');assert.match(r.outcome,/patient report/);assert.match(r.learned.join(' '),/after work/);
});
test('permission or an unsupported resolution claim never closes a barrier',()=>{
 for(const override of [{barrier_response:'not_checked'},{support_provided:'none'},{unresolved_need:'unknown'},{pain_point:'unknown'},{barrier_response:'unclear'}]) {
  const r=result({barrier:'routine',pain_point:'routine_memory',support_provided:'routine_plan_developed',barrier_response:'addressed',unresolved_need:'none',autonomous_action:'routine_reminder',...override});
  assert.equal(r.discovery.resolved,false);
 }
});
test('clinical evidence in any new field overrides conflicting logistical classifications',()=>{
 for(const evidence of [{pain_point:'side_effect_impact'},{pain_point:'restart_question'},{treatment_impact:'missed_or_stopped'},{treatment_impact:'supply_gap'},{unresolved_need:'clinical_review'}]) {
  const r=result({barrier:'cost',review_team:'pharmacy_support',pain_point:'routine_memory',barrier_response:'addressed',support_provided:'routine_plan_developed',unresolved_need:'none',cost_resources:'accepted',clinical_routing:'declined',...evidence});
  assert.equal(r.clinicalOnly,true);assert.equal(r.autonomous,null);assert.equal(r.discovery.resolved,false);assert.equal(r.discovery.route,'Clinical care team');assert.match(r.discovery.remaining,/Clinical review/);
 }
});
test('missing, malformed and injected extraction never leaks generated text or invents support',()=>{
 for(const value of [undefined,null,{},['routine_memory'],'__proto__','constructor','<img src=x onerror=alert(1)> Jane 555-0000']) {
  const r=result(Object.fromEntries(['pain_point','support_provided','barrier_response','unresolved_need','handoff_permission'].map(k=>[k,value])));
  assert.equal(r.discovery.resolved,false);assert.equal(r.discovery.route,'More information needed');assert.doesNotMatch(JSON.stringify(r),/Jane|555-0000|<img|__proto__|constructor/);
 }
});
test('emergency outranks every discovery result and permission',()=>{
 const r=result({clinical_routing:'emergency',pain_point:'routine_memory',support_provided:'routine_plan_developed',barrier_response:'addressed',unresolved_need:'none',handoff_permission:'declined'});
 assert.equal(r.discovery.route,'Immediate medical help');assert.equal(r.discovery.resolved,false);
});
test('clinical refusal wins over a conflicting accepted staff handoff',()=>{
 const r=result({barrier:'side_effects',pain_point:'side_effect_impact',clinical_routing:'declined',handoff_permission:'accepted'});
 assert.equal(r.support.status,'declined');assert.match(r.discovery.routingStatus,/declined/);
});
