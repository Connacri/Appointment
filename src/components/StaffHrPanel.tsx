import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Award,
  Briefcase,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  History,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ROLE_CATEGORY_META } from '../data/roles';
import type {
  StaffCareerChangeType,
  StaffEmploymentStatus,
  StaffMemberRecord,
  StaffShiftType,
  UserRole,
} from '../types/roles';
import { resolveRoleDefinition } from '../utils/rolePermissions';
import { getDefaultTasksForRole } from '../utils/staffHr';
import { RoleIcon } from './RoleIcon';

const SHIFTS: StaffShiftType[] = ['Matin', 'Soir', 'Nuit', 'Polyvalent'];

export const StaffHrPanel: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const {
    language,
    roles,
    staffMembers,
    createStaffMember,
    updateStaffAssignment,
    promoteOrTransferStaff,
    assignTaskToStaff,
    deleteStaffMember,
    resourceGroups,
    currentDomain,
    tasks,
    playFeedback,
    deviceMutationAvailability,
  } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const t = (fr: string, en: string, ar: string) => (isFr ? fr : isAr ? ar : en);

  const assignableRoles = useMemo(
    () => roles.filter((r) => r.id !== 'client'),
    [roles]
  );

  const activeRooms = useMemo(() => {
    const sector = resourceGroups.filter((g) => g.sector === currentDomain).flatMap((g) => g.resources);
    return sector.length > 0 ? sector : resourceGroups.flatMap((g) => g.resources);
  }, [resourceGroups, currentDomain]);

  const zoneSuggestions = useMemo(() => {
    const baseZones = [
      t('Étage 1', 'Floor 1', 'الطابق 1'),
      t('Étage 2', 'Floor 2', 'الطابق 2'),
      t('Étage 3', 'Floor 3', 'الطابق 3'),
      t('Réception & Accueil', 'Front Desk', 'الاستقبال'),
      t('Maintenance Générale', 'General Maintenance', 'الصيانة العامة'),
      t('Lingerie & Stock', 'Laundry & Stock', 'المغسلة والمخزون'),
      t('Spa & Bien-être', 'Spa & Wellness', 'السبا والعافية'),
    ];
    const buildingNames = resourceGroups
      .filter((g) => g.sector === currentDomain)
      .map((g) => (typeof g.name === 'string' ? g.name : (g.name[language] || g.name.fr || '')))
      .filter(Boolean);
    return Array.from(new Set<string>([...buildingNames, ...baseZones]));
  }, [resourceGroups, currentDomain, language, isFr, isAr]);

  // Create Staff Form State
  const defaultRoleId: UserRole = assignableRoles.find((r) => r.id === 'room_attendant')?.id || assignableRoles[0]?.id || 'room_attendant';
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<UserRole>(defaultRoleId);
  const [assignment, setAssignment] = useState(zoneSuggestions[0] || 'Étage 1');
  const [shift, setShift] = useState<StaffShiftType>('Matin');
  const [draftTasks, setDraftTasks] = useState<string[]>(() =>
    getDefaultTasksForRole(resolveRoleDefinition(roles, defaultRoleId), language)
  );
  const [newTaskInput, setNewTaskInput] = useState('');
  const [createInitialTasks, setCreateInitialTasks] = useState(true);
  const [initialRoom, setInitialRoom] = useState(activeRooms[0]?.name || '101');
  const [formError, setFormError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StaffEmploymentStatus>('all');
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Modals State: Assignment, Promotion/Transfer, Quick Task
  const [assignModalMember, setAssignModalMember] = useState<StaffMemberRecord | null>(null);
  const [assignPatch, setAssignPatch] = useState<{
    assignment: string;
    shift: StaffShiftType;
    status: StaffEmploymentStatus;
    defaultTasks: string[];
    taskDraft: string;
    note: string;
  }>({
    assignment: '',
    shift: 'Matin',
    status: 'active',
    defaultTasks: [],
    taskDraft: '',
    note: '',
  });

  const [promoModalMember, setPromoModalMember] = useState<StaffMemberRecord | null>(null);
  const [promoState, setPromoState] = useState<{
    changeType: Extract<StaffCareerChangeType, 'promoted' | 'transferred'>;
    newRoleId: UserRole;
    newAssignment: string;
    newShift: StaffShiftType;
    defaultTasks: string[];
    taskDraft: string;
    note: string;
  }>({
    changeType: 'promoted',
    newRoleId: 'gouvernante',
    newAssignment: '',
    newShift: 'Matin',
    defaultTasks: [],
    taskDraft: '',
    note: '',
  });

  const [taskModalMember, setTaskModalMember] = useState<StaffMemberRecord | null>(null);
  const [quickTaskState, setQuickTaskState] = useState<{
    room: string;
    taskTitle: string;
    priority: 'normal' | 'urgent';
    note: string;
  }>({
    room: activeRooms[0]?.name || '101',
    taskTitle: '',
    priority: 'normal',
    note: '',
  });

  const handleRoleSelectChange = (roleId: UserRole) => {
    setSelectedRoleId(roleId);
    const roleDef = resolveRoleDefinition(roles, roleId);
    setDraftTasks(getDefaultTasksForRole(roleDef, language));
  };

  const handleAddDraftTask = () => {
    const clean = newTaskInput.trim();
    if (!clean) return;
    if (!draftTasks.includes(clean)) {
      setDraftTasks((prev) => [...prev, clean]);
    }
    setNewTaskInput('');
  };

  const handleRemoveDraftTask = (taskLabel: string) => {
    setDraftTasks((prev) => prev.filter((item) => item !== taskLabel));
  };

  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setFormError(t('Veuillez saisir le nom complet du membre.', 'Please enter the staff full name.', 'يرجى إدخال الاسم الكامل للموظف.'));
      return;
    }
    setFormError(null);
    const created = await createStaffMember({
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
      roleId: selectedRoleId,
      assignment: assignment.trim() || 'Étage 1',
      shift,
      defaultTasks: draftTasks,
      status: 'active',
      createInitialTasks,
      initialRoom: initialRoom.trim() || assignment.trim() || '101',
    });
    if (!created) {
      setFormError(t(
        'Enregistrement impossible. Aucune fiche ni tâche initiale n’a été validée.',
        'Save failed. No staff record or initial task was committed.',
        'تعذر الحفظ. لم يتم اعتماد ملف الموظف أو المهام الأولية.'
      ));
      return;
    }
    playFeedback('success');
    const roleDef = resolveRoleDefinition(roles, created.roleId);
    onToast(
      t(
        `${created.fullName} créé(e) au poste ${roleDef.label.fr} (${created.assignment}).`,
        `${created.fullName} added as ${roleDef.label.en} (${created.assignment}).`,
        `تمت إضافة ${created.fullName} بصفة ${roleDef.label.ar}.`
      )
    );
    setFullName('');
    setPhone('');
  };

  const openAssignmentModal = (member: StaffMemberRecord) => {
    setAssignModalMember(member);
    setAssignPatch({
      assignment: member.assignment,
      shift: member.shift,
      status: member.status,
      defaultTasks: [...member.defaultTasks],
      taskDraft: '',
      note: '',
    });
  };

  const handleSaveAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalMember) return;
    updateStaffAssignment(assignModalMember.id, {
      assignment: assignPatch.assignment.trim() || assignModalMember.assignment,
      shift: assignPatch.shift,
      status: assignPatch.status,
      defaultTasks: assignPatch.defaultTasks,
      note: assignPatch.note.trim() || undefined,
    });
    playFeedback('success');
    onToast(
      t(
        `Affectation mise à jour pour ${assignModalMember.fullName}.`,
        `Assignment updated for ${assignModalMember.fullName}.`,
        `تم تحديث تعيين ${assignModalMember.fullName}.`
      )
    );
    setAssignModalMember(null);
  };

  const openPromotionModal = (member: StaffMemberRecord, changeType: 'promoted' | 'transferred') => {
    const suggestedNextRole: UserRole =
      member.roleId === 'room_attendant'
        ? 'gouvernante'
        : member.roleId === 'receptionist'
        ? 'responsable'
        : member.roleId;
    const roleDef = resolveRoleDefinition(roles, suggestedNextRole);
    setPromoModalMember(member);
    setPromoState({
      changeType,
      newRoleId: suggestedNextRole,
      newAssignment: member.assignment,
      newShift: member.shift,
      defaultTasks: getDefaultTasksForRole(roleDef, language),
      taskDraft: '',
      note: '',
    });
  };

  const handleSavePromotion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoModalMember) return;
    const roleDef = resolveRoleDefinition(roles, promoState.newRoleId);
    promoteOrTransferStaff(promoModalMember.id, {
      newRoleId: promoState.newRoleId,
      newAssignment: promoState.newAssignment.trim() || promoModalMember.assignment,
      newShift: promoState.newShift,
      defaultTasks: promoState.defaultTasks,
      changeType: promoState.changeType,
      note: promoState.note.trim() || undefined,
    });
    playFeedback('success');
    onToast(
      t(
        `${promoModalMember.fullName} ${promoState.changeType === 'promoted' ? 'promu(e)' : 'muté(e)'} vers ${roleDef.label.fr}.`,
        `${promoModalMember.fullName} ${promoState.changeType === 'promoted' ? 'promoted' : 'transferred'} to ${roleDef.label.en}.`,
        `تمت ترقية/نقل ${promoModalMember.fullName} إلى ${roleDef.label.ar}.`
      )
    );
    setPromoModalMember(null);
  };

  const openQuickTaskModal = (member: StaffMemberRecord) => {
    setTaskModalMember(member);
    setQuickTaskState({
      room: activeRooms[0]?.name || member.assignment || '101',
      taskTitle: member.defaultTasks[0] || '',
      priority: 'normal',
      note: '',
    });
  };

  const handleSaveQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskModalMember || !quickTaskState.taskTitle.trim()) return;
    const created = await assignTaskToStaff(taskModalMember.id, {
      room: quickTaskState.room,
      taskTitle: quickTaskState.taskTitle,
      priority: quickTaskState.priority,
      note: quickTaskState.note,
    });
    if (!created) return;
    playFeedback('success');
    onToast(
      t(
        `Tâche « ${quickTaskState.taskTitle} » assignée à ${taskModalMember.fullName}.`,
        `Task "${quickTaskState.taskTitle}" assigned to ${taskModalMember.fullName}.`,
        `تم إسناد المهمة إلى ${taskModalMember.fullName}.`
      )
    );
    setTaskModalMember(null);
  };

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staffMembers.filter((m) => {
      if (roleFilter !== 'all' && m.roleId !== roleFilter) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (!q) return true;
      const roleDef = resolveRoleDefinition(roles, m.roleId);
      const hay = `${m.fullName} ${m.assignment} ${m.phone || ''} ${roleDef.label.fr} ${roleDef.label.en} ${m.defaultTasks.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [staffMembers, roleFilter, statusFilter, search, roles]);

  const kpis = useMemo(() => {
    const activeCount = staffMembers.filter((m) => m.status === 'active').length;
    const careerMovesCount = staffMembers.reduce(
      (sum, m) => sum + m.history.filter((h) => h.type === 'promoted' || h.type === 'transferred').length,
      0
    );
    const activeMemberNames = new Set(staffMembers.map((m) => m.fullName.toLowerCase()));
    const openStaffTasks = tasks.filter(
      (tsk) => tsk.status !== 'done' && tsk.status !== 'cancel' && activeMemberNames.has(tsk.assignee.toLowerCase())
    ).length;

    return {
      total: staffMembers.length,
      activeCount,
      careerMovesCount,
      openStaffTasks,
    };
  }, [staffMembers, tasks]);

  const translateShift = (s: StaffShiftType) => {
    if (s === 'Matin') return t('Matin', 'Morning', 'صباحي');
    if (s === 'Soir') return t('Soir', 'Evening', 'مسائي');
    if (s === 'Nuit') return t('Nuit', 'Night', 'ليلي');
    return t('Polyvalent', 'Flexible', 'متعدد الفترات');
  };

  const translateStatus = (s: StaffEmploymentStatus) => {
    if (s === 'active') return t('En service', 'Active', 'في الخدمة');
    if (s === 'on_leave') return t('En congé', 'On leave', 'في إجازة');
    return t('Inactif', 'Inactive', 'غير نشط');
  };

  const translateHistoryType = (type: StaffCareerChangeType) => {
    if (type === 'hired') return t('Recrutement', 'Hired', 'توظيف');
    if (type === 'assigned') return t('Affectation', 'Assigned', 'تعيين');
    if (type === 'promoted') return t('Promotion', 'Promoted', 'ترقية');
    return t('Changement de poste', 'Transferred', 'تغيير منصب');
  };

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>{t('Effectif total', 'Total Staff', 'إجمالي الموظفين')}</span>
            <Users size={14} className="text-blue-500" />
          </div>
          <div className="mt-1.5 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {kpis.total}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>{t('En service', 'Active Duty', 'في الخدمة')}</span>
            <UserCheck size={14} className="text-emerald-500" />
          </div>
          <div className="mt-1.5 text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {kpis.activeCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>{t('Promotions / Postes', 'Promotions / Moves', 'الترقيات والتنقلات')}</span>
            <Award size={14} className="text-amber-500" />
          </div>
          <div className="mt-1.5 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {kpis.careerMovesCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>{t('Tâches en cours', 'Open Tasks', 'المهام الجارية')}</span>
            <ClipboardList size={14} className="text-violet-500" />
          </div>
          <div className="mt-1.5 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {kpis.openStaffTasks}
          </div>
        </div>
      </section>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-[410px_1fr] gap-5 items-start">
        {/* LEFT: Create Staff Form */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <UserPlus size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {t('Créer un personnel & ses tâches', 'Create Staff Member & Tasks', 'إضافة موظف ومهامه')}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('Selon son rôle, son affectation et sa fiche de tâches', 'Assign role, work zone, shift, and starter tasks', 'تحديد الدور الوظيفي ومنطقة العمل والمهام')}
              </p>
            </div>
          </div>

          {formError && (
            <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/50 dark:border-rose-800 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateStaffSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Nom complet *', 'Full name *', 'الاسم الكامل *')}
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('Ex: Nadia Benali', 'e.g. Nadia Benali', 'مثال: نادية بن علي')}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Téléphone', 'Phone', 'الهاتف')}
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+213 550 ..."
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>

            {/* Role Selection */}
            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {t('Rôle / Poste *', 'Role / Position *', 'الدور / المنصب *')}
              </span>
              <select
                value={selectedRoleId}
                onChange={(e) => handleRoleSelectChange(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {assignableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label[language] || r.label.fr} ({ROLE_CATEGORY_META[r.category].label[language] || r.category})
                  </option>
                ))}
              </select>
            </label>

            {/* Assignment & Shift */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Affectation / Zone', 'Assignment / Zone', 'مكان التعيين')}
                </span>
                <input
                  type="text"
                  value={assignment}
                  onChange={(e) => setAssignment(e.target.value)}
                  placeholder={t('Étage 1, Bloc A...', 'Floor 1, Wing A...', 'الطابق 1...')}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Équipe / Shift', 'Shift', 'فترة العمل')}
                </span>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value as StaffShiftType)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>
                      {translateShift(s)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Quick Zone Chips */}
            <div className="flex flex-wrap gap-1.5">
              {zoneSuggestions.slice(0, 6).map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => setAssignment(zone)}
                  className={`min-h-[32px] px-2.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors ${
                    assignment === zone
                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {zone}
                </button>
              ))}
            </div>

            {/* Role Tasks Checklist */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {t('Tâches à faire selon le rôle', 'Role Tasks to Perform', 'المهام المطلوبة للدور')}
                </span>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {draftTasks.length}
                </span>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pe-0.5">
                {draftTasks.map((taskLabel) => (
                  <div
                    key={taskLabel}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <span className="text-slate-800 dark:text-slate-200 truncate">{taskLabel}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDraftTask(taskLabel)}
                      aria-label="Remove task"
                      className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTaskInput}
                  onChange={(e) => setNewTaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddDraftTask();
                    }
                  }}
                  placeholder={t('Ajouter une tâche spécifique...', 'Add custom task...', 'إضافة مهمة مخصصة...')}
                  className="flex-1 min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddDraftTask}
                  className="min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>

            {/* Dispatch initial tasks toggle */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 space-y-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={createInitialTasks}
                onClick={() => setCreateInitialTasks((v) => !v)}
                className="w-full flex items-center gap-2.5 text-start cursor-pointer"
              >
                <span
                  className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                    createInitialTasks
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                  }`}
                >
                  {createInitialTasks && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {t('Envoyer ces tâches directement dans Tâches PMS', 'Dispatch these tasks directly into PMS Tasks', 'إرسال هذه المهام مباشرة إلى مهام التشغيل')}
                </span>
              </button>

              {createInitialTasks && (
                <div className="flex items-center gap-2 ps-6">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    {t('Chambre / Zone cible :', 'Target room / zone:', 'الغرفة / المنطقة:')}
                  </span>
                  {activeRooms.length > 0 ? (
                    <select
                      value={initialRoom}
                      onChange={(e) => setInitialRoom(e.target.value)}
                      className="flex-1 min-h-[36px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold"
                    >
                      {activeRooms.map((rm) => (
                        <option key={rm.id} value={rm.name}>
                          {rm.name} ({rm.type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={initialRoom}
                      onChange={(e) => setInitialRoom(e.target.value)}
                      className="flex-1 min-h-[36px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs"
                    />
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!deviceMutationAvailability.canMutate}
              className="w-full min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <UserPlus size={16} />
              <span>{t('Créer le personnel & affecter', 'Create Staff & Assign', 'إنشاء وتعيين الموظف')}</span>
            </button>
          </form>
        </section>

        {/* RIGHT: Staff Directory, Affectation & Promotions */}
        <section className="space-y-3 min-w-0">
          {/* Search & Filters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
              <div className="relative">
                <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('Rechercher un membre, étage, poste...', 'Search staff, zone, role...', 'ابحث عن موظف أو منصب...')}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 ps-9 pe-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label={t('Filtrer par rôle', 'Filter by role', 'تصفية حسب الدور')}
                className="min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="all">{t('Tous les postes', 'All roles', 'كل المناصب')}</option>
                {assignableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label[language] || r.label.fr}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | StaffEmploymentStatus)}
                aria-label={t('Filtrer par statut', 'Filter by status', 'تصفية حسب الحالة')}
                className="min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="all">{t('Tous statuts', 'All statuses', 'كل الحالات')}</option>
                <option value="active">{t('En service', 'Active', 'في الخدمة')}</option>
                <option value="on_leave">{t('En congé', 'On leave', 'في إجازة')}</option>
                <option value="inactive">{t('Inactif', 'Inactive', 'غير نشط')}</option>
              </select>
            </div>
          </div>

          {/* Staff Cards */}
          {filteredStaff.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <Users size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {staffMembers.length === 0
                  ? t('Aucun personnel enregistré pour le moment', 'No staff members registered yet', 'لا يوجد موظفون مسجلون حالياً')
                  : t('Aucun résultat pour ces filtres', 'No matching staff members', 'لا توجد نتائج مطابقة')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {t(
                  'Utilisez le formulaire pour créer vos équipiers (femmes de chambre, gouvernante, plombier, menuisier, réceptionniste...), affecter leurs zones et gérer leurs promotions.',
                  'Use the form to add team members by role, assign floors/shifts, dispatch tasks, and manage promotions or transfers.',
                  'استخدم النموذج لإضافة الموظفين حسب أدوارهم وتعيين مناطقهم وإدارة الترقيات.'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredStaff.map((member) => {
                const roleDef = resolveRoleDefinition(roles, member.roleId);
                const catMeta = ROLE_CATEGORY_META[roleDef.category];
                const isHistoryOpen = Boolean(expandedHistoryIds[member.id]);
                const memberOpenTasks = tasks.filter(
                  (tsk) =>
                    tsk.status !== 'done' &&
                    tsk.status !== 'cancel' &&
                    tsk.assignee.toLowerCase() === member.fullName.toLowerCase()
                ).length;

                return (
                  <article
                    key={member.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                            <RoleIcon iconName={roleDef.iconName} size={18} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {member.fullName}
                            </h3>
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate">
                              {roleDef.label[language] || roleDef.label.fr}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                            member.status === 'active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : member.status === 'on_leave'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {translateStatus(member.status)}
                        </span>
                      </div>

                      {/* Metadata row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={13} className="text-rose-500 shrink-0" />
                          <span>{member.assignment}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={13} className="text-amber-500 shrink-0" />
                          <span>{translateShift(member.shift)}</span>
                        </span>
                        {member.phone && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                            <Phone size={12} className="text-slate-400 shrink-0" />
                            <span>{member.phone}</span>
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${catMeta.badgeClass}`}>
                          {catMeta.label[language] || catMeta.label.fr}
                        </span>
                      </div>

                      {/* Assigned Tasks */}
                      <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-semibold">
                            {t('Tâches du poste', 'Role Tasks', 'مهام المنصب')} ({member.defaultTasks.length})
                          </span>
                          <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400 font-semibold">
                            {memberOpenTasks} {t('en cours PMS', 'open in PMS', 'جارية')}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {member.defaultTasks.slice(0, 4).map((taskStr) => (
                            <span
                              key={taskStr}
                              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]"
                            >
                              {taskStr}
                            </span>
                          ))}
                          {member.defaultTasks.length > 4 && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                              +{member.defaultTasks.length - 4}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Career History Toggle */}
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedHistoryIds((prev) => ({
                              ...prev,
                              [member.id]: !prev[member.id],
                            }))
                          }
                          className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <History size={12} />
                          <span>
                            {t(
                              `Parcours & Promotions (${member.history.length})`,
                              `Career History (${member.history.length})`,
                              `السجل الوظيفي والترقيات (${member.history.length})`
                            )}
                          </span>
                        </button>

                        {isHistoryOpen && (
                          <div className="mt-2 space-y-1.5 border-s-2 border-slate-200 dark:border-slate-700 ps-3">
                            {member.history.map((entry) => {
                              const toRole = resolveRoleDefinition(roles, entry.toRoleId);
                              const fromRole = entry.fromRoleId ? resolveRoleDefinition(roles, entry.fromRoleId) : null;
                              return (
                                <div key={entry.id} className="text-[11px] space-y-0.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      {translateHistoryType(entry.type)}
                                    </span>
                                    <span className="font-mono text-[10px] text-slate-400">
                                      {entry.date.slice(0, 10)}
                                    </span>
                                  </div>
                                  <div className="text-slate-600 dark:text-slate-300">
                                    {fromRole && fromRole.id !== toRole.id
                                      ? `${fromRole.label[language] || fromRole.label.fr} → ${toRole.label[language] || toRole.label.fr}`
                                      : toRole.label[language] || toRole.label.fr}
                                    {' · '}
                                    {entry.toAssignment}
                                  </div>
                                  {entry.note && (
                                    <div className="text-slate-500 dark:text-slate-400 italic">{entry.note}</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openQuickTaskModal(member)}
                        className="min-h-[38px] px-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ClipboardList size={13} />
                        <span>{t('Tâche', 'Task', 'مهمة')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openAssignmentModal(member)}
                        className="min-h-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <MapPin size={13} />
                        <span>{t('Affecter', 'Assign', 'تعيين')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openPromotionModal(member, 'promoted')}
                        className="min-h-[38px] px-2.5 rounded-xl border border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-[11px] font-bold text-amber-800 dark:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowUpRight size={13} />
                        <span>{t('Promouvoir / Poste', 'Promote / Role', 'ترقية / منصب')}</span>
                      </button>

                      {confirmDeleteId === member.id ? (
                        <div className="ms-auto flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              deleteStaffMember(member.id);
                              setConfirmDeleteId(null);
                              onToast(t(`Fiche de ${member.fullName} supprimée.`, `${member.fullName} removed.`, `تم حذف ملف ${member.fullName}.`));
                            }}
                            disabled={!deviceMutationAvailability.canMutate}
                            className="min-h-[38px] px-2.5 rounded-xl bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                          >
                            {t('Confirmer', 'Confirm', 'تأكيد')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[38px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(member.id)}
                          aria-label={t('Supprimer', 'Delete', 'حذف')}
                          className="ms-auto min-h-[38px] min-w-[38px] rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* MODAL 1: AFFECTATION / ZONE / SHIFT */}
      {assignModalMember && (
        <div className="fixed inset-0 z-[9995] bg-slate-950/70 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSaveAssignment}
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 space-y-3.5 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin size={18} className="text-blue-500 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {t('Affectation', 'Assignment', 'تعيين العمل')} · {assignModalMember.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalMember(null)}
                className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {t('Nouvelle zone / étage', 'New zone / floor', 'المنطقة / الطابق الجديد')}
              </span>
              <input
                type="text"
                required
                value={assignPatch.assignment}
                onChange={(e) => setAssignPatch((p) => ({ ...p, assignment: e.target.value }))}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Shift', 'Shift', 'المناوبة')}
                </span>
                <select
                  value={assignPatch.shift}
                  onChange={(e) => setAssignPatch((p) => ({ ...p, shift: e.target.value as StaffShiftType }))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold"
                >
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>
                      {translateShift(s)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Statut', 'Status', 'الحالة')}
                </span>
                <select
                  value={assignPatch.status}
                  onChange={(e) => setAssignPatch((p) => ({ ...p, status: e.target.value as StaffEmploymentStatus }))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold"
                >
                  <option value="active">{translateStatus('active')}</option>
                  <option value="on_leave">{translateStatus('on_leave')}</option>
                  <option value="inactive">{translateStatus('inactive')}</option>
                </select>
              </label>
            </div>

            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {t('Note d’affectation', 'Assignment note', 'ملاحظة التعيين')}
              </span>
              <input
                type="text"
                value={assignPatch.note}
                onChange={(e) => setAssignPatch((p) => ({ ...p, note: e.target.value }))}
                placeholder={t('Ex: Renfort haute saison étage 2', 'e.g. High season wing 2 support', 'مثال: دعم الطابق الثاني')}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
              />
            </label>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignModalMember(null)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {t('Annuler', 'Cancel', 'إلغاء')}
              </button>
              <button
                type="submit"
                disabled={!deviceMutationAvailability.canMutate}
                className="flex-1 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
              >
                {t('Valider l’affectation', 'Save Assignment', 'حفظ التعيين')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: PROMOTION OR ROLE TRANSFER */}
      {promoModalMember && (
        <div className="fixed inset-0 z-[9995] bg-slate-950/70 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSavePromotion}
            className="w-full sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 space-y-3.5 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <Award size={18} className="text-amber-500 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {t('Promotion / Changement de poste', 'Promotion / Role Change', 'ترقية / تغيير المنصب')} · {promoModalMember.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPromoModalMember(null)}
                className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'promoted', label: t('Promotion', 'Promotion', 'ترقية') },
                  { id: 'transferred', label: t('Changement de poste', 'Role Transfer', 'تغيير منصب') },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPromoState((p) => ({ ...p, changeType: opt.id }))}
                  className={`min-h-[42px] rounded-xl border text-xs font-bold cursor-pointer ${
                    promoState.changeType === opt.id
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {t('Nouveau rôle / poste', 'New Role / Position', 'الدور / المنصب الجديد')}
              </span>
              <select
                value={promoState.newRoleId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  const nextRole = resolveRoleDefinition(roles, nextId);
                  setPromoState((p) => ({
                    ...p,
                    newRoleId: nextId,
                    defaultTasks: getDefaultTasksForRole(nextRole, language),
                  }));
                }}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold"
              >
                {assignableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label[language] || r.label.fr}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Nouvelle affectation', 'New assignment', 'التعيين الجديد')}
                </span>
                <input
                  type="text"
                  value={promoState.newAssignment}
                  onChange={(e) => setPromoState((p) => ({ ...p, newAssignment: e.target.value }))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Nouveau shift', 'New shift', 'المناوبة الجديدة')}
                </span>
                <select
                  value={promoState.newShift}
                  onChange={(e) => setPromoState((p) => ({ ...p, newShift: e.target.value as StaffShiftType }))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold"
                >
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>
                      {translateShift(s)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">
                {t('Tâches du nouveau poste', 'New Role Tasks', 'مهام المنصب الجديد')}
              </span>
              <div className="flex flex-wrap gap-1">
                {promoState.defaultTasks.map((tsk) => (
                  <span
                    key={tsk}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-800 dark:text-slate-200"
                  >
                    <span>{tsk}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPromoState((p) => ({
                          ...p,
                          defaultTasks: p.defaultTasks.filter((x) => x !== tsk),
                        }))
                      }
                      className="text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={promoState.taskDraft}
                  onChange={(e) => setPromoState((p) => ({ ...p, taskDraft: e.target.value }))}
                  placeholder={t('Ajouter une tâche...', 'Add task...', 'إضافة مهمة...')}
                  className="flex-1 min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = promoState.taskDraft.trim();
                    if (!clean) return;
                    setPromoState((p) => ({
                      ...p,
                      defaultTasks: p.defaultTasks.includes(clean) ? p.defaultTasks : [...p.defaultTasks, clean],
                      taskDraft: '',
                    }));
                  }}
                  className="min-h-[38px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {t('Motif / Décision RH', 'Reason / HR Note', 'سبب القرار')}
              </span>
              <input
                type="text"
                value={promoState.note}
                onChange={(e) => setPromoState((p) => ({ ...p, note: e.target.value }))}
                placeholder={t('Ex: Promotion méritée — passage Gouvernante', 'e.g. Performance promotion to Executive Housekeeper', 'مثال: ترقية بناءً على الأداء')}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
              />
            </label>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPromoModalMember(null)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                {t('Annuler', 'Cancel', 'إلغاء')}
              </button>
              <button
                type="submit"
                disabled={!deviceMutationAvailability.canMutate}
                className="flex-1 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer"
              >
                {t('Enregistrer la décision', 'Confirm Change', 'تأكيد القرار')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: QUICK ASSIGN TASK TO STAFF */}
      {taskModalMember && (
        <div className="fixed inset-0 z-[9995] bg-slate-950/70 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSaveQuickTask}
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <Briefcase size={18} className="text-blue-500 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {t('Assigner une tâche', 'Assign Task', 'إسناد مهمة')} · {taskModalMember.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTaskModalMember(null)}
                className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {t('Intitulé de la tâche *', 'Task title *', 'عنوان المهمة *')}
              </span>
              <input
                type="text"
                required
                value={quickTaskState.taskTitle}
                onChange={(e) => setQuickTaskState((p) => ({ ...p, taskTitle: e.target.value }))}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
              />
            </label>

            {taskModalMember.defaultTasks.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {taskModalMember.defaultTasks.map((presetTask) => (
                  <button
                    key={presetTask}
                    type="button"
                    onClick={() => setQuickTaskState((p) => ({ ...p, taskTitle: presetTask }))}
                    className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[11px] font-medium hover:border-blue-400 cursor-pointer"
                  >
                    {presetTask}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Chambre / Zone', 'Room / Zone', 'الغرفة / المنطقة')}
                </span>
                {activeRooms.length > 0 ? (
                  <select
                    value={quickTaskState.room}
                    onChange={(e) => setQuickTaskState((p) => ({ ...p, room: e.target.value }))}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold"
                  >
                    {activeRooms.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={quickTaskState.room}
                    onChange={(e) => setQuickTaskState((p) => ({ ...p, room: e.target.value }))}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
                  />
                )}
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Priorité', 'Priority', 'الأولوية')}
                </span>
                <select
                  value={quickTaskState.priority}
                  onChange={(e) => setQuickTaskState((p) => ({ ...p, priority: e.target.value as 'normal' | 'urgent' }))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold"
                >
                  <option value="normal">{t('Normale', 'Normal', 'عادية')}</option>
                  <option value="urgent">{t('Urgente', 'Urgent', 'عاجلة')}</option>
                </select>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTaskModalMember(null)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                {t('Annuler', 'Cancel', 'إلغاء')}
              </button>
              <button
                type="submit"
                disabled={!deviceMutationAvailability.canMutate}
                className="flex-1 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={15} />
                <span>{t('Envoyer la tâche', 'Dispatch Task', 'إرسال المهمة')}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
