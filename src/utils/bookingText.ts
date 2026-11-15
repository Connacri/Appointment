/**
 * Bookings, resources and imported inventory can carry missing or non-string
 * text fields (no guest name, no e-mail, a legacy Date object, an old import
 * without a room label). Calling `.toLowerCase()` on such a value throws during
 * render, which unmounts the whole React tree and leaves a blank page behind the
 * dialogs. Every text comparison coming from stored data goes through here.
 */
export const normalizeBookingText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
