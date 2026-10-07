import { TimelineBooking } from '../types/booking';

export function generateICS(booking: TimelineBooking): string {
  const start = booking.startDate.replace(/-/g, '');
  const end = booking.endDate ? booking.endDate.replace(/-/g, '') : start;
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OmniBook AGENTS.md//FR
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${booking.id}@omnibook.app
DTSTAMP:${now}
DTSTART;VALUE=DATE:${start}
DTEND;VALUE=DATE:${end}
SUMMARY:Réservation OmniBook - ${booking.resourceName}
DESCRIPTION:Réservation pour ${booking.guestName}\\nStatut: ${booking.status}\\nPrix: ${booking.totalPrice} EUR\\nNotes: ${booking.notes || 'Aucune'}
LOCATION:${booking.resourceName}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
}

export function downloadICS(booking: TimelineBooking) {
  const icsContent = generateICS(booking);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `reservation-${booking.id}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
