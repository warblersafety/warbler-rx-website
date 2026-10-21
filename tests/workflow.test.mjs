import test from 'node:test';
import assert from 'node:assert/strict';
import { examples, waitingSteps, workflowFromResult } from '../src/workflow-model.js';
import { initWorkflow } from '../src/workflow-controller.js';

test('each fictional example creates an isolated request owned by the correct team, with follow-up still pending', () => {
  for (const result of Object.values(examples)) {
    const model = workflowFromResult(result);
    assert.equal(model.request.owner, result.discovery.route);
    assert.match(model.request.status, /awaiting review/);
    assert.equal(model.steps.length, 4);
    assert.equal(model.steps[2].status, 'Created in demo');
    assert.equal(model.steps[3].state, 'held');
    assert.equal(model.steps[0].description, result.discovery.painPoint);
    assert.match(model.steps[1].description, /follow-up.*accepted/);
    assert.match(model.steps[3].description, /No staff have been contacted/);
    assert.ok(model.steps.every(step => step.description.length > 0));
  }
});

test('declined, absent, or unclear staff permission never creates a request even when a text was accepted', () => {
  for (const permission of ['declined', 'not_discussed', 'unclear', undefined]) {
    const result = { ...examples.transport, autonomous: { status: 'accepted' }, discovery: { ...examples.transport.discovery, handoffPermission: permission } };
    assert.equal(workflowFromResult(result).request, null);
  }
});

test('missing analysis or unknown owner never fabricates a request', () => {
  assert.equal(workflowFromResult({}).request, null);
  for (const route of ['More information needed', '', undefined, 'Unreviewed team']) {
    assert.equal(workflowFromResult({ ...examples.transport, discovery: { ...examples.transport.discovery, route } }).request, null);
  }
  for (const resolved of [undefined, null, 'false', 0]) {
    assert.equal(workflowFromResult({ ...examples.transport, discovery: { ...examples.transport.discovery, resolved } }).request, null);
  }
});

test('resolved informational concerns do not create unnecessary staff work', () => {
  const model = workflowFromResult({ ...examples.transport, discovery: { ...examples.transport.discovery, resolved: true, route: 'No staff follow-up identified' } });
  assert.equal(model.request, null);
  assert.equal(model.steps[3].status, 'No follow-up');
});

test('clinical reviews remain clinical and emergencies never enter the routine queue', () => {
  const clinical = { ...examples.transport, clinicalOnly: true, discovery: { ...examples.transport.discovery, route: 'Clinical care team' } };
  assert.equal(workflowFromResult(clinical).request.title, 'Clinical review requested');
  const urgent = { ...clinical, discovery: { ...clinical.discovery, route: 'Immediate medical help' } };
  assert.equal(workflowFromResult(urgent).request, null);
  assert.equal(workflowFromResult(urgent).steps[1].status, 'Urgent');
  assert.equal(workflowFromResult({ ...clinical, support: { status: 'urgent' } }).request, null);
  assert.equal(workflowFromResult({ ...examples.transport, clinicalOnly: true }).request, null);
});

function harness({ reducedMotion = false } = {}) {
  const elements = new Map();
  const create = () => ({ dataset: {}, attributes: {}, children: [], handlers: {}, hidden: false, disabled: false, textContent: '',
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, handler) { this.handlers[type] = handler; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; }, scrollIntoView() {},
  });
  const element = id => { if (!elements.has(id)) elements.set(id, create()); return elements.get(id); };
  const buttons = Object.keys(examples).map(id => Object.assign(create(), { dataset: { workflowExample: id } }));
  const link = create();
  const timers = new Map(); let nextTimer = 0;
  const window = Object.assign(create(), { matchMedia: () => ({ matches: reducedMotion }) });
  const workflow = initWorkflow({
    document: { getElementById: element, createElement: create, querySelectorAll: selector => selector === '[data-workflow-example]' ? buttons : [link] }, window,
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timers.delete(id),
  });
  return { ...workflow, element, buttons, timers, window,
    click: id => element(id).handlers.click(),
    advance() { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); },
    steps: () => element('workflow-steps').children,
  };
}

test('the four cards start with useful descriptions and an explicitly labeled example', () => {
  const h = harness();
  assert.equal(h.element('workflow-title').textContent, 'From one call to one clear task');
  assert.equal(h.element('workflow-mode-label').textContent, 'Illustrative example');
  assert.equal(h.element('workflow-caption').textContent, examples.transport.quote);
  assert.equal(h.steps().length, 4);
  assert.deepEqual(h.steps().map(card => card.children[1].children[0].textContent), waitingSteps().map(step => step.title));
  assert.ok(h.steps().every(card => card.children[1].children[1].textContent));
  assert.equal(h.element('workflow-output').hidden, true);
});

test('example playback reveals the request only after its creation stage and resets cleanly', () => {
  const h = harness(); h.click('workflow-play');
  assert.equal(h.steps()[0].dataset.state, 'active');
  h.advance(); h.advance();
  assert.equal(h.steps()[2].dataset.state, 'active');
  assert.equal(h.element('workflow-output').hidden, true);
  h.advance();
  assert.equal(h.steps()[2].dataset.state, 'complete');
  assert.equal(h.element('workflow-output').hidden, false);
  h.advance();
  assert.equal(h.steps()[3].dataset.state, 'held');
  assert.equal(h.element('workflow-play').textContent, 'Replay example');
  assert.equal(h.timers.size, 0);
  h.click('workflow-reset');
  assert.equal(h.element('workflow-output').hidden, true);
  assert.ok(h.steps().every(card => card.dataset.state === 'pending'));
});

test('skipping and reduced motion both finish examples immediately', () => {
  for (const reducedMotion of [false, true]) {
    const h = harness({ reducedMotion }); h.click('workflow-play');
    if (!reducedMotion) h.click('workflow-play');
    assert.equal(h.timers.size, 0);
    assert.equal(h.element('workflow-output-owner').textContent, examples.transport.discovery.route);
    assert.equal(h.steps()[3].dataset.state, 'held');
  }
});

test('a live call interrupts example playback without fabricating partial analysis', () => {
  const h = harness(); h.click('workflow-play');
  const stalePlayback = h.timers.values().next().value;
  h.onVoiceEvent({ type: 'connecting' }); stalePlayback();
  assert.equal(h.element('workflow-title').textContent, 'Connecting');
  assert.equal(h.element('workflow-output').hidden, true);
  assert.equal(h.element('workflow-caption').hidden, true);
  assert.ok(h.buttons.every(button => button.disabled));
  h.onVoiceEvent({ type: 'connected' }); h.onVoiceEvent({ type: 'analyzing' });
  assert.equal(h.steps()[0].dataset.state, 'active');
  assert.ok(h.steps().slice(1).every(card => card.dataset.state === 'pending'));
  h.onVoiceEvent({ type: 'result', result: examples.schedule });
  assert.equal(h.element('workflow-output-owner').textContent, examples.schedule.discovery.route);
  assert.ok(h.buttons.every(button => !button.disabled));
});

test('voice failures keep examples usable and never leave a stale care request visible', () => {
  for (const type of ['error', 'unavailable', 'cancelled']) {
    const h = harness({ reducedMotion: true }); h.click('workflow-play');
    h.onVoiceEvent({ type: 'connecting' }); h.onVoiceEvent({ type });
    assert.equal(h.element('workflow-output').hidden, true);
    assert.equal(h.element('workflow-example-controls').hidden, false);
    assert.ok(h.buttons.every(button => !button.disabled));
    h.buttons[2].handlers.click(); h.click('workflow-play');
    assert.equal(h.element('workflow-output-owner').textContent, examples.pharmacy.discovery.route);
    assert.equal(h.element('workflow-live').hidden, false);
    h.click('workflow-live');
    assert.equal(h.element('workflow-output').hidden, true);
  }
});
