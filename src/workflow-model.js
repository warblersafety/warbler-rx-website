// This public workspace is intentionally in memory. It never writes to clinic records.
// Only the server's reviewed analysis labels, not live transcript guesses, drive it.
export const examples = {
  transport: {
    label: 'A ride falls through',
    quote: '“My ride fell through. Could the clinic help me figure out how to get there?”',
    barrier: 'Transportation to clinic',
    discovery: { painPoint: 'Transportation to the clinic fell through', route: 'Clinic care coordinator', remaining: 'Transportation options still need clinic review', handoffPermission: 'accepted', resolved: false },
  },
  schedule: {
    label: 'A new work schedule',
    quote: '“My new shift overlaps with my visits. Yes, I’d like help finding another time.”',
    barrier: 'Work or caregiving conflict',
    discovery: { painPoint: 'Work or caregiving conflicts with clinic attendance', route: 'Clinic scheduling team', remaining: 'Appointment availability still needs review', handoffPermission: 'accepted', resolved: false },
  },
  pharmacy: {
    label: 'A pharmacy delay',
    quote: '“The pharmacy is waiting on a renewal. I have medication left. Can someone help check?”',
    barrier: 'Refill or renewal delays',
    discovery: { painPoint: 'New prescription or renewal needed', route: 'Prescribing office', remaining: 'A prescription renewal is still needed', handoffPermission: 'accepted', resolved: false },
  },
};

const step = (title, description, state = 'pending', status = 'Waiting') => ({ title, description, state, status });
export function waitingSteps() {
  return [
    step('Have the conversation', 'Talk about a fictional barrier to treatment.'),
    step('Summarize what matters', 'Identify the concern and what still needs help.'),
    step('Check permission', 'Keep the patient’s choice attached to the next step.'),
    step('Create a care request', 'Give the right team a clear request to review.'),
    step('Keep follow-up visible', 'Show what is waiting for the care team.'),
  ];
}

export function workflowFromResult(result) {
  const steps = waitingSteps();
  steps[0] = step('Conversation complete', 'The conversation has ended.', 'complete', 'Complete');
  const discovery = result?.discovery;
  if (!discovery) {
    steps[1] = step('Analysis unavailable', 'No care request can be created without the conversation analysis.', 'held', 'Unavailable');
    return { steps, request: null, title: 'Analysis is unavailable', announcement: 'Analysis unavailable. No demo request created.' };
  }
  steps[1] = step('Concern summarized', discovery.painPoint, 'complete', 'Analyzed');
  const emergency = discovery.route === 'Immediate medical help' || result.support?.status === 'urgent';
  if (emergency) {
    steps[2] = step('Immediate help needed', 'This demo cannot arrange emergency care.', 'held', 'Urgent');
    steps[3] = step('No routine request created', 'An urgent concern is not placed in an ordinary follow-up queue.', 'held', 'Not created');
    steps[4] = step('Use real-world help', 'Follow the emergency guidance from the conversation. Do not wait for this demo.', 'held', 'Action needed');
    return { steps, request: null, title: 'Immediate help is needed', announcement: 'Immediate help needed. This demo cannot arrange care.' };
  }
  const noFollowUp = discovery.resolved || discovery.route === 'No staff follow-up identified';
  const permission = discovery.handoffPermission;
  const consentText = { accepted: 'Staff follow-up was agreed in the conversation.', declined: 'The patient declined staff follow-up.', unclear: 'Permission for staff follow-up was not confirmed.', not_discussed: 'Staff follow-up was not discussed.' };
  steps[2] = step('Patient choice recorded', consentText[permission] || consentText.unclear, permission === 'accepted' ? 'complete' : 'held', permission === 'accepted' ? 'Agreed' : permission === 'declined' ? 'Declined' : 'Not confirmed');
  const knownOwner = discovery.route && discovery.route !== 'More information needed';
  // Reminder or text acceptance never grants staff-handoff permission. Clinical
  // permission has already been reconciled separately by discoveryResult on the server.
  const eligible = permission === 'accepted' && knownOwner && !noFollowUp;
  if (!eligible) {
    const reason = noFollowUp ? 'No staff follow-up was identified for the reported concern.' : permission !== 'accepted' ? 'A care request needs the patient’s agreement.' : 'The next team still needs to be established.';
    steps[3] = step('No care request created', reason, 'held', 'Not created');
    steps[4] = step('Keep the outcome visible', noFollowUp ? discovery.outcome || 'No further support requested.' : 'The conversation remains a summary; no staff are contacted.', 'held', noFollowUp ? 'No follow-up' : 'On hold');
    return { steps, request: null, title: noFollowUp ? 'No staff follow-up was identified' : permission === 'declined' ? 'The patient’s choice comes first' : 'More information is needed before follow-up', announcement: 'Conversation analyzed. No demo care request created.' };
  }
  const request = {
    title: result.clinicalOnly ? 'Clinical review requested' : result.barrier?.replace(/^Barrier ID:\s*/i, '') || 'Care-team review requested',
    body: discovery.painPoint,
    owner: discovery.route,
    status: 'Needs attention · awaiting review',
    note: discovery.remaining,
  };
  steps[3] = step('Demo care request created', `For: ${request.owner}`, 'complete', 'Created in demo');
  steps[4] = step('Awaiting care-team review', 'The demo record is marked “Needs attention.” A person would review the request next.', 'held', 'Pending review');
  return { steps, request, title: 'A clear next step for the care team', announcement: 'Demo care request created. Awaiting care-team review. No staff have been contacted.' };
}
