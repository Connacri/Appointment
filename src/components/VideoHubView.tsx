import React, { useEffect, useMemo, useState } from 'react';
import {
  Film, Home, Heart, Clock, History, Grid3x3, ListVideo, Settings, Plus, Search,
  Play, ThumbsUp, ThumbsDown, X, Tag, Filter, ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

type Locale = 'fr' | 'en' | 'ar';

type Platform = 'youtube' | 'tiktok';

type Video = {
  id: string;
  platform?: Platform;
  title: string;
  channel: string;
  summary: string;
  why?: string;
  categories: string[];
  tags: string[];
  duration?: number;
  views?: number;
  published?: string;
  contentType?: string;
};

type ExtraCategory = { id: string; name: string };

type Page = 'home' | 'feed' | 'liked' | 'history' | 'later' | 'categories' | 'category' | 'search' | 'settings' | 'add' | 'watch';

const CATEGORIES: { id: string; name: Record<Locale, string> }[] = [
  { id: 'tech', name: { fr: 'Technologie', en: 'Technology', ar: 'تقنية' } },
  { id: 'talks', name: { fr: 'Conférences', en: 'Talks', ar: 'محاضرات' } },
  { id: 'education', name: { fr: 'Éducation', en: 'Education', ar: 'تعليم' } },
  { id: 'music', name: { fr: 'Musique', en: 'Music', ar: 'موسيقى' } },
  { id: 'docs', name: { fr: 'Documentaires', en: 'Documentaries', ar: 'وثائقيات' } },
  { id: 'comedy', name: { fr: 'Humour', en: 'Comedy', ar: 'كوميديا' } },
];

const SEED_VIDEOS: Video[] = [
  { id: 'dQw4w9WgXcQ', title: 'Rick Astley - Never Gonna Give You Up (Official Video)', channel: 'Rick Astley', summary: 'The classic 80s pop anthem that became an internet legend.', why: 'A cultural touchstone of the early web.', categories: ['music'], tags: ['classic', '80s', 'pop'], duration: 213, views: 1400000000, published: '2009-10-25T00:00:00Z', contentType: 'music' },
  { id: 'jNQXAC9IVRw', title: 'Me at the zoo', channel: 'jawed', summary: 'The very first video uploaded to YouTube.', why: 'Historical milestone of online video.', categories: ['tech', 'education'], tags: ['history', 'youtube'], duration: 19, views: 300000000, published: '2005-04-23T00:00:00Z', contentType: 'demo' },
  { id: 'M7lc1UVf-VE', title: 'Nyan Cat', channel: 'saraj00n', summary: 'A flying cat with a Pop-Tart body leaving a rainbow trail.', why: 'Iconic internet meme.', categories: ['comedy', 'music'], tags: ['meme', 'cat'], duration: 216, views: 200000000, published: '2011-04-05T00:00:00Z', contentType: 'comedy' },
  { id: '9bZkp7q19f0', title: 'PSY - GANGNAM STYLE', channel: 'officialpsy', summary: 'The K-pop hit that broke YouTube view records.', why: 'First video to reach one billion views.', categories: ['music'], tags: ['kpop', 'dance'], duration: 252, views: 5000000000, published: '2012-07-15T00:00:00Z', contentType: 'music' },
  { id: 'kJQP7kiw5Fk', title: 'Luis Fonsi - Despacito ft. Daddy Yankee', channel: 'Luis Fonsi', summary: 'Global reggaeton phenomenon.', why: 'One of the most viewed videos ever.', categories: ['music'], tags: ['latin', 'pop'], duration: 282, views: 8000000000, published: '2017-01-12T00:00:00Z', contentType: 'music' },
];

const LS = {
  lib: 'videohub_library',
  likes: 'videohub_likes',
  dislikes: 'videohub_dislikes',
  seen: 'videohub_seen',
  later: 'videohub_later',
};

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function extractVideo(input: string): { platform: Platform; id: string } | null {
  const s = input.trim();
  // YouTube
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return { platform: 'youtube', id: s };
  const yt = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { platform: 'youtube', id: yt[1] };
  // TikTok: /video/1234567890
  const tt = s.match(/\/video\/(\d{10,})/);
  if (tt) return { platform: 'tiktok', id: tt[1] };
  if (/^\d{10,}$/.test(s)) return { platform: 'tiktok', id: s };
  return null;
}

function extractId(input: string): string | null {
  return extractVideo(input)?.id ?? null;
}

function thumbUrl(v: Video): string {
  if ((v.platform || 'youtube') === 'tiktok') return '';
  return `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
}

function embedUrl(v: Video): string {
  if ((v.platform || 'youtube') === 'tiktok') return `https://www.tiktok.com/embed/v2/${v.id}`;
  return `https://www.youtube-nocookie.com/embed/${v.id}?rel=0&autoplay=1`;
}

function watchEmbedUrl(v: Video): string {
  if ((v.platform || 'youtube') === 'tiktok') return `https://www.tiktok.com/embed/v2/${v.id}`;
  return `https://www.youtube-nocookie.com/embed/${v.id}?rel=0&autoplay=1`;
}
function feedEmbedUrl(v: Video): string {
  if ((v.platform || 'youtube') === 'tiktok') return `https://www.tiktok.com/embed/v2/${v.id}`;
  return `https://www.youtube-nocookie.com/embed/${v.id}?rel=0&modestbranding=1`;
}

function fmtDur(s?: number) {
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}

function fmtViews(n?: number) {
  if (n == null) return '';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B views`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M views`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K views`;
  return `${n} views`;
}

function ago(iso?: string, lang: Locale = 'en') {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const units: [string, string, string, number][] = [
    ['year', 'year', 'سنة', 31536000],
    ['month', 'month', 'شهر', 2592000],
    ['week', 'week', 'أسبوع', 604800],
    ['day', 'day', 'يوم', 86400],
  ];
  for (const [enU, frU, arU, sec] of units) {
    const n = Math.floor(s / sec);
    if (n >= 1) {
      const u = lang === 'fr' ? frU : lang === 'ar' ? arU : enU;
      return lang === 'ar' ? `قبل ${n} ${u}` : `${n} ${u}${n > 1 ? 's' : ''} ago`.replace('ago', lang === 'fr' ? 'passé' : 'ago');
    }
  }
  return lang === 'fr' ? "aujourd'hui" : lang === 'ar' ? 'اليوم' : 'today';
}

export const VideoHubView: React.FC = () => {
  const { language } = useApp();
  const lang = language as Locale;
  const t = (fr: string, en: string, ar: string) => (lang === 'fr' ? fr : lang === 'ar' ? ar : en);

  const [library, setLibrary] = useState<Video[]>(() => {
    const stored = loadJSON<Video[]>(LS.lib, []);
    return stored.length ? stored : SEED_VIDEOS;
  });
  const [extraCategories, setExtraCategories] = useState<ExtraCategory[]>(() => loadJSON<ExtraCategory[]>('videohub_extra_cats', []));
  const [likes, setLikes] = useState<string[]>(() => loadJSON<string[]>(LS.likes, []));
  const [dislikes, setDislikes] = useState<string[]>(() => loadJSON<string[]>(LS.dislikes, []));
  const [seen, setSeen] = useState<string[]>(() => loadJSON<string[]>(LS.seen, []));
  const [later, setLater] = useState<string[]>(() => loadJSON<string[]>(LS.later, []));

  const [page, setPage] = useState<Page>('home');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'grid' | 'feed'>('grid');

  // Add form
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addChannel, setAddChannel] = useState('');
  const [addCategory, setAddCategory] = useState('tech');
  const [addPlatform, setAddPlatform] = useState<Platform>('youtube');
  const [addTags, setAddTags] = useState('');

  useEffect(() => saveJSON(LS.lib, library), [library]);
  useEffect(() => saveJSON(LS.likes, likes), [likes]);
  useEffect(() => saveJSON(LS.dislikes, dislikes), [dislikes]);
  useEffect(() => saveJSON(LS.seen, seen), [seen]);
  useEffect(() => saveJSON(LS.later, later), [later]);
  useEffect(() => saveJSON('videohub_extra_cats', extraCategories), [extraCategories]);

  // Load the HackerTube dataset (offline-first: bundled asset, then cached in library)
  useEffect(() => {
    let cancelled = false;
    fetch('/data/hackertube.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const cats: ExtraCategory[] = (data.categories || []).map((c: any) => ({ id: c.id, name: c.name }));
        const vids: Video[] = (data.videos || []).map((v: any) => ({
          id: v.id,
          platform: 'youtube' as Platform,
          title: v.title,
          channel: v.channel,
          summary: v.summary || '',
          why: v.why,
          categories: v.categories || [],
          tags: v.tags || [],
          contentType: v.contentType,
        }));
        setExtraCategories((prev) => {
          const ids = new Set(prev.map((c) => c.id));
          const merged = [...prev];
          for (const c of cats) if (!ids.has(c.id)) { merged.push(c); ids.add(c.id); }
          return merged;
        });
        setLibrary((prev) => {
          const ids = new Set(prev.map((v) => v.id));
          const merged = [...prev];
          for (const v of vids) if (!ids.has(v.id)) { merged.push(v); ids.add(v.id); }
          return merged;
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const videoById = useMemo(() => new Map(library.map((v) => [v.id, v])), [library]);

  const allCategories = useMemo(() => {
    const fixed = CATEGORIES.map((c) => ({ id: c.id, name: c.name[lang], fixed: true }));
    const extra = extraCategories.map((c) => ({ id: c.id, name: c.name, fixed: false }));
    const seen = new Set(fixed.map((c) => c.id));
    const merged = [...fixed];
    for (const c of extra) if (!seen.has(c.id)) { merged.push(c); seen.add(c.id); }
    return merged;
  }, [lang, extraCategories]);

  const markSeen = (id: string) => {
    setSeen((prev) => [...prev.filter((x) => x !== id), id].slice(-200));
  };

  const toggleLike = (id: string) => {
    setLikes((prev) => {
      const i = prev.indexOf(id);
      if (i >= 0) return prev.filter((x) => x !== id);
      setDislikes((d) => d.filter((x) => x !== id));
      return [...prev, id];
    });
  };
  const toggleDislike = (id: string) => {
    setDislikes((prev) => {
      const i = prev.indexOf(id);
      if (i >= 0) return prev.filter((x) => x !== id);
      setLikes((l) => l.filter((x) => x !== id));
      return [...prev, id];
    });
  };
  const toggleLater = (id: string) => {
    setLater((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const openVideo = (id: string) => {
    setSelectedId(id);
    setPage('watch');
    markSeen(id);
  };

  const goHome = () => { setPage('home'); setSelectedId(null); };
  const goCategory = (id: string) => { setCategoryId(id); setPage('category'); };
  const goSearch = (q: string) => { setQuery(q); setPage('search'); };

  const filtered = (params: { cat?: string; dur?: string; q?: string }) => {
    let res = [...library];
    if (params.cat) res = res.filter((v) => v.categories.includes(params.cat!));
    if (params.dur === 'short') res = res.filter((v) => (v.duration || 0) < 240);
    if (params.dur === 'medium') res = res.filter((v) => (v.duration || 0) >= 240 && (v.duration || 0) < 1200);
    if (params.dur === 'long') res = res.filter((v) => (v.duration || 0) >= 1200 && (v.duration || 0) < 3600);
    if (params.dur === 'xlong') res = res.filter((v) => (v.duration || 0) >= 3600);
    if (params.q) {
      const ql = params.q.toLowerCase();
      res = res.filter((v) =>
        v.title.toLowerCase().includes(ql) ||
        v.channel.toLowerCase().includes(ql) ||
        v.summary.toLowerCase().includes(ql) ||
        v.tags.some((t) => t.toLowerCase().includes(ql)),
      );
    }
    return res;
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const ev = extractVideo(addUrl);
    if (!ev) return;
    if (library.some((v) => v.id === ev.id && (v.platform || 'youtube') === ev.platform)) {
      setAddUrl('');
      return;
    }
    const v: Video = {
      id: ev.id,
      platform: ev.platform,
      title: addTitle.trim() || `Video ${ev.id}`,
      channel: addChannel.trim() || 'Unknown',
      summary: '',
      categories: [addCategory],
      tags: addTags.split(',').map((x) => x.trim()).filter(Boolean),
      contentType: 'video',
    };
    setLibrary((prev) => [v, ...prev]);
    setAddUrl(''); setAddTitle(''); setAddChannel(''); setAddTags('');
    setPage('home');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) goSearch(query.trim());
  };

  // Watch page
  const selected = selectedId ? videoById.get(selectedId) : null;

  // Home: mix
  const homeVideos = useMemo(() => {
    const likedSet = new Set(likes);
    const seenSet = new Set(seen);
    const pool = library.filter((v) => !seenSet.has(v.id));
    // simple shuffle by seed
    const arr = [...pool];
    // deterministic-ish shuffle
    let seed = 42;
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor((seed / 233280) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 36);
  }, [library, likes, seen]);

  const renderCard = (v: Video) => (
    <a
      key={v.id}
      href="#"
      onClick={(e) => { e.preventDefault(); openVideo(v.id); }}
      className="group block rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow"
      title={v.why}
    >
      <div className="relative aspect-video bg-slate-200 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
        {(v.platform || 'youtube') === 'youtube' ? (
          <img
            loading="lazy"
            src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`; }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-pink-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
            TikTok
          </div>
        )}
        {v.duration ? (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            {fmtDur(v.duration)}
          </span>
        ) : null}
        {later.includes(v.id) ? (
          <span className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">Saved</span>
        ) : null}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug">{v.title}</h3>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{v.channel}</div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          {[fmtViews(v.views), ago(v.published, lang)].filter(Boolean).join(' · ')}
        </div>
      </div>
    </a>
  );

  const renderNavButton = (p: Page, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setPage(p)}
      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
        page === p
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-800/80 px-4 py-3 flex items-center gap-3 flex-wrap bg-white/60 dark:bg-slate-950/60 backdrop-blur">
        <div className="flex items-center gap-2">
          <Film size={20} className="text-rose-500" />
          <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">HackTube</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">ad-free</span>
        </div>
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[180px] max-w-xl flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Rechercher', 'Search', 'بحث')}
              className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold">
            {t('Chercher', 'Go', 'بحث')}
          </button>
        </form>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === 'grid' ? 'feed' : 'grid')}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            title={mode === 'grid' ? t('Mode flux vertical', 'Vertical feed mode', 'وضع التغذية العمودية') : t('Mode grille', 'Grid mode', 'وضع الشبكة')}
          >
            {mode === 'grid' ? <ListVideo size={14} /> : <Grid3x3 size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setPage('add')}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
          >
            <Plus size={14} /> {t('Ajouter', 'Add', 'إضافة')}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Side nav */}
        <aside className="hidden md:flex w-52 shrink-0 flex-col gap-1 p-3 border-r border-slate-200 dark:border-slate-800/80 overflow-y-auto">
          {renderNavButton('home', <Home size={16} />, t('Accueil', 'Home', 'الرئيسية'))}
          {renderNavButton('feed', <ListVideo size={16} />, t('Flux', 'Feed', 'تغذية'))}
          {renderNavButton('liked', <Heart size={16} />, t('Aimés', 'Liked', 'المفضلة'))}
          {renderNavButton('later', <Clock size={16} />, t('À voir plus tard', 'Watch later', 'المشاهدة لاحقاً'))}
          {renderNavButton('history', <History size={16} />, t('Historique', 'History', 'السجل'))}
          {renderNavButton('categories', <Tag size={16} />, t('Catégories', 'Categories', 'الفئات'))}
          {renderNavButton('settings', <Settings size={16} />, t('Paramètres', 'Settings', 'الإعدادات'))}
          <div className="mt-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {library.length} {t('vidéos', 'videos', 'فيديو')}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4">
          {page === 'home' && (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('Accueil', 'Home', 'الرئيسية')}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('Vidéos recommandées, sans pub ni distraction.', 'Recommended videos, no ads, no distractions.', 'فيديوهات موصى بها، بدون إعلانات أو تشويش.')}</p>
              </div>
              {mode === 'feed' ? (
                <div className="flex flex-col items-center gap-6 max-w-sm mx-auto">
                  {homeVideos.map((v) => (
                    <div key={v.id} className="w-full rounded-2xl overflow-hidden bg-black shadow-xl">
                      <div className="relative aspect-[9/16] bg-black">
                        <iframe
                          src={feedEmbedUrl(v)}
                          title={v.title}
                          className="absolute inset-0 w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allowFullScreen
                        />
                      </div>
                      <div className="p-3 bg-slate-900 text-white">
                        <div className="text-sm font-semibold line-clamp-2">{v.title}</div>
                        <div className="text-xs text-slate-400 mt-1">{v.channel}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {homeVideos.map(renderCard)}
                </div>
              )}
              {homeVideos.length === 0 && (
                <div className="text-center text-slate-500 dark:text-slate-400 py-12">
                  {t('Aucune vidéo. Ajoutez-en une !', 'No videos. Add one!', 'لا توجد فيديوهات. أضف واحداً!')}
                </div>
              )}
            </>
          )}

          {page === 'feed' && (
            <>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('Flux vertical', 'Vertical feed', 'تغذية عمودية')}</h2>
              <div className="flex flex-col items-center gap-6 max-w-sm mx-auto">
                {library.map((v) => (
                  <div key={v.id} className="w-full rounded-2xl overflow-hidden bg-black shadow-xl">
                    <div className="relative aspect-[9/16] bg-black">
                      <iframe
                        src={feedEmbedUrl(v)}
                        title={v.title}
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </div>
                    <div className="p-3 bg-slate-900 text-white">
                      <div className="text-sm font-semibold line-clamp-2">{v.title}</div>
                      <div className="text-xs text-slate-400 mt-1">{v.channel}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {page === 'liked' && (
            <>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('Vidéos aimées', 'Liked videos', 'فيديوهات مفضلة')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {likes.map((id) => videoById.get(id)).filter(Boolean).map((v) => renderCard(v as Video))}
              </div>
              {likes.length === 0 && <div className="text-slate-500 dark:text-slate-400 py-12 text-center">{t('Aucune vidéo aimée.', 'No liked videos.', 'لا توجد فيديوهات مفضلة.')}</div>}
            </>
          )}

          {page === 'later' && (
            <>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('À voir plus tard', 'Watch later', 'المشاهدة لاحقاً')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...later].reverse().map((id) => videoById.get(id)).filter(Boolean).map((v) => renderCard(v as Video))}
              </div>
              {later.length === 0 && <div className="text-slate-500 dark:text-slate-400 py-12 text-center">{t('Rien à voir plus tard.', 'Nothing saved.', 'لا شيء محفوظ.')}</div>}
            </>
          )}

          {page === 'history' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('Historique', 'History', 'السجل')}</h2>
                {seen.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSeen([])}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    {t('Tout effacer', 'Clear all', 'مسح الكل')}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...seen].reverse().map((id) => videoById.get(id)).filter(Boolean).map((v) => renderCard(v as Video))}
              </div>
              {seen.length === 0 && <div className="text-slate-500 dark:text-slate-400 py-12 text-center">{t('Aucun historique.', 'No history.', 'لا يوجد سجل.')}</div>}
            </>
          )}

          {page === 'categories' && (
            <>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('Catégories', 'Categories', 'الفئات')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {allCategories.map((c) => {
                  const count = library.filter((v) => v.categories.includes(c.id)).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => goCategory(c.id)}
                      className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">{c.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{count}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {page === 'category' && categoryId && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button type="button" onClick={() => setPage('categories')} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                  {t('Catégories', 'Categories', 'الفئات')}
                </button>
                <ChevronRight size={14} className="text-slate-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {allCategories.find((c) => c.id === categoryId)?.name || categoryId}
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered({ cat: categoryId }).map(renderCard)}
              </div>
            </>
          )}

          {page === 'search' && (
            <>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                {t('Résultats pour', 'Results for', 'نتائج لـ')} « {query} »
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered({ q: query }).map(renderCard)}
              </div>
              {filtered({ q: query }).length === 0 && (
                <div className="text-slate-500 dark:text-slate-400 py-12 text-center">{t('Aucun résultat.', 'No results.', 'لا نتائج.')}</div>
              )}
            </>
          )}

          {page === 'add' && (
            <div className="max-w-xl">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('Ajouter une vidéo', 'Add a video', 'إضافة فيديو')}</h2>
              <form onSubmit={handleAdd} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('URL ou ID YouTube', 'YouTube URL or ID', 'رابط أو معرف YouTube')}</label>
                  <input
                    value={addUrl}
                    onChange={(e) => setAddUrl(e.target.value)}
                    required
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('Titre', 'Title', 'العنوان')}</label>
                  <input
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('Chaîne', 'Channel', 'القناة')}</label>
                  <input
                    value={addChannel}
                    onChange={(e) => setAddChannel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('Catégorie', 'Category', 'الفئة')}</label>
                  <select
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    {allCategories.slice(0, 40).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('Plateforme', 'Platform', 'المنصة')}</label>
                  <select
                    value={addPlatform}
                    onChange={(e) => setAddPlatform(e.target.value as Platform)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="tiktok">TikTok</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('Tags (séparés par virgule)', 'Tags (comma separated)', 'وسوم (مفصولة بفواصل)')}</label>
                  <input
                    value={addTags}
                    onChange={(e) => setAddTags(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold">
                    {t('Ajouter', 'Add', 'إضافة')}
                  </button>
                  <button type="button" onClick={() => setPage('home')} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t('Annuler', 'Cancel', 'إلغاء')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {page === 'settings' && (
            <div className="max-w-xl space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('Paramètres', 'Settings', 'الإعدادات')}</h2>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="font-semibold text-sm text-slate-900 dark:text-white">{t('Lecture sans pub', 'Ad-free playback', 'تشغيل بدون إعلانات')}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t('Les vidéos sont lues via youtube-nocookie.com, sans cookies de pistage.', 'Videos play via youtube-nocookie.com without tracking cookies.', 'يتم تشغيل الفيديوهات عبر youtube-nocookie.com بدون ملفات تتبع.')}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="font-semibold text-sm text-slate-900 dark:text-white">{t('Bibliothèque locale', 'Local library', 'مكتبة محلية')}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {library.length} {t('vidéos enregistrées dans ce navigateur.', 'videos stored in this browser.', 'فيديو مخزن في هذا المتصفح.')}
                </p>
                <button
                  type="button"
                  onClick={() => { if (confirm(t('Réinitialiser la bibliothèque ?', 'Reset library?', 'إعادة تعيين المكتبة؟'))) { setLibrary(SEED_VIDEOS); setExtraCategories([]); setLikes([]); setDislikes([]); setSeen([]); setLater([]); } }}
                  className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                >
                  {t('Réinitialiser', 'Reset', 'إعادة تعيين')}
                </button>
              </div>
            </div>
          )}

          {page === 'watch' && selected && (
            <div className="max-w-5xl mx-auto">
              <button
                type="button"
                onClick={goHome}
                className="mb-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                ← {t('Retour', 'Back', 'رجوع')}
              </button>
              <div className={`w-full rounded-xl overflow-hidden bg-black shadow-lg ${(selected.platform || 'youtube') === 'tiktok' ? 'aspect-[9/16] max-w-sm mx-auto' : 'aspect-video'}`}>
                <iframe
                  src={watchEmbedUrl(selected)}
                  title={selected.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
              <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">{selected.title}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <div className="text-sm text-slate-600 dark:text-slate-400">{selected.channel}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLike(selected.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      likes.includes(selected.id)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <ThumbsUp size={14} /> {t('Aimer', 'Like', 'إعجاب')}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDislike(selected.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      dislikes.includes(selected.id)
                        ? 'bg-slate-700 text-white border-slate-700'
                        : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <ThumbsDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLater(selected.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      later.includes(selected.id)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Clock size={14} /> {later.includes(selected.id) ? t('Enregistré', 'Saved', 'محفوظ') : t('Plus tard', 'Later', 'لاحقاً')}
                  </button>
                  <a
                    href={(selected.platform || 'youtube') === 'tiktok' ? `https://www.tiktok.com/@/video/${selected.id}` : `https://www.youtube.com/watch?v=${selected.id}`}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Play size={14} /> {(selected.platform || 'youtube') === 'tiktok' ? 'TikTok' : 'YouTube'}
                  </a>
                </div>
              </div>
              <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                {[fmtViews(selected.views), ago(selected.published, lang), selected.contentType].filter(Boolean).join(' · ')}
              </div>
              {selected.summary && <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{selected.summary}</p>}
              {selected.why && <p className="mt-2 text-sm italic text-slate-500 dark:text-slate-400">{selected.why}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.categories.map((c) => (
                  <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    {allCategories.find((x) => x.id === c)?.name || c}
                  </span>
                ))}
                {selected.tags.map((t) => (
                  <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">#{t}</span>
                ))}
              </div>

              {/* Up next */}
              <div className="mt-6">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{t('À suivre', 'Up next', 'التالي')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {library
                    .filter((v) => v.id !== selected.id && v.categories.some((c) => selected.categories.includes(c)))
                    .slice(0, 8)
                    .map(renderCard)}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};