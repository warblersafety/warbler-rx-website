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
    context: 'A fictional patient may report nausea after a GLP-1 injection or another adverse event and may request a clinician. The patient has not yet confirmed any symptom. Clinical review takes priority over refill questions.',
    opening: 'What would you like your GLP-1 care team to know?',
    focus: 'Hear how Warbler recognizes a GLP-1 treatment concern and prepares a clear clinical-review preview.',
    steps: ['Listen to the reported GLP-1 concern', 'Recognize when clinical review is needed', 'Preview the concern and preferred follow-up'],
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
    context: 'A fictional GLP-1 patient has an affordability concern. No assistance programs, prices, eligibility rules, or guaranteed savings are supplied. Only a simulated pharmacy-support review is available.',
    opening: 'What has changed about the cost of your GLP-1 refill?',
    focus: 'Hear how Warbler captures an affordability barrier without promising GLP-1 coverage, discounts, or savings.',
    steps: ['Understand the GLP-1 affordability concern', 'Clarify the impact on the next refill', 'Preview support-team review'],
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

export const analysisFields = [
  { type: 'enum', name: 'barrier', choices: ['coverage', 'side_effects', 'refill', 'cost', 'delivery', 'treatment_question', 'no_barrier', 'unclear'], description: 'Classify only the fictional patient’s actual statements in this conversation. Never infer a barrier from the selected scenario or agent opening. Any symptoms or medication question take priority over logistical barriers. Use unclear when the visitor did not state a concern.' },
  { type: 'string', name: 'patient_need', description: 'One short sentence describing the GLP-1 need actually expressed by the visitor. Do not include names, contact details, identifiers, dosing recommendations, or claim the selected scenario happened. If no concern was expressed say No GLP-1 concern was established.' },
  { type: 'string', name: 'agent_response', description: 'One short factual sentence describing what the agent actually discussed. Say simulated or preview for any follow-up. Never claim an order, coverage approval, appointment, transfer, message, or actual care was completed. Do not repeat clinical advice.' },
  { type: 'enum', name: 'review_team', choices: ['clinical', 'pharmacy_support', 'none', 'unclear'], description: 'Clinical for any symptom, adverse event, product condition concern, missed-dose or restart question, ran-out report, clinician-directed treatment change or explicit clinician request. Pharmacy_support for unresolved coverage, cost, renewal or delivery barriers without clinical content. None only for an uncomplicated refill intention or no barrier with no human help requested. Unclear when insufficient conversation.' },
];
