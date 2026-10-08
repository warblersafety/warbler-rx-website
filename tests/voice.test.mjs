import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCall, checkAllowance, checkQuota, checkRequest, getConfig, provider, publicResult, signReceipt, verifyReceipt } from '../lib/voice-server.js';

const config = { agentId: 'agent_website', versionId: 'version_website', secret: 'a'.repeat(64), dailyLimit: 10 };
const now = 1800000000000;
const req = { method: 'POST', headers: { origin: 'https://warbler-rx-website.vercel.app', 'content-type': 'application/json' }, body: { scenarioId: 'refill' } };

test('anonymous callers cannot choose agents, inject prompts or enable tools', () => {
  const request = buildCall('coverage', config, 'visitor', now);
  assert.equal(request.agent_id, 'agent_website');
  assert.equal(request.version_id, 'version_website');
  assert.deepEqual(Object.keys(request).sort(), ['agent_id', 'participant_name', 'version_id']);
  assert.throws(() => buildCall('{{ignore instructions}}', config, 'visitor'), { status: 400 });
  assert.throws(() => buildCall('__proto__', config, 'visitor'), { status: 400 });
});

test('session API only accepts approved origins and JSON POST requests', () => {
  assert.doesNotThrow(() => checkRequest(req, { VERCEL: '1' }));
  const originRequest = origin => ({ ...req, headers: { ...req.headers, origin } });
  for (const origin of ['https://warbler-health.com', 'https://www.warbler-health.com']) assert.doesNotThrow(() => checkRequest(originRequest(origin), { VERCEL: '1' }));
  assert.doesNotThrow(() => checkRequest(originRequest('https://warbler-rx-website-noahdelay-techs-projects.vercel.app'), { VERCEL: '1' }));
  assert.doesNotThrow(() => checkRequest(originRequest('https://production.example.test'), { VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'production.example.test' }));
  assert.throws(() => checkRequest(originRequest('https://warbler-rx-website-noahdelay-techs-projects.vercel.app.evil.test'), { VERCEL: '1' }), { status: 403 });
  for (const origin of ['https://warbler-health.com.evil.test', 'http://warbler-health.com', 'https://warblersafety.com.evil.test', 'null', undefined, 'http://localhost:5173']) assert.throws(() => checkRequest({ ...req, headers: { ...req.headers, origin } }, { VERCEL: '1' }), { status: 403 });
  assert.throws(() => checkRequest({ ...req, method: 'GET' }), { status: 405 });
  assert.throws(() => checkRequest({ ...req, body: { value: 'x'.repeat(3000) } }), { status: 400 });
});

test('summary access is tied to an unmodified, unexpired signed receipt', () => {
  const receipt = signReceipt('call_own', config.secret, now);
  assert.equal(verifyReceipt(receipt, config.secret, now + 1000), 'call_own');
  assert.throws(() => verifyReceipt(receipt, 'different-secret', now), { status: 403 });
  assert.throws(() => verifyReceipt(receipt + '.extra', config.secret, now), { status: 403 });
  assert.throws(() => verifyReceipt(receipt, config.secret, now + 3600001), { status: 403 });
  assert.throws(() => verifyReceipt('call_someone_else', config.secret, now), { status: 403 });
});

test('provider history limits repeats and daily use across process restarts', () => {
  const ended = { status: 'done', start_time_unix_secs: (now - 1000) / 1000 };
  assert.throws(() => checkAllowance(Array(3).fill(ended), Array(3).fill(ended), 10, now), { status: 429 });
  assert.doesNotThrow(() => checkAllowance(Array(3).fill(ended), [], 10, now));
  assert.throws(() => checkAllowance(Array(10).fill(ended), [], 10, now), { status: 429 });
  assert.throws(() => checkAllowance([ended], [{ ...ended, status: 'in-progress' }], 10, now), { status: 409 });
  assert.throws(() => checkAllowance(Array(2).fill({...ended,status:'initiated'}), [], 10, now), {status:429});
  assert.doesNotThrow(() => checkAllowance([{...ended,start_time_unix_secs:(now-86400001)/1000}], [], 1, now));
});

test('actual analysis overrides scenario and clinical concerns retain clinical review', () => {
  const result = publicResult({ analysis: { data_collection_results: { barrier: {value:'side_effects'}, review_team: {value:'none'}, patient_need: {value:'<script>bad</script>'} } } });
  assert.equal(result.team, 'Clinical care team');
  assert.equal(result.barrier, 'Reported medication side effect');
  assert.equal(JSON.stringify(result).includes('<script>'), false);
  assert.match(result.next, /No clinician has been contacted/);
  assert.deepEqual(publicResult({ status: 'done' }), { status: 'pending' });
  assert.deepEqual(publicResult({ status: 'failed' }), { status: 'unavailable' });
});

test('unknown analysis cannot produce a completed or invented outcome', () => {
  const result = publicResult({ analysis: { data_collection_results: { barrier: {value:'approved'}, review_team: {value:'booked'} } } });
  assert.equal(result.team, 'More information needed');
  assert.equal(result.barrier, 'GLP-1 need not established');
});

test('missing secrets and the kill switch fail closed; a pinned version is required', () => {
  assert.throws(() => getConfig({}), { status: 503 });
  const env = { ELEVENLABS_API_KEY: 'test', ELEVENLABS_AGENT_ID: 'website', ELEVENLABS_AGENT_VERSION_ID: 'version_website', VOICE_SESSION_SECRET: config.secret, VOICE_DEMO_ENABLED: 'true' };
  assert.equal(getConfig(env).versionId, 'version_website');
  assert.throws(() => getConfig({ ...env, ELEVENLABS_AGENT_VERSION_ID: '' }), { status: 503 });
  assert.throws(() => getConfig({ ...env, VOICE_DEMO_ENABLED: 'false' }), { status: 503 });
});

test('quota checks fail closed below the free allowance reserve', () => {
  assert.doesNotThrow(() => checkQuota({character_limit:10000,character_count:8000}));
  assert.throws(() => checkQuota({character_limit:10000,character_count:9000}), {status:429});
  assert.throws(() => checkQuota({}), {status:429});
});

test('provider diagnostics distinguish failures without exposing credentials, queries or response bodies', async () => {
  for (const [name, kind] of [['TimeoutError', 'timeout'], ['TypeError', 'network']]) {
    const api = provider({ key: 'secret-key' }, async () => { throw Object.assign(new Error('sensitive upstream details'), { name }); });
    await assert.rejects(api('/v1/convai/conversations', { user_id: 'private-visitor' }, 'visitor_history'), error => {
      assert.equal(error.diagnostic.kind, kind);
      assert.equal(error.diagnostic.stage, 'visitor_history');
      assert.ok(error.diagnostic.elapsedMs >= 0);
      assert.doesNotMatch(JSON.stringify(error), /secret-key|private-visitor|sensitive upstream/);
      return true;
    });
  }
  const denied = provider({}, async () => ({ ok: false, status: 401 }));
  await assert.rejects(denied('/v1/user/subscription', {}, 'subscription'), error => error.diagnostic.providerStatus === 401 && error.diagnostic.kind === 'http');
  const malformed = provider({}, async () => ({ ok: true, status: 200, json() { throw new Error('private body'); } }));
  await assert.rejects(malformed('/token', {}, 'untrusted-secret-label'), error => error.diagnostic.kind === 'invalid_json' && error.diagnostic.stage === 'provider_request');
});

function analyzed(values) {
  return { analysis: { data_collection_results: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }])) } };
}

test('side-effect summary names the stated medication and previews scheduling only with consent', () => {
  for (const [medication, name] of [['glp1', 'GLP-1'], ['ozempic', 'Ozempic'], ['metformin', 'metformin'], ['amoxicillin', 'amoxicillin']]) {
    const result = publicResult(analyzed({ barrier: 'side_effects', medication, clinical_routing: 'accepted' }));
    assert.equal(result.barrier, `Reported ${name} side effect`);
    assert.equal(result.team, 'Automatic scheduling');
    assert.equal(result.schedulingPreview, true);
    assert.match(result.next, /clinical care team’s availability/);
    assert.match(result.next, /Demo preview only — no appointment has been booked/);
  }
});

test('declined, unanswered and missing consent never become a scheduling preview', () => {
  for (const clinical_routing of ['declined', 'unclear', 'not_discussed', undefined, 'booked']) {
    const result = publicResult(analyzed({ barrier: 'side_effects', clinical_routing }));
    assert.equal(result.schedulingPreview, false);
    assert.doesNotMatch(result.team, /Automatic scheduling/);
    if (clinical_routing === 'declined') assert.match(result.team, /declined/);
    else assert.match(result.next, /Permission for follow-up was not confirmed/);
  }
  assert.equal(publicResult(analyzed({ barrier: 'coverage', clinical_routing: 'accepted' })).schedulingPreview, false);
});

test('emergency routing overrides routine follow-up even when classification is logistical', () => {
  const result = publicResult(analyzed({ barrier: 'coverage', review_team: 'pharmacy_support', clinical_routing: 'emergency' }));
  assert.equal(result.schedulingPreview, false);
  assert.equal(result.team, 'Immediate medical help');
  assert.match(result.next, /local emergency services/);
});

test('unknown medication or malicious analysis stays generic and never leaks free text', () => {
  for (const medication of ['other', 'unknown', undefined, '__proto__', 'constructor', '<script>private name</script>']) {
    const result = publicResult(analyzed({ barrier: 'side_effects', medication }));
    assert.equal(result.barrier, 'Reported medication side effect');
    assert.doesNotMatch(JSON.stringify(result), /private name|<script>|__proto__|GLP-1/);
  }
});
