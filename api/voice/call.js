import { checkAllowance, checkQuota, checkRequest, DemoError, provider, respondError, signReceipt } from '../../lib/voice-server.js';
import { getAdmissionConfig, identifyVisitor, reserveAdmission } from '../../lib/voice-limits.js';
import { ehrDynamicVariables, sanitizeEhr } from '../../lib/mock-ehr.js';
import { appendPhoneCookie, consumePhoneProof, getPhoneConfig, normalizePhone, reservePhoneRecipient, startPhoneCall, verifyPhoneProof } from '../../lib/voice-phone.js';

export function createCallHandler({ env = process.env, fetchRequest = globalThis.fetch, admissionQuery } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      checkRequest(req, env);
      const config = getPhoneConfig(env);
      if (req.body.consent !== true) throw new DemoError(400, 'Confirm that this is your number and you agree to receive an AI demo call.');
      const phone = normalizePhone(req.body.phone);
      const ehr = sanitizeEhr(req.body.ehr);
      const identity = identifyVisitor(req, res, config.secret, env);
      const proof = config.verificationRequired ? verifyPhoneProof(req, phone, identity.visitor, config.secret) : null;
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
      if (proof) {
        await consumePhoneProof(proof, config, identity, admissionConfig, admissionQuery);
        appendPhoneCookie(res, '', 0);
      }
      await reserveAdmission(config, identity, admissionConfig, admissionQuery);
      await reservePhoneRecipient(config, identity, phone, admissionConfig, admissionQuery);
      const conversationId = await startPhoneCall(config, identity, phone, ehrDynamicVariables(ehr), fetchRequest);
      return res.status(200).json({ status: 'initiated', message: 'Your demo call has been requested. Keep your phone nearby; it may ring from an unfamiliar number.', receipt: signReceipt(conversationId, config.secret) });
    } catch (error) { return respondError(res, error, 'phone_call'); }
  };
}

export default createCallHandler();
