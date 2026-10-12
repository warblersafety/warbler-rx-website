// Enumerated extraction only. No generated patient text reaches the public website.
export const discoveryDefinitions = {
  pain_point: {
    description: 'Specific obstacle stated by the visitor, not the scenario or agent. Choose the primary concern, prioritizing symptoms or medication-use questions. cost_share = expensive after insurance; coverage_gap = lapsed/denied; authorization_pending; renewal_needed; refill_not_requested; stock_shortage; failed_delivery; pickup_access; routine_memory; treatment_doubts; restart_question; side_effect_impact; other; none only for explicit no concern. Unknown if not established. Honor corrections.',
    labels: { cost_share: 'High patient cost after insurance', coverage_gap: 'Coverage lapsed or denied', authorization_pending: 'Prior authorization pending', renewal_needed: 'New prescription or renewal needed', refill_not_requested: 'Refill request not yet made', stock_shortage: 'Medication unavailable at the pharmacy', failed_delivery: 'Delivery attempt or receipt problem', pickup_access: 'Difficulty getting to the pharmacy', routine_memory: 'Remembering the existing routine', treatment_doubts: 'Questions about whether treatment meets their goals', restart_question: 'Guidance needed after a treatment interruption', side_effect_impact: 'Symptoms affecting the treatment experience', other: 'Another concern needs clarification', none: 'No barrier reported', unknown: 'Specific obstacle not established' },
  },
  treatment_impact: {
    description: 'Only impact explicitly stated by visitor: missed_or_stopped = missed DOSE or stopped treatment; supply_gap = explicitly no medication left; continuing_with_symptoms; supply_at_risk = worried about running out; no_change = explicitly unaffected. Otherwise unknown. A missed DELIVERY, waiting for medication, or carrier missing the patient does NOT establish missed doses or no remaining supply: unknown unless separately stated. Never infer from scenario, agent, quantity or future plans.',
    labels: { missed_or_stopped: 'Patient reports missed or interrupted treatment', supply_gap: 'Patient reports being out of medication', continuing_with_symptoms: 'Continuing treatment while experiencing symptoms', supply_at_risk: 'Patient is concerned about a supply gap', no_change: 'No change in medication use reported by the patient', unknown: 'Effect on treatment not established' },
  },
  prior_attempt: {
    description: 'Latest relevant step the visitor explicitly says they already tried: contacted_prescriber, contacted_pharmacy, contacted_insurer, tried_cost_support, requested_refill, attempted_delivery. not_tried only if they explicitly have not tried to resolve it. Unknown if unstated. Never count agent recommendations or future plans as prior attempts. No identifiers or free text.',
    labels: { contacted_prescriber: 'Already contacted the prescribing office', contacted_pharmacy: 'Already contacted the pharmacy', contacted_insurer: 'Already contacted the insurer', tried_cost_support: 'Already explored cost support', requested_refill: 'Already requested the refill', attempted_delivery: 'A delivery was already attempted', not_tried: 'No previous attempt reported', unknown: 'Previous attempts not established' },
  },
  support_preference: {
    description: 'Explicit visitor preference relevant to addressing the obstacle: after_work_reminder, text_reminder, pickup, delivery, clinical_discussion, financial_support, no_additional_support. Do not infer from an offer or scenario. unknown if unstated. Choose the most specific; after_work_reminder takes priority over text_reminder when both apply. This is a preference, NOT consent to execute or evidence of availability.',
    labels: { after_work_reminder: 'Prefers an administrative reminder after work', text_reminder: 'Prefers a text reminder', pickup: 'Prefers pickup if available', delivery: 'Prefers delivery if available', clinical_discussion: 'Wants a clinical discussion', financial_support: 'Wants help with affordability', no_additional_support: 'Does not want additional support', unknown: 'Support preference not established' },
  },
  support_provided: {
    description: 'Actual in-call explanation, not a promise: cost_review_explained = explained affordability-review purpose; coverage_steps_explained = explained coverage checklist or coverage vs authorization; refill_dependency_explained = explained blocked refill step/owner; routine_plan_developed = tailored reminder to failed step; delivery_constraint_explained = explained receiving/access constraint; clinical_question_clarified = summarized clinical question/impact. none if only offer, unknown if unclear.',
    labels: { cost_review_explained: 'Explained the affordability review and what it needs to establish', coverage_steps_explained: 'Explained the coverage issue and information needed for review', refill_dependency_explained: 'Explained which refill step is blocked and who owns it', routine_plan_developed: 'Developed a reminder approach around the step that was being missed', delivery_constraint_explained: 'Clarified the access or receiving constraint for fulfillment', clinical_question_clarified: 'Clarified the question and context for clinical review; no treatment advice given', none: 'No substantive support was established beyond an offer', unknown: 'Support delivered during the call was not established' },
  },
  barrier_response: {
    description: 'Visitor response to support actually provided: addressed only for explicit report that an informational/organizational barrier is addressed; plan_clearer for understanding next step while work remains; still_blocked for unresolved obstacle; declined_help for explicit refusal; not_checked if no resolution check/response; unclear if ambiguous. A yes to text, reminder, handoff, or appointment is permission, NEVER addressed. Never infer resolution from agent summary, goodbye or selected scenario.',
    labels: { addressed: 'Patient says the informational or organizational barrier was addressed', plan_clearer: 'Patient understands the next step; work remains', still_blocked: 'Patient still reports a barrier', declined_help: 'Patient declined further help', not_checked: 'Patient response to the support was not established', unclear: 'Patient response was unclear' },
  },
  unresolved_need: {
    description: 'Remaining dependency from this conversation: clinical_review for symptoms, missed/stopped use, running out, damaged product or treatment questions; affordability_review, coverage_review, authorization, prescription_renewal, refill_processing, stock_confirmation, delivery_arrangement, support_review as applicable. none ONLY if visitor explicitly says an informational/routine barrier is addressed and no external or clinical work remains. Unknown if incomplete; permission never means completed.',
    labels: { clinical_review: 'Clinical review is still needed', affordability_review: 'Affordability options still need review', coverage_review: 'Coverage still needs review', authorization: 'Authorization is still pending', prescription_renewal: 'A prescription renewal is still needed', refill_processing: 'The refill still needs processing', stock_confirmation: 'Availability still needs confirmation', delivery_arrangement: 'A workable fulfillment arrangement still needs confirmation', support_review: 'Additional support review is needed', none: 'No remaining need reported', unknown: 'Remaining needs were not established' },
  },
  handoff_permission: {
    description: 'Permission for a specific simulated STAFF handoff/reminder/review or filing a request with the insurance team, based only on explicit visitor request/agreement. accepted, declined for refusal/withdrawal, unclear for unanswered/ambiguous offer, not_discussed if absent. Honor latest relevant decision. If symptoms, medication-use question, running out or emergency occur, only clinical handoff consent counts; earlier administrative consent does not transfer. Resource texts and patient reminders never imply staff handoff consent.',
    labels: { accepted: 'Handoff agreed · demo preview', declined: 'Handoff declined', unclear: 'Handoff permission not confirmed', not_discussed: 'Handoff not discussed' },
  },
};
export const discoveryFields = Object.entries(discoveryDefinitions).map(([name, { description, labels }]) => ({ type: 'enum', name, description, choices: Object.keys(labels) }));
export const painBarriers = { cost_share: 'cost', coverage_gap: 'coverage', authorization_pending: 'renewal', renewal_needed: 'renewal', refill_not_requested: 'refill', stock_shortage: 'delivery', failed_delivery: 'delivery', pickup_access: 'delivery', routine_memory: 'routine', treatment_doubts: 'treatment_question', restart_question: 'treatment_question', side_effect_impact: 'side_effects', none: 'no_barrier' };
const clinicalPain = ['side_effect_impact', 'restart_question', 'treatment_doubts'];
export function discoveryClinical(fields) {
  return clinicalPain.includes(fields.pain_point?.value) || ['missed_or_stopped', 'supply_gap', 'continuing_with_symptoms'].includes(fields.treatment_impact?.value) || fields.unresolved_need?.value === 'clinical_review';
}
const routes = {
  cost_share: 'Customer success financial support', coverage_gap: 'Pharmacy insurance support', authorization_pending: 'Insurance authorization team', renewal_needed: 'Prescribing office', refill_not_requested: 'Pharmacy refill support', stock_shortage: 'Pharmacy inventory team', failed_delivery: 'Fulfillment support', pickup_access: 'Pharmacy access support', routine_memory: 'Pharmacy support',
};
const needRoutes = { affordability_review: routes.cost_share, coverage_review: routes.coverage_gap, authorization: routes.authorization_pending, prescription_renewal: routes.renewal_needed, refill_processing: routes.refill_not_requested, stock_confirmation: routes.stock_shortage, delivery_arrangement: routes.failed_delivery, support_review: 'Pharmacy support' };
export function discoveryResult(fields, { clinical = false, emergency = false } = {}) {
  const values = Object.fromEntries(Object.entries(discoveryDefinitions).map(([name, def]) => [name, typeof fields[name]?.value === 'string' && Object.hasOwn(def.labels, fields[name].value) ? fields[name].value : name === 'handoff_permission' ? 'not_discussed' : name === 'barrier_response' ? 'not_checked' : 'unknown']));
  const label = key => discoveryDefinitions[key].labels[values[key]];
  const clinicalOnly = clinical || discoveryClinical(fields);
  if (clinicalOnly) {
    const consent = fields.clinical_routing?.value;
    values.handoff_permission = consent === 'declined' || values.handoff_permission === 'declined' ? 'declined' : consent === 'accepted' && values.handoff_permission === 'accepted' ? 'accepted' : 'unclear';
  }
  const delivered = !['none', 'unknown', 'clinical_question_clarified'].includes(values.support_provided);
  const resolved = !clinicalOnly && !emergency && delivered && values.barrier_response === 'addressed' && values.unresolved_need === 'none' && ['routine_memory', 'other'].includes(values.pain_point);
  const noBarrier = values.pain_point === 'none' && values.unresolved_need === 'none' && !clinicalOnly && !emergency;
  const route = emergency ? 'Immediate medical help' : clinicalOnly ? 'Clinical care team' : resolved || noBarrier ? 'No staff follow-up identified' : needRoutes[values.unresolved_need] || routes[values.pain_point] || 'More information needed';
  const remaining = emergency ? 'This demo cannot provide emergency care.' : clinicalOnly ? 'Clinical review is still needed; logistical support does not resolve the clinical concern.' : values.unresolved_need === 'none' && !resolved && !noBarrier ? 'Resolution was not established; any external work still needs confirmation.' : label('unresolved_need');
  return {
    painPoint: label('pain_point'),
    learned: [label('treatment_impact'), label('prior_attempt'), label('support_preference')],
    help: label('support_provided'),
    response: label('barrier_response'),
    outcome: emergency ? 'Immediate help needed' : clinicalOnly ? 'Clinical review needed' : resolved ? 'Barrier addressed — patient report' : noBarrier ? 'No barrier reported' : values.barrier_response === 'plan_clearer' ? 'Next step clarified — work remains' : 'Resolution not established',
    remaining,
    route,
    routingStatus: emergency ? 'Seek real-world help now' : resolved || noBarrier ? 'No handoff needed for the reported concern' : label('handoff_permission'),
    handoffPermission: values.handoff_permission,
    resolved,
  };
}
