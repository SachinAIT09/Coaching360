import { spoken } from '../utils/dates';
// Contact reasons. Each holds the lines an agent might say at each score level, so a
// call's transcript always matches its AI scores (see transcripts.js).
export const INTENTS = {
  billing_high: {
    disposition: 'Inquiry — Billing', label: 'High bill explanation', contact: 'Billing Inquiry', weight: 3,
    problem: "My bill is way higher than usual this month and I don't understand why.",
    explain: {
      3: 'Your last bill covered 34 days instead of 30, and usage rose during the heat wave. Together that explains most of the $86 increase.',
      2: "It's the extended billing period plus on-peak TOU consumption variance on the read.",
      1: 'The system calculated it, so the amount is what it is.',
    },
    wrong: 'Your next bill will definitely be back to normal.',
    reply: { 3: 'Okay, that makes more sense now.', 2: 'Sorry, what does TOU mean?', 1: "I'm still not following why it's so high." },
    next: {
      3: `I've requested a usage review. You'll get the results by email by ${spoken('2025-05-22')}.`,
      2: "I've put in a usage review, so you should hear back soon.",
      1: 'If it happens again you can just call back.',
    },
    recap: 'your bill covered a longer cycle with higher summer usage, and a usage review is on the way',
  },
  billing_cycle: {
    disposition: 'Inquiry — Billing', label: 'Billing cycle question', contact: 'Billing Inquiry', weight: 2,
    problem: 'Why did my due date change this month?',
    explain: {
      3: 'Your meter-read route moved by four days, so your billing cycle and due date moved with it. It only happens once.',
      2: 'The read cycle was re-sequenced in CIS, which shifted your bill date.',
      1: "Due dates change sometimes, that's normal.",
    },
    wrong: 'You can pick any due date you like going forward.',
    reply: { 3: 'Got it, thanks for explaining.', 2: 'Re-sequenced? What does that mean for me?', 1: "That doesn't really answer my question." },
    next: {
      3: 'Your next bill will be issued on June 3 with a due date of June 24.',
      2: 'Your next bill should come out around the usual time.',
      1: 'Just keep an eye on your mail.',
    },
    recap: 'your due date moved because your read route changed, and your next bill arrives June 3',
  },
  payment_arr: {
    disposition: 'Payment — Arrangement', label: 'Payment arrangement', contact: 'Payment Arrangement', weight: 2,
    problem: "I can't pay the full balance right now. Can I split it up?",
    outbound: "I'm calling about the overdue balance on your account, to help you set up a payment plan.",
    explain: {
      3: 'We can split the $412 balance into four monthly payments of $103, added to your regular bills.',
      2: 'We can do an arrangement with equal instalments against the arrears on the account.',
      1: 'You just need to pay what you can.',
    },
    wrong: 'Late fees are waived automatically once you are on a plan.',
    reply: { 3: "Perfect, that's manageable.", 2: 'Sorry, so how much is each payment?', 1: "I don't understand what I'm agreeing to." },
    next: {
      3: "The arrangement is active now. The first $103 payment is due June 10, and you'll get a confirmation email today.",
      2: 'The arrangement will be set up soon.',
      1: 'Someone may follow up with you.',
    },
    recap: 'your $412 balance is split into four payments of $103, starting June 10',
  },
  outage: {
    disposition: 'Outage — Report', label: 'Outage status', contact: 'Outage Report', weight: 1.5,
    problem: 'My power has been out since this morning on my street.',
    outbound: "I'm calling with an update on the outage you reported this morning.",
    explain: {
      3: 'There is a known outage affecting about 240 customers in your area. A damaged transformer is being replaced and crews are on site.',
      2: 'There is an unplanned outage on the feeder due to equipment failure.',
      1: "There's an outage, crews will get to it.",
    },
    wrong: 'You will receive an automatic credit for the outage.',
    reply: { 3: 'Thanks, good to know crews are there.', 2: 'What does that mean, is it just my house?', 1: 'But when will it be fixed?' },
    next: {
      3: 'Power should be restored by 4:30 pm today. We will text you when it is back on.',
      2: 'Power should be back on soon.',
      1: "I can't say when it will be back.",
    },
    recap: 'a transformer is being replaced, with power expected back by 4:30 pm and a text when it is restored',
  },
  closure: {
    disposition: 'Account — Closure', label: 'Account closure', contact: 'Account Closure', weight: 1,
    problem: "I'm moving out of state and need to close my account.",
    explain: {
      3: "I'll close the account on your move-out date, take a final meter reading that day, and send the final bill to your new address.",
      2: 'We will finalize the account and issue a final billing on the move-out read.',
      1: 'I will just close it.',
    },
    wrong: 'Your deposit will be refunded in cash at our office.',
    reply: { 3: 'Great, that covers everything.', 2: 'So when do I get the final bill?', 1: 'What about my deposit and the final bill?' },
    next: {
      3: 'Your final bill will be emailed by June 6, and any deposit refund is applied to it first.',
      2: 'You should receive your final bill soon after you move.',
      1: "You'll get something in the mail.",
    },
    recap: `the account closes on ${spoken('2025-05-31')} with a final reading, and the final bill is emailed by ${spoken('2025-06-06')}`,
  },
  startstop: {
    disposition: 'Service — Start/Stop', label: 'Start / stop service', contact: 'Start / Stop Service', weight: 1,
    problem: "I'm moving into a new place and need to start service there.",
    explain: {
      3: 'I can start service at 22 Elm Street on June 1. No visit is needed, as we will use a remote meter read.',
      2: 'We will create a new service agreement on the premise with a move-in read.',
      1: "I'll put it in the system.",
    },
    wrong: 'There is no deposit required for any new account.',
    reply: { 3: 'Perfect, thank you.', 2: 'A service agreement, do I need to sign something?', 1: 'So is it done or not?' },
    next: {
      3: "Service starts June 1, and you'll get a welcome email with your new account number within 24 hours.",
      2: 'Your service will be set up shortly.',
      1: 'It should be fine.',
    },
    recap: 'service starts at 22 Elm Street on June 1 and your welcome email arrives within a day',
  },
  move: {
    disposition: 'Service — Move', label: 'Move request', contact: 'Start / Stop Service', weight: 1,
    problem: 'I am moving within Mississauga. Can I transfer my service?',
    explain: {
      3: `Yes. I will stop service at your current address on ${spoken('2025-05-30')} and start it at the new one the same day, so there is no gap.`,
      2: 'We can process a transfer with the stop and start reads on the same date.',
      1: 'Yeah, we can move it.',
    },
    wrong: 'The transfer is completed instantly with no final bill.',
    reply: { 3: 'That works, thanks.', 2: 'Reads? Do I need to be home?', 1: 'Do I need to do anything else?' },
    next: {
      3: `Both reads happen ${spoken('2025-05-30')}. Your final bill for the old address will be emailed by ${spoken('2025-06-04')}.`,
      2: 'The transfer will go through around your move date.',
      1: 'Call us if anything goes wrong.',
    },
    recap: `service moves to your new address on ${spoken('2025-05-30')} with no gap, and the old-address final bill comes by ${spoken('2025-06-04')}`,
  },
};

export const INTENT_KEYS = Object.keys(INTENTS);

export const CUSTOMERS = [
  'Erik Johansson', 'Chloe Martin', 'Kenji Watanabe', 'Freya Nielsen', 'Thomas Wagner', 'Isabella Conti', 'Hiroshi Sato',
  'Hana Kobayashi', 'Pierre Moreau', 'Layla Nasser', 'Jan de Vries', 'Astrid Berg', 'Kwame Mensah', 'Lucia Fernandez',
];

export const emailOf = (customer) => `${customer.toLowerCase().replaceAll(' ', '.')}@example.com`;
