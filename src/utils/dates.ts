/** ISO calendar day, not an instant (UTC conversion can shift the date). */
export function calendarDate(date = new Date(), timeZone?: string) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(date);
}
