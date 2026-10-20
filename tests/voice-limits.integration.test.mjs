import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { reserveAdmission } from '../lib/voice-limits.js';

// Opt in with a dedicated test database URL. Every fixture uses a random test-only
// agent key and removes only that key; this never consumes an ElevenLabs session.
const databaseUrl = process.env.VOICE_LIMIT_TEST_DATABASE_URL;
const hash = value => createHash('sha256').update(value).digest('hex');
const identity = (visitor, network = visitor) => ({ visitor: hash(`visitor:${visitor}`), network: hash(`network:${network}`) });

async function fixture(t) {
  const agentId = `admission_test_${randomUUID()}`;
  const sql = neon(databaseUrl);
  t.after(async () => { await sql.query('DELETE FROM voice_demo.admissions WHERE agent_id = $1', [agentId]); });
  const config = { agentId, versionId: 'version_a', dailyLimit: 10 };
  const reserve = (person, options = {}) => reserveAdmission({ ...config, ...options }, person, { databaseUrl });
  const entries = async () => (await sql.query('SELECT entries FROM voice_demo.admissions WHERE agent_id = $1', [agentId]))[0]?.entries || [];
  const seed = async (people, ages) => {
    const rows = people.map((person, index) => ({ ...person, age: ages[index] }));
    await sql.query(`INSERT INTO voice_demo.admissions(agent_id, entries)
      SELECT $1, jsonb_agg(jsonb_build_object('visitor', item->>'visitor', 'network', item->>'network',
        'at', floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint - (item->>'age')::bigint))
      FROM jsonb_array_elements($2::jsonb) AS item
      ON CONFLICT (agent_id) DO UPDATE SET entries = EXCLUDED.entries`, [agentId, JSON.stringify(rows)]);
  };
  return { reserve, entries, seed };
}

test('real database atomically admits at most ten concurrent starts across independent clients and versions', { skip: !databaseUrl }, async t => {
  const { reserve, entries } = await fixture(t);
  const results = await Promise.allSettled(Array.from({ length: 24 }, (_, i) => reserve(identity(String(i)), { versionId: `version_${i}`, dailyLimit: 99 })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 10);
  for (const result of results.filter(result => result.status === 'rejected')) {
    assert.equal(result.reason.status, 429); assert.ok(result.reason.retryAfter > 86300);
  }
  const stored = await entries(); assert.equal(stored.length, 10);
  assert.equal(new Set(stored.map(entry => entry.visitor)).size, 10);
  assert.deepEqual(Object.keys(stored[0]).sort(), ['at', 'network', 'visitor']);
});

test('real database atomically limits a visitor across changing networks to three starts', { skip: !databaseUrl }, async t => {
  const { reserve, entries } = await fixture(t);
  const results = await Promise.allSettled(Array.from({ length: 9 }, (_, i) => reserve(identity('same-visitor', String(i)))));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 3);
  assert.equal((await entries()).length, 3);
  for (const result of results.filter(result => result.status === 'rejected')) assert.equal(result.reason.status, 429);
});

test('real database atomically limits fresh browser identities on the same network to three starts', { skip: !databaseUrl }, async t => {
  const { reserve, entries } = await fixture(t);
  const results = await Promise.allSettled(Array.from({ length: 9 }, (_, i) => reserve(identity(String(i), 'shared-network'))));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 3);
  assert.equal((await entries()).length, 3);
  for (const result of results.filter(result => result.status === 'rejected')) assert.equal(result.reason.status, 429);
});

test('real database enforces rolling24h, uses database time, and retains reservations after reconnecting', { skip: !databaseUrl }, async t => {
  const { reserve, entries, seed } = await fixture(t);
  const person = identity('expiry-visitor');
  await seed([person, person, person], [23 * 3600000, 4 * 3600000, 3 * 3600000]);
  await assert.rejects(reserve(person), error => error.status === 429 && error.retryAfter > 3500 && error.retryAfter <= 3600);
  await seed([person, person, person], [86400001, 4 * 3600000, 3 * 3600000]);
  await reserve(person);
  assert.equal((await entries()).length, 3);
  await assert.rejects(reserve(person, { versionId: 'new-deployment-version' }), { status: 429 });
});

test('real database lower global cap computes retry for all excess reservations', { skip: !databaseUrl }, async t => {
  const { reserve, entries, seed } = await fixture(t);
  await seed(Array.from({ length: 5 }, (_, i) => identity(`lower-${i}`)), [23, 22, 21, 20, 19].map(hours => hours * 3600000));
  await assert.rejects(reserve(identity('new'), { dailyLimit: 3 }), error => error.status === 429 && error.retryAfter > 10700 && error.retryAfter <= 10800);
  assert.equal((await entries()).length, 5);
});
