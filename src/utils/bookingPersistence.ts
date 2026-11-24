/** Demo/bootstrap classification is based on booking identity, never on its resource. */
export function isDemoBookingId(
  bookingId: string,
  demoBookingIds: ReadonlySet<string>,
): boolean {
  return demoBookingIds.has(bookingId);
}
