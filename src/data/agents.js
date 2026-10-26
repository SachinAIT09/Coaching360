// Agent profiles. `p` = probability of meeting expectations (score 3) per category in May;
// `growth` = how much lower those probabilities were in January. Every displayed metric is
// derived from the generated calls (src/utils/metrics.js), not from these numbers.
export const AGENTS = [
  { id: 'a1', name: 'Camille Dubois', team: 'Customer Service', lead: 'Sophie Laurent', tenure: 'Tenured · 4 yrs', tenureMonths: 48,
    p: { accuracy: 0.82, opening: 0.66, closing: 0.62, expectation: 0.72, wordChoice: 0.7, politeness: 0.8, tone: 0.58, pace: 0.52 },
    growth: 0.38, sentiment: 0.7, aht: 8.4, notes: 0.93, prompts: 9 },
  { id: 'a2', name: 'Lukas Becker', team: 'Customer Service', lead: 'Sophie Laurent', tenure: 'New · 5 mos', tenureMonths: 5,
    p: { accuracy: 0.67, opening: 0.59, closing: 0.53, expectation: 0.43, wordChoice: 0.55, politeness: 0.75, tone: 0.55, pace: 0.63 },
    growth: 0.22, sentiment: 0.56, aht: 10.9, notes: 0.8, prompts: 46 },
  { id: 'a3', name: 'Yuki Tanaka', team: 'Customer Service', lead: 'Sophie Laurent', tenure: 'Tenured · 6 yrs', tenureMonths: 72,
    p: { accuracy: 0.97, opening: 0.93, closing: 0.92, expectation: 0.9, wordChoice: 0.92, politeness: 0.96, tone: 0.88, pace: 0.86 },
    growth: 0.07, sentiment: 0.86, aht: 6.9, notes: 0.98, prompts: 7 },
  { id: 'a4', name: 'Giulia Romano', team: 'Billing Support', lead: 'Anna Kowalski', tenure: 'Mid · 2 yrs', tenureMonths: 26,
    p: { accuracy: 0.82, opening: 0.78, closing: 0.74, expectation: 0.62, wordChoice: 0.76, politeness: 0.84, tone: 0.74, pace: 0.72 },
    growth: 0.12, sentiment: 0.72, aht: 8.1, notes: 0.9, prompts: 21 },
  { id: 'a5', name: 'Mateo Silva', team: 'Billing Support', lead: 'Anna Kowalski', tenure: 'New · 3 mos', tenureMonths: 3,
    p: { accuracy: 0.6, opening: 0.54, closing: 0.44, expectation: 0.44, wordChoice: 0.52, politeness: 0.68, tone: 0.52, pace: 0.56 },
    growth: 0.15, sentiment: 0.5, aht: 11.6, notes: 0.72, prompts: 51 },
  { id: 'a6', name: 'Ingrid Larsen', team: 'Billing Support', lead: 'Anna Kowalski', tenure: 'Tenured · 5 yrs', tenureMonths: 60,
    p: { accuracy: 0.9, opening: 0.86, closing: 0.84, expectation: 0.82, wordChoice: 0.86, politeness: 0.91, tone: 0.82, pace: 0.8 },
    growth: 0.08, sentiment: 0.82, aht: 7.2, notes: 0.96, prompts: 10 },
  { id: 'a7', name: 'Omar Haddad', team: 'Customer Service', lead: 'Sophie Laurent', tenure: 'Mid · 1.5 yrs', tenureMonths: 18,
    p: { accuracy: 0.75, opening: 0.67, closing: 0.65, expectation: 0.65, wordChoice: 0.69, politeness: 0.77, tone: 0.61, pace: 0.65 },
    growth: 0.12, sentiment: 0.66, aht: 8.8, notes: 0.87, prompts: 22 },
];

const BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]));
export const agentById = (id) => BY_ID[id] || AGENTS[0];
export const LEADS = ['Sophie Laurent', 'Anna Kowalski'];
export const REVIEWERS = ['Anna Kowalski', 'Sophie Laurent', 'Diego Herrera'];
export const TEAMS = ['Customer Service', 'Billing Support'];
export const INTERACTION_TYPES = ['Inbound Call', 'Outbound Call', 'Chat'];
export const firstName = (a) => a.name.split(' ')[0];
