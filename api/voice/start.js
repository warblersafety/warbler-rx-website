import { buildCall, checkAllowance, checkRequest, fingerprint, getConfig, provider, respondError, signReceipt } from '../../lib/voice-server.js';

// A short per-instance lock supplements durable provider history. It is not the
// sole limiter and must never be described as a distributed spending hard cap.
const starting = new Set();
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let visitor;
  let ownsLock = false;
  try {
    checkRequest(req);
    const config = getConfig();
    visitor = fingerprint(req, config.secret);
    const request = buildCall(req.body.scenarioId, config, visitor);
    if (starting.has(visitor)) return res.status(409).json({ error: 'Your GLP-1 conversation is already connecting.' });
    starting.add(visitor);
    ownsLock = true;
    const retell = provider(config);
    const history = await retell.call.list({ filter_criteria: { agent: [{ agent_id: config.agentId }] }, limit: 1000, sort_order: 'descending' });
    checkAllowance(history.items, visitor, config.dailyLimit);
    const call = await retell.call.createWebCall(request);
    console.info(JSON.stringify({ event: 'voice_demo_created', scenario: req.body.scenarioId }));
    return res.status(200).json({ call_id: call.call_id, access_token: call.access_token, transport: call.transport, url: call.url, ice_servers: call.ice_servers, expires_at: call.expires_at, receipt: signReceipt(call.call_id, config.secret) });
  } catch (error) { return respondError(res, error, 'start'); }
  finally { if (ownsLock) starting.delete(visitor); }
}
