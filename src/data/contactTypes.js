import { INTENTS, emailOf } from './intents';
import { shiftUS, shortDate, shift } from '../utils/dates';

// CIS contact types and their required note fields
export const CONTACT_TYPES = {
  'Billing Inquiry': ['Bill period', 'Explanation provided', 'Adjustment requested', 'Next step & timeframe'],
  'Payment Arrangement': ['Amount owed', 'Installment schedule', 'First payment date', 'Customer consent'],
  'Account Closure': ['Closure reason', 'Final bill date', 'Forwarding address', 'Deposit refund method', 'Verified identity'],
  'Start / Stop Service': ['Service address', 'Effective date', 'Meter reading', 'Contact email'],
  'Outage Report': ['Outage area', 'Cause', 'Estimated restoration', 'Customer notification'],
};

const VALUES = {
  'Bill period': `${shortDate(shift('2025-04-08'))} – ${shortDate(shift('2025-05-11'))} (34 days)`,
  'Explanation provided': (c) => INTENTS[c.intentKey].recap,
  'Adjustment requested': 'No — usage review requested',
  'Next step & timeframe': (c) => INTENTS[c.intentKey].next[c.ai.expectation],
  'Amount owed': '$412.00',
  'Installment schedule': '4 × $103 monthly',
  'First payment date': shiftUS('06/10/2025'),
  'Customer consent': 'Verbal consent recorded',
  'Closure reason': 'Moving out of state',
  'Final bill date': shiftUS('06/06/2025'),
  'Forwarding address': '4410 Mesa Verde Dr, Albuquerque NM',
  'Deposit refund method': 'Applied to final bill',
  'Verified identity': 'Yes — account number + service address',
  'Service address': '2210 Elm Ave, Lubbock TX',
  'Effective date': shiftUS('06/01/2025'),
  'Meter reading': 'Remote read scheduled',
  'Contact email': (c) => (c.ai.opening === 3 ? emailOf(c.customer) : ''),
  'Outage area': '34th St & Indiana Ave (240 customers)',
  'Cause': 'Damaged transformer',
  'Estimated restoration': '4:30 pm today',
  'Customer notification': 'SMS on restoration',
};

export const sampleValue = (label, call) => {
  const v = VALUES[label];
  return typeof v === 'function' ? (call ? v(call) : '') : v || '';
};

// AI-drafted contact note for a call; the field the agent missed is left blank
export function draftNote(call) {
  const type = INTENTS[call.intentKey].contact;
  return {
    type,
    fields: CONTACT_TYPES[type].map((label) => ({ label, value: call.notesMissing === label ? '' : sampleValue(label, call) })),
  };
}
