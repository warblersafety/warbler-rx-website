export function normalizeDemoPhone(value) {
  const phone = String(value || '').replace(/[\s().-]/g, '');
  return /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone) ? phone : null;
}

export function initMockEhr({ document = globalThis.document, fetch = globalThis.fetch, now = Date.now, setTimeout = globalThis.setTimeout } = {}) {
  const $ = id => document.getElementById(id);
  const form = $('mock-ehr-form');
  let verifiedPhone = null;
  let pending = false;
  let browserBusy = false;
  let phoneEnabled = false;
  let verificationRequired = true;
  let callRequested = false;
  let resendAfter = 0;
  let phoneCooldownUntil = 0;
  const modeTabs = [$('browser-mode-tab'), $('phone-mode-tab')];

  function getEhrContext(channel = 'browser') {
    if (channel === 'browser' && (pending || now() < phoneCooldownUntil)) {
      throw new Error(pending ? 'Finish the phone request before starting a browser conversation.' : 'Please allow 2½ minutes for the phone demo before starting in this browser.');
    }
    if (!form.reportValidity()) {
      const error = new Error('Invalid mock record');
      error.demoMessage = 'Add a fictional patient first name before starting.';
      throw error;
    }
    return Object.fromEntries(['patientName', 'reason', 'medication', 'lastVisit', 'nextAppointment', 'notes'].map(name => [name, form.elements.namedItem(name).value.trim()]));
  }
  function setRecordBusy(busy) {
    $('ehr-fields').disabled = busy;
    $('ehr-reset').disabled = busy;
    $('ehr-record-state').textContent = busy ? 'Using this record for your conversation' : callRequested ? 'Record sent with your demo call' : 'Ready for your conversation';
  }
  function sync() {
    const phoneBlockingBrowser = pending || now() < phoneCooldownUntil;
    document.querySelectorAll('[data-start-demo]').forEach(button => { button.disabled = browserBusy || phoneBlockingBrowser; });
    $('browser-phone-wait').hidden = !phoneBlockingBrowser;
    $('browser-phone-wait').textContent = pending ? 'Finish the phone request before starting a browser conversation.' : 'Please allow 2½ minutes for the phone demo before starting in this browser.';
    $('phone-fields').disabled = pending || browserBusy || !phoneEnabled || callRequested;
    $('call-phone').disabled = pending || browserBusy || !phoneEnabled || callRequested || !normalizeDemoPhone($('demo-phone').value) || (verificationRequired && verifiedPhone !== normalizeDemoPhone($('demo-phone').value)) || !$('phone-consent').checked;
    modeTabs.forEach(tab => { tab.disabled = pending || browserBusy; });
    setRecordBusy(browserBusy || pending);
  }
  function setBrowserBusy(busy) { browserBusy = busy; sync(); }
  function selectMode(index, focus = false) {
    if (pending || browserBusy) return;
    modeTabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      $(tab.getAttribute('aria-controls')).hidden = i !== index;
    });
    if (focus) modeTabs[index].focus();
  }
  modeTabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectMode(i));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      selectMode(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - i, true);
    });
  });
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', () => { $('ehr-record-state').textContent = 'Changes apply to your next conversation'; });
  $('ehr-reset').addEventListener('click', () => { form.reset(); $('ehr-record-state').textContent = 'Example restored'; });

  function showError(message) { $('phone-error').textContent = message; $('phone-error').hidden = false; }
  function clearError() { $('phone-error').hidden = true; }
  function getPhone() {
    const phone = normalizeDemoPhone($('demo-phone').value);
    if (!phone) { $('demo-phone').focus(); throw new Error('Enter a US or Canada phone number with +1, such as +1 415 555 0123.'); }
    if (!$('phone-consent').checked) { $('phone-consent').focus(); throw new Error('Confirm that you control this number and agree to the demo call.'); }
    return phone;
  }
  async function post(path, body) {
    const response = await fetch(path, {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal:AbortSignal.timeout(55000)});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || 'This request could not be completed. Please try again.');
    return data;
  }
  $('demo-phone').addEventListener('input', () => {
    verifiedPhone = null;
    callRequested = false;
    $('phone-code').value = '';
    $('phone-code-step').hidden = true;
    $('phone-status').textContent = '';
    sync();
  });
  $('phone-consent').addEventListener('change', sync);
  $('send-phone-code').addEventListener('click', async () => {
    if (pending || browserBusy || !phoneEnabled) return;
    clearError();
    try {
      const phone = getPhone();
      if (now() < resendAfter) throw new Error('Please wait 30 seconds before requesting another code.');
      pending = true; sync();
      $('phone-status').textContent = 'Sending your verification code…';
      await post('/api/voice/verify', {phone, action:'send'});
      resendAfter = now() + 30000;
      verifiedPhone = null;
      $('phone-code-step').hidden = false;
      $('phone-status').textContent = 'Code sent. Enter it below to verify your number.';
      $('send-phone-code').textContent = 'Resend code';
    } catch(error) { $('phone-status').textContent = ''; showError(error.name === 'TimeoutError' ? 'Verification is taking longer than expected. Check your messages before trying again.' : error.message); }
    finally { pending = false; sync(); if (!$('phone-code-step').hidden) $('phone-code').focus(); }
  });
  $('verify-phone-code').addEventListener('click', async () => {
    if (pending || browserBusy || !phoneEnabled) return;
    clearError();
    try {
      const phone = getPhone();
      const code = $('phone-code').value.trim();
      if (!/^\d{4,10}$/.test(code)) throw new Error('Enter the verification code from your text message.');
      pending = true; sync();
      $('phone-status').textContent = 'Verifying your number…';
      const result = await post('/api/voice/verify', {phone, action:'check', code});
      if (result.verified !== true) throw new Error('That code could not be verified. Check the code and try again.');
      verifiedPhone = phone;
      $('phone-code-step').hidden = true;
      $('phone-status').textContent = 'Number verified. Press “Call me” when you’re ready.';
    } catch(error) { $('phone-status').textContent = ''; showError(error.message); }
    finally { pending = false; sync(); if (verifiedPhone) $('call-phone').focus(); }
  });
  $('phone-demo-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || browserBusy || !phoneEnabled || callRequested) return;
    clearError();
    try {
      const phone = getPhone();
      if (verificationRequired && verifiedPhone !== phone) throw new Error('Verify your phone number before requesting a call.');
      const ehr = getEhrContext('phone');
      pending = true; sync();
      $('phone-status').textContent = 'Requesting your call…';
      const result = await post('/api/voice/call', {phone, ehr, consent:true});
      // A successful response acknowledges a queued call, not a connected call.
      callRequested = true;
      phoneCooldownUntil = now() + 150000;
      setTimeout(sync, 150000);
      $('phone-status').textContent = result.message || 'Your demo call has been requested. Keep your phone nearby; it may ring from an unfamiliar number.';
      $('call-phone').textContent = 'Call requested';
      $('ehr-record-state').textContent = 'Record sent with your demo call';
    } catch(error) {
      $('phone-status').textContent = '';
      // Verification proofs are single use, including a failed provider attempt.
      if (pending && verificationRequired) verifiedPhone = null;
      showError(error.name === 'TimeoutError' || error.name === 'TypeError' ? 'We couldn’t confirm the call request. Check your phone before trying again to avoid a duplicate call.' : error.demoMessage || error.message);
    } finally { pending = false; sync(); }
  });
  fetch('/api/voice/config', {credentials:'same-origin', signal:AbortSignal.timeout(10000)})
    .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
    .then(config => {
      phoneEnabled = config.phoneEnabled === true;
      verificationRequired = config.verificationRequired !== false;
      $('send-phone-code').hidden = !phoneEnabled || !verificationRequired;
      $('phone-consent-copy').textContent = verificationRequired ? 'I control this number and agree to a verification text and one AI-generated demo call when I press “Call me.”' : 'I control this number and agree to one AI-generated demo call when I press “Call me.”';
      $('phone-availability').textContent = phoneEnabled ? `Available in the US and Canada. Up to 2 minutes. Standard call${verificationRequired ? ' and text' : ''} rates may apply.` : 'Phone calls are temporarily unavailable. Try the browser conversation instead.';
      sync();
    })
    .catch(() => { $('phone-availability').textContent = 'Phone calls are temporarily unavailable. Try the browser conversation instead.'; sync(); });
  return {getEhrContext, setBrowserBusy};
}
