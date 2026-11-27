import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Sparkles,
  Plus,
  Search,
  User,
  Boxes,
  Flame,
  Check,
  Trash2,
  RefreshCw,
  Bell,
  BellRing,
  Play,
  UserCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  PackageCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RoomReplenishmentModal } from './RoomReplenishmentModal';
import { PmsTask } from '../types/booking';
import {
  deriveStaffNotifications,
  loadReadNotificationIds,
  saveReadNotificationIds,
  type StaffNotification,
} from '../utils/staffNotifications';
import { getRoleUiCapabilities } from '../utils/rolePermissions';

const DEFAULT_STAFF_ROSTER = ['Amina', 'Sonia', 'Yacine', 'Karim (Technique)'];

export const TasksManagementView: React.FC = () => {
  const {
    tasks,
    addTask,
    updateTaskStatus,
    toggleSubtask,
    deleteTask,
    language,
    activeRoleDefinition,
    resourceGroups,
    currentDomain,
    bookings,
    updateHousekeepingStatus,
    activeOperatorName,
    setActiveOperatorName,
    focusedTaskId,
    setFocusedTaskId,
    searchQuery: globalSearchQuery,
    stockItems,
    purchaseOrders,
    setActiveView,
    setFocusedStockTab,
    staffMembers: hrStaffMembers,
    deviceMutationAvailability,
  } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const t = (fr: string, en: string, ar: string) => (isFr ? fr : isAr ? ar : en);

  const uiCaps = useMemo(() => getRoleUiCapabilities(activeRoleDefinition), [activeRoleDefinition]);
  const canCreateTask = activeRoleDefinition.permissions.canManageTasks;
  const canDeleteTask =
    activeRoleDefinition.category === 'management' ||
    activeRoleDefinition.category === 'front_office' ||
    activeRoleDefinition.id === 'gouvernante';

  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'doing' | 'done'>('open');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  const [localSearch, setLocalSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(tasks[0]?.id || null);
  const [isNotifsExpanded, setIsNotifsExpanded] = useState<boolean>(true);
  const [customOperatorInput, setCustomOperatorInput] = useState('');
  const [isCustomOperatorOpen, setIsCustomOperatorOpen] = useState(false);
  const [replenishModalState, setReplenishModalState] = useState<{
    open: boolean;
    roomName?: string;
    initialQuantities?: Record<string, number>;
  }>({ open: false });

  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(() => loadReadNotificationIds());

  // Sync focused task when navigated from Notification Bell or Housekeeping
  useEffect(() => {
    if (!focusedTaskId) return;
    const target = tasks.find((item) => item.id === focusedTaskId);
    if (target) {
      setSelectedTaskId(target.id);
      if (target.status === 'done' || target.status === 'cancel') {
        setFilterStatus('all');
      } else if (filterStatus === 'done') {
        setFilterStatus('open');
      }
      setFilterCategory('all');
      setFilterStaff('all');
    }
    setFocusedTaskId(null);
  }, [focusedTaskId, tasks, filterStatus, setFocusedTaskId]);

  const activeRooms = useMemo(
    () => resourceGroups.filter((g) => g.sector === currentDomain).flatMap((g) => g.resources),
    [resourceGroups, currentDomain]
  );

  // Dynamic staff list combining HR roster + defaults + names present on tasks + active operator
  const staffMembers = useMemo(() => {
    const names = new Set<string>(DEFAULT_STAFF_ROSTER);
    for (const member of hrStaffMembers) {
      if (member.status === 'active' && member.fullName.trim()) {
        names.add(member.fullName.trim());
      }
    }
    for (const task of tasks) {
      if (task.assignee?.trim()) names.add(task.assignee.trim());
      if (task.completedBy?.trim()) names.add(task.completedBy.trim());
    }
    if (activeOperatorName.trim()) names.add(activeOperatorName.trim());
    return [...names];
  }, [hrStaffMembers, tasks, activeOperatorName]);

  // Live operational notifications
  const notifications = useMemo(
    () =>
      deriveStaffNotifications({
        role: activeRoleDefinition,
        tasks,
        rooms: activeRooms,
        bookings,
        stockItems,
        purchaseOrders,
        language,
        activeOperatorName,
      }),
    [activeRoleDefinition, tasks, activeRooms, bookings, stockItems, purchaseOrders, language, activeOperatorName]
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !readNotifIds.has(n.id)),
    [notifications, readNotifIds]
  );

  const markNotifRead = (id: string) => {
    setReadNotifIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadNotificationIds(next);
      return next;
    });
  };

  const markAllNotifsRead = () => {
    setReadNotifIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      saveReadNotificationIds(next);
      return next;
    });
  };

  // New task modal state
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newRoom, setNewRoom] = useState(
    activeRooms[0]?.name || (currentDomain === 'resort' ? 'Villa Emeraude' : 'CV-101')
  );
  const [newTypeName, setNewTypeName] = useState('Nettoyage départ à fond');
  const [newCategory, setNewCategory] = useState<PmsTask['category']>('Ménage');
  const [newAssignee, setNewAssignee] = useState('Amina');
  const [newPriority, setNewPriority] = useState<'normal' | 'urgent'>('normal');
  const [newNote, setNewNote] = useState('');

  const effectiveSearch = (localSearch || globalSearchQuery || '').trim().toLowerCase();

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterStatus === 'open' && (task.status === 'done' || task.status === 'cancel')) return false;
      if (filterStatus === 'doing' && task.status !== 'doing') return false;
      if (filterStatus === 'done' && task.status !== 'done') return false;
      if (filterCategory !== 'all' && task.category !== filterCategory) return false;
      if (filterStaff !== 'all') {
        const targetName = filterStaff === '__mine__' ? activeOperatorName.trim() : filterStaff;
        if (targetName) {
          const normTarget = targetName.toLowerCase();
          const matchAssignee = task.assignee.toLowerCase().includes(normTarget);
          const matchCompleted = (task.completedBy || '').toLowerCase().includes(normTarget);
          if (!matchAssignee && !matchCompleted) return false;
        }
      }
      if (effectiveSearch) {
        return (
          task.room.toLowerCase().includes(effectiveSearch) ||
          task.typeName.toLowerCase().includes(effectiveSearch) ||
          (task.note && task.note.toLowerCase().includes(effectiveSearch)) ||
          task.assignee.toLowerCase().includes(effectiveSearch) ||
          (task.completedBy && task.completedBy.toLowerCase().includes(effectiveSearch))
        );
      }
      return true;
    });
  }, [tasks, filterStatus, filterCategory, filterStaff, activeOperatorName, effectiveSearch]);

  const selectedTask =
    tasks.find((item) => item.id === selectedTaskId) || filteredTasks[0] || tasks[0] || null;

  // Live Stats
  const totalTasks = tasks.filter((item) => item.status !== 'cancel').length;
  const openCount = tasks.filter((item) => item.status === 'pending' || item.status === 'doing').length;
  const doingCount = tasks.filter((item) => item.status === 'doing').length;
  const completedTasks = tasks.filter((item) => item.status === 'done').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const urgentCount = tasks.filter((item) => item.priority === 'urgent' && item.status !== 'done' && item.status !== 'cancel').length;

  const translateCategory = (cat: PmsTask['category']) => {
    if (cat === 'Ménage') return t('Ménage', 'Housekeeping', 'تنظيف');
    if (cat === 'Linge') return t('Linge & Literie', 'Linen & Bedding', 'بياضات');
    if (cat === 'Minibar & accueil') return t('Minibar & Accueil', 'Minibar & Welcome', 'ميني بار وترحيب');
    if (cat === 'Livraison') return t('Livraison Client', 'Guest Delivery', 'توصيل للنزيل');
    return t('Maintenance', 'Maintenance', 'صيانة');
  };

  const handleCompleteTask = (taskId: string) => {
    updateTaskStatus(taskId, 'done', activeOperatorName.trim() || undefined);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    addTask({
      room: newRoom,
      typeId: 'custom',
      typeName: newTypeName,
      category: newCategory,
      assignee: newAssignee,
      date: new Date().toISOString().slice(0, 10),
      status: 'pending',
      priority: newPriority,
      note: newNote,
      subtasks: [
        { id: `st_${Date.now()}_1`, text: t('Contrôle initial de la pièce', 'Initial room check', 'الفحص الأولي للغرفة'), completed: false },
        { id: `st_${Date.now()}_2`, text: t('Réalisation de l’intervention', 'Perform intervention', 'تنفيذ المهمة'), completed: false },
        { id: `st_${Date.now()}_3`, text: t('Validation et contrôle qualité', 'Quality check & sign-off', 'التحقق واعتماد الجودة'), completed: false },
      ],
      tools: [t('Chariot d’intervention', 'Service trolley', 'عربة الخدمة'), t('Tablette PMS', 'PMS Tablet', 'جهاز لوحي')],
    });
    setIsNewTaskOpen(false);
    setNewNote('');
  };

  const handleNotificationClick = (notif: StaffNotification) => {
    markNotifRead(notif.id);
    if (notif.taskId) {
      setSelectedTaskId(notif.taskId);
      setFilterStatus('open');
    } else if (
      notif.kind === 'stock_rupture' ||
      notif.kind === 'stock_low' ||
      notif.kind === 'purchase_order_draft'
    ) {
      setFocusedStockTab('reorder');
      setActiveView('stock');
    }
  };

  const openReplenishmentForTask = (roomName?: string, consumed?: PmsTask['consumedItems']) => {
    const prefill: Record<string, number> = {};
    if (consumed?.length) {
      for (const c of consumed) {
        const match =
          stockItems.find((s) => s.id === c.itemId || s.id === `std_${c.itemId}`) ||
          stockItems.find((s) => s.name.toLowerCase().includes(c.itemName.toLowerCase()));
        if (match) {
          prefill[match.id] = c.quantity;
        }
      }
    }
    setReplenishModalState({
      open: true,
      roomName,
      initialQuantities: Object.keys(prefill).length > 0 ? prefill : undefined,
    });
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex-1 min-w-0 min-h-0 w-full max-w-full flex flex-col md:flex-row h-full overflow-hidden"
    >
      {/* Left / Center Tasks & Notifications Workspace */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col h-full overflow-hidden p-2.5 sm:p-4 md:p-6 space-y-3">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {uiCaps.isFocusedOperationalRole
                  ? t('Espace Tâches, Notifications & Achèvement', 'Tasks, Notifications & Completion', 'مساحة المهام والإشعارات والإنجاز')
                  : t('Tâches, Livraisons & Rotations', 'Turnaround Tasks & Deliveries', 'مهام وتوصيل وتجهيز الغرف')}
              </h1>
              {urgentCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  <Flame size={13} className="text-rose-500" />
                  <span>
                    {urgentCount} {t('Urgentes', 'Urgent', 'عاجلة')}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {uiCaps.isFocusedOperationalRole
                ? t(
                    'Suivez vos notifications en temps réel, cochez les étapes et validez l’achèvement de chaque chambre.',
                    'Follow live alerts, complete checklists, and confirm task completion.',
                    'تابع التنبيهات الفورية وأنجز المهام مع تسجيل اسم المنفذ.'
                  )
                : t(
                    'Coordination des équipes d’étage, attribution des réalisations et suivi de productivité.',
                    'Floor team coordination, completion attribution & productivity tracking.',
                    'تنسيق فرق الطوابق وتتبع تنفيذ المهام والإنتاجية.'
                  )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Active Operator Selector ("Qui réalise / achève ?") */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 shadow-2xs">
              <UserCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <label htmlFor="active-operator-select" className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {t('Opérateur :', 'Operator:', 'المنفذ:')}
              </label>
              {isCustomOperatorOpen ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customOperatorInput.trim()) {
                      setActiveOperatorName(customOperatorInput.trim());
                    }
                    setIsCustomOperatorOpen(false);
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    type="text"
                    value={customOperatorInput}
                    onChange={(e) => setCustomOperatorInput(e.target.value)}
                    placeholder={t('Prénom...', 'Name...', 'الاسم...')}
                    className="w-24 px-1.5 py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 text-[11px] font-bold bg-emerald-600 text-white rounded-md cursor-pointer"
                  >
                    OK
                  </button>
                </form>
              ) : (
                <select
                  id="active-operator-select"
                  value={activeOperatorName}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomOperatorInput('');
                      setIsCustomOperatorOpen(true);
                    } else {
                      setActiveOperatorName(e.target.value);
                    }
                  }}
                  className="text-xs font-semibold bg-transparent text-slate-800 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="" className="bg-white dark:bg-slate-900">
                    {t('Assigné de la tâche (auto)', 'Task assignee (auto)', 'المسندة إليه تلقائياً')}
                  </option>
                  {staffMembers.map((name) => (
                    <option key={name} value={name} className="bg-white dark:bg-slate-900">
                      {name}
                    </option>
                  ))}
                  <option value="__custom__" className="bg-white dark:bg-slate-900">
                    + {t('Autre prénom...', 'Other name...', 'اسم آخر...')}
                  </option>
                </select>
              )}
            </div>

            <button
              type="button"
              onClick={() => openReplenishmentForTask(selectedTask?.room, selectedTask?.consumedItems)}
              disabled={!deviceMutationAvailability.canMutate}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white min-h-[40px] px-3 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <PackageCheck size={15} />
              <span>{t('Réalimentation chambre', 'Room Replenish', 'تزويد غرفة')}</span>
            </button>

            {canCreateTask && (
              <button
                type="button"
                onClick={() => setIsNewTaskOpen(true)}
                disabled={!deviceMutationAvailability.canMutate}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white min-h-[40px] px-3.5 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus size={15} />
                <span>{t('Nouvelle demande', 'New Task', 'مهمة جديدة')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Operational Notifications Strip */}
        <section
          aria-label={t('Notifications opérationnelles', 'Operational notifications', 'الإشعارات التشغيلية')}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden shrink-0"
        >
          <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-slate-50/80 dark:bg-slate-800/40">
            <button
              type="button"
              onClick={() => setIsNotifsExpanded((v) => !v)}
              className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white cursor-pointer"
            >
              {unreadNotifications.length > 0 ? (
                <BellRing size={15} className="text-rose-500 shrink-0" />
              ) : (
                <Bell size={15} className="text-slate-400 shrink-0" />
              )}
              <span>{t('Notifications & Alertes Étage', 'Floor Alerts & Notifications', 'إشعارات وتنبيهات الطوابق')}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                  unreadNotifications.length > 0
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {unreadNotifications.length} {t('non lues', 'unread', 'غير مقروءة')}
              </span>
              {isNotifsExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
            </button>

            {unreadNotifications.length > 0 && (
              <button
                type="button"
                onClick={markAllNotifsRead}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {t('Tout marquer lu', 'Mark all read', 'تحديد الكل كمقروء')}
              </button>
            )}
          </div>

          {isNotifsExpanded && (
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
              {notifications.length === 0 ? (
                <div className="px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  <span>{t('Aucune alerte en attente — tout est à jour.', 'No pending alerts — all caught up.', 'لا توجد تنبيهات معلقة.')}</span>
                </div>
              ) : (
                notifications.slice(0, 6).map((notif) => {
                  const isUnread = !readNotifIds.has(notif.id);
                  return (
                    <div
                      key={notif.id}
                      className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3.5 py-2 text-xs transition-colors ${
                        isUnread ? 'bg-blue-50/40 dark:bg-blue-950/15' : 'opacity-75'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(notif)}
                        className="flex-1 min-w-0 text-start flex items-center gap-2 cursor-pointer"
                      >
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            notif.severity === 'urgent'
                              ? 'bg-rose-500'
                              : notif.severity === 'action'
                              ? 'bg-amber-500'
                              : 'bg-sky-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            <span>{notif.title}</span>
                            {notif.isMine && (
                              <span className="rounded bg-emerald-100 dark:bg-emerald-950/50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                {t('Moi', 'Mine', 'لي')}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {notif.description}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {notif.taskId && (
                          <button
                            type="button"
                            onClick={() => {
                              markNotifRead(notif.id);
                              handleCompleteTask(notif.taskId!);
                            }}
                            className="min-h-[32px] px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check size={12} />
                            <span>{t('Achever', 'Complete', 'إنجاز')}</span>
                          </button>
                        )}
                        {notif.kind === 'room_dirty' && notif.resourceId && (
                          <button
                            type="button"
                            onClick={() => {
                              markNotifRead(notif.id);
                              updateHousekeepingStatus(notif.resourceId!, 'clean');
                            }}
                            className="min-h-[32px] px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles size={12} />
                            <span>{t('Marquer Propre', 'Mark Clean', 'تحديد كجاهزة')}</span>
                          </button>
                        )}
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => markNotifRead(notif.id)}
                            aria-label={t('Marquer lu', 'Mark as read', 'تحديد كمقروء')}
                            className="min-h-[32px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 cursor-pointer"
                          >
                            ✓
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>

        {/* Compact KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFilterStatus('open')}
            className="text-start rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 hover:border-blue-400 transition cursor-pointer"
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">{t('À faire / Ouvertes', 'Open Tasks', 'المهام المفتوحة')}</div>
            <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{openCount}</div>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('doing')}
            className="text-start rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 hover:border-amber-400 transition cursor-pointer"
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">{t('En cours', 'In Progress', 'قيد التنفيذ')}</div>
            <div className="text-lg font-black text-amber-600 dark:text-amber-400 tabular-nums">{doingCount}</div>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('done')}
            className="text-start rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 hover:border-emerald-400 transition cursor-pointer"
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">{t('Achevées', 'Completed', 'المكتملة')}</div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {completedTasks} <span className="text-xs font-semibold text-slate-400">({progressPercent}%)</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('open')}
            className="text-start rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 hover:border-rose-400 transition cursor-pointer"
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">{t('Urgentes', 'Urgent', 'عاجلة')}</div>
            <div className="text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums">{urgentCount}</div>
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-[190px]">
            <Search size={14} className="absolute start-3 top-3 text-slate-400" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={t('Filtrer par chambre, tâche ou personnel...', 'Filter by room, task, or staff...', 'تصفية حسب الغرفة أو المهمة أو الموظف...')}
              className="w-full ps-9 pe-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-xl">
            {(
              [
                ['open', t('À faire', 'Open', 'مفتوحة')],
                ['doing', t('En cours', 'Doing', 'جارية')],
                ['done', t('Terminées', 'Done', 'مكتملة')],
                ['all', t('Toutes', 'All', 'الكل')],
              ] as const
            ).map(([statusKey, label]) => (
              <button
                key={statusKey}
                type="button"
                onClick={() => setFilterStatus(statusKey)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  filterStatus === statusKey
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            aria-label={t('Filtrer par catégorie', 'Filter by category', 'تصفية حسب الفئة')}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">{t('Toutes catégories', 'All Categories', 'جميع الفئات')}</option>
            <option value="Ménage">{t('Ménage', 'Housekeeping', 'تنظيف')}</option>
            <option value="Linge">{t('Linge & Literie', 'Linen & Bedding', 'بياضات')}</option>
            <option value="Minibar & accueil">{t('Minibar & Accueil', 'Minibar & Welcome', 'ميني بار وترحيب')}</option>
            <option value="Livraison">{t('Livraison Client', 'Guest Delivery', 'توصيل')}</option>
            {!uiCaps.isFocusedOperationalRole || activeRoleDefinition.category === 'maintenance' ? (
              <option value="Maintenance">{t('Maintenance', 'Maintenance', 'صيانة')}</option>
            ) : null}
          </select>

          <select
            aria-label={t('Filtrer par personnel', 'Filter by staff', 'تصفية حسب الموظف')}
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
            className="px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">{t('Tout le personnel', 'All Staff', 'كل الموظفين')}</option>
            {activeOperatorName.trim() && (
              <option value="__mine__">
                {t(`Mes tâches (${activeOperatorName})`, `My tasks (${activeOperatorName})`, `مهامي (${activeOperatorName})`)}
              </option>
            )}
            {staffMembers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Scope Banner (shown to supervisors / reception, hidden for focused operational roles so tasks stay front & center) */}
        {!uiCaps.isFocusedOperationalRole && (
          <div className="hidden lg:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs shrink-0">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <span>{t('Cycle de service & Rotations hôtelières', 'Service Cycle & Room Turnovers', 'دورة الخدمة وتجهيز الغرف')}</span>
              <span className="text-blue-500 font-mono">Appointment PMS</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">{t('1. Arrivée & Accueil', '1. Arrival & Welcome', '1. الوصول')}</span>
                <span className="text-[10px] text-slate-400">{t('Minibar, kit courtoisie', 'Minibar, welcome kit', 'الترحيب والميني بار')}</span>
              </div>
              <div className="p-2 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40">
                <span className="font-bold text-blue-700 dark:text-blue-400 block">{t('2. En Séjour', '2. Stayover', '2. أثناء الإقامة')}</span>
                <span className="text-[10px] text-blue-500">{t('Recouche, draps, demandes', 'Refresh, linen, requests', 'تغيير الشراشف')}</span>
              </div>
              <div className="p-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40">
                <span className="font-bold text-amber-700 dark:text-amber-400 block">{t('3. Départ', '3. Check-out', '3. المغادرة')}</span>
                <span className="text-[10px] text-amber-500">{t('Nettoyage à fond & inventaire', 'Deep clean & check', 'تنظيف شامل')}</span>
              </div>
              <div className="p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40">
                <span className="font-bold text-emerald-700 dark:text-emerald-400 block">{t('4. Contrôle & Prête', '4. Inspected & Ready', '4. جاهزة')}</span>
                <span className="text-[10px] text-emerald-500">{t('Validation gouvernante', 'Supervisor check', 'اعتماد النظافة')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Task Cards List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pe-1">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2 opacity-80" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('Aucune tâche correspondante', 'No matching tasks', 'لا توجد مهام مطابقة')}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {t('Toutes les interventions demandées pour ce filtre ont été traitées.', 'All tasks matching this filter have been processed.', 'تمت معالجة جميع المهام في هذا التصنيف.')}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isSelected = selectedTask?.id === task.id;
              const completedSub = task.subtasks?.filter((s) => s.completed).length || 0;
              const totalSub = task.subtasks?.length || 0;

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedTaskId(task.id);
                    }
                  }}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-500 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="px-2.5 py-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-xs font-bold font-mono shrink-0">
                        {task.room}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5">
                          <span>{task.typeName}</span>
                          {task.priority === 'urgent' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold rounded">
                              <AlertTriangle size={10} />
                              {t('URGENT', 'URGENT', 'عاجل')}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {translateCategory(task.category)} · {task.note || task.date}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          task.status === 'done'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : task.status === 'doing'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {task.status === 'done'
                          ? t('✓ Achevée', '✓ Done', '✓ مكتملة')
                          : task.status === 'doing'
                          ? t('⏳ En cours', '⏳ Doing', '⏳ قيد التنفيذ')
                          : t('À faire', 'Pending', 'معلقة')}
                      </span>

                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                        <User size={12} />
                        <span>{task.assignee}</span>
                      </span>
                    </div>
                  </div>

                  {/* Card Footer: attribution + quick completion buttons */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400">
                      {task.status === 'done' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md">
                          <CheckCircle2 size={12} />
                          <span>
                            {t('Achevé par', 'Completed by', 'أنجزت بواسطة')} {task.completedBy || task.assignee}
                            {task.completedAt ? ` · ${task.completedAt}` : ''}
                          </span>
                        </span>
                      )}
                      {task.consumedItems && task.consumedItems.length > 0 && (
                        <span className="flex items-center gap-1 text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          <Boxes size={11} />
                          <span>{task.consumedItems.map((c) => `${c.itemName} ×${c.quantity}`).join(', ')}</span>
                        </span>
                      )}
                      {totalSub > 0 && (
                        <span className="font-mono text-[11px] tabular-nums">
                          {t('Étapes', 'Steps', 'الخطوات')}: {completedSub}/{totalSub}
                        </span>
                      )}
                    </div>

                    {/* 1-click Task Completion Actions */}
                    <div
                      className="flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {task.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => updateTaskStatus(task.id, 'doing')}
                          disabled={!deviceMutationAvailability.canMutate}
                          className="min-h-[36px] px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Play size={12} />
                          <span>{t('Démarrer', 'Start', 'بدء')}</span>
                        </button>
                      )}
                      {task.status !== 'done' && (
                        <button
                          type="button"
                          onClick={() => handleCompleteTask(task.id)}
                          disabled={!deviceMutationAvailability.canMutate}
                          className="min-h-[36px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                        >
                          <CheckCircle2 size={13} />
                          <span>{t('Achever', 'Complete', 'إتمام')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Drawer / Task Execution & Attribution Details */}
      <div className="w-full md:w-88 lg:w-96 max-h-[45vh] md:max-h-none min-h-0 p-3 sm:p-4 md:p-6 bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-s border-slate-200 dark:border-slate-800 flex flex-col space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {t('Détails de l’intervention', 'Execution & Sign-off', 'تفاصيل التنفيذ')}
            </span>
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold font-mono">
            {selectedTask?.room || t('Chambre', 'Room', 'غرفة')}
          </div>
        </div>

        {selectedTask ? (
          <div className="space-y-4 flex-1">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {selectedTask.typeName}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {translateCategory(selectedTask.category)} · {t('Assigné à', 'Assigned to', 'مسندة إلى')} {selectedTask.assignee}
              </span>
            </div>

            {selectedTask.status === 'done' && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">
                    {t('Tâche achevée par', 'Completed by', 'أنجزت بواسطة')} {selectedTask.completedBy || selectedTask.assignee}
                  </div>
                  {selectedTask.completedAt && (
                    <div className="text-[11px] opacity-80 tabular-nums">{selectedTask.completedAt}</div>
                  )}
                </div>
              </div>
            )}

            {selectedTask.note && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 text-xs text-slate-700 dark:text-slate-300">
                <span className="font-semibold block text-[11px] text-slate-400 uppercase mb-1">
                  {t('Consigne :', 'Note:', 'ملاحظة:')}
                </span>
                {selectedTask.note}
              </div>
            )}

            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                {t('Exécutant / Personnel :', 'Assigned / Operator:', 'المنفذ:')}
              </span>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {(selectedTask.completedBy || selectedTask.assignee).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                    {selectedTask.assignee}
                    {activeOperatorName.trim() && selectedTask.status !== 'done'
                      ? ` → ${t('Validation par', 'Sign-off as', 'اعتماد باسم')}: ${activeOperatorName}`
                      : ''}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {t('Étage & Service hôtelier', 'Floor & Hospitality Service', 'خدمة الطوابق')}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                {t('Équipements & Outils :', 'Tools & Equipment:', 'الأدوات والمعدات:')}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(selectedTask.tools || [t('Chariot standard', 'Standard trolley', 'عربة قياسية')]).map((tool, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>

            {/* Subtasks Checklist */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                {t('Checklist d’intervention :', 'Action Checklist:', 'قائمة التحقق:')}
              </span>
              <div className="space-y-2">
                {(selectedTask.subtasks || [
                  { id: 'st_1', text: t('Vérifier état général', 'Check overall state', 'فحص الحالة العامة'), completed: selectedTask.status === 'done' },
                  { id: 'st_2', text: t('Effectuer l’intervention', 'Perform task', 'تنفيذ المهمة'), completed: selectedTask.status === 'done' },
                ]).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => toggleSubtask(selectedTask.id, st.id)}
                    disabled={!deviceMutationAvailability.canMutate}
                    className={`w-full min-h-[44px] flex items-center justify-between p-2.5 rounded-xl border text-start text-xs transition-colors cursor-pointer ${
                      st.completed
                        ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className={st.completed ? 'line-through opacity-80' : ''}>{st.text}</span>
                    <span
                      className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        st.completed
                          ? 'bg-blue-600 text-white'
                          : 'border-2 border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {st.completed && <Check size={12} strokeWidth={3} />}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => openReplenishmentForTask(selectedTask.room, selectedTask.consumedItems)}
                disabled={!deviceMutationAvailability.canMutate}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 py-2 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                <PackageCheck size={16} />
                <span>{t('Valider réalimentation consommables', 'Validate Room Consumables', 'تأكيد تزويد المستهلكات')}</span>
              </button>

              {selectedTask.status !== 'done' && (
                <button
                  type="button"
                  onClick={() => handleCompleteTask(selectedTask.id)}
                  disabled={!deviceMutationAvailability.canMutate}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  <span>
                    {selectedTask.consumedItems?.length
                      ? t('Valider l’achèvement & Déduire Stock', 'Complete & Deduct Stock', 'إتمام المهمة وخصم المخزون')
                      : t('Valider l’achèvement de la tâche', 'Confirm Task Completion', 'تأكيد إتمام المهمة')}
                  </span>
                </button>
              )}

              {selectedTask.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => updateTaskStatus(selectedTask.id, 'doing')}
                  disabled={!deviceMutationAvailability.canMutate}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white py-2 rounded-xl font-semibold text-xs shadow-xs transition cursor-pointer"
                >
                  <Clock size={16} />
                  <span>{t('Démarrer l’intervention', 'Start Working', 'بدء التنفيذ')}</span>
                </button>
              )}

              {selectedTask.status === 'done' && (
                <button
                  type="button"
                  onClick={() => updateTaskStatus(selectedTask.id, 'pending')}
                  disabled={!deviceMutationAvailability.canMutate}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2 rounded-xl font-semibold text-xs transition cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>{t('Rouvrir la tâche', 'Reopen Task', 'إعادة فتح المهمة')}</span>
                </button>
              )}

              {canDeleteTask && (
                <button
                  type="button"
                  onClick={() => deleteTask(selectedTask.id)}
                  disabled={!deviceMutationAvailability.canMutate}
                  className="w-full min-h-[40px] flex items-center justify-center gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 py-2 rounded-xl font-semibold text-xs transition cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>{t('Supprimer la tâche', 'Delete Task', 'حذف المهمة')}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-xs text-slate-400">
            {t('Sélectionnez une tâche pour afficher les détails.', 'Select a task to review details.', 'اختر مهمة لعرض تفاصيلها.')}
          </div>
        )}

        {/* Daily Progress Card */}
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 mt-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {t('Avancement du jour', 'Completion Progress', 'تقدم اليوم')}
            </span>
            <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
              {progressPercent}%
            </span>
          </div>

          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
              {completedTasks}
            </span>
            <span className="text-slate-400 font-mono text-sm">
              / {totalTasks} {t('tâches', 'tasks', 'مهمة')}
            </span>
          </div>

          <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* New Task Modal */}
      {isNewTaskOpen && canCreateTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs pms-modal-backdrop">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 pms-modal">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles size={18} className="text-blue-500" />
              <span>{t('Créer une tâche / demande', 'Create Task or Request', 'إنشاء مهمة جديدة')}</span>
            </h2>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {t('Chambre / Emplacement', 'Room / Location', 'الغرفة / الموقع')}
                </label>
                <select
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  {activeRooms.map((r) => (
                    <option key={r.id} value={r.name.split(' - ')[0]}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {t('Prestation demandée', 'Task Description', 'الخدمة المطلوبة')}
                </label>
                <input
                  type="text"
                  required
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder={t('Ex: Nettoyage départ, linge supplémentaire...', 'e.g. Turnover clean, extra towels...', 'مثال: تنظيف مغادرة، مناشف إضافية...')}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {t('Catégorie', 'Category', 'الفئة')}
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as PmsTask['category'])}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="Ménage">{t('Ménage', 'Housekeeping', 'تنظيف')}</option>
                    <option value="Linge">{t('Linge', 'Linen', 'بياضات')}</option>
                    <option value="Minibar & accueil">{t('Minibar & accueil', 'Minibar & welcome', 'ميني بار')}</option>
                    <option value="Livraison">{t('Livraison', 'Delivery', 'توصيل')}</option>
                    <option value="Maintenance">{t('Maintenance', 'Maintenance', 'صيانة')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    {t('Personnel assigné', 'Assigned Staff', 'الموظف المسند إليه')}
                  </label>
                  <select
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {staffMembers.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {t('Priorité', 'Priority', 'الأولوية')}
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="prio"
                      checked={newPriority === 'normal'}
                      onChange={() => setNewPriority('normal')}
                    />
                    <span>{t('Normale', 'Normal', 'عادية')}</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="prio"
                      checked={newPriority === 'urgent'}
                      onChange={() => setNewPriority('urgent')}
                    />
                    <span>{t('Urgente', 'Urgent', 'عاجلة')}</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {t('Note spécifique', 'Specific Note', 'ملاحظة خاصة')}
                </label>
                <textarea
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={t('Consignes client, créneau horaire...', 'Guest notes, time window...', 'تعليمات النزيل...')}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewTaskOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t('Annuler', 'Cancel', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={!deviceMutationAvailability.canMutate}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {t('Créer la demande', 'Create Task', 'إنشاء المهمة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <RoomReplenishmentModal
        isOpen={replenishModalState.open}
        onClose={() => setReplenishModalState({ open: false })}
        rooms={activeRooms}
        initialRoomName={replenishModalState.roomName}
        initialQuantities={replenishModalState.initialQuantities}
      />
    </div>
  );
};
