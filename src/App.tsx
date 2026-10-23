import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownWideNarrow, ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, Clock3, ExternalLink, Film, FolderHeart, Heart, Leaf, Library as LibraryIcon, LoaderCircle, LockKeyhole, Menu, MoreHorizontal, Music2, Play, Plus, Search, ShieldCheck, Sparkles, Sprout, Star, Trash2, Upload, X } from 'lucide-react';
import type { Collection, Library, Metadata, Source, Video } from './types';
import YouTubeStage from './StreamingPlayer';
import VideoCover from './VideoCover';
import { coverArtworkFor } from '../shared/covers.mjs';
import AccessGate from './AccessGate';

// Child streaming remains disabled until the parent accepts YouTube's player limitations.
// Keep provider navigation out of child playback, as requested by the parent.
const allowChildYouTube = false;

const collections: { name: Collection; icon: typeof Leaf; color: string; artwork: string; detail: string }[] = [
  { name: 'Nature & animals', icon: Leaf, color: 'sage', artwork: 'forest', detail: 'For the wild at heart' },
  { name: 'Curious minds', icon: Sparkles, color: 'lavender', artwork: 'space', detail: 'Big questions, little discoveries' },
  { name: 'Stories & imagination', icon: BookOpen, color: 'peach', artwork: 'stories', detail: 'A little once upon a time' },
  { name: 'Music & movement', icon: Music2, color: 'yellow', artwork: 'music', detail: 'Wiggle, giggle, sing along' },
];
const sourceNames: Record<Source, string> = { youtube: 'YouTube', netflix: 'Netflix', disney: 'Disney+', prime: 'Prime Video', max: 'HBO Max', upload: 'Vlastné video' };
const emptyLibrary: Library = { videos: [], demo: false, pinConfigured: false, parent: false };

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
  });
  const data = await response.json().catch(() => ({ error: 'The server could not complete this request.' }));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data as T;
}

function durationLabel(seconds: number | null) {
  if (!seconds) return null;
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function SourceBadge({ source }: { source: Source }) {
  return <span className={`source-badge source-${source}`}>{source === 'youtube' ? <span className="youtube-mark"><Play size={9} fill="currentColor" /></span> : source === 'netflix' ? <b className="netflix-mark">N</b> : source === 'disney' ? <span className="disney-mark">D+</span> : source === 'upload' ? <ShieldCheck size={13} /> : <Film size={13} />} {sourceNames[source]}</span>;
}

export function Modal({ children, title, onClose, wide = false, fullScreen = false }: { children: ReactNode; title: string; onClose: () => void; wide?: boolean; fullScreen?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input, button, select, textarea, a[href]')?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab' && ref.current) {
        const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, a[href], video[controls], iframe, [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && (document.activeElement === first || !ref.current.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`modal ${wide ? 'modal-wide' : ''} ${fullScreen ? 'modal-fullscreen' : ''}`}><button className="icon-button modal-close" aria-label="Zavrieť dialóg" onClick={onClose}><X size={20} /></button>{children}</div></div>;
}

export function ParentGate({ configured, onClose, onDone }: { configured: boolean; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!configured && pin !== confirm) { setError('PIN kódy sa nezhodujú. Skúste to znova.'); return; }
    setBusy(true);
    try { await api(`/api/auth/${configured ? 'login' : 'setup'}`, { method: 'POST', body: JSON.stringify({ pin }) }); onDone(); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  const content = <Modal title={configured ? 'Rodičovský režim' : 'Nastaviť rodinnú knižnicu'} onClose={onClose}>
    <div className="modal-emblem"><LockKeyhole size={25} /></div>
    <span className="eyebrow">PRE RODIČOV</span>
    <h2>{configured ? 'Rodičovský režim' : 'Vytvorte svoju knižnicu'}</h2>
    <p className="modal-description">{configured ? 'Zadajte rodičovský PIN na pridávanie a úpravu videí.' : 'Nastavte rodičovský PIN. Ukážkové videá nahradí vaša vlastná knižnica.'}</p>
    <form onSubmit={submit} className="form-stack">
      <label>Rodičovský PIN <input autoComplete={configured ? 'current-password' : 'new-password'} type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} required placeholder="6–12 číslic" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} /></label>
      {!configured && <label>Potvrďte PIN<input type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} required autoComplete="new-password" placeholder="Zadajte PIN znova" value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))} /></label>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="button button-primary button-full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <LockKeyhole size={16} />}{configured ? 'Odomknúť rodičovský režim' : 'Vytvoriť knižnicu'}</button>
    </form>
    <p className="fine-print">{configured ? 'Po dokončení prepnite späť do detského režimu.' : 'PIN si bezpečne uložte. Obnovu môžete nastaviť v Render.'}</p>
  </Modal>;
  return configured ? content : <div className="first-parent-setup"><button type="button" className="button button-soft first-parent-setup-back" onClick={onClose}><ArrowLeft size={16} /> Späť do knižnice</button><AccessGate>{content}</AccessGate></div>;
}

function VideoEditor({ video, onClose, onSaved }: { video?: Video; onClose: () => void; onSaved: () => void }) {
  const [tab, setTab] = useState<'upload' | 'link'>(video && video.source !== 'upload' ? 'link' : 'upload');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState(video?.source === 'upload' ? '' : video?.url || '');
  const [title, setTitle] = useState(video?.title || '');
  const [description, setDescription] = useState(video?.description || '');
  const [creator, setCreator] = useState(video?.creator || '');
  const [duration, setDuration] = useState(video?.duration ? String(Math.round(video.duration / 6) / 10) : '');
  const [age, setAge] = useState(video?.age || 'All ages');
  const [collection, setCollection] = useState<Collection>(video?.collection || 'Nature & animals');
  const [tags, setTags] = useState(video?.tags.join(', ') || '');
  const [thumbnail, setThumbnail] = useState(video?.thumbnail || '');
  const [artwork, setArtwork] = useState(video?.artwork || 'forest');
  const [approved, setApproved] = useState(video?.approved ?? true);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploaded, setUploaded] = useState<Video | null>(null);

  function chooseFile(chosen?: File) {
    if (!chosen) return;
    if (chosen.size > 200 * 1024 * 1024) { setError('Choose a file smaller than 200 MB.'); return; }
    setError(''); setFile(chosen);
    if (!title) setTitle(chosen.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '));
    const objectUrl = URL.createObjectURL(chosen);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => { if (Number.isFinite(probe.duration)) setDuration(String(Math.round(probe.duration / 6) / 10)); URL.revokeObjectURL(objectUrl); };
    probe.onerror = () => URL.revokeObjectURL(objectUrl);
    probe.src = objectUrl;
  }
  async function lookup() {
    if (!url.trim()) return;
    setLooking(true); setError(''); setNotice('');
    try {
      const result = await api<Metadata>('/api/metadata', { method: 'POST', body: JSON.stringify({ url: url.trim() }) });
      setMetadata(result);
      if (result.title) setTitle(result.title);
      if (result.description) setDescription(result.description);
      if (result.creator) setCreator(result.creator);
      if (result.thumbnail) setThumbnail(result.thumbnail);
      if (result.duration) setDuration(String(Math.round(result.duration / 6) / 10));
      setNotice(result.warning || 'Details found. Give them a quick check before saving.');
    } catch (error) { setError((error as Error).message); }
    finally { setLooking(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const fields = { title: title.trim(), description: description.trim(), creator: creator.trim(), duration: duration ? Math.round(Number(duration) * 60) : null, age, collection, tags: tags.split(',').map(x => x.trim()).filter(Boolean), thumbnail, artwork, approved };
      if (video) {
        await api(`/api/videos/${video.id}`, { method: 'PATCH', body: JSON.stringify({ ...fields, ...(tab === 'link' ? { url: url.trim() } : {}) }) });
      } else if (tab === 'upload') {
        let saved = uploaded;
        if (!saved) {
          if (!file) throw new Error('Choose a video file first.');
          const form = new FormData(); form.append('file', file);
          const result = await api<{ video: Video }>('/api/uploads', { method: 'POST', body: form });
          saved = result.video; setUploaded(saved);
        }
        await api(`/api/videos/${saved.id}`, { method: 'PATCH', body: JSON.stringify(fields) });
      } else {
        await api('/api/videos', { method: 'POST', body: JSON.stringify({ ...fields, url: url.trim(), source: metadata?.source, favorite: false }) });
      }
      onSaved();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <Modal title={video ? 'Edit video' : 'Pridať video'} onClose={() => { if (!busy) onClose(); }} wide>
    <span className="eyebrow">VAŠE VYBRANÉ VIDEÁ</span>
    <h2>{video ? 'Upraviť video' : 'Pridať video'}</h2>
    <p className="modal-description">Vyberte video, ktoré chcete zaradiť do detskej knižnice.</p>
    {!video && <div className="editor-tabs"><button className={tab === 'upload' ? 'selected' : ''} onClick={() => { setTab('upload'); setError(''); }}><Upload size={16} /> Nahrať video</button><button className={tab === 'link' ? 'selected' : ''} onClick={() => { setTab('link'); setError(''); }}><FolderHeart size={16} /> Pridať odkaz</button></div>}
    <form className="form-stack" onSubmit={submit}>
      {tab === 'upload' && !video && <label className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); chooseFile(e.dataTransfer.files[0]); }}><Upload size={26} /><strong>{file ? file.name : 'A little drag, a little drop.'}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · Click to choose a different video` : 'Choose a video · MP4 or WebM · Up to 200 MB'}</span><input type="file" aria-label="Choose video file" accept="video/mp4,video/webm,.mp4,.webm" onChange={e => chooseFile(e.target.files?.[0])} disabled={!!uploaded || busy} /></label>}
      {tab === 'link' && <><div className="info-note"><LockKeyhole size={17} /><span>Uložte video do knižnice. YouTube má prehrávač v Nest; prehrávanie platených služieb tu zatiaľ nie je dostupné.</span></div><label>Odkaz na video<div className="input-action"><input type="url" required placeholder="Paste a link from one of the five supported services" value={url} onChange={e => { setUrl(e.target.value); setMetadata(null); }} /><button type="button" className="button button-soft" disabled={looking || !url} onClick={lookup}>{looking ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />} Načítať údaje</button></div></label>{notice && <p className="lookup-note" role="status">{notice}</p>}</>}
      <label>Názov<input required maxLength={200} value={title} placeholder="Zadajte názov videa" onChange={e => setTitle(e.target.value)} /></label>
      <div className="form-two"><label>Collection<select value={collection} onChange={e => setCollection(e.target.value as Collection)}>{collections.map(c => <option key={c.name}>{c.name}</option>)}</select></label><label>Made by<input value={creator} maxLength={150} placeholder="Creator or studio" onChange={e => setCreator(e.target.value)} /></label></div>
      <div className="form-two"><label>Trvanie (minúty)<input type="number" required={approved} min="0.02" max="1440" step="any" value={duration} placeholder="Doplňte skutočné trvanie" onChange={e => setDuration(e.target.value)} /></label><label>Age guide<select value={age} onChange={e => setAge(e.target.value)}>{['All ages', 'Ages 2–4', 'Ages 4–6', 'Ages 6–9', 'Ages 9+'].map(x => <option key={x}>{x}</option>)}</select></label></div>
      <label>A little about it<textarea rows={3} maxLength={2000} value={description} placeholder="What will they discover?" onChange={e => setDescription(e.target.value)} /></label>
      <label>Tags <span className="optional">separate with commas</span><input maxLength={500} value={tags} placeholder="Space, animals, bedtime…" onChange={e => setTags(e.target.value)} /></label>
      <fieldset className="artwork-field"><legend>Pick a cover</legend><div className="artwork-choices">{['forest', 'ocean', 'space', 'bears', 'butterfly', 'music', 'stories', 'earth'].map(name => <button type="button" key={name} title={name} aria-label={`${name} cover`} aria-pressed={artwork === name && !thumbnail} className={artwork === name && !thumbnail ? 'chosen' : ''} onClick={() => { setArtwork(name); setThumbnail(''); }}><img src={`/artwork/${name}.svg`} alt="" />{artwork === name && !thumbnail && <Check size={15} />}</button>)}</div></fieldset>
      {<label className="approval-option"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} /><span><strong>Zobraziť v detskej knižnici</strong><small>Vypnite, ak chcete video uložiť iba ako rodičovský návrh.</small></span><ShieldCheck size={21} /></label>}
      {error && <div role="alert" className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="button button-plain" disabled={busy} onClick={onClose}>Zrušiť</button><button className="button button-primary" disabled={busy || (!video && tab === 'upload' && !file)}>{busy ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}{busy ? 'Ukladám video…' : video ? 'Uložiť zmeny' : approved ? 'Pridať do knižnice' : 'Uložiť návrh'}</button></div>
      {tab === 'upload' && <p className="fine-print">Upload videos you own or have permission to share. Uploaded files play here, without a feed or links to other services.</p>}
    </form>
  </Modal>;
}

function VideoPlayer({ video, demo, parent, onClose, onParent }: { video: Video; demo: boolean; parent: boolean; onClose: () => void; onParent: () => void }) {
  const [error, setError] = useState(false);
  const youtube = video.source === 'youtube' && (parent || allowChildYouTube) && !demo;
  const upload = video.source === 'upload' && Boolean(video.mediaUrl);
  return <Modal title={video.title} onClose={onClose} wide fullScreen={youtube || upload}>
    <div className={`player-stage ${youtube ? 'player-stage-youtube' : ''}`}>{youtube ? <YouTubeStage url={video.url} title={video.title} parentPreview={parent} /> : upload ? <video controls autoPlay playsInline controlsList="nodownload noremoteplayback" disablePictureInPicture src={video.mediaUrl} onError={() => setError(true)} aria-label={video.title} /> : <><VideoCover artwork={coverArtworkFor(video)} title={video.title} description={video.description} alt="" /><div className="player-message"><span className="player-lock"><LockKeyhole size={27} /></span><h3>{demo ? 'Ukážka vašej knižnice' : video.source === 'youtube' ? 'Prehrávanie vyžaduje rodiča' : 'Prehrávanie zatiaľ nie je dostupné'}</h3><p>{demo ? 'Rodič môže do knižnice pridať vlastné videá a vybrané odkazy.' : video.source === 'youtube' ? 'Prehrávač YouTube umožňuje prístup aj k ďalšiemu obsahu. Pre zachovanie vášho prísneho obmedzenia ho môže otvoriť iba rodič.' : 'Prehrávanie tejto služby v Nest zatiaľ nie je dostupné. Zostávate v knižnici.'}</p>{(demo || (video.source === 'youtube' && !parent)) && <button className="button button-primary" onClick={onParent}><LockKeyhole size={16} /> Rodičovský režim</button>}</div></>}</div>
    {error && <div className="form-error" role="alert">Video sa nepodarilo prehrať. Skúste súbor MP4 s videom H.264 a zvukom AAC alebo WebM.</div>}
    <div className="player-details"><SourceBadge source={video.source} /><h2>{video.title}</h2><div className="detail-meta">{video.creator && <span>{video.creator}</span>}{durationLabel(video.duration) && <span><Clock3 size={13} />{durationLabel(video.duration)}</span>}<span>{video.age}</span></div><p>{video.description}</p><div className="tag-row">{video.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
  </Modal>;
}

export default function App() {
  const [library, setLibrary] = useState<Library>(emptyLibrary);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState<'library' | 'favorites' | 'collections'>('library');
  const [collection, setCollection] = useState<Collection | 'all'>('all');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [length, setLength] = useState('all');
  const [sort, setSort] = useState('newest');
  const [favorites, setFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('nest-favorites') || '[]'); } catch { return []; } });
  const [gate, setGate] = useState(false);
  const [editor, setEditor] = useState<Video | 'new' | null>(null);
  const [playing, setPlaying] = useState<Video | null>(null);
  const [deleting, setDeleting] = useState<Video | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState('');
  const [info, setInfo] = useState(false);
  const refreshVersion = useRef(0);
  const coverRefreshAttempted = useRef(false);
  const wantsParentOnEntry = useRef(new URLSearchParams(window.location.search).get('parent') === '1');
  const initialSession = useRef<Promise<unknown> | null>(null);
  async function refresh() {
    const version = ++refreshVersion.current;
    setLoadError('');
    try {
      const current = await api<Library>('/api/library');
      if (version !== refreshVersion.current) return;
      setLibrary(current);
      if (current.parent && !current.demo && !coverRefreshAttempted.current && current.videos.some(video => video.source !== 'upload' && (!video.thumbnail || video.duration == null))) {
        coverRefreshAttempted.current = true;
        // Optional enrichment runs once per visit; the illustrated cover remains visible.
        void api<{ updated: number }>('/api/library/thumbnails', { method: 'POST' }).then(async result => {
          if (!result.updated || version !== refreshVersion.current) return;
          const refreshed = await api<Library>('/api/library');
          if (version === refreshVersion.current) setLibrary(refreshed);
        }).catch(() => { /* Public images can be unavailable; covers still render locally. */ });
      }
      return current;
    } catch (error) { if (version === refreshVersion.current) setLoadError((error as Error).message); }
    finally { if (version === refreshVersion.current) setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    // The ordinary home address always starts in child view, even after parent use.
    initialSession.current ??= wantsParentOnEntry.current ? Promise.resolve() : api('/api/auth/logout', { method: 'POST' });
    void initialSession.current.then(async () => {
      if (!active) return;
      const current = await refresh();
      if (active && wantsParentOnEntry.current && current && !current.parent) setGate(true);
    }).catch(error => { if (active) { setLoadError((error as Error).message); setLoading(false); } });
    return () => { active = false; refreshVersion.current += 1; };
  }, []);
  useEffect(() => { try { localStorage.setItem('nest-favorites', JSON.stringify(favorites)); } catch { /* Browser storage is optional. */ } }, [favorites]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); } }, [toast]);
  function toggleFavorite(id: string) { setFavorites(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]); }
  function navigate(next: typeof page, nextCollection: typeof collection = 'all') { setPage(next); setCollection(nextCollection); setSearch(''); setSource('all'); setLength('all'); setMobileNav(false); }
  async function exitParent() {
    try { await api('/api/auth/logout', { method: 'POST' }); window.history.replaceState(null, '', '/'); setPlaying(null); setEditor(null); await refresh(); setSource('all'); setToast('Detský režim je zapnutý.'); }
    catch (error) { setToast((error as Error).message); }
  }
  async function remove() {
    if (!deleting) return;
    setDeleteBusy(true);
    try { await api(`/api/videos/${deleting.id}`, { method: 'DELETE' }); setDeleting(null); await refresh(); setToast('Video removed from your Nest.'); }
    catch (error) { setToast((error as Error).message); }
    finally { setDeleteBusy(false); }
  }
  const videos = library.videos.filter(v => {
    const query = search.toLocaleLowerCase();
    return (collection === 'all' || v.collection === collection) && (page !== 'favorites' || favorites.includes(v.id)) && (source === 'all' || v.source === source) && (length === 'all' || (v.duration != null && (length === 'short' ? v.duration < 600 : length === 'medium' ? v.duration >= 600 && v.duration <= 1800 : v.duration > 1800))) && (!query || [v.title, v.creator, v.description, v.collection, ...v.tags].join(' ').toLocaleLowerCase().includes(query));
  }).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'duration' ? (a.duration ?? Infinity) - (b.duration ?? Infinity) : b.createdAt.localeCompare(a.createdAt));
  const pageTitle = page === 'favorites' ? 'Obľúbené videá' : collection !== 'all' ? collection : 'Vaša knižnica';
  const filtered = collection !== 'all' || search || source !== 'all' || length !== 'all';

  return <div className="app-shell">
    {mobileNav && <div className="nav-scrim" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => navigate('library')} aria-label="Nest home"><img src="/nest.svg" alt="" /><span>nest<span className="brand-dot">.</span></span></button>
      <span className="brand-tagline">Vaša rodinná knižnica</span>
      <div className="family-space"><div className="family-icon"><Sprout size={22} /></div><div><strong>Rodinná knižnica</strong><span>{library.demo ? 'Ukážková knižnica' : 'Vybrané pre vašu rodinu'}</span></div><Heart size={13} /></div>
      <span className="nav-label">VAŠE VIDEÁ</span>
      <nav aria-label="Main navigation" className="main-nav">
        <button className={page === 'library' && collection === 'all' ? 'active' : ''} onClick={() => navigate('library')}><LibraryIcon size={19} /> Všetky videá <span className="nav-count">{library.videos.length}</span></button>
        <button className={page === 'favorites' ? 'active' : ''} onClick={() => navigate('favorites')}><Heart size={19} /> Obľúbené <span className="nav-count">{library.videos.filter(v => favorites.includes(v.id)).length}</span></button>
        <button className={page === 'collections' ? 'active' : ''} onClick={() => navigate('collections')}><FolderHeart size={19} /> Kolekcie <span className="nav-count">4</span></button>
      </nav>
      <div className="nav-section-heading"><span className="nav-label">KOLEKCIE</span><span>4</span></div>
      <nav aria-label="Video collections" className="collection-nav">{collections.map(({ name, icon: Icon, color }) => <button key={name} className={collection === name ? 'active' : ''} onClick={() => navigate('library', name)}><span className={`collection-dot ${color}`}><Icon size={14} /></span>{name}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-doodle"><Leaf size={25} strokeWidth={1.5} /><Sparkles size={15} /></span><strong>Menej hľadania.<br />Viac príbehov.</strong><p>Miesto pre videá,<br />ktoré vyberiete vy.</p></div><button className={`parent-nav ${library.parent ? 'parent-active' : ''}`} onClick={() => library.parent ? void exitParent() : setGate(true)}>{library.parent ? <ShieldCheck size={18} /> : <LockKeyhole size={18} />}<span>{library.parent ? 'Detský režim' : 'Rodičovský režim'}</span><ArrowRight size={15} /></button><div className="sidebar-footnote"><span className="status-dot" /> Vybrané rodičom.</div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar nest-mode-header"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Otvoriť navigáciu" onClick={() => setMobileNav(true)}><Menu size={22} /></button><span className="breadcrumb">{library.parent ? 'Rodičovský režim' : 'Detská knižnica'}</span></div><div className="topbar-right">{library.parent && <a className="button button-soft" href="/discover"><Sparkles size={15} /> Vyhľadať videá</a>}<button className="button button-primary nest-mode-toggle" disabled={loading} onClick={() => library.parent ? void exitParent() : setGate(true)}>{library.parent ? <Sprout size={15} /> : <LockKeyhole size={15} />}{library.parent ? 'Detský režim' : 'Rodičovský režim'}</button></div></header>
      <main>
        {library.demo && !loading && <div className="sample-banner"><span><Sparkles size={15} /><strong>Ukážka knižnice.</strong> Rodič môže pridať vlastné videá.</span><button onClick={() => setGate(true)}>Nastaviť knižnicu <ArrowRight size={14} /></button></div>}
        <section className="hero"><div className="hero-content"><span className="hero-eyebrow"><span /> JEDNA KNIŽNICA PRE VAŠU RODINU</span><h1>{library.parent ? <>Videá, ktoré<br />vyberáte vy<span>.</span></> : <>Vitajte vo<br />vašej knižnici<span>.</span></>}</h1><p>{library.parent ? 'Vyhľadajte videá, pridajte ich do knižnice a vyberte, čo sa zobrazí deťom.' : 'Vaše obľúbené videá na jednom mieste. Vyberte si, čo chcete pozerať.'}</p><div className="hero-bottom"><span className="hero-heart"><Heart size={14} /></span>{library.demo ? 'Pridajte svoje prvé video' : 'Obľúbené príbehy na jednom mieste'}</div>{library.parent && <button className="button button-primary hero-add" onClick={() => setEditor('new')}><Plus size={16} /> Pridať video</button>}</div><img className="hero-illustration" src="/artwork/hero.svg" alt="A peaceful illustrated landscape with a bear, a rabbit, and rolling green hills" /><span className="hero-stamp"><ShieldCheck size={15} />{library.demo ? 'Ukážková knižnica' : 'Vybrané rodičom'}</span></section>

        {page === 'collections' ? <section className="library-section"><div className="section-heading"><div><span className="eyebrow">A PLACE FOR EVERY LITTLE INTEREST</span><h2>Wonder, neatly gathered.</h2><p>Follow their curiosity. See where it takes them.</p></div></div><div className="collection-grid">{collections.map(({ name, artwork, icon: Icon, color, detail }) => <button className="collection-card" key={name} onClick={() => navigate('library', name)}><img src={`/artwork/${artwork}.svg`} alt="" /><div><span className={`collection-dot ${color}`}><Icon size={18} /></span><h3>{name}</h3><p>{detail}</p><span className="collection-count">{library.videos.filter(v => v.collection === name).length} videos <ArrowRight size={16} /></span></div></button>)}</div></section> : <section className="library-section">
          <div className="section-heading"><div><h2>{pageTitle}</h2><p>{page === 'favorites' ? 'Obľúbené videá na jednom mieste.' : collection !== 'all' ? collections.find(c => c.name === collection)?.detail : 'Videá vybrané pre vašu rodinu.'}</p></div>{library.parent ? <button className="button button-primary" onClick={() => setEditor('new')}><Plus size={17} /> Pridať video</button> : <span className="curated-label"><ShieldCheck size={15} />{library.demo ? 'Ukážková knižnica' : 'Vybrané rodičom'}</span>}</div>
          <div className="library-toolbar"><label className="search-field"><Search size={18} /><input type="search" aria-label="Search videos" placeholder="Vyhľadať v knižnici…" value={search} onChange={e => setSearch(e.target.value)} /><kbd>⌕</kbd></label><div className="select-wrapper"><Clock3 size={15} /><select aria-label="Filter by duration" value={length} onChange={e => setLength(e.target.value)}><option value="all">Každá dĺžka</option><option value="short">Do 10 minút</option><option value="medium">10–30 minutes</option><option value="long">Nad 30 minút</option></select><ChevronDown size={13} /></div><div className="select-wrapper"><Film size={15} /><select aria-label="Filter by source" value={source} onChange={e => setSource(e.target.value)}><option value="all">Všetky služby</option>{(['upload', 'youtube', 'netflix', 'disney', 'prime', 'max']).map(s => <option value={s} key={s}>{sourceNames[s as Source]}</option>)}</select><ChevronDown size={13} /></div></div>
          <div className="category-row"><div className="category-pills"><button className={collection === 'all' ? 'selected' : ''} onClick={() => setCollection('all')}>Všetky videá</button>{collections.map(({ name, icon: Icon }) => <button key={name} className={collection === name ? 'selected' : ''} onClick={() => setCollection(name)}><Icon size={13} />{name}</button>)}</div></div>
          <div className="results-row"><span>{videos.length} {videos.length === 1 ? 'video' : 'videos'}{filtered ? ' found' : ' to discover'}{library.parent && ' · Vrátane rodičovských návrhov'}</span><label className="sort-control"><ArrowDownWideNarrow size={14} /><select aria-label="Sort videos" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Najnovšie</option><option value="title">Podľa názvu</option><option value="duration">Najkratšie</option></select><ChevronDown size={12} /></label></div>
          {loading ? <div className="state-panel"><LoaderCircle className="spin" size={28} /><h3>Načítavam knižnicu…</h3></div> : loadError ? <div className="state-panel"><h3>Knižnicu sa nepodarilo načítať.</h3><p>{loadError}</p><button className="button button-primary" onClick={() => { setLoading(true); void refresh(); }}>Skúsiť znova</button></div> : videos.length === 0 ? <div className="state-panel empty-state"><span className="empty-icon">{page === 'favorites' ? <Heart size={30} /> : <Sprout size={32} />}</span><h3>{filtered ? 'Žiadne videá nevyhovujú filtrom.' : page === 'favorites' ? 'Make room for your favorites.' : 'Knižnica je zatiaľ prázdna.'}</h3><p>{filtered ? 'Skúste iné hľadanie alebo zrušte filtre.' : page === 'favorites' ? 'Tap the heart on a video to keep it close. Favorites are saved on this device.' : library.parent ? 'Nahrajte video alebo ho pridajte cez vyhľadávanie.' : 'Rodič môže pridať videá v rodičovskom režime.'}</p>{filtered ? <button className="button button-soft" onClick={() => { setCollection('all'); setSearch(''); setSource('all'); setLength('all'); }}>Zrušiť filtre</button> : <button className="button button-primary" onClick={() => library.parent ? setEditor('new') : page === 'favorites' ? navigate('library') : setGate(true)}>{library.parent ? <><Plus size={16} /> Pridať prvé video</> : page === 'favorites' ? 'Otvoriť knižnicu' : <><LockKeyhole size={15} /> Rodičovský režim</>}</button>}</div> : <div className="video-grid">{videos.map(video => <article className="video-card" key={video.id}>
            <div className="card-cover"><button className="card-play" aria-label={video.source === 'upload' || (video.source === 'youtube' && (library.parent || allowChildYouTube) && !library.demo) ? `Prehrať ${video.title}` : `Zobraziť ${video.title}`} onClick={() => setPlaying(video)}><VideoCover thumbnail={video.thumbnail} artwork={video.thumbnail ? video.artwork : coverArtworkFor(video)} title={video.title} description={video.description} alt="" loading="lazy" /><span className="play-overlay">{video.source === 'upload' || (video.source === 'youtube' && (library.parent || allowChildYouTube) && !library.demo) ? <Play size={23} fill="currentColor" /> : <BookOpen size={23} />}</span></button><button className={`favorite-button ${favorites.includes(video.id) ? 'is-favorite' : ''}`} aria-label={`${favorites.includes(video.id) ? 'Remove' : 'Add'} ${video.title} ${favorites.includes(video.id) ? 'from' : 'to'} favorites`} aria-pressed={favorites.includes(video.id)} onClick={() => toggleFavorite(video.id)}><Heart size={16} fill={favorites.includes(video.id) ? 'currentColor' : 'none'} /></button><span className="duration-badge"><Clock3 size={11} />{durationLabel(video.duration) || "Trvanie nezistené"}</span>{library.parent && <span className={`availability-badge ${video.source === 'upload' && video.approved ? 'available' : ''}`}>{video.approved ? 'V detskej knižnici' : 'Návrh'}</span>}</div>
            <div className="card-body"><div className="card-source-row"><SourceBadge source={video.source} /><span>{video.age}</span></div><button className="card-title" onClick={() => setPlaying(video)}>{video.title}</button><p className="card-creator">{video.creator || 'Vybrané pre rodinu'}</p>{!library.parent && video.source !== 'upload' && <p className="card-access-note"><LockKeyhole size={12} />{video.source === 'youtube' ? 'Prehrávač iba pre rodiča' : 'Prehrávanie zatiaľ nepripojené'}</p>}<div className="card-bottom"><span className={`card-category ${collections.find(c => c.name === video.collection)?.color || 'sage'}`}><span />{video.collection}</span>{library.parent ? <div className="card-manage"><button className="icon-button" aria-label={`Edit ${video.title}`} onClick={() => setEditor(video)}><MoreHorizontal size={18} /></button><button className="icon-button" aria-label={`Remove ${video.title}`} onClick={() => setDeleting(video)}><Trash2 size={14} /></button></div> : <span className="card-flower">✳</span>}</div></div>
          </article>)}</div>}
        </section>}
        <div className="bottom-note"><div className="bottom-note-icon"><ShieldCheck size={22} /></div><div><strong>Videá vybrané pre vašu rodinu.</strong><p>{library.demo ? 'Rodič môže pridať videá do spoločnej rodinnej knižnice.' : 'V detskej knižnici sú videá schválené rodičom. Dostupnosť prehrávania závisí od služby.'}</p></div><button className="text-button" onClick={() => setInfo(true)}>O knižnici <ArrowRight size={14} /></button></div>
        <footer className="page-footer"><span><img src="/nest.svg" alt="" /> Vybrané rodičom.</span><span>Spolu v Nest.</span></footer>
      </main>
    </div>
    {gate && <ParentGate configured={library.pinConfigured} onClose={() => setGate(false)} onDone={() => { window.history.replaceState(null, '', '/?parent=1'); setGate(false); void refresh(); setToast('Rodičovský režim je odomknutý.'); }} />}
    {editor && <VideoEditor video={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); void refresh(); setToast('Video je uložené v knižnici.'); }} />}
    {playing && <VideoPlayer video={playing} demo={library.demo} parent={library.parent} onClose={() => setPlaying(null)} onParent={() => { setPlaying(null); setGate(true); }} />}
    {deleting && <Modal title="Remove this video?" onClose={() => { if (!deleteBusy) setDeleting(null); }}><div className="modal-emblem peach"><Trash2 size={23} /></div><h2>A little room for something new?</h2><p className="modal-description">Remove “{deleting.title}” from your family’s library? Uploaded files will also be deleted. This can’t be undone.</p><div className="modal-actions"><button className="button button-plain" disabled={deleteBusy} onClick={() => setDeleting(null)}>Keep it</button><button className="button button-danger" disabled={deleteBusy} onClick={() => void remove()}>{deleteBusy ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />} Remove video</button></div></Modal>}
    {info && <Modal title="About your Nest" onClose={() => setInfo(false)}><div className="modal-emblem"><Sprout size={27} /></div><span className="eyebrow">A LITTLE MORE INTENTIONAL</span><h2>A space you shape.</h2><p className="modal-description">Nest is one shared library for your family, ready for a phone, tablet, or a bigger screen.</p><div className="about-features"><div><ShieldCheck size={21} /><p><strong>Only what you choose</strong>V detskej knižnici sa zobrazujú videá schválené rodičom. Vlastné súbory sa prehrávajú priamo v Nest.</p></div><div><FolderHeart size={21} /><p><strong>A home for good finds</strong>Pridávajte videá z YouTube a platených služieb. YouTube má prehrávač v Nest; prehrávanie ostatných služieb zatiaľ nie je dostupné.</p></div><div><LockKeyhole size={21} /><p><strong>Rodičovský režim stays yours</strong>A PIN protects library changes. This is an MVP for a trusted household network; browser and device restrictions are separate.</p></div></div><button className="button button-primary button-full" onClick={() => setInfo(false)}>That sounds lovely <Check size={16} /></button></Modal>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={19} /><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>;
}
