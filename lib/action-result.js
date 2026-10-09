// Reviewed labels only: never expose generated transcript text in the public UI.
const options = {
  coverage: ['coverage_checklist', 'Coverage checklist', 'Preview a text with the information to gather for a coverage review.', 'Pharmacy insurance support', 'Review the coverage barrier and available next steps.'],
  cost: ['cost_resources', 'Cost-support resources', 'Preview a text with additional cost-support resources.', 'Customer success team', 'Preview a financial-support appointment.'],
  routine: ['routine_reminder', 'Routine reminder', 'Preview a reminder to follow the existing prescribed routine.', 'Pharmacy support', 'Help organize a routine around travel or a busy schedule.'],
  renewal: ['renewal_outreach', 'Remind the renewal team', 'Preview a reminder to the prescribing office or authorization team to review the pending renewal or prior authorization request.', 'Pharmacy renewal team', 'Review the prescription renewal or prior authorization delay.'],
  refill: ['refill_outreach', 'Remind the pharmacy or prescriber', 'Preview a reminder to the pharmacist or prescribing clinician to review and, if appropriate, submit the refill or renewal request.', 'Pharmacy support', 'Help with the next refill request.'],
  delivery: ['delivery_information', 'Pickup & delivery information', 'Preview a text with pharmacy-provided pickup or delivery information.', 'Fulfillment support', 'Review a missed shipment or difficulty getting to the pharmacy.'],
};
const permission = value => ['accepted', 'declined', 'unclear'].includes(value) ? value : 'not_discussed';
export function actionResult(fields, { barrier, clinical, emergency, nextText }) {
  if (clinical) return {
    autonomous: null,
    support: { title: emergency ? 'Immediate medical help' : 'Clinical care team', description: nextText, status: emergency ? 'urgent' : permission(fields.clinical_routing?.value) },
    clinicalOnly: true,
  };
  const option = Object.hasOwn(options, barrier) ? options[barrier] : null;
  if (!option) return { autonomous: null, support: { title: barrier === 'no_barrier' ? 'No support needed' : 'No next step identified', description: 'No action or support follow-up was agreed in this conversation.', status: 'not_discussed' }, clinicalOnly: false };
  const [id, title, description, supportTitle, supportDescription] = option;
  const chosen = fields.autonomous_action?.value;
  const autonomousStatus = barrier === 'cost' ? permission(fields.cost_resources?.value)
    : chosen === id ? 'accepted' : permission(chosen);
  return {
    autonomous: { title, description, status: autonomousStatus },
    support: { title: supportTitle, description: supportDescription, status: permission(barrier === 'cost' ? fields.cost_appointment?.value : fields.support_routing?.value) },
    clinicalOnly: false,
  };
}
