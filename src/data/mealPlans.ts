export interface MealPlanOption {
  id: string;
  code: string;
  name: { fr: string; en: string; ar: string };
  shortBadge: string;
  description: { fr: string; en: string; ar: string };
  pricePerPersonDay: number; // in base currency units
  iconName: string;
  includedItems: string[];
}

export const HOSPITALITY_MEAL_PLANS: MealPlanOption[] = [
  {
    id: 'ro',
    code: 'RO',
    name: {
      fr: 'Logement Seul (Room Only)',
      en: 'Room Only (No Meals)',
      ar: 'إقامة فقط (بدون وجبات)',
    },
    shortBadge: 'RO',
    description: {
      fr: 'Hébergement seul sans restauration. Liberté totale, idéal séjours d\'affaires ou clientèle autonome.',
      en: 'Room accommodation only without food service. Ideal for independent travelers or short stays.',
      ar: 'إقامة في الغرفة فقط دون خدمات الإطعام. مثالية للرحلات السريعة والاستقلالية التامة.',
    },
    pricePerPersonDay: 0,
    iconName: 'Bed',
    includedItems: ['Hébergement', 'Wi-Fi haut débit', 'Service de chambre standard'],
  },
  {
    id: 'bb',
    code: 'BB',
    name: {
      fr: 'Chambre & Petit-Déjeuner (Bed & Breakfast)',
      en: 'Bed & Breakfast',
      ar: 'غرفة مع إفطار الصباح',
    },
    shortBadge: 'BB',
    description: {
      fr: 'Chambre + grand buffet continental & américain chaque matin avec boissons chaudes et jus pressés.',
      en: 'Full room stay + daily hot & continental breakfast buffet with juices and fresh coffee.',
      ar: 'إقامة فندقية مع بوفيه إفطار ساخن وقاري غني يومياً ومشروبات طازجة.',
    },
    pricePerPersonDay: 15,
    iconName: 'Coffee',
    includedItems: ['Hébergement', 'Buffet Petit-Déjeuner complet (7h-10h30)', 'Boissons chaudes & jus'],
  },
  {
    id: 'hb',
    code: 'HB',
    name: {
      fr: 'Demi-Pension (Half Board)',
      en: 'Half Board',
      ar: 'نصف إقامة (فطور + عشاء)',
    },
    shortBadge: 'HB',
    description: {
      fr: 'Chambre + Petit-Déjeuner buffet + Dîner (ou Déjeuner au choix) au restaurant de l\'établissement.',
      en: 'Room + Breakfast buffet + Dinner (or Lunch) at the hotel gourmet restaurant.',
      ar: 'إقامة تشمل وجبة الإفطار اليومية ووجبة عشاء أو غداء بمطعم الفندق.',
    },
    pricePerPersonDay: 35,
    iconName: 'UtensilsCrossed',
    includedItems: ['Hébergement', 'Petit-déjeuner buffet', 'Dîner 3 services ou buffet du chef', 'Eau minérale de table'],
  },
  {
    id: 'fb',
    code: 'FB',
    name: {
      fr: 'Pension Complète (Full Board)',
      en: 'Full Board',
      ar: 'إقامة كاملة (3 وجبات)',
    },
    shortBadge: 'FB',
    description: {
      fr: 'Tous les 3 repas principaux inclus : Petit-Déjeuner, Déjeuner et Dîner avec eau minérale.',
      en: 'All 3 main daily meals included: Breakfast, Lunch, and Dinner with mineral water.',
      ar: 'تشمل الوجبات الثلاث اليومية الرئيسية: الفطور والغداء والعشاء.',
    },
    pricePerPersonDay: 55,
    iconName: 'ChefHat',
    includedItems: ['Hébergement', 'Petit-Déjeuner', 'Déjeuner gourmet', 'Dîner buffet ou carte', 'Eau de source'],
  },
  {
    id: 'ai',
    code: 'AI',
    name: {
      fr: 'Tout Compris (All Inclusive)',
      en: 'All Inclusive',
      ar: 'شامل كلياً (All Inclusive)',
    },
    shortBadge: 'All-In',
    description: {
      fr: 'Restauration complète en continu, snacks, glaces et boissons fraîches à volonté tout au long de la journée.',
      en: 'Full continuous dining, afternoon snacks, ice creams, and unlimited refreshments all day long.',
      ar: 'جميع الوجبات الرئيسية والخفيفة والمثلجات مع المشروبات المنعشة غير المحدودة طوال اليوم.',
    },
    pricePerPersonDay: 75,
    iconName: 'Sparkles',
    includedItems: ['3 repas principaux', 'Snacks & goûter 24h', 'Boissons & cocktails soft illimités', 'Accès piscine & transats'],
  },
  {
    id: 'uai',
    code: 'UAI',
    name: {
      fr: 'Ultra All Inclusive (VIP Palace)',
      en: 'Ultra All Inclusive (VIP)',
      ar: 'ألترا شامل فائق (VIP)',
    },
    shortBadge: 'Ultra AI',
    description: {
      fr: 'Service VIP 24h/24, minibar de chambre réapprovisionné, room service offert, accès spa & dîners gastronomiques.',
      en: '24/7 VIP concierge & room service, premium minibar, unlimited spa access & à-la-carte specialty restaurants.',
      ar: 'خدمة غرف ومشروبات ومطاعم متخصصة 24/24، ميني بار مجاني مع دخول غير محدود للسبا.',
    },
    pricePerPersonDay: 110,
    iconName: 'Crown',
    includedItems: ['Service 24h/24', 'Minibar gratuit rechargé', 'Accès Spa & Hammam illimité', 'Restaurants à la carte', 'Room service'],
  },
  {
    id: 'sc',
    code: 'SC',
    name: {
      fr: 'Gestion Libre (Self-Catering Airbnb)',
      en: 'Self-Catering (Apart / Villa)',
      ar: 'خدمة ذاتية ومطبخ مستقل (Airbnb)',
    },
    shortBadge: 'Self-Cat',
    description: {
      fr: 'Logement indépendant avec cuisine entièrement équipée (réfrigérateur, four, ustensiles), idéal séjours longs.',
      en: 'Fully equipped private kitchen apartment/villa for independent self-cooking and privacy.',
      ar: 'شقة أو فيلا مستقلة بمطبخ مجهز بالكامل للطبخ الذاتي والاستقلالية.',
    },
    pricePerPersonDay: 0,
    iconName: 'Home',
    includedItems: ['Cuisine tout équipée', 'Électroménager complet', 'Ménage de fin de séjour', 'Indépendance totale'],
  },
  {
    id: 'brunch',
    code: 'BRUNCH',
    name: {
      fr: 'Bed & Brunch (Week-end Gourmand)',
      en: 'Bed & Brunch Weekend',
      ar: 'مبيت وبرانش عطلة نهاية الأسبوع',
    },
    shortBadge: 'Brunch',
    description: {
      fr: 'Nuitée avec accès au grand Brunch dînatoire du week-end servi jusqu\'à 14h30 avec pâtisseries et grillades.',
      en: 'Overnight stay including extended weekend gourmet brunch served until 2:30 PM.',
      ar: 'مبيت مع بوفيه برانش فاخر ممتد لعطلة نهاية الأسبوع حتى الساعة 14:30.',
    },
    pricePerPersonDay: 28,
    iconName: 'Sun',
    includedItems: ['Nuitée', 'Grand Brunch week-end (10h-14h30)', 'Buffet salé/sucré & grillades', 'Départ tardif possible'],
  },
];

export const DIETARY_PREFERENCES = [
  { id: 'halal', label: 'Halal 100% certifié 🥩' },
  { id: 'vegetarian', label: 'Végétarien 🥗' },
  { id: 'vegan', label: 'Végétalien / Vegan 🌱' },
  { id: 'gluten_free', label: 'Sans gluten 🌾' },
  { id: 'kids_menu', label: 'Menu enfant / Bébé 👶' },
];
