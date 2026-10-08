import test from 'node:test';
import assert from 'node:assert/strict';
import { initVoiceDemo } from '../src/voice-controller.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness({ tokenResponse, sessionResponse, failure } = {}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { dataset: {}, hidden: false, disabled: false, textContent: '', handlers: {}, attributes: {},
      addEventListener(type, fn) { this.handlers[type] = fn; }, setAttribute(k,v) { this.attributes[k] = v; }, focus() {}, scrollIntoView() {} });
    return elements.get(id);
  };
  const startButtons = ['voice-orb', 'start-voice', 'try-again', 'nav-demo'].map(element);
  let callbacks, starts = 0, ends = 0, requests = 0, intervals = 0;
  const muted = [];
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
      if (url.endsWith('/result')) return { ok: true, json: async () => ({ status: 'unavailable' }) };
      requests++;
      if (tokenResponse) await tokenResponse.promise;
      return { ok: true, json: async () => ({ token: 'fictional-token', receipt: 'test-receipt', scenarioId: 'coverage', userId: 'test' }) };
    },
    setInterval: () => ++intervals, clearInterval() {},
  });
  return { element, session, window, muted, click: id => element(id).handlers.click(),
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

test('cancel during token fetch never opens a microphone session', async () => {
  const tokenResponse = deferred(); const h = harness({ tokenResponse });
  h.click('voice-orb'); await flush(); await h.click('end-voice');
  tokenResponse.resolve(); await flush();
  assert.equal(h.starts, 0); assert.equal(h.element('voice-orb').disabled, false);
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
});

test('leaving the page ends the current session', async () => {
  const h = harness(); h.click('voice-orb'); await flush();
  h.window.handlers.pagehide(); await flush();
  assert.equal(h.ends, 1);
});
