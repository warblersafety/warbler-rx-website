import { buildCall, checkAllowance, checkQuota, checkRequest, getConfig, provider, respondError, signReceipt, validateSignedSession } from '../../lib/voice-server.js';
import { getAdmissionConfig, identifyVisitor, reserveAdmission } from '../../lib/voice-limits.js';

export function createStartHandler({ env = process.env, fetchRequest = globalThis.fetch, admissionQuery } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      checkRequest(req, env);
      const config = getConfig(env);
      const identity = identifyVisitor(req, res, config.secret, env);
      const request = buildCall(req.body.scenarioId, config, identity.visitor);
      const admissionConfig = getAdmissionConfig(env);
      const api = provider(config, fetchRequest);
      const now = Date.now();
      const filter = { agent_id: config.agentId, call_start_after_unix: Math.floor((now - 86400_000) / 1000), page_size: 100 };
      const [history, own, quota] = await Promise.all([
        api('/v1/convai/conversations', filter, 'history'),
        api('/v1/convai/conversations', { ...filter, user_id: identity.visitor }, 'visitor_history'),
        api('/v1/user/subscription', {}, 'subscription'),
      ]);
      checkQuota(quota);
      checkAllowance(history.conversations, own.conversations, config.dailyLimit, now);
      // The shared database atomically reserves all daily limits before any token
      // can be issued. Provider history and browser user_id are supplementary only.
      await reserveAdmission(config, identity, admissionConfig, admissionQuery);
      const call = await api('/v1/convai/conversation/get-signed-url', request, 'session_token');
      const session = validateSignedSession(call, config);
      console.info(JSON.stringify({ event: 'voice_demo_created', scenario: req.body.scenarioId, provider: 'elevenlabs' }));
      return res.status(200).json({ signedUrl: session.signedUrl, userId: identity.visitor, scenarioId: req.body.scenarioId, receipt: signReceipt(session.conversationId, config.secret) });
    } catch (error) { return respondError(res, error, 'start'); }
  };
}

export default createStartHandler();
