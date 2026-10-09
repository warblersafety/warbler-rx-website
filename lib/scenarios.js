export const scenarios = [
  {
    id: 'coverage', label: 'My coverage changed', tag: 'Insurance & access',
    line: 'I want to stay on my GLP-1, but my insurance stopped covering it.',
    context: 'A fictional patient wants to continue their prescribed GLP-1 treatment and is encountering an insurance coverage problem. No actual benefits, prior authorization status, price, or eligibility is known.',
    opening: 'What is getting in the way of your next GLP-1 refill?',
    focus: 'Hear how Warbler separates a GLP-1 coverage problem from a treatment question, then identifies the support needed.',
    steps: ['Clarify the GLP-1 coverage barrier', 'Check whether the next supply is at risk', 'Preview pharmacy-support follow-up'],
  },
  {
    id: 'side-effects', label: 'I’m having side effects', tag: 'Clinical follow-up',
    line: 'I’ve been feeling nauseous since my last GLP-1 injection. I want to speak with a clinician.',
    context: 'A fictional patient may report nausea after a GLP-1 injection or another adverse event and may request a clinician. The patient has not yet confirmed any symptom. Once a side effect is reported, offer empathy and request permission to route to the clinical care team without asking any symptom questions. Clinical review takes priority over refill questions.',
    opening: 'In this demo, may I route you to the clinical care team?',
    focus: 'Hear how Warbler responds with empathy and asks permission for clinical follow-up, without probing symptoms.',
    steps: ['Acknowledge the side-effect concern', 'Ask permission for clinical follow-up', 'Preview scheduling around the care team’s availability'],
  },
  {
    id: 'refill', label: 'I forgot my refill', tag: 'Refill continuity',
    line: 'I’m running low on my GLP-1. I just forgot to request my next refill.',
    context: 'A fictional patient may have GLP-1 medication remaining but may have forgotten to request a mail-order refill. Do not assume they missed a dose, ran out, or stopped treatment. The fictional pharmacy has a refill request portal; no actual request can be placed.',
    opening: 'How are you set for your next GLP-1 refill?',
    focus: 'Hear how Warbler clarifies GLP-1 supply and the next refill step, without treating a promise to reorder as a completed refill.',
    steps: ['Clarify remaining GLP-1 supply', 'Identify the refill step the patient needs', 'Keep refill confirmation separate'],
  },
  {
    id: 'cost', label: 'My copay went up', tag: 'Affordability',
    line: 'My GLP-1 copay went up, and I’m worried I can’t afford my next refill.',
    context: 'A fictional GLP-1 patient has an affordability concern. No assistance programs, prices, eligibility rules, or guaranteed savings are supplied. Ask once for remaining supply if unstated, preserving the reported units. Offer simulated resource texting and a financial-support appointment with the customer success team separately; each requires its own permission. No text or appointment is real.',
    opening: 'What has changed about the cost of your GLP-1 refill?',
    focus: 'Hear how Warbler asks separately about cost-support resources and a financial-support appointment.',
    steps: ['Capture cost and reported supply', 'Ask permission for a resource text', 'Separately offer a financial-support appointment'],
  },
  {
    id: 'delivery', label: 'My shipment is late', tag: 'Supply & delivery',
    line: 'My GLP-1 shipment hasn’t arrived, and I’m nearly out.',
    context: 'A fictional GLP-1 patient may report a delayed shipment. No tracking data is available. If they have run out or ask how to handle a missed injection, route to clinical review. Warm or damaged medication also requires pharmacist review, not usability advice.',
    opening: 'What is happening with your GLP-1 delivery?',
    focus: 'Hear how Warbler distinguishes a GLP-1 delivery issue from a medication-use question that needs a clinician.',
    steps: ['Clarify the GLP-1 delivery issue', 'Check the reported supply situation', 'Preview support or clinical review'],
  },
  {
    id: 'restart', label: 'I have a restart question', tag: 'Treatment questions',
    line: 'I’ve been off my GLP-1 for a few weeks. Can I restart at my old dose?',
    context: 'A fictional patient asks about restarting a GLP-1 after an interruption. This is a clinical question. Never provide a dose, restart schedule, titration plan, product substitution, or instruction to take, skip, stop, or resume medication.',
    opening: 'What would you like to ask about your GLP-1 treatment?',
    focus: 'Hear how Warbler recognizes a GLP-1 restart question and keeps dosing decisions with the clinical team.',
    steps: ['Recognize the GLP-1 treatment interruption', 'Keep restart and dose decisions with clinicians', 'Preview the question for clinical review'],
  },
];

export const scenarioById = (id) => scenarios.find((scenario) => scenario.id === id);

// Only reviewed medication labels reach the public summary. Unknown names stay generic.
export const medicationLabels = Object.freeze({
  glp1: 'GLP-1', semaglutide: 'semaglutide', tirzepatide: 'tirzepatide',
  wegovy: 'Wegovy', ozempic: 'Ozempic', zepbound: 'Zepbound', mounjaro: 'Mounjaro',
  rybelsus: 'Rybelsus', liraglutide: 'liraglutide', saxenda: 'Saxenda', victoza: 'Victoza',
  dulaglutide: 'dulaglutide', trulicity: 'Trulicity',
  metformin: 'metformin', amoxicillin: 'amoxicillin', sertraline: 'sertraline',
  atorvastatin: 'atorvastatin', lisinopril: 'lisinopril', amlodipine: 'amlodipine',
  losartan: 'losartan', levothyroxine: 'levothyroxine', escitalopram: 'escitalopram',
  fluoxetine: 'fluoxetine', bupropion: 'bupropion', gabapentin: 'gabapentin',
  insulin: 'insulin', jardiance: 'Jardiance', empagliflozin: 'empagliflozin',
  farxiga: 'Farxiga', dapagliflozin: 'dapagliflozin',
  doxycycline: 'doxycycline', prednisone: 'prednisone',
});

export const analysisFields = [
  { type: 'enum', name: 'barrier', choices: ['coverage', 'side_effects', 'refill', 'cost', 'delivery', 'routine', 'renewal', 'treatment_question', 'no_barrier', 'unclear'], description: 'Classify actual visitor statements only, never the selected scenario. Symptoms take side_effects; medication-use, missed-dose or restart questions take treatment_question, overriding logistics. Pending prescription renewal or prior authorization takes renewal, not coverage. Lapsed insurance takes coverage; high price cost; travel/busy routine without dosing questions routine; pickup/shipment delivery; forgotten refill refill; no concern unclear; explicitly no barrier no_barrier.' },
  { type: 'enum', name: 'medication', choices: [...Object.keys(medicationLabels), 'other', 'unknown'], description: 'The medication the visitor explicitly connects to their reported side effect. Use the exact named medication from the choices, or glp1 only when the visitor explicitly says GLP-1 without a specific name. Use other for a named drug outside the choices, unknown for no medication stated, multiple ambiguous medications or insufficient information. Never infer a medication from the agent opening, selected scenario, or an injection alone. Honor visitor corrections.' },
  { type: 'enum', name: 'clinical_routing', choices: ['accepted', 'declined', 'not_discussed', 'unclear', 'emergency'], description: 'From the actual conversation, emergency when the visitor describes an immediate emergency such as trouble breathing or collapse; this takes priority over routine follow-up consent. Otherwise accepted only when the visitor explicitly requests or agrees to clinical care team follow-up. Declined when the visitor refuses or withdraws that permission, honoring their latest decision. Not_discussed if clinical routing is never discussed; unclear if offered but unanswered or ambiguous. Symptoms alone, choosing a scenario, agent promises, silence or ending the call do not imply consent. This is a demo; nothing is actually booked.' },
  { type: 'enum', name: 'cost_resources', choices: ['accepted', 'declined', 'not_discussed', 'unclear'], description: 'Permission for a simulated text with cost-support resources only. Accepted only if the visitor explicitly requests or agrees to this text. Declined for refusal or withdrawal; honor the latest decision. Not_discussed if not offered or requested; unclear for ambiguous/unanswered offers. Appointment or clinical consent never implies text consent. Never infer consent from the scenario, silence, agent promises or ending the call.' },
  { type: 'enum', name: 'cost_appointment', choices: ['accepted', 'declined', 'not_discussed', 'unclear'], description: 'Permission for a simulated financial-support appointment with the customer success team only. Accepted only if explicitly requested or agreed by the visitor. Declined for refusal or withdrawal; honor the latest decision. Not_discussed if not offered or requested; unclear for ambiguous/unanswered offers. Resource-text or clinical consent never implies this permission. Never infer from the scenario, silence, agent promises or ending the call.' },
  { type: 'enum', name: 'autonomous_action', choices: ['coverage_checklist', 'routine_reminder', 'renewal_reminder', 'refill_reminder', 'delivery_information', 'declined', 'not_discussed', 'unclear'], description: 'Which non-cost autonomous demo action did the visitor explicitly accept or request: coverage checklist text, routine reminder, renewal/status-check reminder, refill reminder, or pickup/delivery information text? Honor latest corrections/withdrawals (declined). Not_discussed if no offer; unclear if unanswered/ambiguous. Never infer from agent promises, support consent, scenario, silence or goodbye. Any symptoms, emergency, missed-dose or medication-use question overrides previous actions: not_discussed.' },
  { type: 'enum', name: 'support_routing', choices: ['accepted', 'declined', 'not_discussed', 'unclear'], description: 'Permission for simulated NONCLINICAL pharmacy/insurance, routine, renewal or fulfillment support review. Accepted only for explicit visitor request or agreement; declined for refusal or withdrawal (latest decision wins); not_discussed if no offer/request; unclear for unanswered/ambiguous offer. Autonomous-action consent never implies support consent. Never infer from agent promises, scenario, silence or goodbye. Clinical follow-up and financial appointments are excluded.' },
  { type: 'string', name: 'remaining_supply', collect: true, description: 'Copy only the visitor’s latest stated remaining medication supply as an exact short phrase from their speech, including their quantity and units (e.g. two pens, about a week). Never convert units or estimate duration, infer from the scenario/agent, include identifying details or medication instructions. Use an empty string if unstated, ambiguous, corrected without a replacement, or unknown. No other text.' },
  { type: 'string', name: 'patient_need', description: 'One short sentence describing the GLP-1 need actually expressed by the visitor. Do not include names, contact details, identifiers, dosing recommendations, or claim the selected scenario happened. If no concern was expressed say No GLP-1 concern was established.' },
  { type: 'string', name: 'agent_response', description: 'One short factual sentence describing what the agent actually discussed. Say simulated or preview for any follow-up. Never claim an order, coverage approval, appointment, transfer, message, or actual care was completed. Do not repeat clinical advice.' },
  { type: 'enum', name: 'review_team', choices: ['clinical', 'pharmacy_support', 'none', 'unclear'], description: 'Clinical for any symptom, adverse event, product condition concern, missed-dose or restart question, ran-out report, clinician-directed treatment change or explicit clinician request. Pharmacy_support for unresolved coverage, cost, renewal or delivery barriers without clinical content. None only for an uncomplicated refill intention or no barrier with no human help requested. Unclear when insufficient conversation.' },
];

export const dataCollection = Object.fromEntries(analysisFields.filter(field => field.type === 'enum' || field.collect).map(field => [field.name, { type: 'string', description: field.description, ...(field.choices ? { enum: field.choices } : {}) }]));
