export interface RoomGenerationInput {
  buildingNumber: number;
  floorNumber: number;
  prefix?: string;
  start: number;
  end: number;
  padWidth?: number;
  excludedFloorNumbers?: string[];
  existingNames?: string[];
}

export interface GeneratedRoom {
  id: string;
  name: string;
  type: 'Chambre';
  sector: 'hotel';
  pricePerDay: number;
  housekeepingStatus: 'clean';
  capacity: number;
  building: string;
  floor: string;
}

export interface RoomGenerationResult {
  rooms: GeneratedRoom[];
  excluded: string[];
  duplicates: string[];
}

export function generateHotelFloorRooms(input: RoomGenerationInput): RoomGenerationResult {
  const { buildingNumber, floorNumber, start, end } = input;
  if (!Number.isInteger(buildingNumber) || buildingNumber < 1) throw new Error('Le numéro du bâtiment doit être un entier positif.');
  if (!Number.isInteger(floorNumber) || floorNumber < 0) throw new Error('Le numéro d’étage doit être un entier positif ou zéro.');
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) throw new Error('La plage de chambres est invalide.');
  if (end - start > 999) throw new Error('Une génération est limitée à 1 000 numéros par étage.');

  const prefix = input.prefix ?? '';
  const width = Math.max(input.padWidth ?? 0, String(start).length, String(end).length);
  const excluded = new Set((input.excludedFloorNumbers ?? ['13']).map((value) => value.trim()).filter(Boolean));
  const existing = new Set(input.existingNames ?? []);
  const rooms: GeneratedRoom[] = [];
  const skippedExcluded: string[] = [];
  const duplicates: string[] = [];

  for (let number = start; number <= end; number += 1) {
    const suffix = String(number).padStart(width, '0');
    const name = `${prefix}${suffix}`;
    if (excluded.has(suffix) || excluded.has(String(number))) {
      skippedExcluded.push(name);
      continue;
    }
    if (existing.has(name)) {
      duplicates.push(name);
      continue;
    }
    rooms.push({
      id: `manual-room-${buildingNumber}-${floorNumber}-${name}`,
      name,
      type: 'Chambre',
      sector: 'hotel',
      pricePerDay: 0,
      housekeepingStatus: 'clean',
      capacity: 1,
      building: String(buildingNumber),
      floor: String(floorNumber),
    });
  }

  return { rooms, excluded: skippedExcluded, duplicates };
}
