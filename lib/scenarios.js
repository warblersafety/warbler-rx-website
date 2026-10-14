import { discoveryFields } from './discovery-result.js';
export const scenarios = [
  {
    "id": "open",
    "label": "What is getting in the way?",
    "tag": "Open check-in",
    "line": "I have been finding it hard to stay connected to treatment.",
    "context": "Open fictional addiction-treatment check-in. Discover the actual barrier without assuming medication, missed doses, diagnosis or desired outcome.",
    "opening": "What has been getting in the way of staying connected to treatment?",
    "focus": "Hear how Warbler understands the barrier and previews appropriate clinic support.",
    "steps": [
      "Understand the stated barrier",
      "Clarify what help is needed",
      "Preview the next step with permission"
    ]
  },
  {
    "id": "transportation",
    "label": "I cannot get to the clinic",
    "tag": "Transportation",
    "line": "My car broke down and I missed counseling. I have not missed medication.",
    "context": "Getting to clinic is difficult. Distinguish clinic transport from pharmacy delivery. Care coordination reviews available options; no ride, hours or dosing window is known.",
    "opening": "What has been getting in the way of staying connected to treatment?",
    "focus": "Hear how Warbler understands the barrier and previews appropriate clinic support.",
    "steps": [
      "Understand the stated barrier",
      "Clarify what help is needed",
      "Preview the next step with permission"
    ]
  },
  {
    "id": "schedule",
    "label": "My work shift changed",
    "tag": "Work & childcare",
    "line": "My new shift clashes with my clinic appointments.",
    "context": "A work or caregiving conflict affects attendance. Clarify a general workable time and preview clinic scheduling review, not a medication change or guaranteed slot.",
    "opening": "What has been getting in the way of staying connected to treatment?",
    "focus": "Hear how Warbler understands the barrier and previews appropriate clinic support.",
    "steps": [
      "Understand the stated barrier",
      "Clarify what help is needed",
      "Preview the next step with permission"
    ]
  },
  {
    "id": "return-to-care",
    "label": "I am nervous about going back",
    "tag": "Returning to care",
    "line": "I used again and I am afraid the clinic will judge me.",
    "context": "A patient may fear judgment or want to reconnect after return to use. Acknowledge without blame; clinical care team reviews a safe return with permission. Do not infer an emergency or promise readmission.",
    "opening": "What has been getting in the way of staying connected to treatment?",
    "focus": "Hear how Warbler understands the barrier and previews appropriate clinic support.",
    "steps": [
      "Understand the stated barrier",
      "Clarify what help is needed",
      "Preview the next step with permission"
    ]
  },
  {
    "id": "clinic-access",
    "label": "I cannot reach my clinic",
    "tag": "Clinic access",
    "line": "I called the clinic twice and still cannot get an appointment.",
    "context": "An access barrier may involve unanswered calls, clinic cancellation, waitlist or discharge. Do not infer which. Clinic access staff review options; clinical concerns take priority.",
    "opening": "What has been getting in the way of staying connected to treatment?",
    "focus": "Hear how Warbler understands the barrier and previews appropriate clinic support.",
    "steps": [
      "Understand the stated barrier",
      "Clarify what help is needed",
      "Preview the next step with permission"
    ]
  },
  {
    "id": "privacy",
    "label": "I cannot talk privately",
    "tag": "Privacy",
    "line": "I share this phone and do not want treatment discussed on it.",
    "context": "Honor privacy and opt-out. Stop treatment discussion, do not collect contact details or claim a contact-list update.",
    "opening": "What has been getting in the way of staying connected to treatment?",
    "focus": "Hear how Warbler understands the barrier and previews appropriate clinic support.",
    "steps": [
      "Understand the stated barrier",
      "Clarify what help is needed",
      "Preview the next step with permission"
    ]
  },
  {
    "id": "coverage",
    "label": "My coverage changed",
    "tag": "Insurance & access",
    "line": "My insurance lapsed and I am worried about paying for treatment.",
    "context": "An addiction-treatment coverage concern. Discover actual facts; no benefit, authorization status, price or eligibility is known.",
    "opening": "What has been getting in the way of staying connected to treatment?",
    "focus": "Hear how Warbler understands the barrier and previews appropriate clinic support.",
    "steps": [
      "Understand the stated barrier",
      "Clarify what help is needed",
      "Preview the next step with permission"
    ]
  },
  {
    "id": "side-effects",
    "label": "I have medication concerns",
    "tag": "Clinical follow-up",
    "line": "My buprenorphine is making me feel unwell. I want to talk to my care team.",
    "context": "Medication concerns or symptoms require a clinical handoff, not dosing advice. Do not infer symptoms or medication from this label. Explicit clinician requests need no additional discovery.",
    "opening": "What has been getting in the way of staying connected to treatment?",
    "focus": "Hear how Warbler understands the barrier and previews appropriate clinic support.",
    "steps": [
      "Understand the stated barrier",
      "Clarify what help is needed",
      "Preview the next step with permission"
    ]
  },
  {
    "id": "refill",
    "label": "My prescription is delayed",
    "tag": "Medication access",
    "line": "I requested my refill but the pharmacy says it needs a new prescription.",
    "context": "Clarify pharmacy access dependency and previous attempts. Medication-use questions, running out or interruption need clinical review; administrative requests are simulated.",
    "opening": "What has been getting in the way of staying connected to treatment?",
    "focus": "Hear how Warbler understands the barrier and previews appropriate clinic support.",
    "steps": [
      "Understand the stated barrier",
      "Clarify what help is needed",
      "Preview the next step with permission"
    ]
  },
  {
    "id": "cost",
    "label": "I cannot afford treatment",
    "tag": "Affordability",
    "line": "I cannot afford the clinic fees this month.",
    "context": "Distinguish clinic fees from medication copay and coverage. Explain financial review without promises; offer a simulated financial-resource text with permission.",
    "opening": "What has been getting in the way of staying connected to treatment?",
    "focus": "Hear how Warbler understands the barrier and previews appropriate clinic support.",
    "steps": [
      "Understand the stated barrier",
      "Clarify what help is needed",
      "Preview the next step with permission"
    ]
  },
  {
    "id": "delivery",
    "label": "The pharmacy is out of stock",
    "tag": "Pharmacy access",
    "line": "The pharmacy says my buprenorphine is out of stock.",
    "context": "A pharmacy supply or delivery problem. No stock levels or timelines known. Do not confuse pharmacy delivery with clinic transportation; never advise substitutions.",
    "opening": "What has been getting in the way of staying connected to treatment?",
    "focus": "Hear how Warbler understands the barrier and previews appropriate clinic support.",
    "steps": [
      "Understand the stated barrier",
      "Clarify what help is needed",
      "Preview the next step with permission"
    ]
  },
  {
    "id": "restart",
    "label": "I missed doses",
    "tag": "Clinical review",
    "line": "I missed methadone for three days. Can I take my usual dose?",
    "context": "Missed medication or restart question requires clinical review. Never answer dosing, restarting or taper questions or assume a safe dosing window.",
    "opening": "What has been getting in the way of staying connected to treatment?",
    "focus": "Hear how Warbler understands the barrier and previews appropriate clinic support.",
    "steps": [
      "Understand the stated barrier",
      "Clarify what help is needed",
      "Preview the next step with permission"
    ]
  }
];

export const scenarioById = (id) => scenarios.find((scenario) => scenario.id === id);

// Only reviewed medication labels reach the public summary. Unknown names stay generic.
export const medicationLabels = Object.freeze({
  methadone: 'methadone', buprenorphine: 'buprenorphine', suboxone: 'Suboxone', subutex: 'Subutex', sublocade: 'Sublocade', brixadi: 'Brixadi', naltrexone: 'naltrexone', vivitrol: 'Vivitrol', acamprosate: 'acamprosate', disulfiram: 'disulfiram',
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
  ...discoveryFields,
  { type: 'enum', name: 'barrier', choices: ['coverage', 'side_effects', 'refill', 'cost', 'delivery', 'routine', 'renewal', 'treatment_question', 'transportation', 'schedule', 'return_to_care', 'clinic_access', 'privacy', 'no_barrier', 'unclear'], description: 'Visitor facts only. Symptoms/withdrawal: side_effects; medication-use, missed-dose, restart, return-to-use or treatment decisions: treatment_question. Clinic transport: transportation; work/childcare/hours: schedule; return anxiety without clinical question: return_to_care; clinic waitlist/discharge/unanswered calls: clinic_access; confidentiality: privacy. Medication pharmacy pickup/shipment: delivery. Renewal/PA: renewal; lapsed coverage: coverage; high cost: cost; forgotten refill: refill.' },
  { type: 'enum', name: 'medication', choices: [...Object.keys(medicationLabels), 'other', 'unknown'], description: 'The medication the visitor explicitly connects to their reported side effect. Use the exact named medication from the choices, or glp1 only when the visitor explicitly says GLP-1 without a specific name. Use other for a named drug outside the choices, unknown for no medication stated, multiple ambiguous medications or insufficient information. Never infer a medication from the agent opening, selected scenario, or an injection alone. Honor visitor corrections.' },
  { type: 'enum', name: 'clinical_routing', choices: ['accepted', 'declined', 'not_discussed', 'unclear', 'emergency'], description: 'Emergency for immediate danger such as trouble breathing/collapse. Otherwise accepted only for explicit agreement/request for CLINICAL care-team consultation; declined for latest refusal/withdrawal; not_discussed if absent; unclear if unanswered/ambiguous. A reminder to a prescriber about routine refill/renewal paperwork is administrative, NOT clinical consent. Symptoms, scenario, agent promises, silence and goodbye never imply permission. Honor latest decision. Nothing is booked.' },
  { type: 'enum', name: 'cost_resources', choices: ['accepted', 'declined', 'not_discussed', 'unclear'], description: 'Permission for a simulated text containing a link to financial/cost-support resources only. Accepted only if the visitor explicitly requests or agrees to this text. Declined for refusal or withdrawal; honor the latest decision. Not_discussed if not offered or requested; unclear for ambiguous/unanswered offers. Appointment or clinical consent never implies text consent. Never infer consent from the scenario, silence, agent promises or ending the call.' },
  { type: 'enum', name: 'cost_appointment', choices: ['accepted', 'declined', 'not_discussed', 'unclear'], description: 'Permission for a simulated financial-support appointment with the clinic financial-support team only. Accepted only if explicitly requested or agreed by the visitor. Declined for refusal or withdrawal; honor the latest decision. Not_discussed if not offered or requested; unclear for ambiguous/unanswered offers. Resource-text or clinical consent never implies this permission. Never infer from the scenario, silence, agent promises or ending the call.' },
  { type: 'enum', name: 'autonomous_action', choices: ['coverage_checklist', 'routine_reminder', 'renewal_outreach', 'refill_outreach', 'delivery_information', 'insurance_request', 'declined', 'not_discussed', 'unclear'], description: 'Explicit permission: insurance_request = file insurance-team request using call details; renewal_outreach = prescriber renewal request or generic PA reminder; refill_outreach = pharmacy refill request; coverage_checklist/delivery_information = text; routine_reminder = patient reminder. Generic handoff is NOT insurance_request. Refusal/withdrawal = declined; no offer = not_discussed; unanswered = unclear. Never infer consent. Symptoms/emergency/medication-use questions override: not_discussed.' },
  { type: 'enum', name: 'support_routing', choices: ['accepted', 'declined', 'not_discussed', 'unclear'], description: 'Permission for simulated NONCLINICAL clinic coordination, scheduling, access/privacy, pharmacy/insurance or fulfillment review. Accepted only for explicit visitor request or agreement; declined for refusal or withdrawal (latest decision wins); not_discussed if no offer/request; unclear for unanswered/ambiguous offer. Autonomous-action consent never implies support consent. Never infer from agent promises, scenario, silence or goodbye. Clinical follow-up and financial appointments are excluded.' },
  { type: 'string', name: 'remaining_supply', collect: true, description: 'Copy only the visitor’s latest stated remaining medication supply as an exact short phrase from their speech, including their quantity and units (e.g. two pens, about a week). Never convert units or estimate duration, infer from the scenario/agent, include identifying details or medication instructions. Use an empty string if unstated, ambiguous, corrected without a replacement, or unknown. No other text.' },
  { type: 'string', name: 'patient_need', description: 'One short sentence describing the addiction-treatment support need actually expressed by the visitor. Do not include names, contact details, identifiers, dosing recommendations, or claim the selected scenario happened. If no concern was expressed say No treatment-support concern was established.' },
  { type: 'string', name: 'agent_response', description: 'One short factual sentence describing what the agent actually discussed. Say simulated or preview for any follow-up. Never claim an order, coverage approval, appointment, transfer, message, or actual care was completed. Do not repeat clinical advice.' },
  { type: 'enum', name: 'review_team', choices: ['clinical', 'clinic_support', 'pharmacy_support', 'none', 'unclear'], description: 'Clinical for symptoms, withdrawal, return to use, treatment decisions, missed medication, restart or running out. Clinic_support for transportation to clinic, work/childcare scheduling, clinic access, privacy, housing/phone barriers or clinic costs without clinical concerns. Pharmacy_support for medication supply, pharmacy delivery, refill paperwork or insurance. None only for no concern/help needed; unclear if insufficient. A missed visit alone is not a missed dose.' },
];

export const dataCollection = Object.fromEntries(analysisFields.filter(field => field.type === 'enum' || field.collect).map(field => [field.name, { type: 'string', description: field.description, ...(field.choices ? { enum: field.choices } : {}) }]));
