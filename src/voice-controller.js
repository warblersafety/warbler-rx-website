// The orb owns one voice session. Dependencies are injectable for offline lifecycle tests.
export function initVoiceDemo({
  document = globalThis.document,
  window = globalThis.window,
  navigator = globalThis.navigator,
  fetch = globalThis.fetch,
  loadConversation,
  setInterval = globalThis.setInterval,
  clearInterval = globalThis.clearInterval,
} = {}) {
const $ = (id) => document.getElementById(id);
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
let voiceMode = 'listening';
let visualState = 'idle';
const stateLabels = { idle: 'Ready when you are', connecting: 'Connecting…', listening: 'Listening', processing: 'Processing', speaking: 'Speaking', muted: 'Microphone off', error: 'Connection unavailable' };
function setVisualState(mode) {
  visualState = mode;
  const effective = muted && connected ? 'muted' : mode;
  $('voice-orb').dataset.state = effective;
  $('voice-orb').setAttribute('aria-label', connected ? `Warbler voice demo — ${stateLabels[effective]}` : 'Talk to Warbler — start voice demo');
  $('voice-state').textContent = stateLabels[effective] || stateLabels.idle;
}
function status(text, mode) {
  $('connection-announcement').textContent = text;
  setVisualState(mode);
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll('[data-start-demo]').forEach(el => { el.disabled = value; });
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
  $('result-flow').hidden = false;
  $('demo-result').hidden = false;
  $('result-content').hidden = true;
  $('result-status').hidden = false;
  $('result-status').textContent = 'Preparing your conversation summary…';
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
        $('result-next-step').dataset.scheduling = String(result.schedulingPreview === true);
        $('result-next-step').dataset.cost = String(result.costPreview === true);
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
  $('start-voice').textContent = 'Talk to Warbler again';
  $('voice-hint').textContent = 'Explore another barrier, or see how Warbler could support your pharmacy.';
  status(failure ? 'Let’s try that again' : wasConnected ? 'Conversation complete' : 'Conversation ended', failure ? 'error' : 'idle');
  if (wasConnected && receipt) void getSummary(activeRun, receipt);
}

async function start() {
  if (busy) return;
  if (!navigator.mediaDevices?.getUserMedia) { showError('Voice conversations need a browser with microphone support over a secure connection. Try a current version of Safari, Chrome, or Edge.'); return; }
  const activeRun = ++run;
  receipt = null; connected = false; failure = false; muted = false; cancelled = false; voiceMode = 'listening';
  $('demo-error').hidden = true; $('demo-result').hidden = true; $('result-flow').hidden = true;
  $('result-next-step').dataset.scheduling = 'false';
  $('result-next-step').dataset.cost = 'false';
  $('mute-voice').textContent = 'Mute mic'; $('mute-voice').setAttribute('aria-pressed', 'false');
  setBusy(true); status('Connecting…', 'connecting');
  $('duration').textContent = 'Up to 2 minutes';
  $('voice-hint').textContent = 'Allow your microphone when asked, then describe a fictional prescription barrier.';
  try {
    const { Conversation } = await loadConversation();
    if (activeRun !== run || cancelled) return;
    const response = await fetch('/api/voice/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 'coverage' }), signal: AbortSignal.timeout(25000) });
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
        if (activeRun !== run || cancelled || !busy) void conversation.endSession();
        else session = conversation;
      },
      onConnect: () => {
        if (activeRun !== run || cancelled || !busy || connected) return;
        connected = true; startedAt = Date.now(); setBusy(true);
        status('Conversation connected', voiceMode);
        $('voice-hint').textContent = 'Speak naturally. You can interrupt or end the demo at any time.';
        timer = setInterval(() => {
          const seconds = Math.floor((Date.now() - startedAt) / 1000);
          $('duration').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} / 2:00`;
          if (seconds >= 120) void end();
        }, 1000);
      },
      onModeChange: ({ mode }) => {
        if (activeRun !== run || cancelled || !busy) return;
        voiceMode = mode;
        if (connected) status(mode === 'speaking' ? 'Warbler is speaking' : 'Warbler is listening', mode);
      },
      onMessage: ({ role, source }) => {
        if (activeRun !== run || cancelled || !connected) return;
        if (!muted && (role === 'user' || source === 'user')) status('Warbler is processing your response', 'processing');
      },
      onVadScore: ({ vadScore }) => {
        if (activeRun === run && !cancelled && connected && !muted && vadScore > .5 && visualState === 'processing') status('Warbler is listening', 'listening');
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
  catch { showError('The conversation has ended. Please refresh if your browser still shows microphone access.'); }
  finally { if (busy) finish(activeRun); }
}
document.querySelectorAll('[data-start-demo]').forEach(button => {
  button.addEventListener('click', () => {
    $('try-warbler').scrollIntoView({ behavior: 'instant', block: 'center' });
    void start();
  });
});
$('end-voice').addEventListener('click', end);
$('mute-voice').addEventListener('click', () => {
  if (!session || !connected) return;
  muted = !muted;
  session.setMicMuted(muted);
  $('mute-voice').textContent = muted ? 'Unmute mic' : 'Mute mic';
  $('mute-voice').setAttribute('aria-pressed', String(muted));
  status(muted ? 'Microphone muted' : 'Microphone unmuted', voiceMode);
});
window.addEventListener('pagehide', () => { void end(); });
}
