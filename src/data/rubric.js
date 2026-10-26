// Base QA rubric (template v3). Weights come from the Call Grading matrix mockup; the final
// weights must match the client's approved grading matrix.
// The active rubric lives in app state (see QA Template Settings); this is the seed.
// `levels` says what earns each score (2 is null for binary categories); `example` is a model behavior.
export const BASE_RUBRIC = [
  { id: 'accuracy', name: 'Accuracy', label: 'Accuracy (binary)', weight: 20, binary: true,
    def: 'Provided correct and complete information in accordance with policies and procedures.',
    levels: { 3: 'All information correct, complete and in line with policy, including verifying the caller before disclosure.', 2: null, 1: 'Any incorrect, incomplete or out-of-policy information, or account details shared before verification.' },
    example: 'Explained the higher bill using the actual meter reads and rate, after verifying the caller.' },
  { id: 'expectation', name: 'Expectation Setting', label: 'Expectation Setting / Next Steps', weight: 20, binary: false,
    def: 'Clearly explained what will happen next and any timeframes.',
    levels: { 3: 'Explained exactly what happens next, who does it and a specific timeframe.', 2: 'Next steps given, but the timeframe or owner was vague ("soon", "in a few days").', 1: 'No next steps or timeframe given.' },
    example: '"The adjustment will post within 2 business days and you\'ll get an email confirmation."' },
  { id: 'wordChoice', name: 'Word Choice', label: 'Word Choice / Clarity', weight: 15, binary: false,
    def: 'Used clear, concise language; avoided jargon; customer easily understood.',
    levels: { 3: 'Plain, concise language; the customer understood the first time.', 2: 'Some jargon or a confusing explanation that needed rephrasing.', 1: 'The customer stayed confused because of the language used.' },
    example: '"Your meter was read 34 days apart instead of 30" rather than "extended billing period variance".' },
  { id: 'politeness', name: 'Politeness', label: 'Politeness', weight: 10, binary: false,
    def: 'Respectful, courteous, and empathetic communication.',
    levels: { 3: 'Courteous throughout and acknowledged the customer\'s feelings.', 2: 'Polite, but missed a clear chance to show empathy.', 1: 'Curt, dismissive or argumentative.' },
    example: '"I completely understand, that\'s frustrating. Let\'s get this sorted out for you."' },
  { id: 'opening', name: 'Opening', label: 'Opening (binary)', weight: 15, binary: true,
    def: 'Greeted the customer, identified self/company and requested the customer email address.',
    levels: { 3: 'Greeted, gave own and utility name, verified the caller and requested the customer email address.', 2: null, 1: 'Any required opening element missed (most often the email request).' },
    example: '"Could I also confirm the best email address for your account?"' },
  { id: 'closing', name: 'Closing', label: 'Closing (binary)', weight: 10, binary: true,
    def: 'Recapped the call, confirmed next steps and offered further help.',
    levels: { 3: 'Recapped the call, confirmed next steps and offered further help.', 2: null, 1: 'Ended without a recap or confirmation of next steps.' },
    example: '"To recap, ... Is there anything else I can help you with today?"' },
  { id: 'tone', name: 'Tone', label: 'Tone', weight: 5, binary: false,
    def: 'Warm, calm and engaged; not monotone, rushed or dismissive.',
    levels: { 3: 'Warm, calm and engaged for the whole call.', 2: 'Appropriate but slightly flat or monotone in places.', 1: 'Flat, impatient or irritated.' },
    example: 'Steady, friendly delivery even while the customer is frustrated.' },
  { id: 'pace', name: 'Pace', label: 'Pace', weight: 5, binary: false,
    def: 'Speaking speed allowed the customer time to understand and respond.',
    levels: { 3: 'Speaking speed let the customer follow and respond (about 140–160 wpm).', 2: 'Slightly fast in places, e.g. during verification.', 1: 'Too fast; the customer had to ask the agent to slow down.' },
    example: 'Pauses after giving numbers so the customer can write them down.' },
];

export const CAT_IDS = BASE_RUBRIC.map((c) => c.id);
export const BINARY = new Set(BASE_RUBRIC.filter((c) => c.binary).map((c) => c.id));
// Display order used by the Agent Performance mockup
export const CAT_ORDER = ['accuracy', 'opening', 'closing', 'expectation', 'wordChoice', 'politeness', 'tone', 'pace'];

export const defaultRubric = () => ({
  version: 3,
  published: '04/22/2025',
  criteria: BASE_RUBRIC.map((c) => ({ ...c, on: true })),
});

export const catName = (id, criteria = BASE_RUBRIC) => criteria.find((c) => c.id === id)?.name || BASE_RUBRIC.find((c) => c.id === id)?.name || 'General';

// Observable behaviors a coaching goal can target. The AI checks each applicable call for the
// behavior (score 3 in its category = observed); `naOutbound` = not expected on outbound callbacks.
export const BEHAVIORS = [
  { id: 'emailRequest', label: 'Requests the customer email address during the opening', cat: 'opening', naOutbound: true },
  { id: 'timeframe', label: 'Gives a specific timeframe for every next step', cat: 'expectation' },
  { id: 'recap', label: 'Recaps the call and confirms next steps before closing', cat: 'closing' },
  { id: 'verify', label: 'Verifies the caller before disclosing account details', cat: 'accuracy' },
  { id: 'plainLanguage', label: 'Explains charges in plain language without jargon', cat: 'wordChoice' },
  { id: 'empathy', label: 'Acknowledges customer frustration with empathy', cat: 'politeness' },
  { id: 'warmTone', label: 'Keeps a warm, engaged tone throughout the call', cat: 'tone' },
  { id: 'pace', label: 'Keeps speaking pace at 140–160 wpm', cat: 'pace' },
  { id: 'notes', label: 'Completes every required contact-note field', cat: 'accuracy', metric: 'notes' },
];
export const behaviorById = (id) => BEHAVIORS.find((b) => b.id === id);
// A goal's behavior: the stored one, else the first behavior measured by the goal's category
export const goalBehavior = (g) => behaviorById(g.behavior)
  || BEHAVIORS.find((b) => (g.metric === 'notes' ? b.metric === 'notes' : b.cat === g.cat && !b.metric));

// Suggested interaction tags (coaches can also type their own)
export const TAG_SUGGESTIONS = ['Billing Inquiry', 'Customer Frustration', 'Payment Arrangement', 'Good Example', 'Escalation', 'Training Example', 'Outage', 'Start / Stop Service'];

export const SCALE = [
  { v: 3, title: '3 — You did it:', text: 'Meets all expectations consistently.', cls: 'green' },
  { v: 2, title: '2 — Mostly (missing):', text: 'Meets most expectations but something is missing or could be improved.', cls: 'amber' },
  { v: 1, title: '1 — Not at all:', text: 'Does not meet expectations.', cls: 'red' },
];

const INSIGHTS = {
  accuracy: { 3: 'Provided accurate information.', 1: 'Information was incomplete or inconsistent with policy.' },
  expectation: { 3: 'Clear next steps with a specific timeframe.', 2: 'Explained timeframe, could be clearer.', 1: 'No next steps or timeframe given.' },
  wordChoice: { 3: 'Clear and easy to understand.', 2: 'Some jargon; customer needed clarification.', 1: 'Customer confused by language used.' },
  politeness: { 3: 'Very professional and courteous.', 2: 'Polite, but empathy could be stronger.', 1: 'Curt or dismissive at times.' },
  opening: { 3: 'Greeting provided and email requested.', 1: 'Greeting provided. Email not requested.' },
  closing: { 3: 'Proper closing, confirmed next steps.', 1: 'No recap or confirmation of next steps.' },
  tone: { 3: 'Warm, engaged tone.', 2: 'Tone was appropriate, slight monotone.', 1: 'Tone was flat or impatient.' },
  pace: { 3: 'Good pace, allowed time for customer.', 2: 'Slightly fast at times.', 1: 'Too fast; customer could not respond.' },
};
export const insight = (catId, s) => INSIGHTS[catId]?.[s] || '';
