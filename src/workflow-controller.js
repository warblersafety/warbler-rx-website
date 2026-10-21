import { examples, waitingSteps, workflowFromResult } from './workflow-model.js';

export function initWorkflow({ document = globalThis.document, window = globalThis.window, setTimeout = globalThis.setTimeout, clearTimeout = globalThis.clearTimeout } = {}) {
  const $ = id => document.getElementById(id);
  if (!$('workflow-panel')) return { onVoiceEvent() {} };
  let mode = 'example';
  let selected = 'transport';
  let timer;
  let generation = 0;
  let playing = false;
  let exampleStarted = false;
  let voiceBusy = false;
  let live = null;

  function stopPlayback() { clearTimeout(timer); generation++; playing = false; }
  function renderSteps(steps) {
    const list = $('workflow-steps');
    list.replaceChildren(...steps.map((item, index) => {
      const li = document.createElement('li'); li.className = 'workflow-step'; li.dataset.state = item.state;
      const marker = document.createElement('span'); marker.className = 'workflow-step-marker'; marker.textContent = item.state === 'complete' ? '✓' : String(index + 1); marker.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('div'); copy.className = 'workflow-step-copy';
      const title = document.createElement('p'); title.className = 'workflow-step-title'; title.textContent = item.title;
      const status = document.createElement('span'); status.className = 'workflow-step-status'; status.textContent = item.status;
      copy.append(title);
      if (item.description) {
        const description = document.createElement('p'); description.className = 'workflow-step-description'; description.textContent = item.description;
        copy.append(description);
      }
      const progress = document.createElement('span'); progress.className = 'workflow-step-progress'; progress.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('span'); progress.append(fill);
      li.append(marker, copy, status, progress); return li;
    }));
  }
  function renderOutput(request) {
    $('workflow-output').hidden = !request;
    for (const field of ['title', 'body', 'status', 'owner', 'note']) $('workflow-output-' + field).textContent = request?.[field] || '';
  }
  function controls() {
    $('workflow-panel').dataset.mode = mode;
    $('workflow-panel').dataset.playing = String(playing);
    $('workflow-example-controls').hidden = voiceBusy;
    document.querySelectorAll('[data-workflow-example]').forEach(button => { button.disabled = voiceBusy; button.setAttribute('aria-pressed', String(mode === 'example' && button.dataset.workflowExample === selected)); });
    $('workflow-play').hidden = mode !== 'example';
    $('workflow-play').disabled = voiceBusy;
    $('workflow-play').textContent = playing ? 'Skip to result' : exampleStarted ? 'Replay example' : 'Play example';
    $('workflow-reset').hidden = mode !== 'example' || !exampleStarted;
    $('workflow-reset').textContent = 'Reset';
    $('workflow-reset').disabled = voiceBusy;
    $('workflow-live').hidden = !live || mode === 'live';
    document.querySelectorAll('[data-run-workflow-example]').forEach(button => button.setAttribute('aria-disabled', String(voiceBusy)));
  }
  function showExample(id = selected) {
    if (voiceBusy || !Object.hasOwn(examples, id)) return;
    stopPlayback(); mode = 'example'; selected = id; exampleStarted = false;
    $('workflow-mode-label').textContent = 'Illustrative example';
    $('workflow-title').textContent = 'From one call to one clear task';
    $('workflow-caption').textContent = examples[id].quote;
    $('workflow-caption').hidden = false;
    $('workflow-announcement').textContent = '';
    renderSteps(waitingSteps()); renderOutput(null); controls();
  }
  function playExample() {
    if (voiceBusy) return;
    exampleStarted = true;
    renderOutput(null);
    const model = workflowFromResult(examples[selected]);
    const finish = () => {
      stopPlayback(); renderSteps(model.steps); renderOutput(model.request);
      $('workflow-title').textContent = 'An example care request, ready for review';
      $('workflow-announcement').textContent = `Example complete. ${model.announcement}`;
      controls();
    };
    if (playing || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    stopPlayback(); playing = true; const activeGeneration = generation;
    $('workflow-title').textContent = 'From one call to one clear task';
    $('workflow-announcement').textContent = 'Playing an illustrative example. No live call is taking place.';
    let progress = 0;
    function advance() {
      if (activeGeneration !== generation || mode !== 'example' || voiceBusy) return;
      const stages = waitingSteps();
      for (let i = 0; i < progress; i++) stages[i] = model.steps[i];
      if (progress < stages.length) {
        stages[progress] = { ...model.steps[progress], state: 'active', status: 'Example in progress' };
      }
      renderSteps(stages);
      if (progress >= 3) renderOutput(model.request);
      controls();
      if (progress++ >= stages.length) { finish(); return; }
      timer = setTimeout(advance, 1200);
    }
    advance();
  }
  function showLive() {
    if (!live) return;
    stopPlayback(); mode = 'live';
    $('workflow-mode-label').textContent = 'Your conversation';
    $('workflow-title').textContent = live.title;
    $('workflow-caption').textContent = live.caption || '';
    $('workflow-caption').hidden = !live.caption;
    renderSteps(live.steps); renderOutput(live.request); controls();
    $('workflow-announcement').textContent = live.announcement || live.title;
  }
  function onVoiceEvent(event) {
    if (event.type === 'connecting') {
      voiceBusy = true;
      const steps = waitingSteps(); steps[0] = { ...steps[0], description: 'Connecting your microphone to Warbler.', state: 'active', status: 'Connecting' };
      live = { title: 'Connecting', steps, request: null };
    } else if (event.type === 'connected') {
      voiceBusy = true;
      const steps = waitingSteps(); steps[0] = { ...steps[0], description: 'Listening. A reviewed summary appears after the call.', state: 'active', status: 'In progress' };
      live = { title: 'Conversation in progress', steps, request: null };
    } else if (event.type === 'analyzing') {
      voiceBusy = true; const steps = waitingSteps();
      steps[0] = { ...steps[0], description: 'Call ended. Reviewing the conversation before showing a summary.', state: 'active', status: 'Reviewing' };
      live = { title: 'Analyzing conversation', steps, request: null };
    } else if (event.type === 'result') {
      voiceBusy = false; const model = workflowFromResult(event.result);
      live = { ...model };
    } else if (event.type === 'error' || event.type === 'unavailable' || event.type === 'cancelled') {
      voiceBusy = false; const steps = waitingSteps();
      const unavailable = event.type === 'unavailable';
      steps[0] = { ...steps[0], state: 'held', status: unavailable ? 'Unavailable' : 'Stopped', description: unavailable ? 'No reviewed summary is available for this call.' : 'No completed conversation to analyze.' };
      steps[2] = { ...steps[2], state: 'held', status: 'Not created', description: 'No care request was created.' };
      steps[3] = { ...steps[3], state: 'held', status: 'No follow-up', description: 'No staff have been contacted. You can still explore an example below.' };
      live = { title: unavailable ? 'Analysis unavailable' : event.type === 'error' ? 'Could not connect' : 'Conversation cancelled', steps, request: null, announcement: 'No care request created. Illustrative examples are still available.' };
    } else return;
    showLive();
  }
  document.querySelectorAll('[data-workflow-example]').forEach(button => button.addEventListener('click', () => showExample(button.dataset.workflowExample)));
  $('workflow-play').addEventListener('click', playExample);
  $('workflow-reset').addEventListener('click', () => showExample());
  $('workflow-live').addEventListener('click', showLive);
  document.querySelectorAll('[data-run-workflow-example]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); if (voiceBusy) return; showExample(); playExample(); $('workflow-panel').scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); }));
  window.addEventListener('pagehide', stopPlayback);
  showExample();
  return { onVoiceEvent };
}
