import { buildCall, checkAllowance, checkQuota, checkRequest, DemoError, fingerprint, getConfig, provider, respondError, signReceipt } from '../../lib/voice-server.js';
// Supplement provider-enforced agent limits; not a distributed per-IP guarantee.
const starting = new Set();
const attempts = new Map();
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let visitor; let ownsLock = false;
  try {
    checkRequest(req);
    const config = getConfig();
    visitor = fingerprint(req, config.secret);
    const request = buildCall(req.body.scenarioId, config, visitor);
    if (starting.has(visitor)) throw new DemoError(409, 'Your GLP-1 conversation is already connecting.');
    const now=Date.now();
    for(const [id,times] of attempts){const recent=times.filter(t=>now-t<3600_000);if(recent.length)attempts.set(id,recent);else attempts.delete(id);}
    if((attempts.get(visitor)?.length || 0)>=3) throw new DemoError(429, 'You’ve tried three GLP-1 conversations this hour. Please try again later.');
    starting.add(visitor); ownsLock = true;
    const api = provider(config);
    const filter = { agent_id: config.agentId, call_start_after_unix: Math.floor((now-86400_000)/1000), page_size:100 };
    const [history, own, quota] = await Promise.all([api('/v1/convai/conversations', filter), api('/v1/convai/conversations', {...filter,user_id:visitor}),api('/v1/user/subscription')]);
    checkQuota(quota);
    checkAllowance(history.conversations, own.conversations, config.dailyLimit, now);
    const call = await api('/v1/convai/conversation/token', request);
    if(!call.token || !call.conversation_id) throw new Error('Invalid session response');
    attempts.set(visitor,[...(attempts.get(visitor)||[]),now]);
    console.info(JSON.stringify({ event: 'voice_demo_created', scenario: req.body.scenarioId, provider:'elevenlabs' }));
    return res.status(200).json({ token:call.token, userId:visitor, scenarioId:req.body.scenarioId, receipt:signReceipt(call.conversation_id,config.secret) });
  } catch (error) { return respondError(res, error, 'start'); }
  finally { if (ownsLock) starting.delete(visitor); }
}
