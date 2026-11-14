import test from 'node:test';
import assert from 'node:assert/strict';
import { initMockEhr, normalizeDemoPhone } from '../src/mock-ehr.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const record = { patientName: 'Alex', reason: 'missed_visit', medication: 'Example treatment', lastVisit: 'Missed two visits', nextAppointment: 'Tuesday at ten', notes: 'A ride would help.' };
function harness({verificationRequired = false, phoneEnabled = true, callResponse} = {}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {value: '', checked: false, hidden: false, disabled: false, textContent: '', handlers: {}, attributes: {},
      addEventListener(type, fn) { this.handlers[type] = fn; }, setAttribute(key, value) { this.attributes[key] = value; }, getAttribute(key) {return this.attributes[key];}, focus() {this.focused = true;} });
    return elements.get(id);
  };
  element('browser-mode-tab').attributes['aria-controls'] = 'browser-mode';
  element('phone-mode-tab').attributes['aria-controls'] = 'phone-mode';
  element('phone-code-step').hidden = true;
  element('mock-ehr-form').reportValidity = () => true;
  element('mock-ehr-form').elements = {namedItem: name => ({value: record[name]})};
  element('mock-ehr-form').reset = () => {};
  const requests = [];
  let clock = 1000000;
  const timers = [];
  const api = initMockEhr({ document: {getElementById: element,querySelectorAll: () => [element('voice-orb'),element('start-voice')]}, now: () => clock, setTimeout: fn => timers.push(fn), fetch: async (url, options) => {
    if (url.endsWith('/config')) return {ok: true, json: async () => ({phoneEnabled, verificationRequired})};
    requests.push({url,body:JSON.parse(options.body)});
    if (url.endsWith('/call') && callResponse) return callResponse;
    return {ok:true, json:async () => url.endsWith('/verify') ? {verified:true} : {status:'initiated'}};
  }});
  return {element, api, requests, advance: ms => {clock += ms; timers.forEach(fn => fn());}, click: id => element(id).handlers.click(), submit: () => element('phone-demo-form').handlers.submit({preventDefault() {}}), change: id => element(id).handlers.change(), input: id => element(id).handlers.input()};
}
function readyPhone(h) { h.element('demo-phone').value = '+1 (415) 555-0123'; h.input('demo-phone'); h.element('phone-consent').checked = true; h.change('phone-consent'); }

test('phone normalization accepts only US/Canada-format numbers', () => {
  assert.equal(normalizeDemoPhone('+1 (415) 555-0123'), '+14155550123');
  for (const value of ['+44 20 7946 0958', '4155550123', '+10005550123', '+14151550123', 'javascript:alert(1)']) assert.equal(normalizeDemoPhone(value), null);
});

test('direct callback requires consent and sends the current mock record once', async () => {
  let resolveCall;
  const callResponse = new Promise(resolve => { resolveCall = resolve; });
  const h = harness({callResponse}); await flush();
  h.element('demo-phone').value = '+14155550123';
  await h.submit(); assert.equal(h.requests.length, 0); assert.match(h.element('phone-error').textContent, /agree/);
  readyPhone(h); assert.equal(h.element('call-phone').disabled, false); assert.equal(h.element('send-phone-code').hidden, true);
  const first = h.submit(); const second = h.submit();
  assert.equal(h.element('ehr-fields').disabled, true);
  assert.equal(h.requests.length, 1);
  assert.equal(h.element('start-voice').disabled, true);
  assert.throws(() => h.api.getEhrContext(), /Finish the phone request/);
  assert.deepEqual(h.requests[0].body, {phone:'+14155550123',ehr:record,consent:true});
  resolveCall({ok:true,json:async () => ({status:'initiated'})}); await Promise.all([first,second]);
  await h.submit(); assert.equal(h.requests.length, 1);
  assert.equal(h.element('call-phone').disabled, true);
  assert.equal(h.element('ehr-record-state').textContent, 'Record sent with your demo call');
  assert.match(h.element('phone-status').textContent, /requested/);
  assert.equal(h.element('start-voice').disabled, true);
  assert.throws(() => h.api.getEhrContext(), /2½ minutes/);
  h.advance(150000);
  assert.equal(h.element('start-voice').disabled, false);
  assert.deepEqual(h.api.getEhrContext(), record);
});

test('verification mode requires a verified matching number before a callback', async () => {
  const h = harness({verificationRequired:true}); await flush(); readyPhone(h);
  assert.equal(h.element('send-phone-code').hidden, false);
  await h.submit(); assert.equal(h.requests.length, 0);
  await h.click('send-phone-code'); assert.equal(h.requests[0].body.action, 'send');
  h.element('phone-code').value = '123456'; await h.click('verify-phone-code');
  assert.deepEqual(h.requests[1].body, {phone:'+14155550123',action:'check',code:'123456'});
  assert.equal(h.element('call-phone').disabled, false);
  h.element('demo-phone').value = '+14155550124'; h.input('demo-phone');
  await h.submit(); assert.equal(h.requests.length, 2); assert.equal(h.element('call-phone').disabled, true);
});

test('browser activity and unavailable phone service block callback requests', async () => {
  const h = harness(); await flush(); readyPhone(h); h.api.setBrowserBusy(true);
  await h.submit(); assert.equal(h.requests.length, 0); assert.equal(h.element('ehr-fields').disabled, true);
  h.api.setBrowserBusy(false); assert.equal(h.element('ehr-fields').disabled, false);
  const unavailable = harness({phoneEnabled:false}); await flush(); readyPhone(unavailable);
  await unavailable.submit(); assert.equal(unavailable.requests.length, 0); assert.equal(unavailable.element('phone-fields').disabled, true);
});
