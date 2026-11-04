/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Holidays & Geolocation Events Service
 * Provides public holidays (national and religious Hijri holidays) and cultural/seasonal
 * events according to geolocation (Algeria wilayas, France, International).
 */

export interface HolidayEvent {
  date: string; // YYYY-MM-DD
  name: string;
  nameAr?: string;
  category: 'national' | 'religious' | 'cultural' | 'high_season';
  description: string;
  suggestedMultiplier: number; // e.g. 1.25 for +25%, 1.50 for +50%
}

// Algerian Official National Holidays (Fixed Gregorian Dates)
export const ALGERIA_FIXED_HOLIDAYS: Array<{ month: number; day: number; nameFr: string; nameAr: string; desc: string; multiplier: number }> = [
  { month: 1, day: 1, nameFr: "Jour de l'An", nameAr: 'رأس السنة الميلادية', desc: 'Fête nationale chômée et payée', multiplier: 1.25 },
  { month: 1, day: 12, nameFr: 'Yennayer (Nouvel An Amazigh)', nameAr: 'رأس السنة الأمازيغية (يناير)', desc: 'Fête nationale chômée et payée', multiplier: 1.30 },
  { month: 5, day: 1, nameFr: 'Fête du Travail', nameAr: 'عيد العمال', desc: 'Fête internationale des travailleurs', multiplier: 1.25 },
  { month: 7, day: 5, nameFr: "Fête de l'Indépendance et de la Jeunesse", nameAr: 'عيد الاستقلال والشباب (5 جويلية)', desc: 'Commémoration de l\'indépendance nationale 1962', multiplier: 1.40 },
  { month: 11, day: 1, nameFr: 'Déclenchement de la Révolution de Libération', nameAr: 'ذكرى اندلاع ثورة أول نوفمبر 1954', desc: 'Fête nationale historique du 1er Novembre', multiplier: 1.35 },
];

// Algerian & Islamic Religious Holidays (calculated for 2025, 2026, 2027)
export const ISLAMIC_HOLIDAYS_TABLE: Record<number, Array<{ date: string; nameFr: string; nameAr: string; desc: string; multiplier: number }>> = {
  2025: [
    { date: '2025-03-30', nameFr: 'Aïd El-Fitr (1er jour)', nameAr: 'عيد الفطر المبارك', desc: 'Fin du mois sacré de Ramadhan', multiplier: 1.50 },
    { date: '2025-03-31', nameFr: 'Aïd El-Fitr (2ème jour)', nameAr: 'ثاني أيام عيد الفطر', desc: 'Fête religieuse nationale', multiplier: 1.45 },
    { date: '2025-06-06', nameFr: 'Aïd El-Adha (1er jour)', nameAr: 'عيد الأضحى المبارك', desc: 'Fête du Sacrifice', multiplier: 1.50 },
    { date: '2025-06-07', nameFr: 'Aïd El-Adha (2ème jour)', nameAr: 'ثاني أيام عيد الأضحى', desc: 'Fête religieuse nationale', multiplier: 1.45 },
    { date: '2025-06-26', nameFr: 'Awal Moharram (Nouvel An Hégirien 1447)', nameAr: 'أول محرم (رأس السنة الهجرية 1447)', desc: 'Nouvel an islamique', multiplier: 1.25 },
    { date: '2025-07-05', nameFr: 'Achoura', nameAr: 'عاشوراء', desc: '10 Moharram', multiplier: 1.20 },
    { date: '2025-09-04', nameFr: 'El Mawlid Ennabaoui Echarif', nameAr: 'المولد النبوي الشريف', desc: 'Naissance du Prophète (PBSL)', multiplier: 1.35 },
  ],
  2026: [
    { date: '2026-03-20', nameFr: 'Aïd El-Fitr (1er jour)', nameAr: 'عيد الفطر المبارك', desc: 'Fin du mois sacré de Ramadhan', multiplier: 1.50 },
    { date: '2026-03-21', nameFr: 'Aïd El-Fitr (2ème jour)', nameAr: 'ثاني أيام عيد الفطر', desc: 'Fête religieuse nationale', multiplier: 1.45 },
    { date: '2026-05-27', nameFr: 'Aïd El-Adha (1er jour)', nameAr: 'عيد الأضحى المبارك', desc: 'Fête du Sacrifice', multiplier: 1.50 },
    { date: '2026-05-28', nameFr: 'Aïd El-Adha (2ème jour)', nameAr: 'ثاني أيام عيد الأضحى', desc: 'Fête religieuse nationale', multiplier: 1.45 },
    { date: '2026-06-16', nameFr: 'Awal Moharram (Nouvel An Hégirien 1448)', nameAr: 'أول محرم (رأس السنة الهجرية 1448)', desc: 'Nouvel an islamique', multiplier: 1.25 },
    { date: '2026-06-25', nameFr: 'Achoura', nameAr: 'عاشوراء', desc: '10 Moharram', multiplier: 1.20 },
    { date: '2026-08-25', nameFr: 'El Mawlid Ennabaoui Echarif', nameAr: 'المولد النبوي الشريف', desc: 'Naissance du Prophète (PBSL)', multiplier: 1.35 },
  ],
  2027: [
    { date: '2027-03-10', nameFr: 'Aïd El-Fitr (1er jour)', nameAr: 'عيد الفطر المبارك', desc: 'Fin du mois sacré de Ramadhan', multiplier: 1.50 },
    { date: '2027-03-11', nameFr: 'Aïd El-Fitr (2ème jour)', nameAr: 'ثاني أيام عيد الفطر', desc: 'Fête religieuse nationale', multiplier: 1.45 },
    { date: '2027-05-17', nameFr: 'Aïd El-Adha (1er jour)', nameAr: 'عيد الأضحى المبارك', desc: 'Fête du Sacrifice', multiplier: 1.50 },
    { date: '2027-05-18', nameFr: 'Aïd El-Adha (2ème jour)', nameAr: 'ثاني أيام عيد الأضحى', desc: 'Fête religieuse nationale', multiplier: 1.45 },
    { date: '2027-06-06', nameFr: 'Awal Moharram (Nouvel An Hégirien 1449)', nameAr: 'أول محرم (رأس السنة الهجرية 1449)', desc: 'Nouvel an islamique', multiplier: 1.25 },
    { date: '2027-06-15', nameFr: 'Achoura', nameAr: 'عاشوراء', desc: '10 Moharram', multiplier: 1.20 },
    { date: '2027-08-14', nameFr: 'El Mawlid Ennabaoui Echarif', nameAr: 'المولد النبوي الشريف', desc: 'Naissance du Prophète (PBSL)', multiplier: 1.35 },
  ],
};

// Regional cultural events by Wilaya
export const REGIONAL_EVENTS_BY_WILAYA: Record<string, Array<{ month: number; startDay: number; endDay: number; nameFr: string; nameAr: string; desc: string; multiplier: number }>> = {
  '31': [
    { month: 7, startDay: 15, endDay: 20, nameFr: 'Festival National du Raï d\'Oran', nameAr: 'المهرجان الوطني لأغنية الراي بوهران', desc: 'Grand rassemblement musical et afflux touristique majeur', multiplier: 1.45 },
    { month: 10, startDay: 10, endDay: 14, nameFr: 'Salon HORECA & SIHRA Oran', nameAr: 'صالون الفندقة والسياحة بوهران', desc: 'Salon international des professionnels du tourisme et de l\'hôtellerie', multiplier: 1.30 },
    { month: 8, startDay: 1, endDay: 25, nameFr: 'Haute Saison Balnéaire Corniche d\'Oran', nameAr: 'موسم الاصطياف بكورنيش وهران', desc: 'Période de pic d\'affluence estivale côtière', multiplier: 1.40 },
  ],
  '16': [
    { month: 6, startDay: 18, endDay: 24, nameFr: 'Foire Internationale d\'Alger (FIA)', nameAr: 'معرض الجزائر الدولي (قصر المعارض)', desc: 'Plus grande manifestation économique d\'Afrique du Nord', multiplier: 1.40 },
    { month: 10, startDay: 22, endDay: 26, nameFr: 'Salon International du Tourisme (SITEV)', nameAr: 'الصالون الدولي للسياحة والأسفار', desc: 'Événement annuel majeur du tourisme à Alger', multiplier: 1.30 },
  ],
  '25': [
    { month: 5, startDay: 10, endDay: 15, nameFr: 'Festival Culturel du Malouf de Constantine', nameAr: 'المهرجان الثقافي للمألوف بقسنطينة', desc: 'Musique andalouse et patrimoine constantinois', multiplier: 1.35 },
  ],
  '13': [
    { month: 6, startDay: 5, endDay: 8, nameFr: 'Fête de la Cerise et Musique Hawzi Tlemcen', nameAr: 'مهرجان الكرز والموسيقى الحوزية بتلمسان', desc: 'Célébration culturelle traditionnelle', multiplier: 1.30 },
  ],
  '47': [
    { month: 3, startDay: 15, endDay: 19, nameFr: 'Fête Nationale du Tapis du M\'Zab', nameAr: 'المهرجان الوطني لزرابي غرداية ووادي ميزاب', desc: 'Afflux touristique et artisanal saharien', multiplier: 1.35 },
  ],
  '56': [
    { month: 9, startDay: 20, endDay: 25, nameFr: 'Festival International de la Sebeïba (Djanet)', nameAr: 'مهرجان السبيبة الدولي بجانت', desc: 'Célébration ancestrale touarègue classée au patrimoine mondial UNESCO', multiplier: 1.50 },
  ],
};

/**
 * Retrieve all holidays and events for a given year and geolocation (wilaya / country)
 */
export async function getHolidaysAndEvents(year: number, wilayaCode: string = '31', countryCode: string = 'DZ'): Promise<HolidayEvent[]> {
  const events: HolidayEvent[] = [];

  // 1. National Fixed Algerian Holidays
  for (const h of ALGERIA_FIXED_HOLIDAYS) {
    const dateStr = `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`;
    events.push({
      date: dateStr,
      name: h.nameFr,
      nameAr: h.nameAr,
      category: 'national',
      description: h.desc,
      suggestedMultiplier: h.multiplier,
    });
  }

  // 2. Religious Islamic Holidays
  const religious = ISLAMIC_HOLIDAYS_TABLE[year] || ISLAMIC_HOLIDAYS_TABLE[2026] || [];
  for (const r of religious) {
    events.push({
      date: r.date,
      name: r.nameFr,
      nameAr: r.nameAr,
      category: 'religious',
      description: r.desc,
      suggestedMultiplier: r.multiplier,
    });
  }

  // 3. Regional / Local Events for the selected Wilaya
  const regional = REGIONAL_EVENTS_BY_WILAYA[wilayaCode] || [];
  for (const reg of regional) {
    for (let day = reg.startDay; day <= reg.endDay; day++) {
      const dateStr = `${year}-${String(reg.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      events.push({
        date: dateStr,
        name: `${reg.nameFr} (Jour ${day - reg.startDay + 1})`,
        nameAr: reg.nameAr,
        category: 'cultural',
        description: reg.desc,
        suggestedMultiplier: reg.multiplier,
      });
    }
  }

  // Optional: Try public API if available and user requested international
  if (countryCode && countryCode !== 'DZ') {
    try {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
      if (res.ok) {
        const apiData = await res.json();
        for (const item of apiData) {
          if (!events.some((e) => e.date === item.date)) {
            events.push({
              date: item.date,
              name: item.localName || item.name,
              category: 'national',
              description: `Fête légale (${countryCode})`,
              suggestedMultiplier: 1.25,
            });
          }
        }
      }
    } catch {
      // Graceful offline fallback
    }
  }

  // Sort events chronologically
  return events.sort((a, b) => a.date.localeCompare(b.date));
}
