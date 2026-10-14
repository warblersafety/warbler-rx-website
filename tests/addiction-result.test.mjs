import test from 'node:test';
import assert from 'node:assert/strict';
import { publicResult } from '../lib/voice-server.js';
import { dataCollection } from '../lib/scenarios.js';
const result = values => publicResult({analysis:{data_collection_results:Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]))}});
test('missed visits retain clinic owner without inventing missed medication or completed work',()=>{
 for(const [pain,need,route] of [['transport_to_clinic','transport_arrangement','Clinic care coordinator'],['schedule_conflict','scheduling_review','Clinic scheduling team'],['clinic_access','clinic_access_review','Clinic access team'],['reengagement_worry','reengagement_review','Clinic care team'],['privacy_concern','privacy_review','Clinic privacy contact']]){
 const r=result({pain_point:pain,treatment_impact:'missed_visit',unresolved_need:need,handoff_permission:'accepted',support_routing:'accepted',review_team:'clinic_support',barrier_response:'addressed'});
 assert.equal(r.clinicalOnly,false);assert.equal(r.discovery.route,route);assert.equal(r.discovery.resolved,false);assert.equal(r.autonomous,null);assert.match(r.discovery.learned[0],/medication interruption was not established/);
 }
});
test('withdrawal, return to use and missed medication override transport with clinical review',()=>{
 for(const fact of [{pain_point:'withdrawal_concern'},{pain_point:'return_to_use'},{treatment_impact:'missed_or_stopped'}]){
 const r=result({barrier:'transportation',pain_point:'transport_to_clinic',review_team:'clinic_support',support_routing:'accepted',handoff_permission:'accepted',clinical_routing:'declined',...fact});
 assert.equal(r.clinicalOnly,true);assert.equal(r.discovery.route,'Clinical care team');assert.equal(r.support.status,'declined');assert.equal(r.autonomous,null);
 }
 assert.equal(result({pain_point:'withdrawal_concern'}).barrier,'Reported withdrawal or craving concern');
});
test('new medication names reflect explicit extraction and privacy refusal stays refused',()=>{
 assert.match(result({barrier:'side_effects',medication:'buprenorphine'}).barrier,/buprenorphine/);
 assert.doesNotMatch(result({barrier:'side_effects',medication:'unknown'}).barrier,/methadone|GLP/);
 const r=result({pain_point:'privacy_concern',support_routing:'accepted',handoff_permission:'declined'});
 assert.equal(r.support.status,'declined');assert.equal(r.discovery.resolved,false);
});
test('provider field descriptions remain bounded and schema includes new categories',()=>{
 for(const [key,value] of Object.entries(dataCollection)) assert.ok(value.description.length<=500,key);
 assert.ok(dataCollection.treatment_impact.enum.includes('missed_visit'));
 assert.ok(dataCollection.review_team.enum.includes('clinic_support'));
});
