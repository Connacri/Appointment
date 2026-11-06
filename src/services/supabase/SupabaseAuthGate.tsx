import React, { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabaseClient';

type Props = { children: React.ReactNode };

export function SupabaseAuthGate({ children }: Props) {
  const [sessionReady, setSessionReady] = useState(!isSupabaseConfigured);
  const [signedIn, setSignedIn] = useState(false);
  const [mode, setMode] = useState<'signin'|'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({data}) => {
      if (alive) {
        setSignedIn(Boolean(data.session));
        setSessionReady(true);
      }
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setSessionReady(true);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    try {
      const result = mode === 'signin'
        ? await supabase.auth.signInWithPassword({email: email.trim(), password})
        : await supabase.auth.signUp({email: email.trim(), password});
      if (result.error) throw result.error;
      if (mode === 'signup' && !result.data.session) {
        setMessage('Compte créé. Vérifiez votre e-mail pour confirmer votre adresse, puis connectez-vous.');
      } else {
        setSignedIn(Boolean(result.data.session));
        setMessage('Authentification réussie.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Échec de l’authentification.');
    } finally {
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured) return <>{children}</>;
  if (!sessionReady) return <div className="min-h-screen grid place-items-center text-slate-600">Connexion à Supabase…</div>;
  if (signedIn) {
    return <>{children}</>;
  }

  return <main className="min-h-screen grid place-items-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Appointment PMS</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{mode === 'signin' ? 'Connexion' : 'Créer un compte'}</h1>
        <p className="mt-2 text-sm text-slate-500">Authentification sécurisée par Supabase. Les données métier sont protégées par les politiques RLS.</p>
      </div>
      <label className="mb-1 block text-sm font-medium">Adresse e-mail</label>
      <input className="mb-4 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-slate-900 dark:border-slate-700 dark:text-white" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} />
      <label className="mb-1 block text-sm font-medium">Mot de passe</label>
      <input className="mb-4 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-slate-900 dark:border-slate-700 dark:text-white" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} />
      {message && <p role="status" className="mb-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{message}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60">{busy ? 'Veuillez patienter…' : mode === 'signin' ? 'Se connecter' : 'Créer le compte'}</button>
      <button type="button" className="mt-4 w-full text-sm text-blue-600" onClick={()=>{setMode(mode==='signin'?'signup':'signin');setMessage('');}}>
        {mode === 'signin' ? 'Créer un nouveau compte' : 'J’ai déjà un compte'}
      </button>
    </form>
  </main>;
}
