import { checkRequest, DemoError, getConfig, provider, publicResult, respondError, verifyReceipt } from '../../lib/voice-server.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    checkRequest(req);
    const config = getConfig();
    const callId = verifyReceipt(req.body.receipt, config.secret);
    const call = await provider(config)('/v1/convai/conversations/' + encodeURIComponent(callId));
    if (call.agent_id !== config.agentId || call.version_id !== config.versionId) throw new DemoError(403, 'This demo summary is unavailable.');
    return res.status(200).json(publicResult(call));
  } catch (error) { return respondError(res, error, 'result'); }
}
