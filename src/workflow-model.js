// This public workspace is intentionally in memory. It never writes to clinic records.
// Only the server's reviewed analysis labels, not live transcript guesses, drive it.
export const examples = {
  transport: {
    label: 'A ride falls through',
    quote: '“My ride fell through. Can the clinic help?”',
    barrier: 'Transportation to clinic',
    discovery: { painPoint: 'Transportation to the clinic fell through', route: 'Clinic care coordinator', remaining: 'Transportation options still need clinic review', handoffPermission: 'accepted', resolved: false },
  },
  schedule: {
    label: 'A new work schedule',
    quote: '“My new shift overlaps with my visits. I’d like help finding another time.”',
    barrier: 'Work or caregiving conflict',
    discovery: { painPoint: 'Work or caregiving conflicts with clinic attendance', route: 'Clinic scheduling team', remaining: 'Appointment availability still needs review', handoffPermission: 'accepted', resolved: false },
  },
  pharmacy: {
    label: 'A pharmacy delay',
    quote: '“I’m waiting on a renewal. I have medication left. Can someone check?”',
    barrier: 'Refill or renewal delays',
    discovery: { painPoint: 'New prescription or renewal needed', route: 'Prescribing office', remaining: 'A prescription renewal is still needed', handoffPermission: 'accepted', resolved: false },
  },
};

const step = (title, description, state = 'pending', status = 'Waiting') => ({ title, description, state, status });
export function waitingSteps() {
  return [
    step('Talk', ''),
    step('Summarize the concern', ''),
    step('Confirm permission', ''),
    step('Create a care request', ''),
    step('Await review', ''),
  ];
}

export function workflowFromResult(result) {
  const steps = waitingSteps();
  steps[0] = step('Conversation complete', '', 'complete', 'Complete');
  const discovery = result?.discovery;
  if (!discovery) {
    steps[1] = step('Analysis unavailable', 'No analysis; no care request created.', 'held', 'Unavailable');
    return { steps, request: null, title: 'Analysis unavailable', announcement: 'Analysis unavailable. No demo request created.' };
  }
  steps[1] = step('Concern summarized', discovery.painPoint, 'complete', 'Analyzed');
  const emergency = discovery.route === 'Immediate medical help' || result.support?.status === 'urgent';
  if (emergency) {
    steps[2] = step('Immediate help needed', 'This demo cannot arrange emergency care.', 'held', 'Urgent');
    steps[3] = step('No routine request created', 'Urgent concerns need immediate help.', 'held', 'Not created');
    steps[4] = step('Get help now', 'Follow the conversation’s emergency guidance. Do not wait for this demo.', 'held', 'Action needed');
    return { steps, request: null, title: 'Immediate help needed', announcement: 'Immediate help needed. This demo cannot arrange care.' };
  }
  const noFollowUp = discovery.resolved || discovery.route === 'No staff follow-up identified';
  const permission = discovery.handoffPermission;
  const consentText = { accepted: 'Staff follow-up accepted.', declined: 'Staff follow-up declined.', unclear: 'Staff follow-up permission not confirmed.', not_discussed: 'Staff follow-up not discussed.' };
  steps[2] = step('Permission recorded', consentText[permission] || consentText.unclear, permission === 'accepted' ? 'complete' : 'held', permission === 'accepted' ? 'Agreed' : permission === 'declined' ? 'Declined' : 'Not confirmed');
  const knownOwner = discovery.route && discovery.route !== 'More information needed';
  // Reminder or text acceptance never grants staff-handoff permission. Clinical
  // permission has already been reconciled separately by discoveryResult on the server.
  const eligible = permission === 'accepted' && knownOwner && !noFollowUp;
  if (!eligible) {
    const reason = noFollowUp ? 'No staff follow-up identified.' : permission !== 'accepted' ? 'Patient agreement required.' : 'Care team not yet identified.';
    steps[3] = step('No care request created', reason, 'held', 'Not created');
    steps[4] = step('Outcome recorded', noFollowUp ? discovery.outcome || 'No further support requested.' : 'Summary only; no staff contacted.', 'held', noFollowUp ? 'No follow-up' : 'On hold');
    return { steps, request: null, title: noFollowUp ? 'No follow-up identified' : permission === 'declined' ? 'Follow-up declined' : 'Follow-up on hold', announcement: 'Conversation analyzed. No demo care request created.' };
  }
  const request = {
    title: result.clinicalOnly ? 'Clinical review requested' : result.barrier?.replace(/^Barrier ID:\s*/i, '') || 'Care-team review requested',
    body: discovery.painPoint,
    owner: discovery.route,
    status: 'Demo · awaiting review',
    note: discovery.remaining,
  };
  steps[1].description = '';
  steps[2] = step('Staff follow-up accepted', '', 'complete', 'Agreed');
  steps[3] = step('Demo care request created', '', 'complete', 'Created in demo');
  steps[4] = step('Awaiting care-team review', '', 'held', 'Pending review');
  return { steps, request, title: 'Care request ready', announcement: 'Demo care request created. Awaiting care-team review. No staff have been contacted.' };
}
