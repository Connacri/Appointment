import React from 'react';
import {
  X,
  Phone,
  Mail,
  MapPin,
  Globe,
  Github,
  Linkedin,
  ShieldCheck,
  Cpu,
  KeyRound,
  Video,
  Layers,
  Award,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import headerImage from '../../assets/branding/HEADER RMZ.jpg';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const { language } = useApp();
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const isRtl = language === 'ar';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
      className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto pms-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl rounded-3xl border border-cyan-500/30 bg-slate-950 text-slate-100 shadow-[0_0_60px_rgba(6,182,212,0.15)] overflow-hidden my-auto pms-modal">
        {/* Banner with Geometric Polygonal Background Accent */}
        <div className="relative w-full h-44 sm:h-52 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 overflow-hidden border-b border-cyan-500/20">
          {/* Asset image from assets/branding — single source of truth for the header */}
          <img
            src={headerImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-40"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-900/40 to-slate-950/80" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-slate-900/80 border border-slate-700/80 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>

          {/* Header Content: FORSLOG LTD Logo vector & Brand Title */}
          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end justify-between h-full p-4 sm:p-6 gap-3">
            <div className="flex items-center gap-4">
              {/* S-Ribbon Logo Vector */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl bg-slate-900/90 border border-cyan-500/40 p-2 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <svg viewBox="0 0 100 120" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="sTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#94a3b8" />
                      <stop offset="60%" stopColor="#64748b" />
                      <stop offset="100%" stopColor="#475569" />
                    </linearGradient>
                    <linearGradient id="sMidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00d4ff" />
                      <stop offset="50%" stopColor="#0284c7" />
                      <stop offset="100%" stopColor="#1e3a8a" />
                    </linearGradient>
                  </defs>
                  {/* Upper loop of the S ribbon */}
                  <path
                    d="M 68 25 C 68 12, 38 10, 32 24 C 26 38, 52 50, 64 62 C 78 76, 68 105, 36 104 C 22 103, 16 90, 16 90"
                    stroke="url(#sTopGrad)"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Lower vibrant cyan/blue swoosh */}
                  <path
                    d="M 28 64 C 42 74, 76 80, 68 98 C 60 114, 30 110, 22 96"
                    stroke="url(#sMidGrad)"
                    strokeWidth="15"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 id="about-modal-title" className="text-xl sm:text-2xl font-black tracking-wider text-white">
                    FORSLOG LTD
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    Officiel
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-semibold tracking-wider text-slate-300 uppercase">
                  Cybernetics Engineering &bull; Advanced Technology
                </p>
                <p className="text-[11px] text-cyan-400 font-mono mt-0.5">
                  www.forslog.com &bull; Oran, Algérie 🇩🇿
                </p>
              </div>
            </div>

            {/* Quick Contact Badge */}
            <div className="flex items-center gap-2">
              <a
                href="tel:+213696410953"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/30"
              >
                <Phone size={13} />
                <span>0696.410.953</span>
              </a>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-6 max-h-[calc(85vh-180px)] overflow-y-auto">
          {/* Developer Spotlight Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">S.M. RAMZI GUEDOUAR</h2>
                <span className="text-xs text-slate-400 font-mono">(Connacri)</span>
              </div>
              <p className="text-xs text-cyan-400 font-medium">
                {language === 'fr'
                  ? 'Fondateur & Gérant — Forslog SARL | Expert Sécurité Électronique & Full-Stack Developer'
                  : language === 'ar'
                  ? 'المؤسس والمدير العام — شركة Forslog SARL | خبير الأنظمة الأمنية ومطور برمجيات'
                  : 'Founder & CEO — Forslog SARL | Electronic Security Expert & Full-Stack Developer'}
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
                <Award size={12} />
                <span>
                  {language === 'fr'
                    ? 'Agréé Ministère de l’Intérieur Type 1 · RC Oran'
                    : language === 'ar'
                    ? 'معتمد من وزارة الداخلية النوع 1 · السجل التجاري وهران'
                    : 'Accredited Ministry of the Interior Type 1 · CR Oran'}
                </span>
              </div>
            </div>

            {/* Contact quick actions */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyToClipboard('ramzi.guedouar@gmail.com', 'email')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                title="Copier l'adresse e-mail"
              >
                {copiedField === 'email' ? <Check size={13} className="text-emerald-400" /> : <Mail size={13} />}
                <span>{copiedField === 'email' ? 'Copié !' : 'ramzi.guedouar@gmail.com'}</span>
              </button>

              <button
                type="button"
                onClick={() => copyToClipboard('+213696410953', 'phone')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                title="Copier le numéro de téléphone"
              >
                {copiedField === 'phone' ? <Check size={13} className="text-emerald-400" /> : <Phone size={13} />}
                <span>{copiedField === 'phone' ? 'Copié !' : '+213 696 410 953'}</span>
              </button>
            </div>
          </div>

          {/* Company Details & Legal Coordinates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <MapPin size={14} />
                <span>{language === 'fr' ? 'Coordonnées & Siège' : language === 'ar' ? 'العنوان والمقر' : 'Location & Headquarters'}</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                <strong className="text-white">FORSLOG SARL / FORSLOG LTD</strong><br />
                Rue Malbey Bouisseville, Aïn El Turck / Bir El Djir<br />
                Oran 31000, Algérie 🇩🇿
              </p>
              <div className="pt-1 text-xs text-slate-400 space-y-1">
                <div><span className="text-slate-500">Email :</span> ramzi.guedouar@gmail.com / forslog@gmail.com</div>
                <div><span className="text-slate-500">Tél :</span> +213 696 410 953 / 0696.410.953</div>
                <div><span className="text-slate-500">Web :</span> <a href="https://www.forslog.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">www.forslog.com</a></div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Globe size={14} />
                <span>{language === 'fr' ? 'Profils & Dépôts Officiels' : language === 'ar' ? 'الروابط والملفات الرسمية' : 'Profiles & Open Source'}</span>
              </h3>
              <div className="space-y-2 text-xs">
                <a
                  href="https://connacri.github.io/CV/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Globe size={14} className="text-cyan-400" />
                    <span className="font-semibold">Curriculum Vitae Interactif</span>
                  </span>
                  <ExternalLink size={12} className="text-slate-400" />
                </a>

                <a
                  href="https://github.com/Connacri"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Github size={14} className="text-cyan-400" />
                    <span className="font-semibold">github.com/Connacri</span>
                  </span>
                  <ExternalLink size={12} className="text-slate-400" />
                </a>

                <a
                  href="https://www.linkedin.com/in/s-m-ramzi-guedouar-6694043b0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Linkedin size={14} className="text-cyan-400" />
                    <span className="font-semibold">LinkedIn Profil</span>
                  </span>
                  <ExternalLink size={12} className="text-slate-400" />
                </a>
              </div>
            </div>
          </div>

          {/* Technical Specializations */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Cpu size={14} />
              <span>{language === 'fr' ? 'Domaines d’Expertise & Réalisations' : language === 'ar' ? 'مجالات الخبرة والمشاريع' : 'Core Expertise & Innovations'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-bold">
                  <KeyRound size={13} />
                  <span>Serrures proUSB (RFID)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Rétro-ingénierie protocolaire, décodage trames 16 octets MIFARE 1K, communication native WebHID, import direct base CardLock.mdb.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                  <Video size={13} />
                  <span>Sécurité & CCTV</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Vidéosurveillance IP/HD, NVR/DVR, caméras PTZ, vision nocturne infrarouge, contrôle d’accès biométrique et RFID.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold">
                  <Layers size={13} />
                  <span>Architecture PMS & Mobile</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Appointment PMS, AnatomyZ, CabaLink, AutoPost Studio. Full-stack React 19, TypeScript, Capacitor, Flutter, Supabase & IndexedDB.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p>
            &copy; {new Date().getFullYear()} <strong className="text-white">FORSLOG LTD</strong>. Tous droits réservés.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors cursor-pointer"
          >
            {language === 'fr' ? 'Fermer' : language === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
