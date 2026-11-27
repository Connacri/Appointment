import React, { useMemo, useState } from 'react';
import {
  BookOpen, Search, CalendarDays, BedDouble, Receipt, Sparkles, ClipboardList,
  Boxes, Coins, Globe, KeyRound, Flower2, BarChart3, Users, Building2, Database,
  QrCode, ChevronRight, ChevronLeft, Clock3, CheckCircle2, Circle,
  AlertTriangle, Lightbulb, PlayCircle, GraduationCap, Wrench, FileText, Palette,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WINDOWS_CARDLOCK_MDB_PATHS, ANDROID_CARDLOCK_MDB_PATHS, WEB_CARDLOCK_MDB_PATHS } from '../locks/database/mdbPaths';
import {
  filterHelpTutorials,
  readCompletedTutorialIds,
  writeCompletedTutorialIds,
} from '../utils/helpCenter';

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
  },
  {
    id: 'cardlock-import', category: 'administration', icon: Database, duration: '7 min', availability: 'available',
    title: { fr: 'Importer et contrôler CardLock.mdb', en: 'Import and verify CardLock.mdb', ar: 'استيراد وفحص قاعدة CardLock.mdb' },
    summary: { fr: 'Importer bâtiments, chambres, séjours et cartes sans inventer de chambres.', en: 'Import buildings, rooms, stays and cards without inventing rooms.', ar: 'استيراد المباني والغرف والإقامات والبطاقات دون إنشاء غرف وهمية.' },
    prerequisites: {
      fr: [
        `Windows (chemin exact à utiliser) : ${WINDOWS_CARDLOCK_MDB_PATHS.liveMdbPath} ; sauvegardes ${WINDOWS_CARDLOCK_MDB_PATHS.backupDirectoryPath}.`,
        `Android (chemin exact automatique : aucun) : ${ANDROID_CARDLOCK_MDB_PATHS.accessNote}`,
        `Web hors Windows (chemin exact automatique : aucun) : ${WEB_CARDLOCK_MDB_PATHS.accessNote}`,
      ],
      en: [
        `Windows (exact path to use): ${WINDOWS_CARDLOCK_MDB_PATHS.liveMdbPath}; backups ${WINDOWS_CARDLOCK_MDB_PATHS.backupDirectoryPath}.`,
        `Android (no automatic exact path): ${ANDROID_CARDLOCK_MDB_PATHS.accessNote}`,
        `Web outside Windows (no automatic exact path): ${WEB_CARDLOCK_MDB_PATHS.accessNote}`,
      ],
      ar: [
        `ويندوز (المسار الدقيق المطلوب استخدامه): ${WINDOWS_CARDLOCK_MDB_PATHS.liveMdbPath}؛ النسخ الاحتياطية ${WINDOWS_CARDLOCK_MDB_PATHS.backupDirectoryPath}.`,
        `أندرويد (لا يوجد مسار تلقائي دقيق): ${ANDROID_CARDLOCK_MDB_PATHS.accessNote}`,
        `الويب خارج ويندوز (لا يوجد مسار تلقائي دقيق): ${WEB_CARDLOCK_MDB_PATHS.accessNote}`,
      ]
    },
    steps: {
      fr: [
        'Ouvrez la configuration de l’établissement, puis Structure / Import proUSB.',
        'Sélectionnez le fichier réellement utilisé par proUSB ; une ancienne copie de Program Files peut être obsolète.',
        'Contrôlez le rapport des tables : nom et nombre de lignes de chaque table métier.',
        'BuildingInfo fournit BldNo et BldName. RoomInfo fournit BldNo, FlrNo, RoomNo/RomID, type, statut, tarif et compteurs de cartes.',
        'Vérifiez le nombre de chambres pour chaque bâtiment. Le bâtiment, l’étage et le numéro sont conservés séparément.',
        'Les identifiants BldNo = 0 et FlrNo = 0 sont valides ; une valeur zéro ne signifie pas « absent ».',
        'GuestInfo devient un séjour seulement si la chambre exacte existe dans RoomInfo et si les dates sont valides.',
        'CardInfo et Dai décrivent les cartes ; RecordOpen journalise les ouvertures ; OperatorInfo et les journaux ne sont pas des chambres.',
        'Après import, contrôlez les bâtiments, les chambres et les avertissements avant toute nouvelle réservation.'
      ],
      en: [
        'Open property setup, then Structure / proUSB Import.',
        'Select the file actually used by proUSB; an old Program Files copy may be stale.',
        'Review the table report: name and row count for each business table.',
        'BuildingInfo supplies BldNo and BldName. RoomInfo supplies BldNo, FlrNo, RoomNo/RomID, type, status, rate and card counters.',
        'Verify the room count for every building. Building, floor and room number remain separate.',
        'BldNo = 0 and FlrNo = 0 are valid identifiers; zero does not mean missing.',
        'GuestInfo becomes a stay only when the exact room exists in RoomInfo and dates are valid.',
        'CardInfo and Dai describe cards; RecordOpen logs openings; OperatorInfo and logs are not rooms.',
        'After import, verify buildings, rooms and warnings before creating bookings.'
      ],
      ar: [
        'افتح إعدادات المؤسسة ثم Structure / Import proUSB.',
        'اختر الملف المستخدم فعلياً من proUSB؛ فقد تكون نسخة Program Files قديمة.',
        'راجع تقرير الجداول: اسم كل جدول وعدد سجلاته.',
        'يوفر BuildingInfo حقلي BldNo وBldName. ويوفر RoomInfo حقول المبنى والطابق ورقم الغرفة والنوع والحالة والسعر وعدّادات البطاقات.',
        'تحقق من عدد الغرف لكل مبنى. يتم حفظ المبنى والطابق ورقم الغرفة كلٌ على حدة.',
        'القيمتان BldNo = 0 وFlrNo = 0 معرفان صالحان وليستا قيماً مفقودة.',
        'يصبح GuestInfo إقامة فقط عندما توجد الغرفة المطابقة في RoomInfo وتكون التواريخ صحيحة.',
        'تصف CardInfo وDai البطاقات؛ ويسجل RecordOpen عمليات الفتح؛ أما OperatorInfo والسجلات فليست غرفاً.',
        'بعد الاستيراد، راجع المباني والغرف والتحذيرات قبل إنشاء الحجوزات.'
      ]
    },
    result: { fr: 'L’inventaire reprend les lignes RoomInfo valides ; les séjours orphelins sont signalés et les chambres de démonstration sont retirées.', en: 'Inventory reflects valid RoomInfo rows; orphan stays are reported and demo rooms are removed.', ar: 'يعكس المخزون سجلات RoomInfo الصحيحة؛ ويتم الإبلاغ عن الإقامات غير المرتبطة وإزالة غرف العرض التجريبي.' },
    warnings: {
      fr: ['Ne déduisez jamais un étage depuis le numéro de chambre.', 'Un statut RoomInfo inconnu reste non renseigné ; il n’est pas transformé en chambre propre.', 'Un séjour sans chambre correspondante ou sans dates valides est ignoré, jamais transformé en chambre fictive.', 'Ne modifiez pas la base proUSB originale depuis Appointment PMS.'],
      en: ['Never infer a floor from the room number.', 'An unknown RoomInfo status remains unset; it is not converted to clean.', 'A stay without a matching room or valid dates is skipped, never turned into a fake room.', 'Do not modify the original proUSB database from Appointment PMS.'],
      ar: ['لا تستنتج الطابق من رقم الغرفة.', 'تبقى حالة RoomInfo غير المعروفة دون تحديد ولا تتحول إلى غرفة نظيفة.', 'يتم تجاهل الإقامة التي لا تطابق غرفة حقيقية أو لا تحتوي على تواريخ صحيحة، ولا تتحول إلى غرفة وهمية.', 'لا تعدّل قاعدة proUSB الأصلية من Appointment PMS.']
    },
    tips: {
      fr: ['Conservez une sauvegarde du MDB.', 'Si le bâtiment 2 manque, comparez BuildingInfo et la distribution des valeurs RoomInfo.BldNo dans le fichier choisi.'],
      en: ['Keep a backup of the MDB.', 'If building 2 is missing, compare BuildingInfo with the RoomInfo.BldNo distribution in the selected file.'],
      ar: ['احتفظ بنسخة احتياطية من MDB.', 'إذا كان المبنى الثاني مفقوداً، فقارن BuildingInfo مع توزيع RoomInfo.BldNo في الملف المحدد.']
    }
  },
  {
    id: 'room-grouping-timeline',
    category: 'reservations',
    icon: Building2,
    duration: '6 min',
    availability: 'available',
    title: {
      fr: 'Regrouper les chambres par Étage et par Aile & Navigation fluide',
      en: 'Group rooms by Floor and Wing & Smooth timeline navigation',
      ar: 'تجميع الغرف حسب الطابق والجناح والتنقل السلس في المخطط',
    },
    summary: {
      fr: 'Définir l’aile et l’étage de chaque chambre, basculer le mode de regroupement sur le planning et naviguer mois par mois sans aucun saut intempestif.',
      en: 'Set wing and floor for each room, toggle timeline grouping mode, and navigate month-by-month sequentially without jumps.',
      ar: 'تحديد جناح وطابق كل غرفة، والتبديل بين أوضاع العرض في المخطط، والتنقل شهراً بشهر دون قفزات غير متوقعة.',
    },
    prerequisites: {
      fr: ['Avoir configuré au moins un bâtiment d’hébergement.', 'Disposer des droits de modification de la structure de l’établissement.'],
      en: ['Have at least one hotel building configured.', 'Have permissions to edit property structure.'],
      ar: ['تهيئة مبنى إقامة واحد على الأقل.', 'امتلاك صلاحيات تعديل هيكل المؤسسة.'],
    },
    steps: {
      fr: [
        'Ouvrez « Configuration de l’établissement » puis rendez-vous dans l’onglet « Structure ».',
        'Choisissez le Mode de regroupement par défaut : « Par Étage », « Par Aile » ou « Par Étage & Aile ».',
        'Lors de la création manuelle de chambres ou dans l’inventaire, renseignez le nom de l’aile (ex. Aile Nord, Aile Ouest, Bâtiment Principal).',
        'Enregistrez la configuration pour appliquer le modèle à l’ensemble de vos chambres.',
        'Sur le Planning Gantt, observez les en-têtes rétractables qui regroupent vos chambres selon le mode choisi.',
        'Cliquez sur l’en-tête d’un étage ou d’une aile pour plier ou déplier l’ensemble des chambres correspondantes.',
        'Utilisez les boutons de navigation mensuelle [ < ] et [ > ] pour avancer ou reculer mois par mois de manière fluide sans saut de date.',
        'Cliquez sur la pastille centrale du mois pour vous repositionner instantanément sur aujourd’hui.',
      ],
      en: [
        'Open Property Setup and switch to the Structure tab.',
        'Choose default grouping mode: By Floor, By Wing, or By Floor & Wing.',
        'When creating rooms or editing inventory, assign wing names (e.g. North Wing, West Wing).',
        'Save settings to update the hierarchy across all rooms.',
        'On the Gantt Planning view, note collapsible headers grouping rooms by your active mode.',
        'Click any floor or wing header to collapse or expand all associated rooms.',
        'Use sequential month navigation buttons [ < ] and [ > ] to step through months smoothly without skips.',
        'Click the visible month badge to re-center on today instantly.',
      ],
      ar: [
        'افتح إعدادات المؤسسة ثم انتقل إلى تبويب «الهيكل».',
        'اختر وضع التجميع الافتراضي: حسب الطابق، حسب الجناح، أو حسب الطابق والجناح معاً.',
        'عند إنشاء الغرف أو تعديل المخزون، حدد اسم الجناح (مثل: الجناح الشمالي، الجناح الغربي).',
        'احفظ الإعدادات لتطبيق الهيكلية على جميع الغرف.',
        'في مخطط جانت، ستظهر عناوين قابلة للطي تجمع الغرف وفق النمط المختار.',
        'اضغط على عنوان الطابق أو الجناح لطي أو توسيع الغرف التابعة له.',
        'استخدم أزرار التنقل الشهري [ < ] و [ > ] للانتقال بين الأشهر تسلسلياً وبسلاسة تامة دون قفزات.',
        'اضغط على اسم الشهر المعروض في المنتصف للعودة فوراً إلى تاريخ اليوم.',
      ],
    },
    result: {
      fr: 'Vos chambres sont organisées par ailes et étages avec des en-têtes pliables, et le calendrier défile mois par mois sans saut.',
      en: 'Rooms are grouped into collapsible wing/floor headers and the timeline steps month-by-month without jumps.',
      ar: 'أصبحت الغرف منظمة في أجنحة وطوابق بعناوين قابلة للطي والتقويم يتنقل شهراً بشهر دون قفزات.',
    },
    warnings: {
      fr: ['Ne laissez pas le champ Aile vide si vous activez le regroupement par Aile : une valeur par défaut « Aile Principale » sera alors appliquée.'],
      en: ['Do not leave the wing empty if grouping by wing; otherwise a default "Main Wing" is assigned.'],
      ar: ['لا تترك حقل الجناح فارغاً عند تفعيل التجميع بالأجنحة لتفادي إدراجها تحت الجناح الافتراضي.'],
    },
    tips: {
      fr: ['Utilisez le sélecteur rapide « Étage | Aile | Étage & Aile » dans la barre d’outils du planning pour changer de vue en un clic.', 'Sur mobile, repliez les étages inoccupés pour gagner de la place.'],
      en: ['Use the quick switcher in the timeline toolbar to change grouping on the fly.', 'On mobile, collapse unoccupied floors to save vertical space.'],
      ar: ['استخدم أزرار التبديل السريع في شريط المخطط لتغيير وضع التجميع بنقرة واحدة.', 'على الهواتف، اطوِ الطوابق الفارغة لتوفير مساحة التمرير.'],
    },
  },
  {
    id: 'prousb-hardware-cards',
    category: 'access',
    icon: KeyRound,
    duration: '8 min',
    availability: 'available',
    title: {
      fr: 'Connecter le lecteur et contrôler les cartes proUSB',
      en: 'Connect the reader and inspect proUSB cards',
      ar: 'ربط القارئ وفحص بطاقات proUSB',
    },
    summary: {
      fr: 'Connecter l’encodeur, lire une carte et vérifier son type, son établissement et son périmètre avant toute émission.',
      en: 'Connect the encoder, read a card and verify its type, property scope and validity before issuing anything.',
      ar: 'ربط جهاز التشفير وقراءة البطاقة والتحقق من نوعها والمؤسسة ونطاق صلاحيتها قبل إصدار أي بطاقة.',
    },
    prerequisites: {
      fr: ['Un poste et un navigateur ou une application native compatibles avec le transport USB disponible.', 'Encodeur USB proUSB pris en charge et carte de test non utilisée en exploitation.', 'Une sauvegarde de CardLock.mdb si la base est utilisée.'],
      en: ['A workstation and browser or native app compatible with the available USB transport.', 'A supported proUSB USB encoder and a test card not used in live operations.', 'Back up CardLock.mdb when that database is in use.'],
      ar: ['حاسوب ومتصفح أو تطبيق أصلي متوافق مع وسيلة اتصال USB المتاحة.', 'جهاز تشفير proUSB مدعوم وبطاقة اختبار غير مستخدمة في التشغيل الفعلي.', 'أنشئ نسخة احتياطية من CardLock.mdb عند استخدام قاعدة البيانات.'],
    },
    steps: {
      fr: [
        'Ouvrez « Serrures proUSB » depuis le menu de l’application.',
        'Ouvrez l’onglet matériel / lecteur USB, puis connectez l’encodeur et vérifiez son identification.',
        'Présentez une carte de test et lancez la lecture ; contrôlez le type décodé, le code système, le bâtiment, l’étage et les dates lorsqu’ils existent.',
        'Comparez le résultat avec la carte réelle et les données CardLock.mdb importées. Un numéro de chambre seul ne suffit pas à identifier une chambre multi-bâtiments.',
        'Pour une carte Client, vérifiez la réservation, la chambre exacte, le bâtiment, l’étage et les heures avant émission.',
        'Pour une carte Étage ou Bâtiment, sélectionnez explicitement le bâtiment réel et, pour l’étage, l’étage réel correspondant. Les identifiants 0 sont valides dans CardLock.',
        'Testez toute carte nouvellement émise sur une serrure de test ou hors exploitation avant de l’utiliser pour un client ou une équipe.',
        'Après un changement d’établissement ou de code système, n’utilisez pas d’anciennes cartes : suivez la procédure de reconfiguration avec une carte système autorisée.',
      ],
      en: [
        'Open proUSB Locks from the application menu.',
        'Open the hardware / USB reader tab, connect the encoder and verify its identity.',
        'Present a test card and read it; inspect the decoded type, system code, building, floor and dates when available.',
        'Compare the result with the physical card and imported CardLock.mdb data. A room number alone does not identify a room across multiple buildings.',
        'For a Guest Card, verify the booking, exact room, building, floor and access times before issuing it.',
        'For a Floor or Building Card, explicitly select the real building and, for a floor card, the matching real floor. CardLock identifier 0 is valid.',
        'Test every newly issued card on a test lock or outside live operations before using it for a guest or staff member.',
        'After changing property or system code, do not reuse old cards; follow the authorized system-card recommissioning procedure.',
      ],
      ar: [
        'افتح قسم أقفال proUSB من قائمة التطبيق.',
        'افتح تبويب الأجهزة / قارئ USB، ثم اربط جهاز التشفير وتحقق من هويته.',
        'ضع بطاقة اختبار واقرأها؛ تحقق من النوع ورمز النظام والمبنى والطابق والتواريخ عند توفرها.',
        'قارن النتيجة بالبطاقة الفعلية وبيانات CardLock.mdb المستوردة. رقم الغرفة وحده لا يميز الغرف بين مبانٍ متعددة.',
        'قبل إصدار بطاقة نزيل، تحقق من الحجز والغرفة والمبنى والطابق وأوقات الدخول بدقة.',
        'لبطاقة الطابق أو المبنى، حدد المبنى الحقيقي صراحةً، وحدد الطابق الحقيقي المطابق لبطاقة الطابق. القيمة 0 معرف صالح في CardLock.',
        'اختبر كل بطاقة جديدة على قفل تجريبي أو خارج التشغيل الفعلي قبل استخدامها للنزلاء أو الموظفين.',
        'بعد تغيير المؤسسة أو رمز النظام، لا تستخدم البطاقات القديمة؛ اتبع إجراء إعادة البرمجة باستخدام بطاقة نظام مخولة.',
      ],
    },
    result: {
      fr: 'Le lecteur est identifié et les données de la carte sont contrôlées. La lecture ne prouve pas à elle seule que la serrure acceptera l’accès.',
      en: 'The reader is identified and card data is inspected. Reading a card alone does not prove the lock will grant access.',
      ar: 'تم التعرف على القارئ وفحص بيانات البطاقة. قراءة البطاقة وحدها لا تثبت أن القفل سيقبل الدخول.',
    },
    warnings: {
      fr: [
        'Ne déconnectez jamais le lecteur pendant une écriture.',
        'Une carte Maître ouvre toutes les chambres ; une carte universelle de système sert à la mise en service et ne doit pas être distribuée comme carte de service.',
        'La carte Spéciale 0x90 est expérimentale : son marqueur PIN est vérifié par l’application, pas par une protection cryptographique confirmée dans la serrure. Ne l’utilisez pas pour sécuriser une chambre.',
        'La présence d’un type de carte dans le logiciel ne garantit pas sa compatibilité avec chaque modèle de serrure. Validez physiquement chaque famille avant exploitation.',
      ],
      en: [
        'Never disconnect the encoder during a write operation.',
        'A Master Card opens all rooms; a universal system card is for commissioning and must not be issued as a staff card.',
        'The 0x90 Special Card is experimental: its PIN marker is checked by the app, not by confirmed cryptographic enforcement in the lock. Do not rely on it to secure a room.',
        'A card type appearing in the software does not guarantee compatibility with every lock model. Physically validate each family before live use.',
      ],
      ar: [
        'لا تفصل جهاز التشفير أثناء عملية الكتابة.',
        'تفتح بطاقة Master جميع الغرف؛ أما بطاقة النظام الشاملة فهي مخصصة للتهيئة ولا توزع كبطاقة خدمة.',
        'بطاقة 0x90 الخاصة تجريبية: يتحقق التطبيق من علامة PIN ولا توجد حماية تشفيرية مؤكدة داخل القفل. لا تعتمد عليها لتأمين غرفة.',
        'ظهور نوع البطاقة في البرنامج لا يضمن توافقه مع كل طرازات الأقفال. اختبر كل نوع فعلياً قبل التشغيل.',
      ],
    },
    tips: {
      fr: ['Conservez une sauvegarde du MDB et un registre des cartes émises.', 'Utilisez une carte de test et une serrure de test pour chaque changement de format ou de code système.', 'Créez une carte Horloge uniquement lorsque le réglage de l’horloge est nécessaire et selon la procédure du fabricant.'],
      en: ['Keep a backup of the MDB and a register of issued cards.', 'Use a test card and test lock for each format or system-code change.', 'Issue a Clock Card only when clock adjustment is required and according to the manufacturer procedure.'],
      ar: ['احتفظ بنسخة احتياطية من MDB وسجل للبطاقات الصادرة.', 'استخدم بطاقة وقفل اختبار عند كل تغيير في التنسيق أو رمز النظام.', 'أصدر بطاقة الساعة عند الحاجة لضبط الوقت ووفق تعليمات الشركة المصنعة فقط.'],
    },
  },
  {
    id: 'police-folio-export',
    category: 'reservations',
    icon: FileText,
    duration: '6 min',
    availability: 'available',
    title: {
      fr: 'Fiche d’informations client & Export des arrivées',
      en: 'Guest information form & arrival export',
      ar: 'بيانات النزيل وتصدير سجل الوصول',
    },
    summary: {
      fr: 'Renseigner les informations de séjour et d’identité disponibles, puis préparer un document et un export des arrivées à vérifier avant tout usage réglementaire.',
      en: 'Record available stay and identity details, then prepare a document and arrival export for review before any regulatory use.',
      ar: 'تسجيل بيانات الإقامة والهوية المتاحة ثم إعداد مستند وكشف الوصول لمراجعتهما قبل أي استخدام تنظيمي.',
    },
    prerequisites: {
      fr: ['Avoir une réservation active au statut Confirmée ou En cours (In-house).', 'Avoir la pièce d’identité physique du client en main.'],
      en: ['Have an active booking.', 'Hold the guest physical ID card or passport.'],
      ar: ['توفر حجز نشط.', 'حيازة الوثيقة الثبوتية الأصلية للنزيل.'],
    },
    steps: {
      fr: [
        'Ouvrez la réservation depuis le planning Gantt ou la liste des séjours.',
        'Dans l’onglet Informations Client, cliquez sur « Pièce d’identité & Police ».',
        'Sélectionnez le type de document : Carte Nationale d’Identité (CNI), Passeport ou Permis de conduire.',
        'Saisissez le numéro officiel, la date et le lieu de délivrance, ainsi que la wilaya / pays de résidence.',
        'Indiquez la nationalité, la profession et le numéro d’immatriculation du véhicule si le client est motorisé.',
        'Générez le document disponible dans Appointment, puis vérifiez son modèle, ses champs et sa version avant toute utilisation externe.',
        'Appliquez la procédure de signature, d’archivage et de transmission validée par votre établissement.',
        'N’exportez ou ne transmettez les informations qu’aux destinataires autorisés et selon la procédure de votre établissement.',
      ],
      en: [
        'Open the stay folio from the Gantt planner or Bookings view.',
        'Under Guest Details, click ID Document & Police Form.',
        'Select document type: National ID (CNI), Passport, or Driving License.',
        'Input document number, issue date, issuing authority and home province / country.',
        'Fill in nationality, occupation and vehicle license plate if applicable.',
        'Generate the document available in Appointment and review its template, fields and version before external use.',
        'Follow the signature, retention and transmission procedure approved by your property.',
        'Export or transmit guest information only to authorized recipients under your property procedure.',
      ],
      ar: [
        'افتح بطاقة الحجز من مخطط جانت أو قائمة الإقامات.',
        'في تفاصيل النزيل، اضغط على «وثيقة الهوية واستمارة الشرطة».',
        'اختر نوع الوثيقة: بطاقة التعريف الوطنية، جواز السفر، أو رخصة السياقة.',
        'أدخل الرقم الوطني وتاريخ ومكان الإصدار، وولاية أو بلد الإقامة.',
        'سجل الجنسية، المهنة، ورقم لوحة ترقيم السيارة إن وجدت.',
        'أنشئ المستند المتاح في Appointment وراجع النموذج والحقول والإصدار قبل استخدامه خارج التطبيق.',
        'اتبع إجراء التوقيع والحفظ والإرسال المعتمد لدى مؤسستك.',
        'لا تصدر أو ترسل بيانات النزلاء إلا إلى الجهات المخولة ووفق إجراء مؤسستك.',
      ],
    },
    result: {
      fr: 'Les informations sont regroupées dans le document et l’export disponibles ; leur conformité doit être vérifiée par l’établissement avant usage officiel.',
      en: 'Information is collected in the available document and export; the property must verify legal compliance before official use.',
      ar: 'تم جمع البيانات في المستند والكشف المتاحين؛ ويجب على المؤسسة التحقق من المطابقة القانونية قبل الاستخدام الرسمي.',
    },
    warnings: {
      fr: ['Ne conservez pas de copies numériques de pièces d’identité sans consentement et sans chiffrement sécurisé.'],
      en: ['Do not keep unencrypted copies of identity cards without guest consent.'],
      ar: ['لا تحتفظ بنسخ غير مشفرة من بطاقات الهوية دون موافقة النزيل وفق لوائح حماية البيانات.'],
    },
    tips: {
      fr: ['Complétez les informations dès le check-in pour éviter les retards lors des contrôles.', 'Vérifiez la date de validité du passeport pour les voyageurs étrangers.'],
      en: ['Collect details during check-in to avoid front desk delays.', 'Verify foreign passport expiration dates.'],
      ar: ['سجل البيانات لحظة تسجيل الوصول لتفادي أي تأخير.', 'تحقق من تاريخ صلاحية جواز السفر للنزلاء الأجانب.'],
    },
  },
  {
    id: 'establishment-themes-currency',
    category: 'administration',
    icon: Palette,
    duration: '5 min',
    availability: 'available',
    title: {
      fr: 'Personnaliser l’établissement, Thèmes visuels et Devises',
      en: 'Customize property, visual themes and currencies',
      ar: 'تخصيص المؤسسة، السمات البصرية والعملات',
    },
    summary: {
      fr: 'Modifier les informations de l’établissement, choisir la devise d’affichage et appliquer les thèmes exclusifs (Océan, Émeraude, Nuit Polaire).',
      en: 'Configure property profile, set default currency and switch between elegant themes (Ocean, Emerald, Polar Night).',
      ar: 'تعديل بيانات المؤسسة، واختيار العملة المعتمدة، وتطبيق السمات البصرية الأنيقة (المحيط، الزمرد، الليل القطبي).',
    },
    prerequisites: {
      fr: ['Accès administrateur ou gérant.', 'Avoir les informations légales de votre établissement (nom, adresse, NIF, NIS, contact).'],
      en: ['Admin or manager role.', 'Have your business legal details (name, address, tax IDs, phone).'],
      ar: ['صلاحية المدير أو المشرف.', 'توفر البيانات القانونية للمؤسسة (الاسم، العنوان، المعرف الجبائي، الهاتف).'],
    },
    steps: {
      fr: [
        'Cliquez sur « Configurer l’établissement » dans le menu latéral ou le logo en haut de page.',
        'Mettez à jour le nom commercial, le slogan, la catégorie (Étoiles), l’adresse et le numéro de téléphone.',
        'Renseignez les mentions légales et fiscales (NIF, NIS, RC, RIB bancaire) pour qu’elles apparaissent sur vos factures.',
        'Dans la barre supérieure, utilisez le sélecteur de devise pour basculer entre Dinar Algérien (DA / DZD), Euro (€), Dollar ($) ou Livre (£).',
        'Pour changer d’ambiance visuelle, cliquez sur l’icône Palette ou le sélecteur de thème dans le menu.',
        'Sélectionnez un thème : Indigo Classique, Océan Atlantique, Émeraude Luxueuse, Cuivre Royal ou Nuit Polaire.',
        'Basculez entre le Mode Clair et le Mode Sombre selon l’éclairage de votre poste de réception.',
        'Vos préférences sont sauvegardées localement et appliquées immédiatement à tous les écrans du PMS.',
      ],
      en: [
        'Click Setup Property in the sidebar or property badge at the top.',
        'Update trading name, tagline, star rating, address and contact number.',
        'Enter legal and tax IDs (TIN, Commercial Register, Bank IBAN) to brand invoices.',
        'Use the top header currency switcher to toggle between Dinar (DA / DZD), Euro (€), USD ($) or GBP (£).',
        'To change the look and feel, click the Palette icon in the sidebar preferences.',
        'Pick a theme: Classic Indigo, Deep Ocean, Emerald Luxury, Royal Copper or Polar Night.',
        'Toggle Dark Mode or Light Mode depending on ambient front desk lighting.',
        'Preferences are saved locally in the browser and applied instantaneously.',
      ],
      ar: [
        'اضغط على «تهيئة المؤسسة» من القائمة الجانبية أو من شارة الفندق في الأعلى.',
        'حدّث الاسم التجاري، الشعار، التصنيف (النجوم)، العنوان ورقم الهاتف.',
        'أدخل البيانات الجبائية والقانونية (السجل التجاري، المعرف الجبائي، الحساب البنكي) لتظهر تلقائياً في فواتيرك.',
        'في الشريط العلوي، استخدم مبدل العملات للتبديل بين الدينار الجزائري (DA / DZD)، اليورو (€)، الدولار ($) أو الإسترليني (£).',
        'لتغيير المظهر، اضغط على أيقونة السمات (Palette) في القائمة الجانبية.',
        'اختر السمة المفضلة: النيلي الكلاسيكي، محيط أطلسي، الزمرد الفاخر، النحاس الملكي، أو الليل القطبي.',
        'بدل بين الوضع النهاري الفاتح والوضع الليلي المريح للعين بحسب إضاءة مكتب الاستقبال.',
        'يتم حفظ خياراتك محلياً وتطبيقها فوراً على كامل واجهات النظام.',
      ],
    },
    result: {
      fr: 'Votre PMS arbore les couleurs de votre établissement, vos factures sont aux normes et votre monnaie de travail est active.',
      en: 'Your PMS reflects your brand identity, invoices are compliant, and your preferred currency is set.',
      ar: 'أصبح النظام يعكس هوية فندقك بالكامل، وفواتيرك نظامية مع اعتماد عملتك المفضلة.',
    },
    warnings: {
      fr: ['Le changement de devise n’applique pas de taux de change rétroactif sur les devis déjà émis.'],
      en: ['Switching currencies does not retroactively convert previously issued invoices.'],
      ar: ['تغيير العملة المعروضة لا يحول مبالغ الفواتير الصادرة مسبقاً بشكل رجعي.'],
    },
    tips: {
      fr: ['Le mode sombre est particulièrement recommandé pour les équipes travaillant en réception de nuit.', 'Personnalisez le logo de l’hôtel pour des impressions professionnelles.'],
      en: ['Dark mode is strongly recommended for night audit reception shifts.', 'Upload your high-res hotel logo for crisp PDF printing.'],
      ar: ['يوصى بالوضع الليلي بشكل خاص لموظفي الاستقبال أثناء المناوبة الليلية.', 'ارفع شعار الفندق بدقة عالية للحصول على مطبوعات راقية.'],
    },
  }
];

const ui = {
  fr: { heading: 'Centre d’aide', subtitle: 'Apprenez à utiliser Appointment, étape par étape.', search: 'Rechercher un tutoriel, une opération…', all: 'Tous', available: 'Disponible', planned: 'À venir', min: 'min', prerequisites: 'Avant de commencer', steps: 'Procédure détaillée', result: 'Résultat attendu', warnings: 'Points de vigilance', tips: 'Bonnes pratiques', back: 'Tous les tutoriels', progress: 'Tutoriels terminés', completed: 'Terminé', mark: 'Marquer comme terminé', categories: { reservations: 'Réservations', finance: 'Facturation & paiements', operations: 'Opérations hôtelières', services: 'Services & Spa', access: 'Accès & QR', management: 'Pilotage & distribution', administration: 'Administration', future: 'Fonctionnalités en préparation' }, plannedNotice: 'Cette procédure décrit un processus cible ou une capacité encore en validation. Ne l’utilisez pas comme procédure de production.', progressDevice: 'Progression enregistrée sur cet appareil et ce navigateur.', empty: 'Aucun tutoriel ne correspond à votre recherche.' },
  en: { heading: 'Help center', subtitle: 'Learn how to use Appointment, step by step.', search: 'Search tutorials and tasks…', all: 'All', available: 'Available', planned: 'Coming soon', min: 'min', prerequisites: 'Before you start', steps: 'Step-by-step guide', result: 'Expected result', warnings: 'Important warnings', tips: 'Best practices', back: 'All tutorials', progress: 'Completed tutorials', completed: 'Completed', mark: 'Mark as completed', categories: { reservations: 'Reservations', finance: 'Billing & payments', operations: 'Hotel operations', services: 'Services & Spa', access: 'Access & QR', management: 'Management & distribution', administration: 'Administration', future: 'In development' }, plannedNotice: 'This procedure describes a target workflow or a capability still being validated. Do not use it as a production procedure.', progressDevice: 'Progress is saved on this device and browser.', empty: 'No tutorial matches your search.' },
  ar: { heading: 'مركز المساعدة', subtitle: 'تعلم استخدام Appointment خطوة بخطوة.', search: 'ابحث عن دليل أو عملية…', all: 'الكل', available: 'متاح', planned: 'قريباً', min: 'دقيقة', prerequisites: 'قبل البدء', steps: 'الخطوات التفصيلية', result: 'النتيجة المتوقعة', warnings: 'تنبيهات مهمة', tips: 'أفضل الممارسات', back: 'كل الدروس', progress: 'الدروس المكتملة', completed: 'مكتمل', mark: 'وضع علامة مكتمل', categories: { reservations: 'الحجوزات', finance: 'الفوترة والمدفوعات', operations: 'عمليات الفندق', services: 'الخدمات والسبا', access: 'الدخول وQR', management: 'الإدارة والتوزيع', administration: 'الإدارة التقنية', future: 'قيد التطوير' }, plannedNotice: 'تصف هذه الإجراءات سير عمل مستقبلياً أو وظيفة لا تزال قيد التحقق. لا تستخدمها كإجراء إنتاجي.', progressDevice: 'يتم حفظ التقدم على هذا الجهاز والمتصفح فقط.', empty: 'لا يوجد دليل يطابق البحث.' }
};

export const HelpCenterView: React.FC = () => {
  const { language } = useApp();
  const locale: Locale = language;
  const t = ui[locale];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const validTutorialIds = useMemo(
    () => tutorials.filter((item) => item.availability === 'available').map((item) => item.id),
    [],
  );
  const availableTutorialCount = validTutorialIds.length;
  const getHelpStorage = () => {
    try {
      return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
      return null;
    }
  };
  const [completed, setCompleted] = useState<string[]>(() =>
    readCompletedTutorialIds(getHelpStorage(), validTutorialIds)
  );

  const filtered = useMemo(
    () => filterHelpTutorials(tutorials, category, query),
    [category, query],
  );

  const selected = tutorials.find((item) => item.id === selectedId);
  const markCompleted = (id: string) => {
    if (completed.includes(id) || !validTutorialIds.includes(id)) return;
    const next = [...completed, id];
    setCompleted(next);
    writeCompletedTutorialIds(getHelpStorage(), next, validTutorialIds);
  };
  const categories = Array.from(new Set(tutorials.map((item) => item.category)));
  const isRtl = locale === 'ar';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8 space-y-6">
        <header className="rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-5 sm:p-7 text-white shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/10 p-3"><BookOpen size={25}/></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Appointment Academy</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">{t.heading}</h1>
              <p className="mt-1 text-sm text-slate-300">{t.subtitle}</p>
              <a href="https://github.com/Connacri/Appointment/blob/main/docs/USER_GUIDE_FR.md" target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {locale === 'fr' ? 'Ouvrir le guide utilisateur complet' : locale === 'ar' ? 'فتح دليل المستخدم الكامل' : 'Open the complete user guide'}
              </a>
            </div>
            <GraduationCap className="hidden sm:block text-blue-200" size={34}/>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="rounded-xl bg-white/10 p-3"><div className="text-2xl font-bold">{tutorials.filter(x => x.availability === 'available').length}</div><div className="text-xs text-slate-300">{t.available}</div></div>
            <div className="rounded-xl bg-white/10 p-3"><div className="text-2xl font-bold">{completed.length} / {availableTutorialCount}</div><div className="text-xs text-slate-300">{t.progress}</div></div>
          </div>
          <p className="mt-3 text-[11px] text-slate-300">{t.progressDevice}</p>
        </header>

        {selected ? (
          <article className="space-y-5">
            <button type="button" onClick={() => setSelectedId(null)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900">
              {isRtl ? <ChevronRight size={17}/> : <ChevronLeft size={17}/>} {t.back}
            </button>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selected.availability === 'available' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>{selected.availability === 'available' ? t.available : t.planned}</span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 size={13}/>{selected.duration}</span>
                <span className="text-xs text-slate-500">{t.categories[selected.category as keyof typeof t.categories]}</span>
              </div>
              {selected.availability === 'planned' && (
                <div role="note" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  <AlertTriangle size={18} className="mt-1 shrink-0" />
                  <span>{t.plannedNotice}</span>
                </div>
              )}
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
                <button type="button" disabled={selected.availability === 'planned' || completed.includes(selected.id)} onClick={() => markCompleted(selected.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700">
                  <CheckCircle2 size={16}/>{completed.includes(selected.id) ? t.completed : t.mark}
                </button>
              </div>
            </div>
          </article>
        ) : (
          <>
            <div className="relative">
              <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} size={18}/>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t.search}
                aria-label={t.search}
                className={`h-12 w-full rounded-xl border border-slate-200 bg-white ${isRtl ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950`}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${category==='all'?'bg-blue-600 text-white':'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}>{t.all}</button>
              {categories.map(key=><button type="button" key={key} aria-pressed={category === key} onClick={() => setCategory(key)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${category===key?'bg-blue-600 text-white':'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}>{t.categories[key as keyof typeof t.categories]}</button>)}
            </div>
            {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">{t.empty}</div> : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map(item=>{ const Icon=item.icon; return (
                  <button type="button" key={item.id} aria-label={item.title[locale]} onClick={()=>setSelectedId(item.id)} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left rtl:text-right shadow-xs transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700">
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
