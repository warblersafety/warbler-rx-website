import test from 'node:test';
import assert from 'node:assert/strict';
import { examples, workflowFromResult } from '../src/workflow-model.js';

test('each fictional example creates an isolated request owned by the correct team, with follow-up still pending', () => {
  for (const result of Object.values(examples)) {
    const model = workflowFromResult(result);
    assert.equal(model.request.owner, result.discovery.route);
    assert.match(model.request.status, /awaiting review/);
    assert.equal(model.steps[3].status, 'Created in demo');
    assert.equal(model.steps[4].state, 'held');
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
  assert.equal(workflowFromResult({ ...examples.transport, discovery: { ...examples.transport.discovery, route: 'More information needed' } }).request, null);
});

test('resolved informational concerns do not create unnecessary staff work', () => {
  const model = workflowFromResult({ ...examples.transport, discovery: { ...examples.transport.discovery, resolved: true, route: 'No staff follow-up identified' } });
  assert.equal(model.request, null);
  assert.equal(model.steps[4].status, 'No follow-up');
});

test('clinical reviews remain clinical and emergencies never enter the routine queue', () => {
  const clinical = { ...examples.transport, clinicalOnly: true, discovery: { ...examples.transport.discovery, route: 'Clinical care team' } };
  assert.equal(workflowFromResult(clinical).request.title, 'Clinical review requested');
  const urgent = { ...clinical, discovery: { ...clinical.discovery, route: 'Immediate medical help' } };
  assert.equal(workflowFromResult(urgent).request, null);
  assert.equal(workflowFromResult(urgent).steps[2].status, 'Urgent');
});
