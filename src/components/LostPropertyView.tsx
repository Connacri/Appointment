import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { PackageSearch, CheckCircle2, AlertTriangle, Clock3 } from 'lucide-react';

type Tab = 'forgotten' | 'valuables' | 'alerts';

export const LostPropertyView: React.FC = () => {
  const { bookings, updateBooking, language, currentRole, clientProfile } = useApp();
  const [tab, setTab] = useState<Tab>('forgotten');
  const [search, setSearch] = useState('');
  const canManage = ['admin', 'manager', 'receptionist', 'staff'].includes(currentRole);
  const rows = useMemo(() => bookings.flatMap((booking) => {
    const matches = !search.trim() || booking.guestName.toLowerCase().includes(search.toLowerCase()) || booking.resourceName.toLowerCase().includes(search.toLowerCase());
    if (!matches) return [];
    if (tab === 'forgotten') return (booking.forgottenItems || []).filter((item) => item.status === 'stored').map((item) => ({ booking, item }));
    if (tab === 'valuables') return (booking.valuablesAtReception || []).filter((item) => item.status === 'held' || item.status === 'forgotten').map((item) => ({ booking, item }));
    return (booking.guestAlerts || []).map((item) => ({ booking, item }));
  }), [bookings, search, tab]);
  const markReturned = (bookingId: string, itemId: string) => {
    const booking = bookings.find((entry) => entry.id === bookingId);
    if (!booking) return;
    const now = new Date().toISOString();
    if (tab === 'forgotten') updateBooking(bookingId, { forgottenItems: (booking.forgottenItems || []).map((item) => item.id === itemId ? { ...item, status: 'returned', returnedAt: now } : item) });
    if (tab === 'valuables') updateBooking(bookingId, { valuablesAtReception: (booking.valuablesAtReception || []).map((item) => item.id === itemId ? { ...item, status: 'returned', returnedAt: now } : item) });
  };
  const markForgotten = (bookingId: string, itemId: string) => {
    const booking = bookings.find((entry) => entry.id === bookingId);
    if (!booking) return;
    updateBooking(bookingId, { valuablesAtReception: (booking.valuablesAtReception || []).map((item) => item.id === itemId ? { ...item, status: 'forgotten' } : item) });
  };
  return <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-violet-600">Housekeeping & Réception</p><h1 className="text-2xl font-black text-slate-900 dark:text-white">Objets oubliés & réserves</h1><p className="text-sm text-slate-500">Registre central lié aux réservations et à l'historique des clients.</p></div><div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3"><PackageSearch className="inline mr-2 text-violet-600"/><strong>{rows.length}</strong><span className="ml-2 text-xs text-slate-500">élément(s) affiché(s)</span></div></header>
    <div className="flex flex-wrap gap-2">{([{id:'forgotten',label:'Objets oubliés'},{id:'valuables',label:'Objets confiés à la réception'},{id:'alerts',label:'Réserves & historique'}] as const).map((item)=><button key={item.id} onClick={()=>setTab(item.id)} className={`rounded-xl px-4 py-2 text-sm font-semibold border ${tab===item.id?'bg-violet-600 text-white border-violet-600':'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>{item.label}</button>)}</div>
    <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Rechercher un client ou une chambre…" className="w-full sm:max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm"/>
    <div className="space-y-3">{rows.length===0?<div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-slate-500"><PackageSearch size={32} className="mx-auto mb-2 opacity-40"/>Aucun élément dans cette catégorie.</div>:rows.map(({booking,item})=><article key={booking.id+item.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2 text-xs text-slate-500"><span>{booking.resourceName}</span><span>•</span><span>{booking.guestName}</span><span>•</span><span>{booking.endDate}</span></div><p className="font-bold text-slate-900 dark:text-white mt-1">{'description' in item ? item.description : item.text}</p><p className="text-[11px] text-slate-500 mt-1">{'foundBy' in item ? `Signalé par ${item.foundBy}` : 'createdBy' in item ? `Signalé par ${item.createdBy}` : 'Confié à la réception'}</p></div>{canManage && tab!=='alerts' && <div className="flex gap-2"><button onClick={()=>markReturned(booking.id,item.id)} className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-xs font-bold"><CheckCircle2 size={14} className="inline mr-1"/>Restitué</button>{tab==='valuables' && <button onClick={()=>markForgotten(booking.id,item.id)} className="rounded-lg bg-amber-500 text-white px-3 py-2 text-xs font-bold"><AlertTriangle size={14} className="inline mr-1"/>Non réclamé</button>}</div>}</article>)}</div>
  </div>;
};
