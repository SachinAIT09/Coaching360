import { ORG } from './org';
import { agentById, firstName } from './agents';
import { INTENTS, emailOf } from './intents';
import { CAT_IDS, insight } from './rubric';
import { fmtTime } from '../utils/score';

// Builds the transcript for a call from its AI scores, plus the AI's per-category
// explanation (reason, confidence, evidence). Transcript, scores and evidence always agree.
function build(call) {
  const I = INTENTS[call.intentKey];
  const agent = agentById(call.agentId);
  const first = firstName(agent);
  const cust = call.customer.split(' ')[0];
  const s = call.ai;
  const out = call.direction === 'Outbound' && I.outbound;
  const L = [];
  const ev = {};
  const add = (who, text) => L.push({ who, text }) - 1;
  const mark = (cat, idx) => (ev[cat] = ev[cat] || []).push(idx);

  mark('opening', add('Agent', out
    ? `Hi ${cust}, this is ${first} calling from ${ORG.name}. ${I.outbound}`
    : `Thank you for calling ${ORG.name}, this is ${first}. May I have your name, please?`));
  add('Customer', out ? 'Oh hi, yes, this is me.' : `Hi, it's ${call.customer}.`);
  if (call.violation) mark('accuracy', add('Agent', 'I can see a balance of $412.80 on the account. Can you confirm your account number?'));
  else mark('accuracy', add('Agent', `Thanks, ${cust}. Before we go on, can you verify your service address or account number?`));
  add('Customer', `Sure, it's ${call.account}.`);
  if (!out && s.opening === 3) {
    mark('opening', add('Agent', 'Thank you. Could I also confirm the best email address for your account?'));
    add('Customer', `It's ${emailOf(call.customer)}.`);
  }
  const helpIdx = add('Agent', out ? 'Do you have a couple of minutes to go over it?' : 'Thanks. How can I help you today?');
  const problemIdx = add('Customer', out ? 'Yes, go ahead.' : I.problem);
  mark('politeness', add('Agent', s.politeness === 3
    ? "I completely understand, that's frustrating. Let's get this sorted out for you."
    : s.politeness === 2 ? 'Okay. Let me take a look.' : "Well, that's just how it works."));
  const explainIdx = add('Agent', I.explain[s.wordChoice]);
  mark('wordChoice', explainIdx);
  if (s.accuracy === 3 && !call.violation) mark('accuracy', explainIdx);
  mark('wordChoice', add('Customer', I.reply[s.wordChoice]));
  if (s.wordChoice < 3) add('Agent', `Sorry, let me put that more simply. ${I.explain[3]}`);
  if (s.accuracy === 1 && !call.violation) mark('accuracy', add('Agent', I.wrong));
  if (s.pace === 1) mark('pace', add('Customer', 'Sorry, could you slow down a little?'));
  mark('expectation', add('Agent', I.next[s.expectation]));
  if (s.closing === 3) {
    mark('closing', add('Agent', `To recap, ${I.recap}. Is there anything else I can help you with today?`));
    add('Customer', "No, that's everything. Thanks!");
    mark('closing', add('Agent', out ? 'Thanks for your time, and have a great day!' : `Thank you for calling ${ORG.name}. Have a great day!`));
  } else {
    add('Customer', 'Okay, I guess that is it.');
    mark('closing', add('Agent', 'Okay, bye.'));
  }

  // Natural talk time, plus a lookup pause after the agent starts investigating and
  // discussion time spread over the rest of the call, so the total matches the duration.
  const talk = L.map((l) => l.text.split(' ').length * 0.4 + 1.5);
  const talkTotal = talk.reduce((x, y) => x + y, 0);
  const extra = Math.max(0, call.durSec - 10 - talkTotal);
  const later = L.length - explainIdx - 1;
  let acc = 3;
  L.forEach((l, i) => {
    l.t = Math.round(acc);
    acc += talk[i] + (i === explainIdx - 1 ? extra * 0.55 : i >= explainIdx ? (extra * 0.45) / Math.max(1, later) : 0);
  });

  const detail = {};
  for (const cid of CAT_IDS) {
    detail[cid] = {
      score: s[cid],
      confidence: call.conf[cid],
      reason: insight(cid, s[cid]),
      evidence: (ev[cid] || []).map((i) => ({ t: L[i].t, who: L[i].who, quote: L[i].text })),
    };
  }
  if (!out && s.opening === 1) {
    detail.opening.evidence.push({ t: L[helpIdx].t, signal: `No email-address request detected in the opening (0:00–${fmtTime(L[helpIdx].t)}).` });
  }
  if (out) detail.opening.evidence.push({ t: 0, signal: 'Outbound callback: an email request is not expected.' });
  if (call.violation) detail.accuracy.reason = 'Account balance disclosed before the caller was verified (policy violation).';
  const mid = Math.round(call.durSec * 0.4);
  detail.tone.evidence.push({ t: mid, signal: s.tone === 3
    ? 'Healthy pitch variation and warm delivery across the call.'
    : s.tone === 2 ? `Low pitch variation ${fmtTime(mid)}–${fmtTime(mid + 90)} (slightly monotone).` : 'Flat pitch and clipped responses through most of the call.' });
  const vt = L[2].t;
  detail.pace.evidence.unshift({ t: vt, signal: s.pace === 3
    ? 'Speech rate 148 wpm (target 140–160).'
    : s.pace === 2 ? `Speech rate 176 wpm during verification at ${fmtTime(vt)} (target 140–160).` : 'Speech rate 195 wpm; the customer asked the agent to slow down.' });

  return { lines: L, detail, problemT: L[problemIdx].t };
}

const cache = new Map();
export function getConversation(call) {
  if (!cache.has(call.id)) cache.set(call.id, build(call));
  return cache.get(call.id);
}
