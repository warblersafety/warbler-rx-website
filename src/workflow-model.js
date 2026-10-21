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
    step('Hear the barrier', 'Understand what is getting in the way.'),
    step('Agree on a next step', 'Confirm the support the patient agrees to.'),
    step('Create the care request', 'Summarize the need and identify the right team.'),
    step('Track the follow-up', 'Keep remaining work visible for the team to review.'),
  ];
}

// These are the reviewed routes emitted by the server, plus the three examples.
// An arbitrary nonempty label is not enough to establish an owner.
const careTeams = new Set([
  'Clinic care coordinator', 'Clinic scheduling team', 'Prescribing office',
  'Clinical care team', 'Clinic financial support', 'Clinic insurance support',
  'Insurance authorization team', 'Pharmacy refill support', 'Pharmacy inventory team',
  'Fulfillment support', 'Pharmacy access support', 'Clinic care team',
  'Clinic access team', 'Clinic privacy contact', 'Clinic support', 'Pharmacy support',
]);

export function workflowFromResult(result) {
  const steps = waitingSteps();
  const update = (index, description, state, status) => {
    steps[index] = { ...steps[index], description, state, status };
  };
  const discovery = result?.discovery;
  if (!discovery || typeof discovery !== 'object') {
    update(0, 'The conversation could not be reviewed.', 'held', 'Unavailable');
    update(2, 'No analysis; no care request created.', 'held', 'Not created');
    update(3, 'No staff have been contacted by this demo.', 'held', 'No follow-up');
    return { steps, request: null, title: 'Analysis unavailable', announcement: 'Analysis unavailable. No demo request created.' };
  }
  update(0, discovery.painPoint || 'The specific concern was not established.', 'complete', 'Reviewed');
  const emergency = discovery.route === 'Immediate medical help' || result.support?.status === 'urgent';
  if (emergency) {
    update(1, 'Immediate help is needed. This demo cannot arrange emergency care.', 'held', 'Urgent');
    update(2, 'No routine request created for an urgent concern.', 'held', 'Not created');
    update(3, 'Follow the conversation’s emergency guidance. Do not wait for this demo.', 'held', 'Action needed');
    return { steps, request: null, title: 'Immediate help needed', announcement: 'Immediate help needed. This demo cannot arrange care.' };
  }
  const noFollowUp = discovery.resolved === true || discovery.route === 'No staff follow-up identified';
  const permission = discovery.handoffPermission;
  const consentText = { accepted: 'Staff follow-up accepted.', declined: 'Staff follow-up declined.', unclear: 'Staff follow-up permission not confirmed.', not_discussed: 'Staff follow-up not discussed.' };
  update(1, consentText[permission] || consentText.unclear, permission === 'accepted' ? 'complete' : 'held', permission === 'accepted' ? 'Agreed' : permission === 'declined' ? 'Declined' : 'Not confirmed');
  const knownOwner = careTeams.has(discovery.route) && (!result.clinicalOnly || discovery.route === 'Clinical care team');
  // Reminder or text acceptance never grants staff-handoff permission. Clinical
  // permission has already been reconciled separately by discoveryResult on the server.
  const eligible = permission === 'accepted' && knownOwner && discovery.resolved === false && !noFollowUp;
  if (!eligible) {
    const reason = noFollowUp ? 'No staff follow-up identified.' : permission !== 'accepted' ? 'Patient agreement is required before a request can be created.' : !knownOwner ? 'The care team has not been identified.' : 'The need for follow-up has not been established.';
    update(2, reason, 'held', 'Not created');
    update(3, noFollowUp ? discovery.outcome || 'No further follow-up identified in the review.' : 'Summary only; no staff have been contacted.', 'held', noFollowUp ? 'No follow-up' : 'On hold');
    return { steps, request: null, title: noFollowUp ? 'No follow-up identified' : permission === 'declined' ? 'Follow-up declined' : 'Follow-up on hold', announcement: 'Conversation analyzed. No demo care request created.' };
  }
  const request = {
    title: result.clinicalOnly || discovery.route === 'Clinical care team' ? 'Clinical review requested' : result.barrier?.replace(/^Barrier ID:\s*/i, '') || 'Care-team review requested',
    body: discovery.painPoint,
    owner: discovery.route,
    status: 'Demo · awaiting review',
    note: discovery.remaining || 'Remaining work needs care-team review.',
  };
  update(1, `Staff follow-up with ${discovery.route.toLowerCase()} accepted.`, 'complete', 'Agreed');
  update(2, `A demo request is prepared for ${discovery.route.toLowerCase()}.`, 'complete', 'Created in demo');
  update(3, `${request.note.replace(/[.!?]\s*$/, '')}. No staff have been contacted by this demo.`, 'held', 'Pending review');
  return { steps, request, title: 'Care request ready', announcement: 'Demo care request created. Awaiting care-team review. No staff have been contacted.' };
}
