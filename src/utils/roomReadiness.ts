/** Hotel reservation invariant: only an explicitly clean (green) room is bookable. */
export function isRoomReadyForBooking(status: string | null | undefined): boolean {
  return status === 'clean';
}
