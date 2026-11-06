import { AppThemeId } from '../types/booking';

export interface ThemeDefinition {
  id: AppThemeId;
  name: {
    fr: string;
    en: string;
    ar: string;
  };
  subtitle: {
    fr: string;
    en: string;
    ar: string;
  };
  colors: string[];
  accentColor: string;
  stripColor: string;
  badge: {
    fr: string;
    en: string;
    ar: string;
  };
}

export const APP_THEMES: ThemeDefinition[] = [
  {
    id: 'classic-slate',
    name: {
      fr: 'Ardoise Moderne (Défaut)',
      en: 'Modern Slate (Default)',
      ar: 'أردواز عصري (افتراضي)',
    },
    subtitle: {
      fr: 'Bleu océan & ardoise classique pour hôtellerie contemporaine',
      en: 'Ocean blue & slate classic for contemporary hospitality',
      ar: 'أزرق محيطي وأردواز كلاسيكي لإدارة فندقية عصرية',
    },
    colors: ['#2563eb', '#3b82f6', '#0f172a', '#f8fafc'],
    accentColor: '#2563eb',
    stripColor: '#3b82f6',
    badge: {
      fr: 'Standard',
      en: 'Standard',
      ar: 'قياسي',
    },
  },
  {
    id: 'rose-gold',
    name: {
      fr: 'Luxe Rose & Sable Pêche',
      en: 'Rose Gold & Blush Luxury',
      ar: 'فخامة الورد والخوخ الرملي',
    },
    subtitle: {
      fr: 'Tons pêche poudré, or rose & argile douce de palace (Photo 1)',
      en: 'Powder peach, rose gold & soft palace clay (Photo 1)',
      ar: 'وردي خوخي فاخر، ذهب وردي ورمل ناعم للأجنحة الفاخرة (صورة 1)',
    },
    colors: ['#d48b78', '#e59885', '#f5d0c5', '#c4725a', '#fdf6f2'],
    accentColor: '#d48b78',
    stripColor: '#c4725a',
    badge: {
      fr: 'Luxe Palace',
      en: 'Luxury Palace',
      ar: 'قصر فخم',
    },
  },
  {
    id: 'forest-emerald',
    name: {
      fr: 'Émeraude des Forêts & Menthe',
      en: 'Alpine Forest Emerald & Mint',
      ar: 'زمرد الغابة ورغوة النعناع',
    },
    subtitle: {
      fr: 'Palette exacte #051F20, #0B2B26, #163832, #235347, #8EB69B, #DAF1DE (Photo 2)',
      en: 'Exact palette #051F20, #0B2B26, #163832, #235347, #8EB69B, #DAF1DE (Photo 2)',
      ar: 'لوحة متدرجة دقيقة من أعمق درجات الزمرد حتى رغوة النعناع الثلجية (صورة 2)',
    },
    colors: ['#051F20', '#0B2B26', '#163832', '#235347', '#8EB69B', '#DAF1DE'],
    accentColor: '#235347',
    stripColor: '#8EB69B',
    badge: {
      fr: 'Nature & Spa',
      en: 'Nature & Spa',
      ar: 'طبيعة ومنتجع',
    },
  },
  {
    id: 'olive-coral',
    name: {
      fr: 'Olive & Corail Couchant',
      en: 'Olive Moss & Sunset Coral',
      ar: 'زيتوني طبيعي ومرجان الغروب',
    },
    subtitle: {
      fr: 'Vert olive boisé, sauge et bandelette latérale corail (Photo 3)',
      en: 'Woodland olive, sage moss and coral pink lateral stripe (Photo 3)',
      ar: 'أخضر زيتوني دافئ مع حافة مرجانية مشرقة مستوحاة من الغروب (صورة 3)',
    },
    colors: ['#556b2f', '#606c38', '#9eb368', '#fefae0', '#df7b8c'],
    accentColor: '#606c38',
    stripColor: '#df7b8c',
    badge: {
      fr: 'Éco-Resort',
      en: 'Eco-Resort',
      ar: 'منتجع بيئي',
    },
  },
  {
    id: 'midnight-sand',
    name: {
      fr: 'Marine Profonde & Sable Chaud',
      en: 'Midnight Navy & Warm Sand',
      ar: 'أزرق كحلي ورمل الصحراء الدافئ',
    },
    subtitle: {
      fr: 'Dégradé 10 nuances : Deep Navy, Ocean Blue, Golden Sand & Ivory (Photo 4)',
      en: '10 shades gradient: Deep Navy, Ocean Blue, Golden Sand & Ivory (Photo 4)',
      ar: 'تناغم رائع بين أعماق المحيط الكحلية ورمال الصحراء الذهبية الناعمة (صورة 4)',
    },
    colors: ['#0a1626', '#152744', '#25446c', '#b78351', '#d6a771', '#faf6f0'],
    accentColor: '#25446c',
    stripColor: '#b78351',
    badge: {
      fr: 'Bord de Mer',
      en: 'Coastal Dunes',
      ar: 'شاطئي وكثبان',
    },
  },
  {
    id: 'crimson-eclipse',
    name: {
      fr: 'Éclipse Cramoisie & Anthracite',
      en: 'Crimson Eclipse & Charcoal',
      ar: 'كسوف قرمزي وفحم ليلي',
    },
    subtitle: {
      fr: 'Graphite minimaliste rehaussé d\'une bande verticale rubis écarlate (Photo 5)',
      en: 'Minimal charcoal elevated with a ruby crimson vertical strip (Photo 5)',
      ar: 'رمادي فحمي أنيق مع شريط جانبي قرمزي ياقوتي فائق الحداثة (صورة 5)',
    },
    colors: ['#121214', '#1f1f23', '#dc2626', '#ef4444', '#f43f5e'],
    accentColor: '#dc2626',
    stripColor: '#dc2626',
    badge: {
      fr: 'High-Tech',
      en: 'High-Tech',
      ar: 'عصري متطور',
    },
  },
  {
    id: 'amber-charcoal',
    name: {
      fr: 'Ambre & Anthracite Chaud',
      en: 'Marigold Amber & Charcoal',
      ar: 'عنبر دافئ وفحم أنيق',
    },
    subtitle: {
      fr: 'Anthracite brossé sublimé d\'un bandeau latéral orange souci (Photo 6)',
      en: 'Brushed charcoal accented with a warm marigold orange strip (Photo 6)',
      ar: 'خلفية فحمية دافئة مع شريط جانبي بلون العنبر والبرتقالي الملكي (صورة 6)',
    },
    colors: ['#1a1d24', '#262a33', '#f59e0b', '#ea580c', '#fbbf24'],
    accentColor: '#ea580c',
    stripColor: '#f59e0b',
    badge: {
      fr: 'Boutique Hôtel',
      en: 'Boutique Hotel',
      ar: 'فندق بوتيك',
    },
  },
  {
    id: 'oasis-noor',
    name: {
      fr: 'Oasis Noor (Émeraude & Or Sacré)',
      en: 'Oasis Noor (Sacred Emerald & Gold)',
      ar: 'واحة نور (زمردي ملكي وذهب خالص)',
    },
    subtitle: {
      fr: 'Inspiration Noor : parchemin ivoire, vert oasis & enluminures d\'or (Photo 7)',
      en: 'Noor aesthetic: ivory parchment, oasis green & golden radiance (Photo 7)',
      ar: 'طراز نور الإسلامي الرفيع: ورق عاجي أصيل، أخضر الواحة، وتوشيحات ذهبية (صورة 7)',
    },
    colors: ['#1b4332', '#2d6a4f', '#fbf7f0', '#d4af37', '#c59b27'],
    accentColor: '#1b4332',
    stripColor: '#d4af37',
    badge: {
      fr: 'Héritage & Prestige',
      en: 'Heritage & Prestige',
      ar: 'تراث وأصالة',
    },
  },
  {
    id: 'twinkle-indigo',
    name: {
      fr: 'Nuit Indigo & Caramel Twinkle',
      en: 'Twinkle Indigo & Warm Caramel',
      ar: 'ليل نيلي وكراميل دافئ',
    },
    subtitle: {
      fr: 'Ambiance nocturne indigo étoilé mariée à un caramel doux (Photo 8)',
      en: 'Starlit nocturnal indigo paired with soft warm caramel (Photo 8)',
      ar: 'سماء ليلية نيلية مرصعة بالنجوم مع لمسات كراميل مخملية (صورة 8)',
    },
    colors: ['#1b202e', '#252c3c', '#5b6e8a', '#d8a47f', '#c68b59'],
    accentColor: '#5b6e8a',
    stripColor: '#d8a47f',
    badge: {
      fr: 'Nocturne Cosy',
      en: 'Cosy Nocturne',
      ar: 'ليلي مريح',
    },
  },
];
