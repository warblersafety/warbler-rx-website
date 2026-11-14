import { getPhoneConfig } from '../../lib/voice-phone.js';

export function createConfigHandler({ env = process.env } = {}) {
  return function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
    let phoneEnabled = false;
    let verificationRequired = false;
    try { verificationRequired = getPhoneConfig(env).verificationRequired; phoneEnabled = true; } catch { /* Never expose configuration details. */ }
    return res.status(200).json({ phoneEnabled, verificationRequired });
  };
}

export default createConfigHandler();
