export interface CardLockBuildingRef { no: number }
export interface CardLockRoomRef { building: number; floor: number }

/** Preserve CardLock's original numeric identifiers: zero is a valid BldNo/FlrNo. */
export function getCardLockBuildingNumbers(
  buildings: CardLockBuildingRef[],
  rooms: CardLockRoomRef[],
): number[] {
  const numbers = new Set<number>();
  for (const building of buildings) {
    if (Number.isInteger(building.no) && building.no >= 0) numbers.add(building.no);
  }
  for (const room of rooms) {
    if (Number.isInteger(room.building) && room.building >= 0) numbers.add(room.building);
  }
  return [...numbers].sort((a, b) => a - b);
}

/** Floors are scoped to the selected building; floor zero is retained (ground floor). */
export function getCardLockFloorNumbers(rooms: CardLockRoomRef[], buildingNo: number): number[] {
  return [...new Set(rooms
    .filter((room) => room.building === buildingNo && Number.isInteger(room.floor) && room.floor >= 0)
    .map((room) => room.floor))].sort((a, b) => a - b);
}
