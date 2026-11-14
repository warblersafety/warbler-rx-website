import { DemoError } from './voice-server.js';

export const ehrReasons = Object.freeze({
  missed_visit: 'Check in after a missed clinic visit',
  medication_access: 'Check in about getting medication',
  appointment_followup: 'Follow up before an upcoming appointment',
  returning_to_care: 'Support a return to care',
});

export const defaultEhr = Object.freeze({ patientName: 'Alex Morgan', reason: 'missed_visit',
  medication: 'Buprenorphine', lastVisit: 'Missed the last two visits',
  nextAppointment: 'Tuesday at 10:00 AM', notes: 'Work schedule changed. Getting to the clinic has been difficult.' });

export function sanitizeEhr(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DemoError(400, 'Please complete the fictional patient record.');
  const result = {};
  for (const [field, max] of Object.entries({ patientName: 60, medication: 100, lastVisit: 80, nextAppointment: 80, notes: 500 })) {
    if (typeof input[field] !== 'string' || input[field].length > max) throw new DemoError(400, 'Please keep the fictional record within the field limits.');
    result[field] = input[field].replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  if (!result.patientName || !Object.hasOwn(ehrReasons, input.reason)) throw new DemoError(400, 'Please enter a fictional name and choose a reason for outreach.');
  result.reason = input.reason;
  return result;
}

export function ehrDynamicVariables(ehr) {
  return { scenario_id: 'open', mock_ehr: JSON.stringify({ ...ehr, reason: ehrReasons[ehr.reason] }) };
}
