import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Plus,
  Search,
  Filter,
  User,
  Wrench,
  Boxes,
  Bed,
  Layers,
  ChevronRight,
  Flame,
  ArrowRight,
  ShieldCheck,
  Check,
  Trash2,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PmsTask } from '../types/booking';

export const TasksManagementView: React.FC = () => {
  const {
    tasks,
    addTask,
    updateTaskStatus,
    toggleSubtask,
    deleteTask,
    stockItems,
    language,
    currentRole,
    resourceGroups,
  } = useApp();

  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'done'>('open');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(tasks[0]?.id || null);

  // New task modal state
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newRoom, setNewRoom] = useState('CV-101');
  const [newTypeName, setNewTypeName] = useState('Nettoyage départ à fond');
  const [newCategory, setNewCategory] = useState<PmsTask['category']>('Ménage');
  const [newAssignee, setNewAssignee] = useState('Amina');
  const [newPriority, setNewPriority] = useState<'normal' | 'urgent'>('normal');
  const [newNote, setNewNote] = useState('');

  const hotelRooms = resourceGroups
    .filter((g) => g.sector === 'hotel')
    .flatMap((g) => g.resources);

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'open' && (t.status === 'done' || t.status === 'cancel')) return false;
    if (filterStatus === 'done' && t.status !== 'done') return false;
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (filterStaff !== 'all' && t.assignee !== filterStaff) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.room.toLowerCase().includes(q) ||
        t.typeName.toLowerCase().includes(q) ||
        (t.note && t.note.toLowerCase().includes(q)) ||
        t.assignee.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || filteredTasks[0] || tasks[0];

  // Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const urgentCount = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'done').length;

  const staffMembers = ['Amina', 'Yacine', 'Sonia', 'Karim (Technique)'];

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
        { id: `st_${Date.now()}_1`, text: 'Contrôle initial de la pièce', completed: false },
        { id: `st_${Date.now()}_2`, text: 'Réalisation de l’intervention', completed: false },
        { id: `st_${Date.now()}_3`, text: 'Validation et signature QR', completed: false },
      ],
      tools: ['Chariot d’intervention', 'Tablette PMS'],
    });
    setIsNewTaskOpen(false);
    setNewNote('');
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Left / Center Tasks Workspace (inspired by f0a8290b850fbd4fd4dbd072137389bc.jpg) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden p-4 md:p-6 space-y-4">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                {language === 'fr'
                  ? 'Tâches, Livraisons & Rotations'
                  : language === 'ar'
                  ? 'مهام وتوصيل وتجهيز الغرف'
                  : 'Turnaround Tasks & Deliveries'}
              </h1>
              {urgentCount > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse">
                  <Flame size={12} />
                  <span>{urgentCount} {language === 'fr' ? 'Urgentes' : 'Urgent'}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'fr'
                ? 'Coordination des équipes d’étage, gestion des départs et réassorts automatiques'
                : 'Housekeeping floor coordination, departures turnaround & stock deduction'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Onboard Team Avatars Stack (like in f0a8290b850fbd4fd4dbd072137389bc.jpg) */}
            <div className="hidden sm:flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-full shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase mr-1">
                {language === 'fr' ? 'Équipe en service :' : 'Onboard :'}
              </span>
              <div className="flex -space-x-2 overflow-hidden">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-900 bg-indigo-500 text-white text-[10px] font-bold">
                  AM
                </span>
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-900 bg-amber-500 text-white text-[10px] font-bold">
                  YA
                </span>
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-900 bg-emerald-500 text-white text-[10px] font-bold">
                  SO
                </span>
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-900 bg-purple-500 text-white text-[10px] font-bold">
                  KA
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsNewTaskOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-xl font-medium text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>{language === 'fr' ? 'Nouvelle demande' : 'New Task'}</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'fr' ? 'Filtrer par chambre, tâche ou personnel...' : 'Filter by room, task, or staff...'}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-xl">
            <button
              onClick={() => setFilterStatus('open')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === 'open'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {language === 'fr' ? 'À faire' : 'Open'}
            </button>
            <button
              onClick={() => setFilterStatus('done')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === 'done'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {language === 'fr' ? 'Terminées' : 'Completed'}
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {language === 'fr' ? 'Toutes' : 'All'}
            </button>
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">{language === 'fr' ? 'Toutes catégories' : 'All Categories'}</option>
            <option value="Ménage">Ménage</option>
            <option value="Linge">Linge & Literie</option>
            <option value="Minibar & accueil">Minibar & Accueil</option>
            <option value="Livraison">Livraison Client</option>
            <option value="Maintenance">Maintenance</option>
          </select>
        </div>

        {/* Timeline Scope Banner (inspired by 985636b6a575061d10f78334084c2c5e.jpg) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <span>Cycle de service & Rotations hôtelières (Scope of Work)</span>
            <span className="text-blue-500 font-mono">OmniBook PMS</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">1. Arrivée & Accueil</span>
              <span className="text-[10px] text-slate-400">Minibar, clés, kit courtoisie</span>
            </div>
            <div className="p-2 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40">
              <span className="font-bold text-blue-700 dark:text-blue-400 block">2. En Séjour (Stay)</span>
              <span className="text-[10px] text-blue-500">Recouche, draps, room-service</span>
            </div>
            <div className="p-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40">
              <span className="font-bold text-amber-700 dark:text-amber-400 block">3. Départ (Check-out)</span>
              <span className="text-[10px] text-amber-500">Désinfection à fond & inventaire</span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40">
              <span className="font-bold text-emerald-700 dark:text-emerald-400 block">4. Contrôle & Prête</span>
              <span className="text-[10px] text-emerald-500">Validation gouvernante</span>
            </div>
          </div>
        </div>

        {/* Task Cards Grid */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2 opacity-80" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {language === 'fr' ? 'Aucune tâche correspondante' : 'No matching tasks'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'fr' ? 'Toutes les interventions demandées ont été traitées.' : 'All requested tasks have been settled.'}
              </p>
            </div>
          ) : (
            filteredTasks.map((t) => {
              const isSelected = selectedTask?.id === t.id;
              const completedCount = t.subtasks?.filter((s) => s.completed).length || 0;
              const totalSub = t.subtasks?.length || 0;

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTaskId(t.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-500 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-xs font-bold font-mono">
                        {t.room}
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{t.typeName}</span>
                          {t.priority === 'urgent' && (
                            <span className="px-1.5 py-0.2 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold rounded">
                              URGENT
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {t.note || `Catégorie: ${t.category}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          t.status === 'done'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : t.status === 'doing'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {t.status === 'done' ? '✓ Terminée' : t.status === 'doing' ? '⏳ En cours' : 'À faire'}
                      </span>

                      <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 font-mono">
                        <User size={12} />
                        <span>{t.assignee}</span>
                      </span>
                    </div>
                  </div>

                  {/* Consumed items & subtask progress */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      {t.consumedItems && t.consumedItems.length > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          <Boxes size={11} />
                          <span>{t.consumedItems.map((c) => `${c.itemName} x${c.quantity}`).join(', ')}</span>
                        </span>
                      )}
                    </div>

                    {totalSub > 0 && (
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        Sous-tâches: {completedCount}/{totalSub}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Drawer / Upcoming Task Details (Identical to f0a8290b850fbd4fd4dbd072137389bc.jpg) */}
      <div className="w-full md:w-88 lg:w-96 p-4 md:p-6 bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 flex flex-col space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {language === 'fr' ? 'Détails de l’intervention' : 'Upcoming & Execution'}
            </span>
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-semibold">
            {selectedTask?.room || 'Chambre'}
          </div>
        </div>

        {selectedTask ? (
          <div className="space-y-4 flex-1">
            {/* Task Title & Status */}
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {selectedTask.typeName}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {selectedTask.category} · Assigné à {selectedTask.assignee}
              </span>
            </div>

            {/* Note */}
            {selectedTask.note && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 text-xs text-slate-700 dark:text-slate-300">
                <span className="font-semibold block text-[11px] text-slate-400 uppercase mb-1">Consigne :</span>
                {selectedTask.note}
              </div>
            )}

            {/* Participants / Staff Avatar Stack */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Personnel assigné :
              </span>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {selectedTask.assignee.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                    {selectedTask.assignee}
                  </span>
                  <span className="text-[10px] text-slate-400">Étage & Service d’accueil</span>
                </div>
              </div>
            </div>

            {/* Tools Used (matching tools chips in image f0a8290b850fbd4fd4dbd072137389bc.jpg) */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Équipements & Outils :
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(selectedTask.tools || ['Chariot standard', 'Scanner QR']).map((tool, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>

            {/* Subtasks Checklist with blue checkmark circles (from image f0a8290b850fbd4fd4dbd072137389bc.jpg) */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Checklist d’intervention :
              </span>
              <div className="space-y-2">
                {(selectedTask.subtasks || [
                  { id: 'st_1', text: 'Vérifier état général', completed: selectedTask.status === 'done' },
                  { id: 'st_2', text: 'Effectuer l’action', completed: selectedTask.status === 'done' },
                ]).map((st) => (
                  <button
                    key={st.id}
                    onClick={() => toggleSubtask(selectedTask.id, st.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                      st.completed
                        ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className={st.completed ? 'line-through opacity-80' : ''}>{st.text}</span>
                    <span
                      className={`h-5 w-5 rounded-full flex items-center justify-center transition-colors ${
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
              {selectedTask.status !== 'done' && (
                <button
                  onClick={() => updateTaskStatus(selectedTask.id, 'done')}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-medium text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  <span>{language === 'fr' ? 'Valider & Déduire du Stock' : 'Complete & Deduct Stock'}</span>
                </button>
              )}

              {selectedTask.status === 'pending' && (
                <button
                  onClick={() => updateTaskStatus(selectedTask.id, 'doing')}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white py-2 rounded-xl font-medium text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Clock size={16} />
                  <span>{language === 'fr' ? 'Démarrer l’intervention' : 'Start Working'}</span>
                </button>
              )}

              {selectedTask.status === 'done' && (
                <button
                  onClick={() => updateTaskStatus(selectedTask.id, 'pending')}
                  className="w-full flex items-center justify-center gap-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2 rounded-xl font-medium text-xs transition-all cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>{language === 'fr' ? 'Rouvrir la tâche' : 'Reopen Task'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-xs text-slate-400">
            {language === 'fr' ? 'Sélectionnez une tâche pour afficher les détails.' : 'Select a task to review details.'}
          </div>
        )}

        {/* Project Status Card (identical to bottom right widget in image f0a8290b850fbd4fd4dbd072137389bc.jpg) */}
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 mt-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {language === 'fr' ? 'Avancement du jour' : 'Project Status'}
            </span>
            <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">
              {progressPercent}%
            </span>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
              {completedTasks}
            </span>
            <span className="text-slate-400 font-mono text-sm">/ {totalTasks} tâches</span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* New Task Modal */}
      {isNewTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles size={18} className="text-blue-500" />
              <span>{language === 'fr' ? 'Créer une tâche / livraison' : 'Create Task or Delivery'}</span>
            </h2>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Chambre / Emplacement</label>
                <select
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  {hotelRooms.map((r) => (
                    <option key={r.id} value={r.name.split(' - ')[0]}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Prestation demandée</label>
                <input
                  type="text"
                  required
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Ex: Livraison lit bébé, Recharge minibar..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Catégorie</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as PmsTask['category'])}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="Ménage">Ménage</option>
                    <option value="Linge">Linge</option>
                    <option value="Minibar & accueil">Minibar & accueil</option>
                    <option value="Livraison">Livraison</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Personnel assigné</label>
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
                <label className="block text-xs font-semibold text-slate-500 mb-1">Priorité</label>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="prio"
                      checked={newPriority === 'normal'}
                      onChange={() => setNewPriority('normal')}
                    />
                    <span>Normale</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold">
                    <input
                      type="radio"
                      name="prio"
                      checked={newPriority === 'urgent'}
                      onChange={() => setNewPriority('urgent')}
                    />
                    <span>Urgente ⚠</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Note spécifique</label>
                <textarea
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Consignes client, créneau horaire, etc."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewTaskOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20"
                >
                  Créer la demande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
