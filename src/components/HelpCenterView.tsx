import React, { useMemo, useState } from 'react';
import {
  BookOpen, Search, CalendarDays, BedDouble, Receipt, Sparkles, ClipboardList,
  Boxes, Coins, Globe, KeyRound, Flower2, BarChart3, Users, Building2,
  QrCode, ChevronRight, ChevronLeft, Clock3, CheckCircle2, Circle,
  AlertTriangle, Lightbulb, PlayCircle, GraduationCap, Wrench, FileText,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

type Locale = 'fr' | 'en' | 'ar';
type Tutorial = {
  id: string;
  category: string;
  icon: React.ElementType;
  duration: string;
  availability: 'available' | 'planned';
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
  prerequisites: Record<Locale, string[]>;
  steps: Record<Locale, string[]>;
  result: Record<Locale, string>;
  warnings: Record<Locale, string[]>;
  tips: Record<Locale, string[]>;
};

const tutorials: Tutorial[] = [
  {
    id: 'hotel-first-setup', category: 'administration', icon: Building2, duration: '15 min', availability: 'available',
    title: {
      fr: 'Créer votre hôtel : guide complet pour débutant',
      en: 'Set up your hotel: complete beginner guide',
      ar: 'إعداد فندقك: دليل كامل للمبتدئين'
    },
    summary: {
      fr: 'Choisir entre importer CardLock.mdb et créer un hôtel neuf, construire les bâtiments, les étages et les chambres sans doublons.',
      en: 'Choose between importing CardLock.mdb and creating a new hotel, then build buildings, floors and rooms without duplicates.',
      ar: 'اختر بين استيراد CardLock.mdb وإنشاء فندق جديد، ثم أنشئ المباني والطوابق والغرف دون تكرار.'
    },
    prerequisites: {
      fr: ['Pour une reprise proUSB : fermez le logiciel de serrures avant de copier sa base et préparez une sauvegarde.', 'Pour un hôtel neuf : préparez le nom des bâtiments, le nombre d’étages et la règle de numérotation de chaque étage.', 'Ne mélangez pas un import CardLock et une création manuelle sans décider quelle structure doit faire autorité.'],
      en: ['For a proUSB migration, close the lock software before copying its database and prepare a backup.', 'For a new hotel, prepare building names, floor counts and each floor numbering rule.', 'Do not mix a CardLock import and manual creation without deciding which structure is authoritative.'],
      ar: ['عند الترحيل من proUSB، أغلق برنامج الأقفال قبل نسخ القاعدة وجهز نسخة احتياطية.', 'لإنشاء فندق جديد، جهز أسماء المباني وعدد الطوابق وقاعدة ترقيم كل طابق.', 'لا تخلط استيراد CardLock مع الإنشاء اليدوي دون تحديد الهيكل المعتمد.']
    },
    steps: {
      fr: [
        'Ouvrez « Configuration établissement » au premier lancement, ou depuis les paramètres. Commencez par le nom officiel, le type d’établissement, la ville et la devise. Vous pourrez ajouter le logo, les contacts et les informations fiscales ensuite.',
        'Dans « Bâtiments & Chambres », choisissez une seule méthode initiale : « Importer CardLock.mdb » pour reprendre un hôtel proUSB existant, ou « Créer la structure manuellement » pour un nouvel hôtel.',
        'Pour CardLock, sélectionnez le fichier du logiciel proUSB. Le chemin courant est C:\\Program Files (x86)\\ProUSB SOFTWARE\\proUSBHotelLockSystem\\CardLock.mdb. Si plusieurs copies existent, comparez leurs dates : la copie VirtualStore de Windows peut être plus récente.',
        'Avant de confirmer un remplacement, vérifiez l’aperçu des bâtiments, chambres, séjours, cartes et l’inventaire des tables. Le lecteur examine toutes les tables présentes. Les tables BuildingInfo, RoomInfo, GuestInfo, CardInfo et RecordOpen alimentent les données métier prises en charge ; les autres tables restent inventoriées et ne sont pas converties aveuglément en réservations.',
        'Pour créer manuellement, saisissez le nom du bâtiment et son numéro. Créez les étages un par un : 0 désigne le rez-de-chaussée, 1 le premier étage, 2 le deuxième étage, etc.',
        'Définissez le format des chambres. Exemple : préfixe 1, début 01, fin 30. Appointment génère 101 à 130. Au deuxième étage, utilisez le préfixe 2 pour obtenir 201 à 230.',
        'Dans « Numéros à exclure », laissez 13 si votre hôtel ne possède pas de chambre portant ce numéro. Avec le préfixe 1, la chambre 113 sera exclue ; au deuxième étage, 213 sera exclue. Vous pouvez ajouter plusieurs exclusions séparées par des virgules, par exemple 13,17.',
        'Contrôlez le récapitulatif : nombre de chambres créées, numéros exclus et doublons ignorés. Répétez l’opération pour chaque étage et chaque bâtiment. Vérifiez que les numéros restent uniques dans le bâtiment.',
        'Enregistrez l’établissement, ouvrez le planning Gantt et contrôlez chaque bâtiment, étage et chambre. Corrigez la structure avant de saisir des réservations réelles.'
      ],
      en: [
        'Open Establishment Setup on first launch or from Settings. Enter the official name, property type, city and currency first. Logo, contacts and tax details can be added later.',
        'In Buildings & Rooms, choose one initial method: Import CardLock.mdb to migrate an existing proUSB hotel, or Create structure manually for a new hotel.',
        'For CardLock, select the proUSB database. The usual path is C:\\Program Files (x86)\\ProUSB SOFTWARE\\proUSBHotelLockSystem\\CardLock.mdb. If multiple copies exist, compare modification times: Windows VirtualStore may contain the newer copy.',
        'Before confirming replacement, review buildings, rooms, stays, cards and the table inventory. The importer reads every table. BuildingInfo, RoomInfo, GuestInfo, CardInfo and RecordOpen feed supported business data; other tables are inventoried and are not blindly converted into bookings.',
        'For manual setup, enter the building name and number. Create floors one at a time: 0 is ground floor, 1 is first floor, 2 is second floor, and so on.',
        'Set the room number format. Example: prefix 1, start 01, end 30 generates 101 through 130. On floor two, use prefix 2 to generate 201 through 230.',
        'In Excluded numbers, keep 13 if the hotel does not have a room with that number. Prefix 1 excludes 113; floor two excludes 213. Add comma-separated exclusions such as 13,17.',
        'Review the summary: created rooms, excluded numbers and ignored duplicates. Repeat for each floor and building. Ensure room names remain unique within a building.',
        'Save the property, open the Gantt planner and verify every building, floor and room before entering real bookings.'
      ],
      ar: [
        'افتح إعداد المؤسسة عند التشغيل الأول أو من الإعدادات. أدخل الاسم الرسمي ونوع المؤسسة والمدينة والعملة أولاً. يمكنك إضافة الشعار وبيانات الاتصال والضرائب لاحقاً.',
        'في قسم المباني والغرف، اختر طريقة واحدة للبدء: استيراد CardLock.mdb لترحيل فندق proUSB قائم، أو إنشاء الهيكل يدوياً لفندق جديد.',
        'لاستيراد CardLock، اختر قاعدة بيانات proUSB. المسار المعتاد هو C:\\Program Files (x86)\\ProUSB SOFTWARE\\proUSBHotelLockSystem\\CardLock.mdb. إذا وجدت نسخاً متعددة، قارن تاريخ التعديل؛ قد تحتوي VirtualStore على النسخة الأحدث.',
        'قبل تأكيد الاستبدال، راجع المباني والغرف والإقامات والبطاقات وفهرس الجداول. يقرأ المستورد جميع الجداول. تغذي BuildingInfo وRoomInfo وGuestInfo وCardInfo وRecordOpen البيانات المدعومة؛ أما بقية الجداول فتظهر في الفهرس ولا تحول عشوائياً إلى حجوزات.',
        'للإنشاء اليدوي، أدخل اسم المبنى ورقمه. أنشئ الطوابق واحداً تلو الآخر: 0 للطابق الأرضي، 1 للأول، 2 للثاني وهكذا.',
        'حدد تنسيق أرقام الغرف. مثال: البادئة 1 والبداية 01 والنهاية 30 ينتج الغرف 101 إلى 130. للطابق الثاني استخدم البادئة 2 لإنتاج 201 إلى 230.',
        'في الأرقام المستثناة، اترك 13 إذا كان الفندق لا يستخدم هذا الرقم. مع البادئة 1 تُستثنى الغرفة 113، وفي الطابق الثاني 213. يمكنك إدخال عدة أرقام مفصولة بفواصل مثل 13,17.',
        'راجع الملخص: الغرف المنشأة والأرقام المستثناة والتكرارات المتجاهلة. كرر العملية لكل طابق ومبنى، وتأكد من عدم تكرار رقم الغرفة داخل المبنى.',
        'احفظ المؤسسة وافتح مخطط Gantt وتحقق من كل مبنى وطابق وغرفة قبل إدخال حجوزات حقيقية.'
      ]
    },
    result: {
      fr: 'L’hôtel possède une structure cohérente : bâtiments, étages et chambres identifiables, sans numéro interdit ni doublon involontaire.',
      en: 'The hotel has a consistent structure: identifiable buildings, floors and rooms, with no excluded numbers or accidental duplicates.',
      ar: 'أصبح للفندق هيكل متناسق من مبانٍ وطوابق وغرف مع استبعاد الأرقام المطلوبة ومنع التكرار غير المقصود.'
    },
    warnings: {
      fr: [
        'Un import CardLock remplace la structure hôtelière existante après confirmation. Faites une sauvegarde avant une migration.',
        'Ne choisissez pas automatiquement le fichier le plus ancien : la copie de Program Files peut être figée alors que VirtualStore contient les changements récents.',
        'Les tables OperatorInfo, RegInfo, CaoZuoInfo, Dai et LogInfo ne sont pas des réservations. Leur sens détaillé doit être validé avant toute conversion métier.',
        'Le numéro 13 est une convention par défaut, pas une obligation universelle. Modifiez la liste d’exclusion si votre hôtel utilise ce numéro.'
      ],
      en: [
        'A CardLock import replaces the current hotel structure after confirmation. Back up before migration.',
        'Do not automatically choose the oldest file: Program Files may be stale while VirtualStore contains recent changes.',
        'OperatorInfo, RegInfo, CaoZuoInfo, Dai and LogInfo are not bookings. Their detailed meaning must be validated before business conversion.',
        'Room 13 is a default convention, not a universal rule. Change exclusions if your hotel uses it.'
      ],
      ar: [
        'استيراد CardLock يستبدل هيكل الفندق الحالي بعد التأكيد. أنشئ نسخة احتياطية قبل الترحيل.',
        'لا تختر الملف الأقدم تلقائياً؛ قد تكون نسخة Program Files قديمة بينما تحتوي VirtualStore على التغييرات الحديثة.',
        'الجداول OperatorInfo وRegInfo وCaoZuoInfo وDai وLogInfo ليست حجوزات. يجب التحقق من معناها قبل تحويلها إلى بيانات أعمال.',
        'الغرفة 13 قاعدة افتراضية وليست إلزامية لكل الفنادق. عدّل قائمة الاستثناءات إذا كان فندقك يستخدم هذا الرقم.'
      ]
    },
    tips: {
      fr: ['Commencez par un seul bâtiment et un seul étage pour valider votre format avant de générer tout l’hôtel.', 'Conservez une copie originale CardLock non modifiée. Appointment lit la base ; il ne doit pas réécrire le fichier proUSB.', 'Les cartes physiques se programment sur l’encodeur et la serrure, pas dans le Gantt. Consultez le tutoriel « Programmer les serrures proUSB ».'],
      en: ['Start with one building and one floor to validate the format before generating the whole hotel.', 'Keep an untouched copy of the original CardLock database. Appointment reads it and must not rewrite the proUSB file.', 'Physical cards are programmed with the encoder and lock, not in Gantt. See the proUSB lock programming tutorial.'],
      ar: ['ابدأ بمبنى واحد وطابق واحد للتحقق من التنسيق قبل إنشاء الفندق بالكامل.', 'احتفظ بنسخة أصلية غير معدلة من CardLock. يقرأ Appointment القاعدة ولا ينبغي أن يكتب فوق ملف proUSB.', 'تتم برمجة البطاقات الفعلية بواسطة المشفر والقفل وليس من Gantt. راجع دليل برمجة أقفال proUSB.']
    }
  },
  {
    id: 'prousb-lock-programming', category: 'administration', icon: KeyRound, duration: '12 min', availability: 'available',
    title: {
      fr: 'Installer et programmer les serrures proUSB',
      en: 'Install and program proUSB door locks',
      ar: 'تثبيت وبرمجة أقفال proUSB'
    },
    summary: {
      fr: 'Suivre la procédure constructeur pour l’encodeur USB, la carte système, les cartes clients, la carte maître et le réglage de l’horloge.',
      en: 'Follow the manufacturer procedure for the USB encoder, system card, guest cards, master card and lock clock.',
      ar: 'اتبع تعليمات الشركة المصنعة لمشفر USB وبطاقة النظام وبطاقات النزلاء والبطاقة الرئيسية وضبط ساعة القفل.'
    },
    prerequisites: {
      fr: ['Installer le logiciel proUSB fourni avec l’encodeur.', 'Brancher l’encodeur USB et vérifier qu’il est détecté.', 'Préparer une carte système et les cartes vierges adaptées au modèle de serrure.'],
      en: ['Install the proUSB software supplied with the encoder.', 'Connect the USB encoder and verify detection.', 'Prepare a system card and blank cards compatible with the lock model.'],
      ar: ['ثبت برنامج proUSB المرفق مع المشفر.', 'صل مشفر USB وتأكد من تعرف النظام عليه.', 'جهز بطاقة النظام والبطاقات الفارغة المتوافقة مع طراز القفل.']
    },
    steps: {
      fr: [
        'Installez le logiciel depuis le CD fourni avec le boîtier encodeur, puis suivez l’assistant d’installation.',
        'Branchez l’encodeur USB. Dans le logiciel constructeur, ouvrez une session avec le code Admin ; le guide indique qu’aucun mot de passe n’est défini par défaut.',
        'Ouvrez System Options. Configurez le chemin de sauvegarde quotidien et les autres paramètres demandés. Enregistrez le numéro de l’encodeur et suivez la procédure officielle de registration ; ne choisissez pas « For door lock installation only » pour une installation normale.',
        'Dans Operator Management, créez les opérateurs selon les responsabilités de l’hôtel.',
        'Créez le bâtiment et les chambres dans le logiciel constructeur ou importez la structure déjà validée dans Appointment. Vérifiez que les numéros correspondent exactement aux étiquettes physiques.',
        'Placez une carte vierge sur l’encodeur et émettez une System Card (Authorizing Card). Le constructeur indique une carte d’autorisation système par hôtel. Identifiez-la et conservez-la séparément.',
        'Pour chaque chambre, placez une carte vierge sur l’encodeur et émettez la Guest Card correspondant exactement au numéro de cette chambre.',
        'Sur la serrure physique, présentez la carte système trois fois de suite. Immédiatement après, présentez une fois la carte client de la chambre concernée. Les signaux lumineux et sonores indiquent la réussite selon le guide.',
        'Émettez une Master Card si nécessaire : elle peut ouvrir les serrures déjà configurées. Émettez une Clock Setting Card en cas de décalage d’horloge et présentez-la rapidement sur la serrure.',
        'Testez chaque porte avec la carte qui lui correspond et consignez le résultat, le bâtiment, l’étage et la chambre.'
      ],
      en: [
        'Install the software from the CD supplied with the encoder and follow the installer.',
        'Connect the USB encoder. In the manufacturer software, sign in with Admin; the guide states that no password is set by default.',
        'Open System Options. Configure the daily backup location and required settings. Record the encoder number and follow the official registration process; do not choose “For door lock installation only” for a normal installation.',
        'Create operators in Operator Management according to hotel responsibilities.',
        'Create the building and rooms in the manufacturer software or import the validated structure from Appointment. Room numbers must exactly match physical labels.',
        'Place a blank card on the encoder and issue a System Card (Authorizing Card). The manufacturer specifies one authorization system card per hotel. Label it and store it separately.',
        'For each room, place a blank card on the encoder and issue the Guest Card matching that exact room number.',
        'At the physical lock, swipe the system card three consecutive times. Immediately swipe the matching guest card once. Light and sound signals indicate success according to the guide.',
        'Issue a Master Card if required; it can open locks already configured. If the lock clock is incorrect, issue a Clock Setting Card and swipe it promptly.',
        'Test every door with its matching card and record the result, building, floor and room.'
      ],
      ar: [
        'ثبت البرنامج من القرص المرفق مع صندوق المشفر واتبع خطوات التثبيت.',
        'صل مشفر USB. في برنامج الشركة المصنعة، سجل الدخول بالرمز Admin؛ يذكر الدليل أن كلمة المرور الافتراضية غير محددة.',
        'افتح System Options واضبط مسار النسخ الاحتياطي اليومي والإعدادات المطلوبة. سجل رقم المشفر واتبع إجراء التسجيل الرسمي؛ لا تختر “For door lock installation only” في التثبيت العادي.',
        'أنشئ المشغلين في Operator Management حسب مسؤوليات الفندق.',
        'أنشئ المبنى والغرف في برنامج الشركة المصنعة أو استورد الهيكل المعتمد من Appointment. يجب أن تتطابق أرقام الغرف تماماً مع الملصقات الفعلية.',
        'ضع بطاقة فارغة على المشفر وأصدر System Card (Authorizing Card). تحدد الشركة بطاقة تفويض نظام واحدة لكل فندق. ضع عليها تسمية واحفظها منفصلة.',
        'لكل غرفة، ضع بطاقة فارغة على المشفر وأصدر Guest Card المطابقة تماماً لرقم الغرفة.',
        'على القفل الفعلي، مرر بطاقة النظام ثلاث مرات متتالية. فوراً بعدها مرر بطاقة النزيل المطابقة مرة واحدة. تشير الإشارات الضوئية والصوتية إلى النجاح وفق الدليل.',
        'أصدر Master Card عند الحاجة؛ يمكنها فتح الأقفال التي تمت برمجتها. إذا كانت ساعة القفل غير صحيحة، أصدر Clock Setting Card ومررها بسرعة.',
        'اختبر كل باب بالبطاقة المطابقة وسجل النتيجة والمبنى والطابق والغرفة.'
      ]
    },
    result: {
      fr: 'Chaque serrure est associée à la bonne chambre et les cartes fonctionnelles sont identifiées et conservées.',
      en: 'Each lock is assigned to the correct room and functional cards are identified and stored safely.',
      ar: 'يرتبط كل قفل بالغرفة الصحيحة ويتم تحديد البطاقات الوظيفية وحفظها بأمان.'
    },
    warnings: {
      fr: [
        'La carte système est critique : une carte par hôtel selon le constructeur. Ne la distribuez pas comme une carte client.',
        'Ne présentez pas une carte client d’une autre chambre après les trois passages de la carte système.',
        'Le guide indique qu’une réinitialisation par clé mécanique trois fois, carte système trois fois puis carte client une fois efface les données de la serrure. Cette séquence est destructive : ne l’exécutez qu’avec autorisation et procédure constructeur.',
        'Le test d’une carte avant autorisation ne prouve pas que la serrure est correctement affectée à une chambre.'
      ],
      en: [
        'The system card is critical: one per hotel according to the manufacturer. Never distribute it as a guest card.',
        'Do not swipe a guest card for another room after the three system-card swipes.',
        'The guide says that turning the mechanical key three times, swiping the system card three times and then a guest card once clears lock data. This is destructive; perform it only with authorization and the manufacturer procedure.',
        'Testing a card before authorization does not prove the lock is assigned to the correct room.'
      ],
      ar: [
        'بطاقة النظام حساسة للغاية؛ بطاقة واحدة لكل فندق وفق الشركة المصنعة. لا توزعها كبطاقة نزيل.',
        'لا تمرر بطاقة غرفة أخرى بعد تمرير بطاقة النظام ثلاث مرات.',
        'يذكر الدليل أن تدوير المفتاح الميكانيكي ثلاث مرات ثم بطاقة النظام ثلاث مرات ثم بطاقة النزيل مرة واحدة يمسح بيانات القفل. هذا إجراء مدمر؛ لا تنفذه إلا بتفويض ووفق تعليمات الشركة.',
        'اختبار البطاقة قبل التفويض لا يثبت أن القفل مرتبط بالغرفة الصحيحة.'
      ]
    },
    tips: {
      fr: ['Étiquetez la carte système et stockez-la dans un emplacement sécurisé accessible uniquement aux responsables autorisés.', 'Effectuez un test porte par porte après programmation et après tout remplacement de serrure.', 'Conservez une copie de sauvegarde CardLock avant toute opération de maintenance.'],
      en: ['Label the system card and store it securely with access limited to authorized managers.', 'Test every door after programming and after replacing a lock.', 'Keep a CardLock backup before maintenance.'],
      ar: ['ضع تسمية على بطاقة النظام واحفظها في مكان آمن لا يصل إليه إلا المسؤولون المخولون.', 'اختبر كل باب بعد البرمجة وبعد استبدال أي قفل.', 'احتفظ بنسخة احتياطية من CardLock قبل الصيانة.']
    }
  },
  {
    id: 'cardlock-backup-recovery', category: 'administration', icon: FileText, duration: '6 min', availability: 'available',
    title: {
      fr: 'Sauvegarder et restaurer CardLock.mdb',
      en: 'Back up and restore CardLock.mdb',
      ar: 'نسخ واستعادة CardLock.mdb'
    },
    summary: {
      fr: 'Comprendre les sauvegardes quotidiennes CardLock datées et restaurer une copie sans écraser la seule base valide.',
      en: 'Understand dated daily CardLock backups and restore a copy without overwriting the only valid database.',
      ar: 'فهم نسخ CardLock اليومية المؤرخة واستعادة نسخة دون الكتابة فوق قاعدة البيانات الوحيدة السليمة.'
    },
    prerequisites: {
      fr: ['Connaître le chemin de sauvegarde configuré dans System Options.', 'Disposer d’un accès au dossier CardLock et fermer le logiciel proUSB avant restauration.'],
      en: ['Know the backup path configured in System Options.', 'Have access to the CardLock folder and close proUSB before restoring.'],
      ar: ['اعرف مسار النسخ الاحتياطي المحدد في System Options.', 'تأكد من إمكانية الوصول إلى مجلد CardLock وأغلق proUSB قبل الاستعادة.']
    },
    steps: {
      fr: [
        'Dans le logiciel proUSB, définissez le dossier de sauvegarde. Le constructeur indique qu’une sauvegarde est effectuée une fois par jour.',
        'Repérez le fichier daté. Exemple du guide : CardLock101126.MDB. Le nom CardLock est suivi de six chiffres de date.',
        'Avant toute manipulation, copiez le fichier de sauvegarde dans un autre dossier et conservez l’original intact.',
        'Pour restaurer, fermez complètement le logiciel de gestion des serrures. Ne restaurez jamais une base pendant que proUSB est ouvert.',
        'Choisissez la sauvegarde la plus récente qui a été vérifiée. Copiez-la dans le dossier du logiciel et renommez la copie en CardLock.MDB en retirant les six chiffres de date.',
        'Si Windows demande de remplacer le fichier existant, ne confirmez qu’après avoir vérifié que l’ancienne base est sauvegardée ailleurs.',
        'Relancez proUSB et vérifiez les bâtiments, chambres et données attendues. Comparez ensuite le résultat avec Appointment.'
      ],
      en: [
        'In proUSB, choose the backup folder. The manufacturer says a backup is created once per day.',
        'Find the dated file. The guide example is CardLock101126.MDB: CardLock followed by six date digits.',
        'Before changing anything, copy the backup to another folder and keep the original untouched.',
        'To restore, fully close the lock management software. Never restore while proUSB is running.',
        'Choose the newest verified backup. Copy it into the software folder and rename the copy to CardLock.MDB by removing the six date digits.',
        'If Windows asks to replace the existing file, confirm only after the old database has been backed up elsewhere.',
        'Restart proUSB and verify buildings, rooms and expected records. Compare the result with Appointment.'
      ],
      ar: [
        'في برنامج proUSB حدد مجلد النسخ الاحتياطي. تذكر الشركة أن النسخ يتم مرة واحدة يومياً.',
        'ابحث عن الملف المؤرخ. مثال الدليل: CardLock101126.MDB؛ يأتي بعد CardLock ستة أرقام للتاريخ.',
        'قبل أي تغيير، انسخ ملف النسخة الاحتياطية إلى مجلد آخر واحتفظ بالأصل دون تعديل.',
        'للاستعادة، أغلق برنامج إدارة الأقفال بالكامل. لا تستعد قاعدة البيانات أثناء تشغيل proUSB.',
        'اختر أحدث نسخة تم التحقق منها. انسخها إلى مجلد البرنامج وأعد تسمية النسخة إلى CardLock.MDB بحذف أرقام التاريخ الستة.',
        'إذا طلب Windows استبدال الملف الموجود، لا توافق إلا بعد حفظ القاعدة القديمة في مكان آخر.',
        'أعد تشغيل proUSB وتحقق من المباني والغرف والسجلات المتوقعة، ثم قارن النتيجة مع Appointment.'
      ]
    },
    result: {
      fr: 'La base restaurée est lisible par proUSB et les données attendues sont présentes.',
      en: 'The restored database opens in proUSB and contains the expected data.',
      ar: 'يمكن لبرنامج proUSB فتح القاعدة المستعادة وتحتوي على البيانات المتوقعة.'
    },
    warnings: {
      fr: ['Ne renommez jamais l’unique sauvegarde : travaillez sur une copie.', 'Le guide constructeur mentionne parfois C:\\Program Files\\proUSB lock system\\ ; votre installation peut utiliser Program Files (x86) et un autre sous-dossier.', 'Appointment doit importer une copie de CardLock et ne doit pas modifier la base originale.'],
      en: ['Never rename the only backup; work on a copy.', 'The manufacturer guide sometimes shows C:\\Program Files\\proUSB lock system\\; your installation may use Program Files (x86) and a different subfolder.', 'Appointment should import a copy of CardLock and must not modify the original database.'],
      ar: ['لا تعِد تسمية النسخة الاحتياطية الوحيدة؛ اعمل على نسخة.', 'يذكر دليل الشركة أحياناً C:\\Program Files\\proUSB lock system\\؛ قد يستخدم تثبيتك Program Files (x86) ومجلداً فرعياً مختلفاً.', 'ينبغي أن يستورد Appointment نسخة من CardLock وألا يعدل القاعدة الأصلية.']
    },
    tips: {
      fr: ['Conservez plusieurs jours de sauvegardes, pas uniquement la dernière.', 'Notez la date de la sauvegarde et le poste qui l’a produite.', 'Testez périodiquement une restauration sur une copie, jamais directement sur la base de production.'],
      en: ['Keep multiple days of backups, not only the latest one.', 'Record the backup date and the computer that created it.', 'Periodically test restoration on a copy, never directly on the production database.'],
      ar: ['احتفظ بنسخ لعدة أيام وليس بآخر نسخة فقط.', 'سجل تاريخ النسخة والجهاز الذي أنشأها.', 'اختبر الاستعادة دورياً على نسخة وليس على قاعدة الإنتاج مباشرة.']
    }
  },

  {
    id: 'planning', category: 'reservations', icon: CalendarDays, duration: '6 min', availability: 'available',
    title: { fr: 'Comprendre le planning Gantt', en: 'Understand the Gantt planner', ar: 'فهم مخطط جانت' },
    summary: { fr: 'Lire les disponibilités, les chambres, les séjours et les statuts depuis le planning.', en: 'Read availability, rooms, stays and statuses in the planner.', ar: 'قراءة التوفر والغرف والإقامات والحالات من المخطط.' },
    prerequisites: { fr: ['Avoir sélectionné le bon établissement et le bon secteur.', 'Disposer du rôle autorisé pour consulter le planning.'], en: ['Select the correct property and sector.', 'Have a role allowed to view the planner.'], ar: ['اختر المؤسسة والقسم الصحيحين.', 'امتلك صلاحية عرض المخطط.'] },
    steps: {
      fr: ['Ouvrez « Planning Gantt » depuis le menu principal.', 'Choisissez le secteur et le bâtiment à consulter.', 'Repérez les chambres sur les lignes et les dates sur les colonnes.', 'Utilisez la navigation de dates et le bouton « Aujourd’hui » pour revenir à la date courante.', 'Cliquez sur une réservation pour consulter ses informations et les actions disponibles.', 'Utilisez le statut housekeeping pour distinguer une chambre propre, en nettoyage, sale ou hors service.'],
      en: ['Open Gantt Planning from the main menu.', 'Choose the sector and building.', 'Read rooms on rows and dates on columns.', 'Use date navigation and Today to return to the current date.', 'Select a booking to view its details and available actions.', 'Use housekeeping status to identify clean, cleaning, dirty or out-of-order rooms.'],
      ar: ['افتح مخطط جانت من القائمة الرئيسية.', 'اختر القسم والمبنى.', 'تظهر الغرف في الصفوف والتواريخ في الأعمدة.', 'استخدم التنقل بين التواريخ وزر اليوم للعودة إلى التاريخ الحالي.', 'اضغط على الحجز لعرض التفاصيل والإجراءات.', 'تحقق من حالة التدبير المنزلي: نظيفة أو قيد التنظيف أو متسخة أو خارج الخدمة.']
    },
    result: { fr: 'Vous savez lire l’occupation et identifier les disponibilités et les anomalies.', en: 'You can read occupancy and identify availability and exceptions.', ar: 'يمكنك قراءة الإشغال وتحديد التوفر والحالات غير الطبيعية.' },
    warnings: { fr: ['Une cellule vide ne garantit pas à elle seule qu’une chambre est réservable : vérifiez aussi son état et les règles de séjour.', 'Une chambre hors service ne doit pas être attribuée.'], en: ['An empty cell alone does not guarantee a room can be booked; check its status and stay rules.', 'Do not assign an out-of-order room.'], ar: ['الخلية الفارغة لا تعني بالضرورة أن الغرفة متاحة؛ تحقق من حالتها وقواعد الإقامة.', 'لا تخصص غرفة خارج الخدمة.'] },
    tips: { fr: ['Filtrez par bâtiment pour réduire le bruit visuel.', 'Sur mobile, faites défiler le planning horizontalement et verticalement.'], en: ['Filter by building to reduce visual noise.', 'On mobile, scroll the planner horizontally and vertically.'], ar: ['قم بالتصفية حسب المبنى لتقليل ازدحام العرض.', 'على الهاتف، مرر المخطط أفقياً وعمودياً.'] }
  },
  {
    id: 'create-booking', category: 'reservations', icon: BedDouble, duration: '8 min', availability: 'available',
    title: { fr: 'Créer une réservation individuelle', en: 'Create an individual booking', ar: 'إنشاء حجز فردي' },
    summary: { fr: 'Enregistrer un client, choisir une chambre, définir les dates et valider le séjour.', en: 'Register a guest, choose a room, set dates and confirm the stay.', ar: 'تسجيل عميل واختيار غرفة وتحديد التواريخ وتأكيد الإقامة.' },
    prerequisites: { fr: ['Vérifiez les dates et le secteur.', 'Préparez les coordonnées et les informations d’identité requises.'], en: ['Check dates and sector.', 'Prepare contact and required identity information.'], ar: ['تحقق من التواريخ والقسم.', 'جهز بيانات الاتصال والهوية المطلوبة.'] },
    steps: {
      fr: ['Depuis le planning, sélectionnez une cellule libre ou utilisez le bouton de nouvelle réservation.', 'Renseignez le nom du client et ses coordonnées.', 'Sélectionnez la chambre ou la ressource proposée.', 'Saisissez la date d’arrivée et la date de départ ; vérifiez que le départ est postérieur à l’arrivée.', 'Indiquez les adultes, les enfants, la formule de repas et les extras applicables.', 'Complétez les informations d’identité demandées par l’établissement et la réglementation.', 'Vérifiez le tarif, la devise, les notes et les éventuels paiements.', 'Enregistrez puis vérifiez que le séjour apparaît sur le planning.'],
      en: ['From the planner, select an empty slot or use New Booking.', 'Enter the guest name and contact details.', 'Select the proposed room or resource.', 'Set arrival and departure dates; departure must be after arrival.', 'Enter adults, children, meal plan and applicable extras.', 'Complete identity information required by the property and applicable rules.', 'Review rate, currency, notes and any payments.', 'Save and verify that the stay appears on the planner.'],
      ar: ['من المخطط، اختر خانة فارغة أو استخدم زر حجز جديد.', 'أدخل اسم العميل وبيانات الاتصال.', 'اختر الغرفة أو المورد المقترح.', 'حدد الوصول والمغادرة وتأكد أن المغادرة بعد الوصول.', 'أدخل عدد البالغين والأطفال وخطة الوجبات والخدمات الإضافية.', 'أكمل بيانات الهوية المطلوبة من المؤسسة واللوائح المعمول بها.', 'راجع السعر والعملة والملاحظات والمدفوعات.', 'احفظ وتأكد من ظهور الإقامة في المخطط.']
    },
    result: { fr: 'La réservation est enregistrée et visible dans le planning.', en: 'The booking is saved and visible in the planner.', ar: 'تم حفظ الحجز ويظهر في المخطط.' },
    warnings: { fr: ['Ne confirmez pas sans vérifier les conflits de dates et la disponibilité réelle.', 'Ne saisissez que les données personnelles nécessaires.'], en: ['Do not confirm before checking date conflicts and actual availability.', 'Collect only necessary personal data.'], ar: ['لا تؤكد قبل التحقق من تعارض التواريخ والتوفر الفعلي.', 'اجمع البيانات الشخصية الضرورية فقط.'] },
    tips: { fr: ['Vérifiez le numéro de téléphone avant validation.', 'Ajoutez les demandes spéciales dans les notes plutôt que dans le nom du client.'], en: ['Verify the phone number before saving.', 'Put special requests in notes, not in the guest name.'], ar: ['تحقق من رقم الهاتف قبل الحفظ.', 'ضع الطلبات الخاصة في الملاحظات وليس في اسم العميل.'] }
  },
  {
    id: 'modify-booking', category: 'reservations', icon: CalendarDays, duration: '5 min', availability: 'available',
    title: { fr: 'Modifier, déplacer ou annuler un séjour', en: 'Modify, move or cancel a stay', ar: 'تعديل أو نقل أو إلغاء إقامة' },
    summary: { fr: 'Modifier les dates, la chambre, les informations client et le statut en gardant une trace des changements.', en: 'Change dates, room, guest details and status while preserving change history.', ar: 'تعديل التواريخ والغرفة وبيانات العميل والحالة مع الاحتفاظ بسجل التغييرات.' },
    prerequisites: { fr: ['Retrouvez la réservation dans le planning ou la liste des séjours.', 'Vérifiez votre droit de modification.'], en: ['Find the booking in the planner or stay list.', 'Check your permission to edit.'], ar: ['اعثر على الحجز في المخطط أو قائمة الإقامات.', 'تحقق من صلاحية التعديل.'] },
    steps: {
      fr: ['Ouvrez la réservation concernée.', 'Contrôlez l’identité du client et les dates actuelles.', 'Modifiez uniquement les champs nécessaires.', 'Avant un changement de chambre ou de dates, vérifiez les conflits et le nouveau tarif.', 'Pour une annulation, choisissez l’action d’annulation et renseignez le motif si demandé.', 'Enregistrez puis contrôlez le planning et le statut de paiement.'],
      en: ['Open the relevant booking.', 'Verify guest identity and current dates.', 'Change only the required fields.', 'Before changing room or dates, check conflicts and the new rate.', 'For cancellation, choose Cancel and provide a reason when requested.', 'Save, then check the planner and payment status.'],
      ar: ['افتح الحجز المعني.', 'تحقق من هوية العميل والتواريخ الحالية.', 'عدّل الحقول المطلوبة فقط.', 'قبل تغيير الغرفة أو التواريخ، تحقق من التعارض والسعر الجديد.', 'للإلغاء، اختر إجراء الإلغاء وأدخل السبب عند الطلب.', 'احفظ ثم تحقق من المخطط وحالة الدفع.']
    },
    result: { fr: 'La réservation reflète les nouvelles informations et son historique reste consultable.', en: 'The booking reflects the new information and its history remains available.', ar: 'يعكس الحجز المعلومات الجديدة ويبقى سجل التغييرات متاحاً.' },
    warnings: { fr: ['Ne supprimez pas une réservation pour corriger une erreur : privilégiez la modification ou l’annulation tracée.', 'Un changement de dates peut modifier le montant dû.'], en: ['Do not delete a booking to correct an error; use an edit or traceable cancellation.', 'Changing dates may change the amount due.'], ar: ['لا تحذف الحجز لتصحيح خطأ؛ استخدم التعديل أو الإلغاء المسجل.', 'قد يؤدي تغيير التواريخ إلى تغيير المبلغ المستحق.'] },
    tips: { fr: ['Prévenez les équipes concernées après un changement de chambre.', 'Contrôlez les factures et paiements après toute modification tarifaire.'], en: ['Notify relevant teams after a room change.', 'Review invoices and payments after any rate change.'], ar: ['أبلغ الفرق المعنية بعد تغيير الغرفة.', 'راجع الفواتير والمدفوعات بعد أي تغيير في السعر.'] }
  },
  {
    id: 'checkin-checkout', category: 'reservations', icon: CheckCircle2, duration: '5 min', availability: 'available',
    title: { fr: 'Gérer les arrivées et les départs', en: 'Manage check-in and check-out', ar: 'إدارة الوصول والمغادرة' },
    summary: { fr: 'Préparer l’arrivée, vérifier le dossier, encaisser si nécessaire et clôturer le séjour.', en: 'Prepare arrival, verify the record, collect payment when needed and close the stay.', ar: 'تحضير الوصول والتحقق من الملف والتحصيل عند الحاجة وإغلاق الإقامة.' },
    prerequisites: { fr: ['La réservation doit être identifiable et les dates cohérentes.', 'La chambre doit être prête et attribuable.'], en: ['The booking must be identifiable and dates consistent.', 'The room must be ready and assignable.'], ar: ['يجب أن يكون الحجز معروفاً والتواريخ متسقة.', 'يجب أن تكون الغرفة جاهزة وقابلة للتخصيص.'] },
    steps: {
      fr: ['Ouvrez la réservation à l’arrivée du client.', 'Vérifiez l’identité, les occupants, les dates et les demandes particulières.', 'Vérifiez le statut de la chambre auprès du housekeeping.', 'Contrôlez le solde et enregistrez le règlement selon la procédure de caisse.', 'Effectuez le check-in et vérifiez le nouveau statut.', 'Au départ, ajoutez et vérifiez les consommations et extras.', 'Établissez le règlement final, puis effectuez le check-out.', 'Vérifiez que la chambre passe dans le circuit de remise en état.'],
      en: ['Open the booking when the guest arrives.', 'Verify identity, occupants, dates and special requests.', 'Check room status with housekeeping.', 'Review the balance and record payment according to cash procedures.', 'Perform check-in and verify the new status.', 'At departure, add and review consumption and extras.', 'Settle the final balance and check the guest out.', 'Verify that the room enters the turnover workflow.'],
      ar: ['افتح الحجز عند وصول العميل.', 'تحقق من الهوية والنزلاء والتواريخ والطلبات الخاصة.', 'تحقق من حالة الغرفة مع التدبير المنزلي.', 'راجع الرصيد وسجل الدفع وفق إجراءات الصندوق.', 'نفذ تسجيل الوصول وتحقق من الحالة الجديدة.', 'عند المغادرة، أضف الاستهلاك والخدمات الإضافية وراجعها.', 'سوّ الرصيد النهائي ثم نفذ تسجيل المغادرة.', 'تحقق من انتقال الغرفة إلى سير عمل التنظيف.']
    },
    result: { fr: 'Le séjour suit un cycle arrivée → hébergement → départ, avec un statut et un solde contrôlés.', en: 'The stay follows arrival → in-house → departure with controlled status and balance.', ar: 'تتبع الإقامة دورة الوصول ثم الإقامة ثم المغادرة مع ضبط الحالة والرصيد.' },
    warnings: { fr: ['Ne marquez pas une facture comme payée sans encaissement confirmé.', 'Ne faites pas entrer un client dans une chambre hors service ou non prête.'], en: ['Never mark an invoice paid without confirmed collection.', 'Do not check a guest into an out-of-order or unready room.'], ar: ['لا تعتبر الفاتورة مدفوعة دون تحصيل مؤكد.', 'لا تسجل وصول العميل إلى غرفة خارج الخدمة أو غير جاهزة.'] },
    tips: { fr: ['Utilisez la liste des arrivées pour préparer la journée.', 'Faites le rapprochement caisse avant la clôture.'], en: ['Use the arrivals list to prepare the day.', 'Reconcile cash before closing.'], ar: ['استخدم قائمة الوصول لتحضير اليوم.', 'طابق الصندوق قبل الإغلاق.'] }
  },
  {
    id: 'billing', category: 'finance', icon: Receipt, duration: '7 min', availability: 'available',
    title: { fr: 'Créer un devis ou une facture', en: 'Create a quote or invoice', ar: 'إنشاء عرض سعر أو فاتورة' },
    summary: { fr: 'Préparer un document commercial, détailler les lignes et contrôler les taxes et le solde.', en: 'Prepare a commercial document, itemize lines and review taxes and balance.', ar: 'إعداد مستند تجاري وتفصيل البنود ومراجعة الضرائب والرصيد.' },
    prerequisites: { fr: ['Disposez des informations du client ou de l’entreprise.', 'Vérifiez les tarifs, la devise et les paramètres fiscaux de l’établissement.'], en: ['Have customer or company details.', 'Check rates, currency and property tax settings.'], ar: ['جهز بيانات العميل أو الشركة.', 'تحقق من الأسعار والعملة والإعدادات الضريبية للمؤسسة.'] },
    steps: {
      fr: ['Ouvrez « Facturation & Devis ».', 'Choisissez le type de document : devis, proforma ou facture selon le cas.', 'Renseignez le client, l’entreprise et les coordonnées de facturation.', 'Ajoutez chaque prestation sur une ligne distincte avec quantité, prix unitaire et taux de taxe.', 'Vérifiez remises, taxe de séjour, acompte et devise.', 'Relisez les totaux HT, taxes, TTC et solde dû.', 'Enregistrez le document puis utilisez l’aperçu ou l’impression disponible.'],
      en: ['Open Billing & Quotes.', 'Choose quote, pro forma or invoice as appropriate.', 'Enter customer, company and billing details.', 'Add each service as a separate line with quantity, unit price and tax rate.', 'Review discounts, tourist tax, deposit and currency.', 'Check net, tax, gross totals and balance due.', 'Save the document and use the available preview or print action.'],
      ar: ['افتح الفوترة وعروض الأسعار.', 'اختر عرض سعر أو فاتورة أولية أو فاتورة حسب الحالة.', 'أدخل بيانات العميل والشركة والفوترة.', 'أضف كل خدمة في سطر مستقل مع الكمية وسعر الوحدة ونسبة الضريبة.', 'راجع الخصومات وضريبة الإقامة والتسبيق والعملة.', 'تحقق من الإجمالي قبل الضريبة والضرائب والإجمالي والرصيد.', 'احفظ المستند واستخدم المعاينة أو الطباعة المتاحة.']
    },
    result: { fr: 'Le document contient des lignes détaillées et des totaux contrôlés.', en: 'The document contains itemized lines and reviewed totals.', ar: 'يحتوي المستند على بنود مفصلة وإجماليات تمت مراجعتها.' },
    warnings: { fr: ['Une facture émise ne doit pas être modifiée silencieusement : utilisez la procédure de correction ou d’avoir applicable.', 'Ne mélangez pas des montants de devises différentes dans un total.'], en: ['An issued invoice must not be silently altered; use the applicable correction or credit-note process.', 'Do not add amounts in different currencies into one total.'], ar: ['لا تعدل فاتورة صادرة دون أثر؛ استخدم إجراء التصحيح أو الإشعار الدائن المعتمد.', 'لا تجمع مبالغ بعملات مختلفة في إجمالي واحد.'] },
    tips: { fr: ['Séparez hébergement, restauration et extras pour faciliter le contrôle.', 'Vérifiez les coordonnées fiscales avant émission.'], en: ['Separate accommodation, dining and extras for easier review.', 'Verify tax details before issuing.'], ar: ['افصل الإقامة والمطاعم والخدمات الإضافية لتسهيل المراجعة.', 'تحقق من البيانات الضريبية قبل الإصدار.'] }
  },
  {
    id: 'housekeeping', category: 'operations', icon: Sparkles, duration: '5 min', availability: 'available',
    title: { fr: 'Mettre à jour le statut des chambres', en: 'Update room housekeeping status', ar: 'تحديث حالة تنظيف الغرف' },
    summary: { fr: 'Suivre l’état opérationnel d’une chambre et éviter une attribution prématurée.', en: 'Track room operational status and prevent premature assignment.', ar: 'متابعة الحالة التشغيلية للغرفة وتجنب تخصيصها قبل الجاهزية.' },
    prerequisites: { fr: ['Identifiez le numéro de chambre.', 'Vérifiez l’état réel auprès de l’équipe sur place.'], en: ['Identify the room number.', 'Confirm the actual condition with the on-site team.'], ar: ['حدد رقم الغرفة.', 'تحقق من الحالة الفعلية مع الفريق في الموقع.'] },
    steps: {
      fr: ['Ouvrez le planning ou « Housekeeping & Étages ».', 'Repérez la chambre concernée.', 'Choisissez le statut : propre, nettoyage, sale ou hors service.', 'Si la chambre est hors service, faites remonter le motif et la durée estimée.', 'Après intervention, faites confirmer le contrôle et remettez la chambre au statut propre.', 'Vérifiez que le planning reflète bien la disponibilité opérationnelle.'],
      en: ['Open the planner or Housekeeping & Floors.', 'Locate the room.', 'Choose clean, cleaning, dirty or out of order.', 'If out of order, record the reason and expected duration.', 'After service, confirm inspection and set the room to clean.', 'Verify the planner reflects operational availability.'],
      ar: ['افتح المخطط أو التدبير المنزلي والطوابق.', 'حدد الغرفة.', 'اختر نظيفة أو قيد التنظيف أو متسخة أو خارج الخدمة.', 'إذا كانت خارج الخدمة، سجل السبب والمدة المتوقعة.', 'بعد التدخل، أكد الفحص وأعد الحالة إلى نظيفة.', 'تحقق من أن المخطط يعكس التوفر التشغيلي.']
    },
    result: { fr: 'La réception dispose d’un statut opérationnel fiable avant attribution.', en: 'Front desk has a reliable operational status before assignment.', ar: 'لدى الاستقبال حالة تشغيلية موثوقة قبل التخصيص.' },
    warnings: { fr: ['Ne marquez pas une chambre propre sans contrôle réel.', 'Le statut hors service doit correspondre à une indisponibilité effective.'], en: ['Do not mark a room clean without an actual inspection.', 'Out-of-order must reflect a real unavailability.'], ar: ['لا تعتبر الغرفة نظيفة دون فحص فعلي.', 'يجب أن تعكس حالة خارج الخدمة عدم توفر حقيقي.'] },
    tips: { fr: ['Associez les tâches urgentes à une personne responsable.', 'Consignez les anomalies récurrentes pour la maintenance.'], en: ['Assign urgent tasks to an owner.', 'Record recurring issues for maintenance.'], ar: ['أسند المهام العاجلة إلى مسؤول.', 'سجل الأعطال المتكررة للصيانة.'] }
  },
  {
    id: 'tasks-stock', category: 'operations', icon: ClipboardList, duration: '6 min', availability: 'available',
    title: { fr: 'Gérer les tâches et le stock', en: 'Manage tasks and inventory', ar: 'إدارة المهام والمخزون' },
    summary: { fr: 'Affecter les tâches, suivre leur exécution et enregistrer les mouvements de stock.', en: 'Assign tasks, track completion and record inventory movements.', ar: 'إسناد المهام ومتابعة التنفيذ وتسجيل حركات المخزون.' },
    prerequisites: { fr: ['Vérifiez les utilisateurs et articles disponibles.', 'Préparez la quantité et le motif du mouvement.'], en: ['Check available users and inventory items.', 'Prepare quantity and movement reason.'], ar: ['تحقق من المستخدمين والأصناف المتاحة.', 'جهز الكمية وسبب الحركة.'] },
    steps: {
      fr: ['Ouvrez « Tâches PMS » pour créer ou consulter une tâche.', 'Définissez la catégorie, la priorité, la date et le responsable.', 'Ajoutez une note et des sous-tâches si nécessaire.', 'Mettez à jour le statut pendant l’exécution puis clôturez après vérification.', 'Ouvrez « Stock & Équipements » pour consulter les quantités.', 'Enregistrez une entrée ou une sortie avec l’article, la quantité et un motif explicite.', 'Contrôlez le nouveau stock et les seuils d’alerte.'],
      en: ['Open PMS Tasks to create or review a task.', 'Set category, priority, date and assignee.', 'Add notes and subtasks when needed.', 'Update status during work and close after verification.', 'Open Inventory & Equipment to review quantities.', 'Record a receipt or issue with item, quantity and clear reason.', 'Check the new stock level and alert thresholds.'],
      ar: ['افتح مهام PMS لإنشاء مهمة أو مراجعتها.', 'حدد الفئة والأولوية والتاريخ والمسؤول.', 'أضف ملاحظة ومهام فرعية عند الحاجة.', 'حدث الحالة أثناء التنفيذ وأغلق المهمة بعد التحقق.', 'افتح المخزون والمعدات لمراجعة الكميات.', 'سجل إدخالاً أو إخراجاً مع الصنف والكمية والسبب.', 'تحقق من الرصيد الجديد وحدود التنبيه.']
    },
    result: { fr: 'Les tâches sont suivies et les mouvements de stock sont justifiés.', en: 'Tasks are tracked and inventory movements are justified.', ar: 'تتم متابعة المهام وتكون حركات المخزون مبررة.' },
    warnings: { fr: ['Ne corrigez pas un stock par modification arbitraire : enregistrez un mouvement.', 'Une tâche clôturée doit correspondre à un travail réalisé.'], en: ['Do not arbitrarily edit stock; record a movement.', 'A closed task must represent completed work.'], ar: ['لا تصحح المخزون بتعديل عشوائي؛ سجل حركة.', 'يجب أن تعكس المهمة المغلقة عملاً منجزاً.'] },
    tips: { fr: ['Utilisez des motifs homogènes pour faciliter les rapports.', 'Traitez les seuils minimum avant la rupture.'], en: ['Use consistent reasons for better reporting.', 'Act on minimum thresholds before stockouts.'], ar: ['استخدم أسباباً موحدة لتحسين التقارير.', 'عالج حدود الحد الأدنى قبل نفاد المخزون.'] }
  },
  {
    id: 'spa', category: 'services', icon: Flower2, duration: '5 min', availability: 'available',
    title: { fr: 'Utiliser le module Spa', en: 'Use the Spa module', ar: 'استخدام وحدة السبا' },
    summary: { fr: 'Consulter les prestations et les réservations de l’espace bien-être disponibles dans la version actuelle.', en: 'Review services and wellness bookings available in the current version.', ar: 'مراجعة الخدمات وحجوزات العافية المتاحة في الإصدار الحالي.' },
    prerequisites: { fr: ['Ouvrez le secteur Spa & Espace Bien-Être.', 'Vérifiez les prestations et ressources configurées.'], en: ['Open Spa & Wellness.', 'Review configured services and resources.'], ar: ['افتح السبا والعافية.', 'راجع الخدمات والموارد المهيأة.'] },
    steps: {
      fr: ['Sélectionnez « Spa & Espace Bien-Être » dans le menu.', 'Consultez les ressources et prestations réellement configurées.', 'Vérifiez les créneaux, le tarif et les informations du client avant d’enregistrer une opération.', 'Contrôlez ensuite l’impact sur le planning et la facturation si ces fonctions sont activées dans votre configuration.'],
      en: ['Select Spa & Wellness from the menu.', 'Review the resources and services actually configured.', 'Check slot, rate and guest details before saving an operation.', 'Then review planner and billing impact if enabled in your configuration.'],
      ar: ['اختر السبا والعافية من القائمة.', 'راجع الموارد والخدمات المهيأة فعلياً.', 'تحقق من الموعد والسعر وبيانات العميل قبل حفظ العملية.', 'راجع أثر العملية على المخطط والفوترة إذا كانت مفعلة في إعداداتك.']
    },
    result: { fr: 'Vous savez accéder au module et contrôler les éléments disponibles dans votre version.', en: 'You can access the module and review what is available in your version.', ar: 'يمكنك الوصول إلى الوحدة والتحقق مما هو متاح في إصدارك.' },
    warnings: { fr: ['La gestion complète des praticiens, cabines, abonnements et packages reste à développer ; ne la considérez pas comme acquise.'], en: ['Full practitioner, cabin, subscription and package management remains to be developed; do not assume it is available.'], ar: ['إدارة المعالجين والكبائن والاشتراكات والباقات بالكامل لا تزال قيد التطوير.'] },
    tips: { fr: ['Faites valider les tarifs et durées par le responsable Spa.', 'Ne promettez pas une disponibilité non confirmée.'], en: ['Have the Spa manager validate rates and durations.', 'Do not promise unconfirmed availability.'], ar: ['اطلب من مسؤول السبا اعتماد الأسعار والمدد.', 'لا تعد بتوفر غير مؤكد.'] }
  },
  {
    id: 'qr', category: 'access', icon: QrCode, duration: '6 min', availability: 'available',
    title: { fr: 'Générer et scanner un QR Pass', en: 'Generate and scan a QR pass', ar: 'إنشاء ومسح تصريح QR' },
    summary: { fr: 'Émettre un pass depuis une réservation et utiliser le scanner disponible.', en: 'Issue a pass from a booking and use the available scanner.', ar: 'إصدار تصريح من الحجز واستخدام الماسح المتاح.' },
    prerequisites: { fr: ['Disposez d’une réservation éligible.', 'Autorisez l’accès caméra si vous utilisez le scanner sur appareil compatible.'], en: ['Have an eligible booking.', 'Allow camera access when using the scanner on a compatible device.'], ar: ['توفر حجز مؤهل.', 'اسمح باستخدام الكاميرا عند استعمال الماسح على جهاز متوافق.'] },
    steps: {
      fr: ['Ouvrez la réservation concernée.', 'Utilisez l’action QR Pass lorsqu’elle est disponible.', 'Affichez le pass généré et vérifiez qu’il correspond au bon dossier.', 'Pour contrôler un pass, ouvrez le scanner QR depuis le menu ou l’action prévue.', 'Autorisez la caméra et placez le QR dans le cadre.', 'Vérifiez le résultat du contrôle avant d’autoriser l’accès.'],
      en: ['Open the relevant booking.', 'Use the QR Pass action when available.', 'Display the generated pass and verify it belongs to the correct record.', 'To check a pass, open the QR scanner from the menu or provided action.', 'Allow camera access and place the QR inside the frame.', 'Review the validation result before allowing entry.'],
      ar: ['افتح الحجز المعني.', 'استخدم إجراء تصريح QR عند توفره.', 'اعرض التصريح وتأكد من ارتباطه بالملف الصحيح.', 'للتحقق من التصريح، افتح ماسح QR من القائمة أو الإجراء المخصص.', 'اسمح بالكاميرا وضع الرمز داخل الإطار.', 'راجع نتيجة التحقق قبل السماح بالدخول.']
    },
    result: { fr: 'Le pass est affiché ou le scan retourne un résultat de contrôle.', en: 'The pass is displayed or scanning returns a validation result.', ar: 'يتم عرض التصريح أو يعرض المسح نتيجة التحقق.' },
    warnings: { fr: ['Le QR Pass actuel ne remplace pas un système certifié de contrôle de portes.', 'Ne partagez pas publiquement un QR contenant un droit d’accès.'], en: ['The current QR pass is not a certified door-access control system.', 'Do not publicly share a QR that grants access.'], ar: ['تصريح QR الحالي لا يعوض نظام تحكم معتمد للأبواب.', 'لا تشارك رمزاً يمنح حق الدخول علناً.'] },
    tips: { fr: ['Vérifiez le nom et la réservation avant le scan.', 'En cas de refus, vérifiez le dossier plutôt que de contourner le contrôle.'], en: ['Verify the name and booking before scanning.', 'If denied, review the record rather than bypassing the check.'], ar: ['تحقق من الاسم والحجز قبل المسح.', 'عند الرفض، راجع الملف بدلاً من تجاوز التحقق.'] }
  },
  {
    id: 'reports', category: 'management', icon: BarChart3, duration: '5 min', availability: 'available',
    title: { fr: 'Lire les analytics et rapports', en: 'Read analytics and reports', ar: 'قراءة التحليلات والتقارير' },
    summary: { fr: 'Choisir une période et interpréter les indicateurs opérationnels et financiers.', en: 'Choose a period and interpret operational and financial indicators.', ar: 'اختيار فترة وتفسير المؤشرات التشغيلية والمالية.' },
    prerequisites: { fr: ['Les réservations et données opérationnelles doivent être renseignées.', 'Sélectionnez la bonne période et le bon établissement.'], en: ['Bookings and operational data must be recorded.', 'Select the correct period and property.'], ar: ['يجب تسجيل الحجوزات والبيانات التشغيلية.', 'اختر الفترة والمؤسسة الصحيحتين.'] },
    steps: {
      fr: ['Ouvrez « Booking Analytics » ou « Rapports d’activité ».', 'Sélectionnez la période proposée : 30 jours, 90 jours ou 12 mois selon l’écran.', 'Comparez occupation, réservations, housekeeping, stock et revenus.', 'Vérifiez la devise de chaque indicateur avant toute comparaison financière.', 'Utilisez les détails par bâtiment et catégorie pour identifier les écarts.', 'Exportez ou partagez les résultats uniquement selon les fonctions proposées dans votre version.'],
      en: ['Open Booking Analytics or Activity Reports.', 'Choose the available period: 30 days, 90 days or 12 months depending on the screen.', 'Compare occupancy, bookings, housekeeping, inventory and revenue.', 'Check each metric currency before financial comparisons.', 'Use building and category details to identify differences.', 'Export or share results only through features available in your version.'],
      ar: ['افتح تحليلات الحجوزات أو تقارير النشاط.', 'اختر الفترة المتاحة: 30 يوماً أو 90 يوماً أو 12 شهراً حسب الشاشة.', 'قارن الإشغال والحجوزات والتدبير المنزلي والمخزون والإيرادات.', 'تحقق من عملة كل مؤشر قبل المقارنات المالية.', 'استخدم التفاصيل حسب المبنى والفئة لتحديد الفروقات.', 'صدر أو شارك النتائج فقط عبر الوظائف المتاحة في إصدارك.']
    },
    result: { fr: 'Vous interprétez les indicateurs sans mélanger les périodes ni les devises.', en: 'You can interpret metrics without mixing periods or currencies.', ar: 'يمكنك تفسير المؤشرات دون خلط الفترات أو العملات.' },
    warnings: { fr: ['Les factures locales et les données non synchronisées peuvent limiter la consolidation multi-utilisateur.', 'Ne comparez pas directement des revenus de devises différentes.'], en: ['Local invoices and unsynced data may limit cross-user consolidation.', 'Do not directly compare revenue in different currencies.'], ar: ['قد تحد الفواتير المحلية والبيانات غير المتزامنة من التجميع بين المستخدمين.', 'لا تقارن الإيرادات بعملات مختلفة مباشرة.'] },
    tips: { fr: ['Comparez des périodes de durée équivalente.', 'Analysez les tendances avec les événements et la saisonnalité.'], en: ['Compare periods of equal length.', 'Interpret trends alongside events and seasonality.'], ar: ['قارن فترات متساوية المدة.', 'حلل الاتجاهات مع الأحداث والموسمية.'] }
  },
  {
    id: 'pricing-channels', category: 'management', icon: Globe, duration: '6 min', availability: 'available',
    title: { fr: 'Tarifs dynamiques et canaux OTA', en: 'Dynamic rates and OTA channels', ar: 'الأسعار الديناميكية وقنوات OTA' },
    summary: { fr: 'Comprendre les écrans de tarification et de distribution sans supposer une synchronisation OTA non vérifiée.', en: 'Understand pricing and distribution screens without assuming unverified OTA synchronization.', ar: 'فهم شاشات التسعير والتوزيع دون افتراض مزامنة OTA غير مؤكدة.' },
    prerequisites: { fr: ['Accès au rôle gestionnaire.', 'Connaître les catégories de chambres et la grille tarifaire de référence.'], en: ['Manager access.', 'Know room categories and the reference rate plan.'], ar: ['صلاحية المدير.', 'معرفة فئات الغرف وجدول الأسعار المرجعي.'] },
    steps: {
      fr: ['Ouvrez « Yield & Tarifs Dynamiques ».', 'Sélectionnez le type de chambre et la date à modifier.', 'Saisissez le tarif et vérifiez la devise.', 'Pour une modification en masse, contrôlez toutes les dates avant application.', 'Consultez ensuite « Channel Manager » pour examiner les canaux configurés.', 'Vérifiez les journaux ou confirmations disponibles avant de considérer un tarif publié sur une OTA.'],
      en: ['Open Yield & Dynamic Rates.', 'Select room type and date.', 'Enter the rate and check currency.', 'For bulk changes, review all dates before applying.', 'Open Channel Manager to review configured channels.', 'Check available logs or confirmations before considering a rate published to an OTA.'],
      ar: ['افتح التسعير الديناميكي.', 'اختر نوع الغرفة والتاريخ.', 'أدخل السعر وتحقق من العملة.', 'عند التعديل الجماعي، راجع جميع التواريخ قبل التطبيق.', 'افتح مدير القنوات لمراجعة القنوات المهيأة.', 'تحقق من السجلات أو التأكيدات قبل اعتبار السعر منشوراً على OTA.']
    },
    result: { fr: 'Les tarifs sont contrôlés et les publications externes ne sont considérées comme réussies qu’après confirmation.', en: 'Rates are controlled and external publication is considered successful only after confirmation.', ar: 'تتم مراجعة الأسعار ولا يعتبر النشر الخارجي ناجحاً إلا بعد التأكيد.' },
    warnings: { fr: ['Ne supposez pas qu’une modification locale est automatiquement publiée sur Booking.com ou une autre OTA.'], en: ['Do not assume a local change is automatically published to Booking.com or another OTA.'], ar: ['لا تفترض أن التعديل المحلي نُشر تلقائياً على Booking.com أو أي OTA أخرى.'] },
    tips: { fr: ['Définissez des limites tarifaires minimales et maximales.', 'Testez les changements sur une date avant une mise à jour massive.'], en: ['Set minimum and maximum rate limits.', 'Test a change on one date before a bulk update.'], ar: ['حدد حدوداً دنيا وعليا للأسعار.', 'اختبر التعديل على تاريخ واحد قبل التحديث الجماعي.'] }
  },
  {
    id: 'local-data', category: 'administration', icon: Boxes, duration: '4 min', availability: 'available',
    title: { fr: 'Comprendre les données locales et la synchronisation', en: 'Understand local data and synchronization', ar: 'فهم البيانات المحلية والمزامنة' },
    summary: { fr: 'Comprendre le stockage navigateur, l’inspecteur et les limites du mode hors ligne.', en: 'Understand browser storage, the inspector and offline-mode limitations.', ar: 'فهم تخزين المتصفح وأداة الفحص وحدود العمل دون اتصال.' },
    prerequisites: { fr: ['Avoir accès au menu latéral.', 'Ne pas effacer les données du navigateur sans sauvegarde validée.'], en: ['Have access to the sidebar.', 'Do not clear browser data without a verified backup.'], ar: ['توفر الوصول إلى القائمة الجانبية.', 'لا تمسح بيانات المتصفح دون نسخة احتياطية مؤكدة.'] },
    steps: {
      fr: ['Ouvrez « Données locales » depuis le pied du menu.', 'Consultez les stores et les enregistrements disponibles.', 'Comprenez que cet inspecteur présente les données du navigateur et non les performances du serveur.', 'En cas de mode hors ligne, continuez uniquement les opérations prises en charge localement.', 'Au retour du réseau, vérifiez l’état de synchronisation lorsqu’il est exposé par l’application.', 'Ne supprimez pas les données IndexedDB depuis les outils du navigateur pour résoudre un problème sans procédure de récupération.'],
      en: ['Open Local Data at the bottom of the menu.', 'Review available stores and records.', 'This inspector shows browser data, not server performance.', 'While offline, perform only operations supported locally.', 'When connectivity returns, review sync status where exposed by the app.', 'Do not delete IndexedDB data through browser tools as a troubleshooting shortcut.'],
      ar: ['افتح البيانات المحلية أسفل القائمة.', 'راجع المخازن والسجلات المتاحة.', 'تعرض أداة الفحص بيانات المتصفح وليس أداء الخادم.', 'أثناء انقطاع الاتصال، نفذ العمليات المدعومة محلياً فقط.', 'عند عودة الاتصال، راجع حالة المزامنة إذا كانت ظاهرة في التطبيق.', 'لا تحذف بيانات IndexedDB من أدوات المتصفح كحل سريع للمشكلات.']
    },
    result: { fr: 'Vous savez distinguer les données locales, les données distantes et les limites de synchronisation.', en: 'You can distinguish local data, remote data and synchronization limits.', ar: 'يمكنك التمييز بين البيانات المحلية والبعيدة وحدود المزامنة.' },
    warnings: { fr: ['L’inspecteur est un outil de consultation, pas un outil de réparation ni une preuve que Supabase est synchronisé.', 'Effacer le stockage local peut entraîner une perte de données non synchronisées.'], en: ['The inspector is for viewing, not repair, and does not prove Supabase is synchronized.', 'Clearing local storage may destroy unsynced data.'], ar: ['أداة الفحص للعرض وليست للإصلاح ولا تثبت مزامنة Supabase.', 'قد يؤدي مسح التخزين المحلي إلى فقدان البيانات غير المتزامنة.'] },
    tips: { fr: ['Utilisez un profil navigateur dédié au poste de réception.', 'Conservez une procédure de sauvegarde et de restauration documentée.'], en: ['Use a dedicated browser profile for the front desk.', 'Maintain a documented backup and restore procedure.'], ar: ['استخدم ملف متصفح مخصصاً لمكتب الاستقبال.', 'احتفظ بإجراء موثق للنسخ الاحتياطي والاستعادة.'] }
  },
  {
    id: 'groups-events', category: 'future', icon: Users, duration: '8 min', availability: 'planned',
    title: { fr: 'Groupes, délégations et rooming list', en: 'Groups, delegations and rooming lists', ar: 'المجموعات والوفود وقائمة توزيع الغرف' },
    summary: { fr: 'Procédure cible pour créer un dossier groupe, bloquer des chambres et affecter les participants.', en: 'Target workflow for creating a group file, blocking rooms and assigning participants.', ar: 'سير العمل المستهدف لإنشاء ملف مجموعة وحجز الغرف وتوزيع المشاركين.' },
    prerequisites: { fr: ['Fonctionnalité à développer : ce tutoriel décrit le processus cible.', 'Préparer contrat, effectif, dates et liste nominative.'], en: ['Feature not implemented yet; this tutorial describes the target workflow.', 'Prepare contract, headcount, dates and participant list.'], ar: ['الميزة لم تنفذ بعد؛ يشرح هذا الدليل سير العمل المستهدف.', 'جهز العقد والعدد والتواريخ وقائمة المشاركين.'] },
    steps: {
      fr: ['Créer le dossier au nom de l’organisme payeur.', 'Définir les dates, le nombre de chambres et les catégories demandées.', 'Créer un Room Block avec date limite de libération.', 'Importer la Rooming List et contrôler les doublons.', 'Affecter chaque participant à une chambre et créer les réservations liées.', 'Définir les règles de prise en charge organisme / participant.', 'Suivre les arrivées, départs, folios et factures consolidées.'],
      en: ['Create the group file under the paying organization.', 'Set dates, room count and requested categories.', 'Create a room block with a release deadline.', 'Import the rooming list and check duplicates.', 'Assign each participant to a room and create linked bookings.', 'Define organization-versus-guest billing rules.', 'Track arrivals, departures, folios and consolidated invoices.'],
      ar: ['أنشئ ملف المجموعة باسم الجهة الدافعة.', 'حدد التواريخ وعدد الغرف والفئات المطلوبة.', 'أنشئ حجزاً جماعياً مع تاريخ تحرير الحصص.', 'استورد قائمة الغرف وتحقق من التكرار.', 'خصص كل مشارك لغرفة وأنشئ الحجوزات المرتبطة.', 'حدد قواعد الفوترة على الجهة أو المشارك.', 'تابع الوصول والمغادرة والحسابات والفواتير المجمعة.']
    },
    result: { fr: 'Un dossier groupe centralise l’inventaire, les participants, les séjours et la facturation.', en: 'One group file centralizes inventory, participants, stays and billing.', ar: 'يجمع ملف المجموعة المخزون والمشاركين والإقامات والفوترة.' },
    warnings: { fr: ['Ce workflow n’est pas encore disponible dans la version actuelle.', 'Ne bloquez pas des chambres hors du processus de réservation existant.'], en: ['This workflow is not yet available in the current release.', 'Do not block rooms outside the existing booking process.'], ar: ['سير العمل هذا غير متاح بعد في الإصدار الحالي.', 'لا تحجز الغرف خارج عملية الحجز الحالية.'] },
    tips: { fr: ['Fixez une date de cut-off contractuelle.', 'Séparez toujours le payeur contractuel des occupants.'], en: ['Set a contractual cut-off date.', 'Always distinguish the contracting payer from occupants.'], ar: ['حدد تاريخاً نهائياً تعاقدياً.', 'افصل دائماً بين الجهة المتعاقدة والنزلاء.'] }
  },
  {
    id: 'facility-rentals', category: 'future', icon: Building2, duration: '7 min', availability: 'planned',
    title: { fr: 'Louer une salle, un spa ou un équipement', en: 'Rent a room, spa facility or equipment', ar: 'تأجير قاعة أو مرفق سبا أو معدات' },
    summary: { fr: 'Processus cible de réservation multi-ressources pour salles, cabines, parking et matériel.', en: 'Target multi-resource booking workflow for halls, cabins, parking and equipment.', ar: 'سير العمل المستهدف لحجز قاعات وكبائن ومواقف ومعدات متعددة الموارد.' },
    prerequisites: { fr: ['Fonctionnalité à développer.', 'Le catalogue devra contenir capacité, horaires, tarifs et règles de disponibilité.'], en: ['Feature not implemented yet.', 'The catalog must define capacity, hours, rates and availability rules.'], ar: ['الميزة لم تنفذ بعد.', 'يجب أن يتضمن الكتالوج السعة والساعات والأسعار وقواعد التوفر.'] },
    steps: {
      fr: ['Sélectionner la catégorie : salle, spa, sport, parking ou équipement.', 'Choisir la ressource et le créneau demandé.', 'Indiquer le client, l’effectif et l’usage prévu.', 'Vérifier capacité, temps de préparation, maintenance et conflits.', 'Ajouter les équipements et prestations complémentaires.', 'Confirmer le devis ou la réservation selon les conditions.', 'Générer les charges et contrôler le retour du matériel si une location physique est concernée.'],
      en: ['Select category: hall, spa, sport, parking or equipment.', 'Choose the resource and requested time slot.', 'Enter customer, headcount and intended use.', 'Check capacity, setup time, maintenance and conflicts.', 'Add equipment and optional services.', 'Confirm quote or booking according to terms.', 'Post charges and track equipment return for physical rentals.'],
      ar: ['اختر الفئة: قاعة أو سبا أو رياضة أو موقف أو معدات.', 'اختر المورد والفترة المطلوبة.', 'أدخل العميل وعدد الأشخاص والغرض.', 'تحقق من السعة ووقت التجهيز والصيانة والتعارضات.', 'أضف المعدات والخدمات الإضافية.', 'أكد عرض السعر أو الحجز وفق الشروط.', 'سجل الرسوم وتابع إعادة المعدات عند التأجير المادي.']
    },
    result: { fr: 'La location cible mobilise les bonnes ressources et génère des charges traçables.', en: 'The target rental reserves the correct resources and creates traceable charges.', ar: 'يحجز التأجير المستهدف الموارد المناسبة وينشئ رسوماً قابلة للتتبع.' },
    warnings: { fr: ['Le moteur universel de location est un périmètre futur, pas une fonction déjà garantie.'], en: ['The universal rental engine is future scope, not a currently guaranteed feature.'], ar: ['محرك التأجير الشامل ضمن التطوير المستقبلي وليس وظيفة متاحة حالياً.'] },
    tips: { fr: ['Prévoyez un dépôt de garantie pour le matériel.', 'Ajoutez un délai de remise en état entre deux locations.'], en: ['Consider a security deposit for equipment.', 'Add turnaround time between rentals.'], ar: ['خصص ضماناً للمعدات.', 'أضف وقتاً لإعادة التجهيز بين عمليتي تأجير.'] }
  },
  {
    id: 'access-badges', category: 'future', icon: KeyRound, duration: '7 min', availability: 'planned',
    title: { fr: 'Créer des badges et contrôler les accès', en: 'Issue badges and control access', ar: 'إنشاء الشارات ومراقبة الدخول' },
    summary: { fr: 'Processus cible de création de badges visiteurs, QR, zones autorisées et journal des entrées.', en: 'Target workflow for visitor badges, QR, permitted zones and entry logs.', ar: 'سير العمل المستهدف لشارات الزوار ورموز QR والمناطق المسموحة وسجل الدخول.' },
    prerequisites: { fr: ['Fonctionnalité de contrôle d’accès à développer.', 'Définir les zones, points de contrôle et durées d’autorisation.'], en: ['Access-control feature not implemented yet.', 'Define zones, checkpoints and authorization windows.'], ar: ['ميزة التحكم في الدخول لم تنفذ بعد.', 'حدد المناطق ونقاط التفتيش وفترات الصلاحية.'] },
    steps: {
      fr: ['Créer ou importer le participant ou visiteur.', 'Choisir le type de badge et l’événement ou la prestation associé.', 'Attribuer uniquement les zones nécessaires et une plage de validité.', 'Générer un identifiant QR opaque et révocable.', 'Imprimer le badge avec le modèle de l’établissement.', 'Scanner à chaque point de contrôle et vérifier le résultat.', 'Révoquer ou expirer le badge puis consulter le journal des accès.'],
      en: ['Create or import the participant or visitor.', 'Choose badge type and linked event or service.', 'Grant only required zones and a validity window.', 'Generate an opaque, revocable QR identifier.', 'Print the badge using the property template.', 'Scan at each checkpoint and review the result.', 'Revoke or expire the badge and review access logs.'],
      ar: ['أنشئ المشارك أو الزائر أو استورده.', 'اختر نوع الشارة والفعالية أو الخدمة المرتبطة.', 'امنح المناطق الضرورية فقط وفترة صلاحية محددة.', 'أنشئ معرف QR غير مكشوف وقابل للإلغاء.', 'اطبع الشارة باستخدام قالب المؤسسة.', 'امسح الرمز عند كل نقطة تحقق وراجع النتيجة.', 'ألغِ الشارة أو دعها تنتهي ثم راجع سجل الدخول.']
    },
    result: { fr: 'Chaque visiteur dispose d’un droit limité, vérifiable et révocable.', en: 'Each visitor has a limited, verifiable and revocable permission.', ar: 'يحصل كل زائر على صلاحية محدودة وقابلة للتحقق والإلغاء.' },
    warnings: { fr: ['Ce processus est futur. Le QR Pass actuel ne fournit pas encore un contrôle d’accès physique complet.', 'Un scanner hors ligne ne peut pas connaître immédiatement une révocation distante.'], en: ['This is future scope. The current QR pass is not a complete physical access-control system.', 'An offline scanner cannot immediately know about a remote revocation.'], ar: ['هذا سير عمل مستقبلي؛ تصريح QR الحالي ليس نظام تحكم مادي كاملاً.', 'لا يستطيع الماسح غير المتصل معرفة الإلغاء البعيد فوراً.'] },
    tips: { fr: ['Ne mettez aucune donnée personnelle directement dans le QR.', 'Prévoyez une procédure de perte et de remplacement du badge.'], en: ['Do not put personal data directly in the QR.', 'Define a lost-badge replacement procedure.'], ar: ['لا تضع بيانات شخصية مباشرة داخل QR.', 'حدد إجراءً لاستبدال الشارة المفقودة.'] }
  }
];

const ui = {
  fr: { heading: 'Centre d’aide', subtitle: 'Apprenez à utiliser Appointment, étape par étape.', search: 'Rechercher un tutoriel, une opération…', all: 'Tous', available: 'Disponible', planned: 'À venir', min: 'min', prerequisites: 'Avant de commencer', steps: 'Procédure détaillée', result: 'Résultat attendu', warnings: 'Points de vigilance', tips: 'Bonnes pratiques', back: 'Tous les tutoriels', progress: 'Tutoriels terminés', completed: 'Terminé', mark: 'Marquer comme terminé', categories: { reservations: 'Réservations', finance: 'Facturation & paiements', operations: 'Opérations hôtelières', services: 'Services & Spa', access: 'Accès & QR', management: 'Pilotage & distribution', administration: 'Administration', future: 'Fonctionnalités en préparation' }, empty: 'Aucun tutoriel ne correspond à votre recherche.' },
  en: { heading: 'Help center', subtitle: 'Learn how to use Appointment, step by step.', search: 'Search tutorials and tasks…', all: 'All', available: 'Available', planned: 'Coming soon', min: 'min', prerequisites: 'Before you start', steps: 'Step-by-step guide', result: 'Expected result', warnings: 'Important warnings', tips: 'Best practices', back: 'All tutorials', progress: 'Completed tutorials', completed: 'Completed', mark: 'Mark as completed', categories: { reservations: 'Reservations', finance: 'Billing & payments', operations: 'Hotel operations', services: 'Services & Spa', access: 'Access & QR', management: 'Management & distribution', administration: 'Administration', future: 'In development' }, empty: 'No tutorial matches your search.' },
  ar: { heading: 'مركز المساعدة', subtitle: 'تعلم استخدام Appointment خطوة بخطوة.', search: 'ابحث عن دليل أو عملية…', all: 'الكل', available: 'متاح', planned: 'قريباً', min: 'دقيقة', prerequisites: 'قبل البدء', steps: 'الخطوات التفصيلية', result: 'النتيجة المتوقعة', warnings: 'تنبيهات مهمة', tips: 'أفضل الممارسات', back: 'كل الدروس', progress: 'الدروس المكتملة', completed: 'مكتمل', mark: 'وضع علامة مكتمل', categories: { reservations: 'الحجوزات', finance: 'الفوترة والمدفوعات', operations: 'عمليات الفندق', services: 'الخدمات والسبا', access: 'الدخول وQR', management: 'الإدارة والتوزيع', administration: 'الإدارة التقنية', future: 'قيد التطوير' }, empty: 'لا يوجد دليل يطابق البحث.' }
};

export const HelpCenterView: React.FC = () => {
  const { language } = useApp();
  const locale: Locale = language;
  const t = ui[locale];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('omnibook_help_completed') || '[]'); }
    catch { return []; }
  });

  const filtered = useMemo(() => tutorials.filter((item) => {
    const matchesCategory = category === 'all' || item.category === category;
    const haystack = [item.title[locale], item.summary[locale], item.title.fr, item.summary.fr].join(' ').toLowerCase();
    return matchesCategory && haystack.includes(query.trim().toLowerCase());
  }), [category, locale, query]);

  const selected = tutorials.find((item) => item.id === selectedId);
  const markCompleted = (id: string) => {
    const next = completed.includes(id) ? completed : [...completed, id];
    setCompleted(next);
    localStorage.setItem('omnibook_help_completed', JSON.stringify(next));
  };
  const categories = Array.from(new Set(tutorials.map((item) => item.category)));
  const isRtl = locale === 'ar';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 dark:bg-slate-950" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8 space-y-6">
        <header className="rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-5 sm:p-7 text-white shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/10 p-3"><BookOpen size={25}/></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Appointment Academy</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">{t.heading}</h1>
              <p className="mt-1 text-sm text-slate-300">{t.subtitle}</p>
            </div>
            <GraduationCap className="hidden sm:block text-blue-200" size={34}/>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="rounded-xl bg-white/10 p-3"><div className="text-2xl font-bold">{tutorials.filter(x => x.availability === 'available').length}</div><div className="text-xs text-slate-300">{t.available}</div></div>
            <div className="rounded-xl bg-white/10 p-3"><div className="text-2xl font-bold">{completed.length}</div><div className="text-xs text-slate-300">{t.progress}</div></div>
          </div>
        </header>

        {selected ? (
          <article className="space-y-5">
            <button onClick={() => setSelectedId(null)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900">
              {isRtl ? <ChevronRight size={17}/> : <ChevronLeft size={17}/>} {t.back}
            </button>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selected.availability === 'available' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>{selected.availability === 'available' ? t.available : t.planned}</span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 size={13}/>{selected.duration}</span>
                <span className="text-xs text-slate-500">{t.categories[selected.category as keyof typeof t.categories]}</span>
              </div>
              <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{selected.title[locale]}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{selected.summary[locale]}</p>
              <section className="mt-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><CheckCircle2 size={17} className="text-blue-600"/>{t.prerequisites}</h3>
                <ul className="space-y-2">{selected.prerequisites[locale].map((x,i)=><li key={i} className="flex gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300"><Circle size={14} className="mt-1.5 shrink-0 text-slate-400"/>{x}</li>)}</ul>
              </section>
              <section className="mt-7">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><PlayCircle size={18} className="text-blue-600"/>{t.steps}</h3>
                <ol className="space-y-3">{selected.steps[locale].map((x,i)=><li key={i} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">{i+1}</span><span className="pt-0.5 text-sm leading-6 text-slate-700 dark:text-slate-200">{x}</span></li>)}</ol>
              </section>
              <section className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
                <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-300"><CheckCircle2 size={17}/>{t.result}</h3>
                <p className="text-sm leading-6 text-emerald-900 dark:text-emerald-100">{selected.result[locale]}</p>
              </section>
              <section className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-300"><AlertTriangle size={17}/>{t.warnings}</h3>
                  <ul className="space-y-2">{selected.warnings[locale].map((x,i)=><li key={i} className="text-sm leading-6 text-amber-950 dark:text-amber-100">• {x}</li>)}</ul>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-900 dark:text-blue-300"><Lightbulb size={17}/>{t.tips}</h3>
                  <ul className="space-y-2">{selected.tips[locale].map((x,i)=><li key={i} className="text-sm leading-6 text-blue-950 dark:text-blue-100">• {x}</li>)}</ul>
                </div>
              </section>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                <span className="text-xs text-slate-500">{completed.includes(selected.id) ? t.completed : ''}</span>
                <button disabled={selected.availability === 'planned'} onClick={() => markCompleted(selected.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700">
                  <CheckCircle2 size={16}/>{completed.includes(selected.id) ? t.completed : t.mark}
                </button>
              </div>
            </div>
          </article>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search} className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"/>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button onClick={()=>setCategory('all')} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${category==='all'?'bg-blue-600 text-white':'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}>{t.all}</button>
              {categories.map(key=><button key={key} onClick={()=>setCategory(key)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${category===key?'bg-blue-600 text-white':'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}>{t.categories[key as keyof typeof t.categories]}</button>)}
            </div>
            {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">{t.empty}</div> : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map(item=>{ const Icon=item.icon; return (
                  <button key={item.id} onClick={()=>setSelectedId(item.id)} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><Icon size={21}/></div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.availability==='available'?'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300':'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>{item.availability==='available'?t.available:t.planned}</span>
                    </div>
                    <h3 className="mt-4 text-sm font-bold text-slate-900 dark:text-white">{item.title[locale]}</h3>
                    <p className="mt-2 min-h-12 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.summary[locale]}</p>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                      <span>{item.duration} · {t.categories[item.category as keyof typeof t.categories]}</span>
                      <ChevronRight size={16} className={`transition-transform group-hover:translate-x-1 ${isRtl?'rotate-180':''}`}/>
                    </div>
                  </button>
                );})}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
