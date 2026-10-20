import test from 'node:test';
import assert from 'node:assert/strict';
import { initVoiceDemo } from '../src/voice-controller.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness({ tokenResponse, sessionResponse, resultResponse, resultPayload, startPayload, startStatus = 200, failure } = {}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { dataset: {}, hidden: false, disabled: false, textContent: '', handlers: {}, attributes: {},
      addEventListener(type, fn) { this.handlers[type] = fn; }, setAttribute(k,v) { this.attributes[k] = v; }, focus() {}, scrollIntoView() {} });
    return elements.get(id);
  };
  const startButtons = ['voice-orb', 'start-voice', 'nav-demo'].map(element);
  let callbacks, starts = 0, ends = 0, requests = 0, intervals = 0;
  const muted = [];
  const workflowEvents = [];
  const session = { async endSession() { ends++; callbacks?.onDisconnect(); }, setMicMuted(value) { muted.push(value); } };
  const window = element('window');
  initVoiceDemo({
    document: { getElementById: element, querySelectorAll: () => startButtons }, window,
    navigator: { mediaDevices: { getUserMedia() { throw new Error('Only the SDK should own microphone access'); } } },
    loadConversation: () => ({ Conversation: { async startSession(options) {
      starts++; callbacks = options;
      if (failure) throw failure;
      if (sessionResponse) return sessionResponse.promise;
      options.onConversationCreated(session); options.onConnect(); return session;
    } } }),
    fetch: async url => {
      if (url.endsWith('/result')) {
        if (resultResponse) await resultResponse.promise;
        return { ok: true, json: async () => (resultPayload || { status: 'ready', barrier: 'Coverage barrier', team: 'Pharmacy support', next: 'Demo preview only.' }) };
      }
      requests++;
      if (tokenResponse) await tokenResponse.promise;
      return { ok: startStatus === 200, json: async () => (startPayload || { signedUrl: 'wss://api.elevenlabs.io/v1/convai/conversation?conversation_signature=fictional-signature&conversation_id=fictional-call', receipt: 'test-receipt', scenarioId: 'coverage', userId: 'test' }) };
    },
    setInterval: () => ++intervals, clearInterval() {},
    onWorkflowEvent: event => workflowEvents.push(event),
  });
  return { element, session, window, muted, workflowEvents, click: id => element(id).handlers.click(),
    get callbacks() { return callbacks; }, get starts() { return starts; }, get ends() { return ends; }, get requests() { return requests; }, get intervals() { return intervals; } };
}

test('orb starts directly; repeated CTA clicks cannot open a second session; mute and end use that session', async () => {
  const h = harness();
  h.click('voice-orb'); h.click('nav-demo');
  await flush();
  assert.equal(h.starts, 1); assert.equal(h.requests, 1);
  assert.equal(h.element('voice-orb').dataset.state, 'listening');
  assert.equal(h.element('end-voice').hidden, false);
  h.click('mute-voice'); assert.deepEqual(h.muted, [true]);
  assert.equal(h.element('voice-orb').dataset.state, 'muted');
  h.click('mute-voice'); assert.deepEqual(h.muted, [true, false]);
  await h.click('end-voice'); await flush();
  assert.equal(h.ends, 1); assert.equal(h.element('voice-orb').disabled, false);
  assert.equal(h.element('end-voice').hidden, true);
});

test('voice sessions use the admitted single-use URL without public-agent or configuration fallbacks', async () => {
  const signedUrl = 'wss://api.elevenlabs.io/v1/convai/conversation?conversation_signature=fictional-signature&conversation_id=fictional-call';
  const h = harness({ startPayload: { signedUrl, receipt: 'test-receipt', scenarioId: 'coverage', userId: 'test', token: 'ignored-token', agentId: 'ignored-agent', overrides: { conversation: { max_duration_seconds: 99999 } } } });
  h.click('voice-orb'); await flush();
  assert.equal(h.starts, 1);
  assert.equal(h.callbacks.signedUrl, signedUrl);
  assert.equal(h.callbacks.connectionType, 'websocket');
  assert.equal('conversationToken' in h.callbacks, false);
  assert.equal('agentId' in h.callbacks, false);
  assert.equal('overrides' in h.callbacks, false);
  assert.deepEqual(h.callbacks.dynamicVariables, { scenario_id: 'coverage' });
});

test('missing signed admission never opens a microphone session', async () => {
  const h = harness({ startPayload: { token: 'old-token', receipt: 'test-receipt' } });
  h.click('voice-orb'); await flush();
  assert.equal(h.starts, 0);
  assert.equal(h.element('voice-orb').disabled, false);
  assert.equal(h.element('voice-orb').dataset.state, 'error');
  assert.deepEqual(h.workflowEvents.map(event => event.type), ['connecting', 'error']);
});

test('a daily allowance rejection shows the server message without starting the SDK session', async () => {
  const message = 'You’ve reached the limit of three demo conversations in 24 hours. Please try again later.';
  const h = harness({ startStatus: 429, startPayload: { error: message } });
  h.click('voice-orb'); await flush();
  assert.equal(h.starts, 0);
  assert.equal(h.element('demo-error').textContent, message);
  assert.equal(h.element('voice-orb').disabled, false);
  assert.deepEqual(h.workflowEvents.map(event => event.type), ['connecting', 'error']);
});

test('cancel during token fetch never opens a microphone session', async () => {
  const tokenResponse = deferred(); const h = harness({ tokenResponse });
  h.click('voice-orb'); await flush(); await h.click('end-voice');
  tokenResponse.resolve(); await flush();
  assert.equal(h.starts, 0); assert.equal(h.element('voice-orb').disabled, false);
  assert.deepEqual(h.workflowEvents.map(event => event.type), ['connecting', 'cancelled']);
});

test('cancel during SDK setup closes a late session and ignores late connect callbacks', async () => {
  const sessionResponse = deferred(); const h = harness({ sessionResponse });
  h.click('voice-orb'); await flush(); await h.click('end-voice');
  h.callbacks.onConversationCreated(h.session); h.callbacks.onConnect();
  sessionResponse.resolve(h.session); await flush();
  assert.ok(h.ends >= 1); assert.equal(h.intervals, 0);
  assert.equal(h.element('voice-orb').disabled, false);
  assert.equal(h.element('mute-voice').hidden, true);
});

test('microphone denial shows an actionable error and allows retry', async () => {
  const h = harness({ failure: new Error('NotAllowedError: permission denied') });
  h.click('voice-orb'); await flush();
  assert.match(h.element('demo-error').textContent, /Allow your microphone/);
  assert.equal(h.element('voice-orb').disabled, false);
  assert.equal(h.element('voice-orb').dataset.state, 'error');
  assert.deepEqual(h.workflowEvents.map(event => event.type), ['connecting', 'error']);
});

test('leaving the page ends the current session', async () => {
  const h = harness(); h.click('voice-orb'); await flush();
  h.window.handlers.pagehide(); await flush();
  assert.equal(h.ends, 1);
});

test('restart hides the reveal and ignores analysis arriving from the previous conversation', async () => {
  const resultResponse = deferred(); const h = harness({ resultResponse });
  h.click('voice-orb'); await flush(); await h.click('end-voice');
  assert.equal(h.element('result-flow').hidden, false);
  assert.equal(h.element('result-content').hidden, true);
  h.click('start-voice'); await flush();
  assert.equal(h.element('result-flow').hidden, true);
  resultResponse.resolve(); await flush();
  assert.equal(h.element('result-flow').hidden, true);
  assert.equal(h.element('result-content').hidden, true);
});

test('clinical results hide autonomous actions and open support', async () => {
  const h = harness({ resultPayload: { status: 'ready', barrier: 'Reported medication side effect', autonomous: null, clinicalOnly: true, support: { title: 'Clinical care team', description: 'Demo preview.', status: 'accepted' } } });
  h.click('voice-orb'); await flush(); await h.click('end-voice'); await flush();
  assert.equal(h.element('result-auto-tab').hidden, true);
  assert.equal(h.element('result-support-panel').hidden, false);
  assert.equal(h.element('result-clinical-note').hidden, false);
  assert.equal(h.element('demo-result').attributes['aria-busy'], 'false');
});

test('accepted action opens first, tabs preserve independent results and keyboard navigation', async () => {
  const h = harness({ resultPayload: { status: 'ready', barrier: 'Routine changes', autonomous: { title: 'Routine reminder', status: 'accepted' }, support: { title: 'Pharmacy support', status: 'declined' } } });
  h.click('voice-orb'); await flush(); await h.click('end-voice'); await flush();
  assert.equal(h.element('result-auto-panel').hidden, false);
  assert.match(h.element('result-auto-status').textContent, /Agreed in call/);
  assert.equal(h.element('result-support-status').textContent, 'Declined in call');
  h.click('result-support-tab');
  assert.equal(h.element('result-auto-panel').hidden, true);
  assert.equal(h.element('result-support-tab').attributes['aria-selected'], 'true');
  h.element('result-support-tab').handlers.keydown({ key: 'Home', preventDefault() {} });
  assert.equal(h.element('result-auto-tab').attributes['aria-selected'], 'true');
  h.click('start-voice'); await flush();
  assert.equal(h.element('result-flow').hidden, true);
});

test('support acceptance takes focus when autonomous action was declined', async () => {
  const h = harness({ resultPayload: { status: 'ready', barrier: 'Refill or renewal delays', autonomous: { title: 'Status reminder', status: 'declined' }, support: { title: 'Renewal team', status: 'accepted' } } });
  h.click('voice-orb'); await flush(); await h.click('end-voice'); await flush();
  assert.equal(h.element('result-support-panel').hidden, false);
  assert.equal(h.element('result-auto-dot').hidden, true);
  assert.equal(h.element('result-support-dot').hidden, false);
});

test('results render discovery, delivered support, patient response and remaining owner', async () => {
  const discovery = {painPoint:'New prescription or renewal needed',learned:['Already contacted the prescribing office','Supply risk reported'],help:'Explained the blocked refill step',response:'Plan is clearer',outcome:'Next step clarified — work remains',remaining:'Renewal still needed',route:'Prescribing office',routingStatus:'Handoff agreed · demo preview'};
  const h = harness({resultPayload:{status:'ready',barrier:'Refill delay',discovery}});
  h.click('voice-orb');await flush();await h.click('end-voice');await flush();
  assert.equal(h.element('result-discovery').hidden,false);
  assert.equal(h.element('result-pain-point').textContent,discovery.painPoint);
  assert.equal(h.element('result-learned').textContent,discovery.learned.join(' · '));
  assert.equal(h.element('result-help').textContent,discovery.help);
  assert.equal(h.element('result-remaining').textContent,discovery.remaining);
  assert.equal(h.element('result-route').textContent,'Prescribing office');
  assert.match(h.element('result-route-status').textContent,/preview/);
});

test('workflow receives actual connection and post-call results in order; in-call messages never fabricate analysis', async () => {
  const h = harness({ resultPayload: { status: 'ready', barrier: 'Transportation to clinic', discovery: { painPoint: 'Ride fell through', learned: [], route: 'Clinic support', handoffPermission: 'accepted' } } });
  h.click('voice-orb'); await flush();
  h.callbacks.onMessage({ role: 'user', message: 'I need a ride' });
  assert.deepEqual(h.workflowEvents.map(event => event.type), ['connecting', 'connected']);
  await h.click('end-voice'); await flush();
  assert.deepEqual(h.workflowEvents.map(event => event.type), ['connecting', 'connected', 'analyzing', 'result']);
  assert.equal(h.workflowEvents.at(-1).result.discovery.handoffPermission, 'accepted');
  assert.equal(h.element('conversation-details').hidden, false);
});

test('unavailable analysis reports the gap and does not invent a result', async () => {
  const h = harness({ resultPayload: { status: 'unavailable' } });
  h.click('voice-orb'); await flush(); await h.click('end-voice'); await flush();
  assert.deepEqual(h.workflowEvents.map(event => event.type), ['connecting', 'connected', 'analyzing', 'unavailable']);
});
