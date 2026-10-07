import { scenarios } from '../lib/scenarios.js';
import './demo.css';

const root = document.querySelector('#voice-demo-root');
root.innerHTML = `
<section id="try-warbler" class="voice-demo" aria-labelledby="demo-title">
  <div class="demo-intro">
    <h2 id="demo-title">Try a GLP-1 conversation.</h2>
    <p>Choose a situation, play a fictional patient, and talk to Warbler.</p>
  </div>
  <div class="demo-layout">
    <div class="scenario-panel"><div class="step-label"><span>01</span> Choose a situation</div>
      <div class="compact-scenarios"><label class="sr-only" for="scenario-select">Choose a GLP-1 situation</label><select id="scenario-select"></select><p id="selected-line"></p></div>
      <div id="scenario-list" class="scenario-list" role="group" aria-label="GLP-1 conversation scenarios"></div>
      <button id="more-scenarios" class="text-button" aria-expanded="false" aria-controls="extra-scenarios">More GLP-1 situations <span aria-hidden="true">＋</span></button>
      <div id="extra-scenarios" class="scenario-list" role="group" aria-label="More GLP-1 scenarios" hidden></div>
      <div class="scenario-context"><span class="eyebrow">WHAT THIS SCENARIO EXPLORES</span><p id="scenario-focus"></p><ol id="scenario-steps"></ol></div>
    </div>
    <div class="conversation-panel">
      <div class="conversation-top"><span class="step-label"><span>02</span> Talk to Warbler</span><span class="duration-label" id="duration">About 90 seconds</span></div>
      <button id="voice-orb" class="orb-button" aria-label="Start a fictional GLP-1 voice conversation" aria-describedby="demo-disclosure">
        <span class="orb-halo"></span><span class="orb"><span class="orb-swirl"></span><span class="orb-glint"></span></span>
        <span class="orb-symbol" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M7 13v6M13 7v18M19 10v12M25 13v6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></span>
      </button>
      <span id="connection-announcement" class="sr-only" role="status" aria-live="polite"></span>
      <p class="voice-hint" id="voice-hint">Choose a situation, then click the orb.<br>You play the patient. Warbler takes it from there.</p>
      <div class="voice-controls"><button id="start-voice" class="primary-button">Start GLP-1 conversation <span aria-hidden="true">↗</span></button><button id="mute-voice" class="secondary-button" hidden aria-pressed="false">Mute mic</button><button id="end-voice" class="end-button" hidden>End conversation</button></div>
      <p id="demo-error" class="demo-error" role="alert" hidden></p>
      <p id="demo-disclosure" class="disclosure">AI role-play, not medical care. Use fictional details. No clinician is contacted and no refill or appointment is arranged.</p>
      <details class="privacy-note"><summary>Microphone & privacy</summary><p>Your microphone connects to ElevenLabs. Audio is processed live; saving audio recordings is disabled. Conversation text is retained for up to one day. Please use fictional details. Warbler does not request your name, phone number, insurance ID, or payment details. End the conversation to stop microphone access.</p></details><a class="voice-attribution" href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer">Voice powered by ElevenLabs ↗</a>
    </div>
  </div>
  <div id="demo-result" class="demo-result" hidden tabindex="-1" aria-labelledby="result-title"><span class="eyebrow">YOUR CONVERSATION · DEMO PREVIEW</span><h3 id="result-title">What comes after the conversation.</h3><p id="result-status" role="status">Preparing your GLP-1 conversation summary…</p><div id="result-content" hidden><div class="result-grid"><div><span class="result-label">GLP-1 need identified</span><p id="result-barrier"></p></div><div><span class="result-label">Proposed next step</span><p id="result-team"></p></div></div><p id="result-next"></p></div><div class="result-actions"><button id="try-again" class="secondary-button">Try another GLP-1 situation</button><a class="primary-button" href="https://calendar.app.google/dAj1Fv4UhSUbFGfz8">See Warbler in your pharmacy ↗</a></div></div>
  <p class="demo-bottom">From GLP-1 refill barriers to clinical concerns. The right conversation helps identify the right next step.</p>
</section>`;

const $ = (id) => document.getElementById(id);
let selected = scenarios[0];
let session = null;
let busy = false;
let muted = false;
let receipt = null;
let run = 0;
let timer;
let startedAt = 0;
let connected = false;
let failure = false;
let cancelled = false;

function renderScenario(scenario, index) {
  const button = document.createElement('button');
  button.className = 'scenario-card';
  button.dataset.scenario = scenario.id;
  button.setAttribute('aria-pressed', String(scenario.id === selected.id));
  const top = document.createElement('span'); top.className = 'scenario-top';
  const tag = document.createElement('span'); tag.textContent = scenario.tag;
  const marker = document.createElement('span'); marker.className = 'scenario-marker'; marker.textContent = '↗'; marker.setAttribute('aria-hidden', 'true');
  top.append(tag, marker);
  const label = document.createElement('strong'); label.textContent = scenario.label;
  const line = document.createElement('span'); line.className = 'scenario-line'; line.textContent = `“${scenario.line}”`;
  button.append(top, label, line);
  button.addEventListener('click', () => { if (!busy) choose(scenario); });
  $(index < 3 ? 'scenario-list' : 'extra-scenarios').append(button);
}
scenarios.forEach(renderScenario);
$('scenario-select').replaceChildren(...scenarios.map(scenario => {
  const option = document.createElement('option');
  option.value = scenario.id; option.textContent = scenario.label;
  return option;
}));
$('scenario-select').addEventListener('change', event => {
  if (!busy) choose(scenarios.find(scenario => scenario.id === event.target.value));
});

function choose(scenario) {
  selected = scenario;
  $('scenario-select').value = scenario.id;
  $('selected-line').textContent = `“${scenario.line}”`;
  document.querySelectorAll('[data-scenario]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.scenario === scenario.id)));
  $('scenario-focus').textContent = scenario.focus;
  $('scenario-steps').replaceChildren(...scenario.steps.map(step => { const li = document.createElement('li'); li.textContent = step; return li; }));
}
choose(selected);
$('more-scenarios').addEventListener('click', () => {
  const expanded = $('more-scenarios').getAttribute('aria-expanded') !== 'true';
  $('more-scenarios').setAttribute('aria-expanded', String(expanded));
  $('more-scenarios').textContent = expanded ? 'Fewer GLP-1 situations −' : 'More GLP-1 situations ＋';
  $('extra-scenarios').hidden = !expanded;
});

function status(text, mode) {
  $('connection-announcement').textContent = text;
  $('voice-orb').dataset.state = mode;
}

function setBusy(value) {
  busy = value;
  $('scenario-select').disabled = value;
  document.querySelectorAll('[data-scenario]').forEach(el => { el.disabled = value; });
  $('start-voice').hidden = value;
  $('end-voice').hidden = !value;
  $('mute-voice').hidden = !value || !connected;
  $('voice-orb').disabled = value;
  $('try-again').disabled = value;
}

function showError(message) {
  failure = true;
  $('demo-error').textContent = message;
  $('demo-error').hidden = false;
}

function friendlyError(error) {
  if (/permission|notallowed|denied/i.test(error?.message || '')) return 'Microphone access is blocked. Allow your microphone in this browser’s site settings, then try again.';
  if (/notfound|device|microphone/i.test(error?.message || '')) return 'We couldn’t find an available microphone. Connect one and try again.';
  return error?.demoMessage || 'We couldn’t connect the conversation. Check your connection and microphone, then try again.';
}

async function getSummary(activeRun, callReceipt) {
  $('demo-result').hidden = false;
  $('result-content').hidden = true;
  $('result-status').hidden = false;
  $('result-status').textContent = 'Preparing your GLP-1 conversation summary…';
  $('demo-result').focus({ preventScroll: true });
  for (let attempt = 0; attempt < 15; attempt++) {
    if (run !== activeRun) return;
    try {
      const response = await fetch('/api/voice/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receipt: callReceipt }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (run !== activeRun) return;
      if (!response.ok || result.status === 'unavailable') break;
      if (result.status === 'ready') {
        $('result-barrier').textContent = result.barrier;
        $('result-team').textContent = result.team;
        $('result-next').textContent = result.next;
        $('result-content').hidden = false;
        $('result-status').hidden = true;
        return;
      }
    } catch { break; }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (run === activeRun) $('result-status').textContent = 'Your conversation has ended, but its summary isn’t available yet. No GLP-1 refill or clinical follow-up has been arranged. You can try another situation or book a demo.';
}

function finish(activeRun) {
  if (activeRun !== run || !busy) return;
  clearInterval(timer);
  const wasConnected = connected;
  connected = false;
  session = null;
  setBusy(false);
  $('start-voice').textContent = 'Start another conversation ↗';
  $('voice-hint').textContent = 'Try a different GLP-1 situation, or see how Warbler could support your pharmacy.';
  status(failure ? 'Let’s try that again' : wasConnected ? 'Conversation complete' : 'Conversation ended', failure ? 'error' : 'idle');
  if (wasConnected && receipt) void getSummary(activeRun, receipt);
}

async function start() {
  if (busy) return;
  if (!navigator.mediaDevices?.getUserMedia) { showError('Voice conversations need a browser with microphone support over a secure connection. Try a current version of Safari, Chrome, or Edge.'); return; }
  const activeRun = ++run;
  receipt = null; connected = false; failure = false; muted = false; cancelled = false;
  $('demo-error').hidden = true; $('demo-result').hidden = true;
  $('mute-voice').textContent = 'Mute mic'; $('mute-voice').setAttribute('aria-pressed', 'false');
  setBusy(true); status('Connecting…', 'connecting');
  $('duration').textContent = 'Up to 2 minutes';
  $('voice-hint').textContent = 'Allow your microphone when asked. You can use the suggested patient line or your own fictional GLP-1 situation.';
  try {
    const { Conversation } = await import('@elevenlabs/client');
    if (activeRun !== run || cancelled) return;
    const response = await fetch('/api/voice/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: selected.id }), signal: AbortSignal.timeout(25000) });
    const body = await response.json().catch(() => ({}));
    if (activeRun !== run || cancelled) return;
    if (!response.ok) { const error = new Error(body.error || 'Connection unavailable'); error.demoMessage = body.error; throw error; }
    receipt = body.receipt;
    const conversation = await Conversation.startSession({
      conversationToken: body.token,
      connectionType: 'webrtc',
      dynamicVariables: { scenario_id: body.scenarioId },
      userId: body.userId,
      onConversationCreated: conversation => {
        if (activeRun !== run || cancelled) void conversation.endSession();
        else session = conversation;
      },
      onConnect: () => {
        if (activeRun !== run || cancelled) return;
        connected = true; startedAt = Date.now(); setBusy(true);
        status('Conversation connected', 'connected');
        $('voice-hint').textContent = 'Speak naturally. You can interrupt or end the demo at any time.';
        timer = setInterval(() => {
          const seconds = Math.floor((Date.now() - startedAt) / 1000);
          $('duration').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} / 2:00`;
          if (seconds >= 120) void end();
        }, 1000);
      },
      onError: message => { if (activeRun === run && !cancelled) showError(friendlyError(new Error(message))); },
      onDisconnect: () => finish(activeRun),
    });
    if (activeRun !== run || cancelled || !busy) await conversation.endSession();
    else session = conversation;
  } catch (error) {
    if (activeRun === run && !cancelled) { showError(friendlyError(error)); finish(activeRun); }
  }
}

async function end() {
  cancelled = true;
  const activeRun = run;
  const current = session;
  try { await current?.endSession(); }
  finally { if (busy) finish(activeRun); }
}
$('start-voice').addEventListener('click', start);
$('voice-orb').addEventListener('click', start);
$('end-voice').addEventListener('click', end);
$('mute-voice').addEventListener('click', () => {
  if (!session || !connected) return;
  muted = !muted;
  session.setMicMuted(muted);
  $('mute-voice').textContent = muted ? 'Unmute mic' : 'Mute mic';
  $('mute-voice').setAttribute('aria-pressed', String(muted));
});
$('try-again').addEventListener('click', () => {
  ++run; $('demo-result').hidden = true;
  $('try-warbler').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  (matchMedia('(max-width: 900px)').matches ? $('scenario-select') : document.querySelector(`[data-scenario="${selected.id}"]`)).focus({ preventScroll: true });
});
window.addEventListener('pagehide', () => { void session?.endSession(); });
