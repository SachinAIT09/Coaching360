import { AGENTS } from './agents';
import { BASE_RUBRIC, BINARY, CAT_IDS, insight } from './rubric';
import { INTENTS, INTENT_KEYS, CUSTOMERS } from './intents';
import { CONTACT_TYPES } from './contactTypes';
import { rng, weightedTotal, fmtTime } from '../utils/score';
import { TODAY_ISO, toUS, monthOf, workingDays } from '../utils/dates';

const EMOTION = { Positive: ['Satisfied', 'Appreciative'], Neutral: ['Calm', 'Concerned'], Negative: ['Frustrated', 'Concerned'] };
const intentWeights = INTENT_KEYS.map((k) => INTENTS[k].weight);
const intentTotal = intentWeights.reduce((s, w) => s + w, 0);

function pickIntent(r) {
  let x = r * intentTotal;
  for (let i = 0; i < INTENT_KEYS.length; i++) { x -= intentWeights[i]; if (x <= 0) return INTENT_KEYS[i]; }
  return INTENT_KEYS[0];
}

// Fill in everything that follows from the scores: sentiment, notes, focus label...
function finish(c, rand) {
  const total = weightedTotal(c.ai, BASE_RUBRIC);
  if (!c.sentiment) {
    const a = AGENTS.find((x) => x.id === c.agentId);
    const r = rand();
    const posP = a.sentiment * (total >= 88 ? 1.15 : total >= 78 ? 0.9 : 0.5);
    const negP = (1 - a.sentiment) * 0.4 * (total < 75 ? 2.2 : 1);
    c.sentiment = r < posP ? 'Positive' : r > 1 - negP ? 'Negative' : 'Neutral';
  }
  if (!c.emotion) c.emotion = EMOTION[c.sentiment][Math.floor(rand() * 2)];
  if (!c.focus) {
    const gap = BASE_RUBRIC.map((k) => ({ k, lost: k.weight * (3 - c.ai[k.id]) })).sort((x, y) => y.lost - x.lost)[0];
    c.focus = gap.lost ? `${gap.k.name} — ${insight(gap.k.id, c.ai[gap.k.id])}` : `Model call — ${INTENTS[c.intentKey].label.toLowerCase()}`;
    c.note = gap.lost ? insight(gap.k.id, c.ai[gap.k.id]) : 'Model call: clear, accurate and complete.';
  }
  c.intent = [INTENTS[c.intentKey].disposition, INTENTS[c.intentKey].label];
  c.duration = fmtTime(c.durSec);
  c.date = toUS(c.iso);
  c.month = monthOf(c.iso);
  c.aiTotal = total;
  return c;
}

function makeCall(id, a, iso, minute, rand) {
  const m = monthOf(iso);
  const decay = 1 - (a.growth * (4 - m)) / 4;
  const intentKey = pickIntent(rand());
  const direction = (intentKey === 'outage' || intentKey === 'payment_arr') && rand() < 0.3 ? 'Outbound' : 'Inbound';
  const ai = {};
  const conf = {};
  for (const cid of CAT_IDS) {
    const p = Math.max(0.2, a.p[cid] * decay);
    const r = rand();
    ai[cid] = r < p ? 3 : BINARY.has(cid) ? 1 : r < p + (1 - p) * 0.75 ? 2 : 1;
    const base = cid === 'tone' || cid === 'pace' ? 0.8 : 0.93;
    conf[cid] = Math.round(Math.min(0.99, Math.max(0.45, base - (ai[cid] === 2 ? 0.1 : 0) + (rand() - 0.5) * 0.24)) * 100) / 100;
  }
  if (direction === 'Outbound') ai.opening = 3;
  const fields = CONTACT_TYPES[INTENTS[intentKey].contact];
  // A missed email request in the opening also leaves the contact note's email field blank
  const emailGap = ai.opening === 1 && fields.includes('Contact email');
  const notesOk = !emailGap && rand() < a.notes;
  const durMin = a.aht + (4 - m) * 0.35 + (rand() - 0.5) * 4 + (intentKey === 'closure' ? 1.2 : 0);
  return finish({
    id: String(id), agentId: a.id, iso, time: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
    durSec: Math.round(Math.min(20, Math.max(2.5, durMin)) * 60), direction, intentKey,
    customer: CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)], customerType: rand() < 0.2 ? 'Commercial' : 'Residential',
    account: String(10000000 + Math.floor(rand() * 89999999)), ai, conf, violation: null,
    notesOk, notesMissing: notesOk ? null : emailGap ? 'Contact email' : fields[Math.floor(rand() * fields.length)],
  }, rand);
}

const generated = [];
const rand = rng(2025);
let seq = 2850000;
for (const iso of workingDays('2025-01-02', TODAY_ISO)) {
  const today = iso === TODAY_ISO;
  for (const a of AGENTS) {
    const n = today ? 3 + Math.floor(rand() * 3) : 6 + Math.floor(rand() * 4);
    const minutes = Array.from({ length: n }, () => (today ? 485 + Math.floor(rand() * 230) : 480 + Math.floor(rand() * 540))).sort((x, y) => x - y);
    for (const min of minutes) generated.push(makeCall(seq++, a, iso, min, rand));
  }
}

// Hand-written calls used in the demo script (scores: accuracy, expectation, wordChoice, politeness, opening, closing, tone, pace)
const toScores = (arr) => Object.fromEntries(CAT_IDS.map((id, i) => [id, arr[i]]));
const hero = (id, agentId, iso, time, dur, intentKey, customer, sentiment, emotion, arr, { conf: confOverride, ...extra } = {}) => {
  const ai = toScores(arr);
  const conf = Object.fromEntries(CAT_IDS.map((c) => [c, c === 'tone' || c === 'pace' ? 0.84 : 0.94]));
  return { id, agentId, iso, time, durSec: dur, direction: 'Inbound', intentKey, customer, customerType: 'Residential',
    account: String(10000000 + ((Number(id) * 7919) % 89999999)), ai, conf: { ...conf, ...confOverride }, violation: null,
    notesOk: true, notesMissing: null, sentiment, emotion, ...extra };
};
const heroRand = rng(7);
const HERO_CALLS = [
  hero('2857391', 'a1', '2025-05-14', '10:42', 504, 'billing_high', 'Erik Johansson', 'Neutral', 'Frustrated', [3, 2, 3, 3, 1, 3, 2, 3],
    { account: '12345678', conf: { tone: 0.55 }, focus: 'Opening — Missed email request', note: 'Greeting provided. Email not requested.' }),
  hero('2857274', 'a1', '2025-05-12', '14:05', 411, 'billing_cycle', 'Hana Kobayashi', 'Positive', 'Satisfied', [3, 3, 3, 3, 3, 3, 3, 2],
    { focus: 'Closing — Excellent closing & recap', note: 'Strong recap and confirmed next steps.' }),
  hero('2857102', 'a1', '2025-05-09', '09:31', 432, 'payment_arr', 'Kenji Watanabe', 'Positive', 'Appreciative', [3, 2, 3, 3, 3, 3, 3, 3],
    { focus: 'Politeness — Very professional', note: 'Very polite and courteous throughout.' }),
  hero('2856988', 'a1', '2025-05-08', '15:20', 580, 'startstop', 'Freya Nielsen', 'Neutral', 'Concerned', [3, 2, 3, 3, 3, 1, 2, 1],
    { focus: 'Pace — Slightly fast at times', note: 'Pace was fast during account verification.' }),
  hero('2857350', 'a2', '2025-05-13', '11:12', 730, 'billing_high', 'Thomas Wagner', 'Negative', 'Frustrated', [3, 1, 2, 3, 1, 1, 2, 3],
    { focus: 'Expectation Setting — No timeframe', note: 'Customer left unsure when the adjustment posts.' }),
  hero('2857199', 'a3', '2025-05-13', '13:48', 365, 'billing_high', 'Isabella Conti', 'Positive', 'Appreciative', [3, 3, 3, 3, 3, 3, 3, 3],
    { focus: 'Great Example — full billing walkthrough', note: 'Model call: clear explanation, strong recap.' }),
  hero('2857160', 'a3', '2025-05-12', '10:03', 348, 'closure', 'Jan de Vries', 'Positive', 'Satisfied', [3, 3, 3, 3, 3, 3, 3, 3],
    { focus: 'Great Example — account closure notes complete', note: 'Closure reason and forwarding address documented.' }),
  hero('2857088', 'a5', '2025-05-12', '14:08', 800, 'payment_arr', 'Astrid Berg', 'Negative', 'Frustrated', [1, 2, 2, 2, 1, 1, 2, 2],
    { violation: 'Disclosure before authentication', focus: 'Policy — data disclosed before verification', note: 'Account details shared before authentication completed.' }),
].map((c) => finish(c, heroRand));

export const HERO_IDS = new Set(HERO_CALLS.map((c) => c.id));

export const CALLS = [...generated, ...HERO_CALLS].sort((a, b) => (b.iso + b.time).localeCompare(a.iso + a.time) || b.id.localeCompare(a.id));

const BY_ID = new Map(CALLS.map((c) => [c.id, c]));
const BY_AGENT = {};
for (const c of CALLS) (BY_AGENT[c.agentId] = BY_AGENT[c.agentId] || []).push(c);

export const callById = (id) => BY_ID.get(id);
export const callsFor = (agentId) => BY_AGENT[agentId] || [];
export const minConfidence = (c) => Math.min(...Object.values(c.conf));

// Sentiment timeline (-1..1) for the Sentiment tab, deterministic from the call id
export function sentimentSeries(call) {
  const r = rng(Number(call.id));
  const end = call.sentiment === 'Positive' ? 0.7 : call.sentiment === 'Neutral' ? 0.1 : -0.4;
  const start = call.sentiment === 'Positive' ? 0.2 : -0.5;
  return Array.from({ length: 14 }, (_, i) => Math.max(-1, Math.min(1, start + ((end - start) * i) / 13 + (r() - 0.5) * 0.35)));
}
