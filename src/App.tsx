import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownWideNarrow, ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, Clock3, ExternalLink, Film, FolderHeart, Heart, Leaf, Library as LibraryIcon, LoaderCircle, LockKeyhole, Menu, MoreHorizontal, Music2, Play, Plus, Search, ShieldCheck, Sparkles, Sprout, Star, Trash2, Upload, X } from 'lucide-react';
import type { Collection, Library, Metadata, Source, Video } from './types';

const collections: { name: Collection; icon: typeof Leaf; color: string; artwork: string; detail: string }[] = [
  { name: 'Nature & animals', icon: Leaf, color: 'sage', artwork: 'forest', detail: 'For the wild at heart' },
  { name: 'Curious minds', icon: Sparkles, color: 'lavender', artwork: 'space', detail: 'Big questions, little discoveries' },
  { name: 'Stories & imagination', icon: BookOpen, color: 'peach', artwork: 'stories', detail: 'A little once upon a time' },
  { name: 'Music & movement', icon: Music2, color: 'yellow', artwork: 'music', detail: 'Wiggle, giggle, sing along' },
];
const sourceNames: Record<Source, string> = { youtube: 'YouTube', netflix: 'Netflix', disney: 'Disney+', prime: 'Prime Video', max: 'HBO Max', upload: 'In your Nest' };
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

function Modal({ children, title, onClose, wide = false }: { children: ReactNode; title: string; onClose: () => void; wide?: boolean }) {
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
        const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, a[href], video[controls], [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && (document.activeElement === first || !ref.current.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`modal ${wide ? 'modal-wide' : ''}`}><button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>{children}</div></div>;
}

export function ParentGate({ configured, onClose, onDone }: { configured: boolean; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!configured && pin !== confirm) { setError('The PINs don’t match. Please try again.'); return; }
    setBusy(true);
    try { await api(`/api/auth/${configured ? 'login' : 'setup'}`, { method: 'POST', body: JSON.stringify({ pin }) }); onDone(); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <Modal title={configured ? 'Enter parent space' : 'Create your family library'} onClose={onClose}>
    <div className="modal-emblem"><LockKeyhole size={25} /></div>
    <span className="eyebrow">JUST FOR THE GROWN-UPS</span>
    <h2>{configured ? 'Welcome back.' : 'Make room for wonder.'}</h2>
    <p className="modal-description">{configured ? 'Enter your parent PIN to add videos and care for your family’s collection.' : 'Set a parent PIN to start your own library. The sample collection will be replaced with a fresh, empty space.'}</p>
    <form onSubmit={submit} className="form-stack">
      <label>Parent PIN <input autoComplete={configured ? 'current-password' : 'new-password'} type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} required placeholder="6–12 digits" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} /></label>
      {!configured && <label>Confirm PIN<input type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} required autoComplete="new-password" placeholder="One more time" value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))} /></label>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="button button-primary button-full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <LockKeyhole size={16} />}{configured ? 'Enter parent space' : 'Create our library'}</button>
    </form>
    <p className="fine-print">{configured ? 'Finished curating? Switch back to child view to lock parent controls.' : 'Keep your PIN somewhere safe. This first version has no email-based PIN recovery.'}</p>
  </Modal>;
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
      const fields = { title: title.trim(), description: description.trim(), creator: creator.trim(), duration: duration ? Math.round(Number(duration) * 60) : null, age, collection, tags: tags.split(',').map(x => x.trim()).filter(Boolean), thumbnail, artwork, approved: tab === 'upload' && approved };
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
  return <Modal title={video ? 'Edit video' : 'Add a video'} onClose={() => { if (!busy) onClose(); }} wide>
    <span className="eyebrow">A GOOD FIND DESERVES A HOME</span>
    <h2>{video ? 'A few little details.' : 'Add a little wonder.'}</h2>
    <p className="modal-description">Choose something they’ll love. You decide what belongs.</p>
    {!video && <div className="editor-tabs"><button className={tab === 'upload' ? 'selected' : ''} onClick={() => { setTab('upload'); setError(''); }}><Upload size={16} /> Upload a video</button><button className={tab === 'link' ? 'selected' : ''} onClick={() => { setTab('link'); setError(''); }}><FolderHeart size={16} /> Save a service link</button></div>}
    <form className="form-stack" onSubmit={submit}>
      {tab === 'upload' && !video && <label className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); chooseFile(e.dataTransfer.files[0]); }}><Upload size={26} /><strong>{file ? file.name : 'A little drag, a little drop.'}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · Click to choose a different video` : 'Choose a video · MP4 or WebM · Up to 200 MB'}</span><input type="file" aria-label="Choose video file" accept="video/mp4,video/webm,.mp4,.webm" onChange={e => chooseFile(e.target.files?.[0])} disabled={!!uploaded || busy} /></label>}
      {tab === 'link' && <><div className="info-note"><LockKeyhole size={17} /><span>Service links stay in parent space. They can’t be played in the child library because those services allow navigation to other content.</span></div><label>Video link<div className="input-action"><input type="url" required placeholder="Paste a link from one of the five supported services" value={url} onChange={e => { setUrl(e.target.value); setMetadata(null); }} /><button type="button" className="button button-soft" disabled={looking || !url} onClick={lookup}>{looking ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />} Find details</button></div></label>{notice && <p className="lookup-note" role="status">{notice}</p>}</>}
      <label>Title<input required maxLength={200} value={title} placeholder="Give this little discovery a name" onChange={e => setTitle(e.target.value)} /></label>
      <div className="form-two"><label>Collection<select value={collection} onChange={e => setCollection(e.target.value as Collection)}>{collections.map(c => <option key={c.name}>{c.name}</option>)}</select></label><label>Made by<input value={creator} maxLength={150} placeholder="Creator or studio" onChange={e => setCreator(e.target.value)} /></label></div>
      <div className="form-two"><label>Duration in minutes<input type="number" min="0.02" max="1440" step="any" value={duration} placeholder="Optional" onChange={e => setDuration(e.target.value)} /></label><label>Age guide<select value={age} onChange={e => setAge(e.target.value)}>{['All ages', 'Ages 2–4', 'Ages 4–6', 'Ages 6–9', 'Ages 9+'].map(x => <option key={x}>{x}</option>)}</select></label></div>
      <label>A little about it<textarea rows={3} maxLength={2000} value={description} placeholder="What will they discover?" onChange={e => setDescription(e.target.value)} /></label>
      <label>Tags <span className="optional">separate with commas</span><input maxLength={500} value={tags} placeholder="Space, animals, bedtime…" onChange={e => setTags(e.target.value)} /></label>
      <fieldset className="artwork-field"><legend>Pick a cover</legend><div className="artwork-choices">{['forest', 'ocean', 'space', 'bears', 'butterfly', 'music', 'stories', 'earth'].map(name => <button type="button" key={name} title={name} aria-label={`${name} cover`} aria-pressed={artwork === name && !thumbnail} className={artwork === name && !thumbnail ? 'chosen' : ''} onClick={() => { setArtwork(name); setThumbnail(''); }}><img src={`/artwork/${name}.svg`} alt="" />{artwork === name && !thumbnail && <Check size={15} />}</button>)}</div></fieldset>
      {tab === 'upload' && <label className="approval-option"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} /><span><strong>Ready for little eyes</strong><small>Show this video in the child library. Uncheck to save a parent-only draft.</small></span><ShieldCheck size={21} /></label>}
      {error && <div role="alert" className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="button button-plain" disabled={busy} onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy || (!video && tab === 'upload' && !file)}>{busy ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}{busy ? 'Saving your discovery…' : video ? 'Save changes' : tab === 'upload' && approved ? 'Add to child library' : 'Save in parent space'}</button></div>
      {tab === 'upload' && <p className="fine-print">Upload videos you own or have permission to share. Uploaded files play here, without a feed or links to other services.</p>}
    </form>
  </Modal>;
}

function VideoPlayer({ video, demo, parent, onClose, onParent }: { video: Video; demo: boolean; parent: boolean; onClose: () => void; onParent: () => void }) {
  const [error, setError] = useState(false);
  return <Modal title={video.title} onClose={onClose} wide>
    <div className="player-stage">{video.source === 'upload' && video.mediaUrl ? <video controls autoPlay playsInline controlsList="nodownload noremoteplayback" disablePictureInPicture src={video.mediaUrl} onError={() => setError(true)} aria-label={video.title} /> : <><img src={`/artwork/${video.artwork || 'forest'}.svg`} alt="" /><div className="player-message"><span className="player-lock"><LockKeyhole size={27} /></span><h3>{demo ? 'A little taste of what’s possible.' : 'Saved for the grown-ups.'}</h3><p>{demo ? 'This is an example from the sample library. Upload your own videos to watch right here, with no outside links.' : 'This service controls its own player. This reference stays out of the child library.'}</p>{demo ? <button className="button button-primary" onClick={onParent}>Make our own library <ArrowRight size={16} /></button> : parent && <a className="button button-primary" href={video.url} target="_blank" rel="noopener noreferrer">Open in {sourceNames[video.source]} <ExternalLink size={16} /></a>}</div></>}</div>
    {error && <div className="form-error" role="alert">This browser couldn’t play the video. Try an MP4 with H.264 video and AAC audio, or a WebM file.</div>}
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
  async function refresh() {
    setLoadError('');
    try { setLibrary(await api<Library>('/api/library')); }
    catch (error) { setLoadError((error as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { try { localStorage.setItem('nest-favorites', JSON.stringify(favorites)); } catch { /* Browser storage is optional. */ } }, [favorites]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); } }, [toast]);
  function toggleFavorite(id: string) { setFavorites(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]); }
  function navigate(next: typeof page, nextCollection: typeof collection = 'all') { setPage(next); setCollection(nextCollection); setSearch(''); setSource('all'); setLength('all'); setMobileNav(false); }
  async function exitParent() {
    try { await api('/api/auth/logout', { method: 'POST' }); await refresh(); setSource('all'); setToast('Child view is on. Parent controls are locked.'); }
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
  const pageTitle = page === 'favorites' ? 'Little favorites.' : collection !== 'all' ? collection : 'Your little library.';
  const filtered = collection !== 'all' || search || source !== 'all' || length !== 'all';

  return <div className="app-shell">
    {mobileNav && <div className="nav-scrim" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => navigate('library')} aria-label="Nest home"><img src="/nest.svg" alt="" /><span>nest<span className="brand-dot">.</span></span></button>
      <span className="brand-tagline">A little world of wonder</span>
      <div className="family-space"><div className="family-icon"><Sprout size={22} /></div><div><strong>Our family’s Nest</strong><span>{library.demo ? 'A peek at the possibilities' : 'Made for your little people'}</span></div><Heart size={13} /></div>
      <span className="nav-label">THE GOOD STUFF</span>
      <nav aria-label="Main navigation" className="main-nav">
        <button className={page === 'library' && collection === 'all' ? 'active' : ''} onClick={() => navigate('library')}><LibraryIcon size={19} /> All videos <span className="nav-count">{library.videos.length}</span></button>
        <button className={page === 'favorites' ? 'active' : ''} onClick={() => navigate('favorites')}><Heart size={19} /> Favorites <span className="nav-count">{library.videos.filter(v => favorites.includes(v.id)).length}</span></button>
        <button className={page === 'collections' ? 'active' : ''} onClick={() => navigate('collections')}><FolderHeart size={19} /> Collections <span className="nav-count">4</span></button>
      </nav>
      <div className="nav-section-heading"><span className="nav-label">LITTLE COLLECTIONS</span><span>4</span></div>
      <nav aria-label="Video collections" className="collection-nav">{collections.map(({ name, icon: Icon, color }) => <button key={name} className={collection === name ? 'active' : ''} onClick={() => navigate('library', name)}><span className={`collection-dot ${color}`}><Icon size={14} /></span>{name}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-doodle"><Leaf size={25} strokeWidth={1.5} /><Sparkles size={15} /></span><strong>Less scrolling.<br />More discovering.</strong><p>A little space for the things<br />that matter to your family.</p></div><button className={`parent-nav ${library.parent ? 'parent-active' : ''}`} onClick={() => library.parent ? void exitParent() : setGate(true)}>{library.parent ? <ShieldCheck size={18} /> : <LockKeyhole size={18} />}<span>{library.parent ? 'Switch to child view' : 'Parent space'}</span><ArrowRight size={15} /></button><div className="sidebar-footnote"><span className="status-dot" /> Thoughtfully collected. Happily watched.</div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={22} /></button><span className="breadcrumb">Our family’s Nest <span>/</span> <strong>{library.parent ? 'Parent space' : 'Explore'}</strong></span></div><div className="topbar-right">{library.parent && <a className="button button-soft" href="/discover"><Sparkles size={15} /> Find videos</a>}<span className={`mode-pill ${library.parent ? 'parent-mode' : ''}`}>{library.parent ? <LockKeyhole size={13} /> : <Sprout size={14} />}{library.parent ? 'Parent view' : library.demo ? 'Sample library' : 'Child view'}</span><button className="avatar" aria-label="About this library" onClick={() => setInfo(true)}>N<span /></button></div></header>
      <main>
        {library.demo && !loading && <div className="sample-banner"><span><Sparkles size={15} /><strong>A little inspiration.</strong> You’re browsing a sample library.</span><button onClick={() => setGate(true)}>Make it yours <ArrowRight size={14} /></button></div>}
        <section className="hero"><div className="hero-content"><span className="hero-eyebrow"><span /> SMALL SCREENS. BIG DISCOVERIES.</span><h1>{library.parent ? <>Good things,<br />picked by you<span>.</span></> : <>A little world<br />of wonder<span>.</span></>}</h1><p>{library.parent ? 'Gather the good stuff. Make a little space for the videos your family will love.' : 'Their favorite stories. Their next big discovery.\nA thoughtful little library, all in one place.'}</p><div className="hero-bottom"><span className="hero-heart"><Heart size={14} /></span>{library.demo ? 'A glimpse of a library made with love' : 'Picked by you. Ready for them.'}</div>{library.parent && <button className="button button-primary hero-add" onClick={() => setEditor('new')}><Plus size={16} /> Add a video</button>}</div><img className="hero-illustration" src="/artwork/hero.svg" alt="A peaceful illustrated landscape with a bear, a rabbit, and rolling green hills" /><span className="hero-stamp"><ShieldCheck size={15} />{library.demo ? 'Your library, your way' : 'Only what you choose'}</span></section>

        {page === 'collections' ? <section className="library-section"><div className="section-heading"><div><span className="eyebrow">A PLACE FOR EVERY LITTLE INTEREST</span><h2>Wonder, neatly gathered.</h2><p>Follow their curiosity. See where it takes them.</p></div></div><div className="collection-grid">{collections.map(({ name, artwork, icon: Icon, color, detail }) => <button className="collection-card" key={name} onClick={() => navigate('library', name)}><img src={`/artwork/${artwork}.svg`} alt="" /><div><span className={`collection-dot ${color}`}><Icon size={18} /></span><h3>{name}</h3><p>{detail}</p><span className="collection-count">{library.videos.filter(v => v.collection === name).length} videos <ArrowRight size={16} /></span></div></button>)}</div></section> : <section className="library-section">
          <div className="section-heading"><div><h2>{pageTitle}</h2><p>{page === 'favorites' ? 'The ones they ask for. Again and again.' : collection !== 'all' ? collections.find(c => c.name === collection)?.detail : 'Good things to watch. Room to grow.'}</p></div>{library.parent ? <button className="button button-primary" onClick={() => setEditor('new')}><Plus size={17} /> Add a video</button> : <span className="curated-label"><ShieldCheck size={15} />{library.demo ? 'Example collection' : 'Handpicked by you'}</span>}</div>
          <div className="library-toolbar"><label className="search-field"><Search size={18} /><input type="search" aria-label="Search videos" placeholder="Find a little something…" value={search} onChange={e => setSearch(e.target.value)} /><kbd>⌕</kbd></label><div className="select-wrapper"><Clock3 size={15} /><select aria-label="Filter by duration" value={length} onChange={e => setLength(e.target.value)}><option value="all">Any length</option><option value="short">Under 10 minutes</option><option value="medium">10–30 minutes</option><option value="long">Over 30 minutes</option></select><ChevronDown size={13} /></div><div className="select-wrapper"><Film size={15} /><select aria-label="Filter by source" value={source} onChange={e => setSource(e.target.value)}><option value="all">All sources</option>{(library.parent || library.demo ? ['upload', 'youtube', 'netflix', 'disney', 'prime', 'max'] : ['upload']).map(s => <option value={s} key={s}>{sourceNames[s as Source]}</option>)}</select><ChevronDown size={13} /></div></div>
          <div className="category-row"><div className="category-pills"><button className={collection === 'all' ? 'selected' : ''} onClick={() => setCollection('all')}>All discoveries</button>{collections.map(({ name, icon: Icon }) => <button key={name} className={collection === name ? 'selected' : ''} onClick={() => setCollection(name)}><Icon size={13} />{name}</button>)}</div></div>
          <div className="results-row"><span>{videos.length} {videos.length === 1 ? 'video' : 'videos'}{filtered ? ' found' : ' to discover'}{library.parent && ' · Includes parent-only drafts and references'}</span><label className="sort-control"><ArrowDownWideNarrow size={14} /><select aria-label="Sort videos" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Recently added</option><option value="title">Title, A to Z</option><option value="duration">Shortest first</option></select><ChevronDown size={12} /></label></div>
          {loading ? <div className="state-panel"><LoaderCircle className="spin" size={28} /><h3>Gathering the good stuff…</h3></div> : loadError ? <div className="state-panel"><h3>Your Nest needs a moment.</h3><p>{loadError}</p><button className="button button-primary" onClick={() => { setLoading(true); void refresh(); }}>Try again</button></div> : videos.length === 0 ? <div className="state-panel empty-state"><span className="empty-icon">{page === 'favorites' ? <Heart size={30} /> : <Sprout size={32} />}</span><h3>{filtered ? 'No little discoveries here. Yet.' : page === 'favorites' ? 'Make room for your favorites.' : 'Every little library starts somewhere.'}</h3><p>{filtered ? 'Try another search or give your filters a little more room.' : page === 'favorites' ? 'Tap the heart on a video to keep it close. Favorites are saved on this device.' : library.parent ? 'Upload your first video, add a few details, and make it ready for little eyes.' : 'Your grown-up can add videos in parent space. Then the adventure begins.'}</p>{filtered ? <button className="button button-soft" onClick={() => { setCollection('all'); setSearch(''); setSource('all'); setLength('all'); }}>Clear filters</button> : <button className="button button-primary" onClick={() => library.parent ? setEditor('new') : page === 'favorites' ? navigate('library') : setGate(true)}>{library.parent ? <><Plus size={16} /> Add our first video</> : page === 'favorites' ? 'Explore the library' : <><LockKeyhole size={15} /> Parent space</>}</button>}</div> : <div className="video-grid">{videos.map(video => <article className="video-card" key={video.id}>
            <div className="card-cover"><button className="card-play" aria-label={video.source === 'upload' ? `Play ${video.title}` : `View ${video.title}`} onClick={() => setPlaying(video)}><img src={video.thumbnail || `/artwork/${video.artwork || 'forest'}.svg`} alt="" loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = `/artwork/${video.artwork || 'forest'}.svg`; }} /><span className="play-overlay">{video.source === 'upload' ? <Play size={23} fill="currentColor" /> : <BookOpen size={23} />}</span></button><button className={`favorite-button ${favorites.includes(video.id) ? 'is-favorite' : ''}`} aria-label={`${favorites.includes(video.id) ? 'Remove' : 'Add'} ${video.title} ${favorites.includes(video.id) ? 'from' : 'to'} favorites`} aria-pressed={favorites.includes(video.id)} onClick={() => toggleFavorite(video.id)}><Heart size={16} fill={favorites.includes(video.id) ? 'currentColor' : 'none'} /></button>{durationLabel(video.duration) && <span className="duration-badge"><Clock3 size={11} />{durationLabel(video.duration)}</span>}{library.parent && <span className={`availability-badge ${video.source === 'upload' && video.approved ? 'available' : ''}`}>{video.source !== 'upload' ? 'Parent reference' : video.approved ? 'In child library' : 'Draft'}</span>}</div>
            <div className="card-body"><div className="card-source-row"><SourceBadge source={video.source} /><span>{video.age}</span></div><button className="card-title" onClick={() => setPlaying(video)}>{video.title}</button><p className="card-creator">{video.creator || 'A family favorite'}</p><div className="card-bottom"><span className={`card-category ${collections.find(c => c.name === video.collection)?.color || 'sage'}`}><span />{video.collection}</span>{library.parent ? <div className="card-manage"><button className="icon-button" aria-label={`Edit ${video.title}`} onClick={() => setEditor(video)}><MoreHorizontal size={18} /></button><button className="icon-button" aria-label={`Remove ${video.title}`} onClick={() => setDeleting(video)}><Trash2 size={14} /></button></div> : <span className="card-flower">✳</span>}</div></div>
          </article>)}</div>}
        </section>}
        <div className="bottom-note"><div className="bottom-note-icon"><ShieldCheck size={22} /></div><div><strong>A calmer corner of their world.</strong><p>{library.demo ? 'One home for your favorites. Your own videos play here; streaming links stay with the grown-ups.' : 'Only your approved uploads play in child view. No outside players. No endless feed.'}</p></div><button className="text-button" onClick={() => setInfo(true)}>Made with care <ArrowRight size={14} /></button></div>
        <footer className="page-footer"><span><img src="/nest.svg" alt="" /> Small moments. Wonderful things.</span><span>A little less noise. A little more Nest.</span></footer>
      </main>
    </div>
    {gate && <ParentGate configured={library.pinConfigured} onClose={() => setGate(false)} onDone={() => { setGate(false); void refresh(); setToast(library.pinConfigured ? 'Welcome to parent space.' : 'Your very own Nest. Let’s add something wonderful.'); }} />}
    {editor && <VideoEditor video={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); void refresh(); setToast('A little discovery, safely saved.'); }} />}
    {playing && <VideoPlayer video={playing} demo={library.demo} parent={library.parent} onClose={() => setPlaying(null)} onParent={() => { setPlaying(null); setGate(true); }} />}
    {deleting && <Modal title="Remove this video?" onClose={() => { if (!deleteBusy) setDeleting(null); }}><div className="modal-emblem peach"><Trash2 size={23} /></div><h2>A little room for something new?</h2><p className="modal-description">Remove “{deleting.title}” from your family’s library? Uploaded files will also be deleted. This can’t be undone.</p><div className="modal-actions"><button className="button button-plain" disabled={deleteBusy} onClick={() => setDeleting(null)}>Keep it</button><button className="button button-danger" disabled={deleteBusy} onClick={() => void remove()}>{deleteBusy ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />} Remove video</button></div></Modal>}
    {info && <Modal title="About your Nest" onClose={() => setInfo(false)}><div className="modal-emblem"><Sprout size={27} /></div><span className="eyebrow">A LITTLE MORE INTENTIONAL</span><h2>A space you shape.</h2><p className="modal-description">Nest is one shared library for your family, ready for a phone, tablet, or a bigger screen.</p><div className="about-features"><div><ShieldCheck size={21} /><p><strong>Only what you choose</strong>Child view plays approved MP4 and WebM uploads in our own player, without external links or a recommendation feed.</p></div><div><FolderHeart size={21} /><p><strong>A home for good finds</strong>Save YouTube, Netflix, Disney+, Prime Video, and HBO Max links as parent-only references. They stay out of child view because their players can lead to other content.</p></div><div><LockKeyhole size={21} /><p><strong>Parent space stays yours</strong>A PIN protects library changes. This is an MVP for a trusted household network; browser and device restrictions are separate.</p></div></div><button className="button button-primary button-full" onClick={() => setInfo(false)}>That sounds lovely <Check size={16} /></button></Modal>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={19} /><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>;
}
