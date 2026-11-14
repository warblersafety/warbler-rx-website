import { checkRequest, DemoError, respondError } from '../../lib/voice-server.js';
import { getAdmissionConfig, identifyVisitor } from '../../lib/voice-limits.js';
import { appendPhoneCookie, getVerifyConfig, makePhoneProof, normalizePhone, reservePhoneAttempt, twilioVerify } from '../../lib/voice-phone.js';

export function createVerifyHandler({ env = process.env, fetchRequest = globalThis.fetch, admissionQuery } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      checkRequest(req, env);
      const config = getVerifyConfig(env);
      const phone = normalizePhone(req.body.phone);
      const action = req.body.action;
      if (!['send', 'check'].includes(action)) throw new DemoError(400, 'Choose a phone verification action.');
      if (action === 'check' && (typeof req.body.code !== 'string' || !/^\d{4,10}$/.test(req.body.code))) throw new DemoError(400, 'Enter the verification code from your text message.');
      const identity = identifyVisitor(req, res, config.secret, env);
      const admissionConfig = getAdmissionConfig(env);
      await reservePhoneAttempt(action, config, identity, phone, admissionConfig, admissionQuery);
      await twilioVerify(config, phone, action, req.body.code, fetchRequest);
      if (action === 'send') {
        appendPhoneCookie(res, '', 0);
        return res.status(200).json({ status: 'pending' });
      }
      appendPhoneCookie(res, makePhoneProof(phone, identity.visitor, config.secret));
      return res.status(200).json({ verified: true });
    } catch (error) { return respondError(res, error, 'phone_verify'); }
  };
}

export default createVerifyHandler();
