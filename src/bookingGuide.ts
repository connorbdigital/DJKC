import { AREA_GROUPS, TIERS } from './data';

export const quickAnswers = {
  'Starting fees': TIERS.map(t => `${t.name}: ${t.price === 'Custom' ? 'custom quote' : `from ${t.price}`}. ${t.features[0]}.`).join('\n\n'),
  'Travel areas': `KC covers ${AREA_GROUPS.map(a => a.formValue).join(', ')}. Travel is included across the North West; any other area is quoted with travel at cost.`,
  'Check a date': 'Only KC can confirm availability. Open the booking enquiry below, enter your venue and preferred date, then send the prepared email. This chat does not reserve a date.',
};

export function guideFor(question: string) {
  if (/available|availability|book|date|reserv/i.test(question)) return quickAnswers['Check a date'];
  if (/price|cost|how much|fee|budget|package|rate/i.test(question)) return quickAnswers['Starting fees'];
  if (/where|travel|area|cover|london|manchester|liverpool|ireland|ibiza/i.test(question)) return quickAnswers['Travel areas'];
  return 'Use the quick answers for packages, travel and checking a date, or ask KC directly through the booking enquiry.';
}
