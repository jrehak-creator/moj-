import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, ExternalLink, Library as LibraryIcon, Link2, LoaderCircle, LockKeyhole, Play, Search, ShieldCheck, Sparkles, Square } from 'lucide-react';
import { Modal, ParentGate } from './App';
import YouTubeStage from './StreamingPlayer';
import VideoCover from './VideoCover';
import { coverArtworkFor } from '../shared/covers.mjs';
import type { Library, Video } from './types';
import type { DiscoveryConfig, DiscoveryResponse, DiscoveryResult, LinkAnalysis, StreamingSource } from './discovery-types';
import './discover.css';

const services: DiscoveryConfig['services'] = [
  { id: 'youtube', name: 'YouTube' }, { id: 'netflix', name: 'Netflix' },
  { id: 'disney', name: 'Disney+' }, { id: 'prime', name: 'Prime Video' }, { id: 'max', name: 'HBO Max' },
];
const examples = ['Pokojné príbehy o zvieratách pre šesťročné dieťa', 'Krátke videá o vesmíre v slovenčine', 'Nájdi Toy Story v zvolených službách'];

class RequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json().catch(() => ({ error: 'The server could not complete this request.' }));
  if (!response.ok) throw new RequestError(data.error || 'Please try again.', response.status);
  return data as T;
}
function runtime(seconds: number | null) {
  if (!seconds) return 'Trvanie nezistené';
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export default function Discover() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [config, setConfig] = useState<DiscoveryConfig | null>(null);
  const [gate, setGate] = useState(false);
  const [mode, setMode] = useState<'search' | 'link'>('search');
  const [selected, setSelected] = useState<StreamingSource[]>(['youtube']);
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<DiscoveryResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchStopped, setSearchStopped] = useState(false);
  const [playing, setPlaying] = useState<{ url: string; title: string } | null>(null);
  const [url, setUrl] = useState('');
  const [analysis, setAnalysis] = useState<LinkAnalysis | null>(null);
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [pendingSave, setPendingSave] = useState<{ item: DiscoveryResult | LinkAnalysis; title: string } | null>(null);
  const [pendingMinutes, setPendingMinutes] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const sessionVersion = useRef(0);
  const analysisVersion = useRef(0);
  const activeSearch = useRef<AbortController | null>(null);

  function handleError(cause: unknown) {
    setError(cause instanceof Error ? cause.message : 'Please try again.');
    if (cause instanceof RequestError && cause.status === 401) {
      sessionVersion.current += 1;
      stopSearch(false);
      setLibrary(previous => previous ? { ...previous, parent: false } : null);
      setConfig(null); setResponse(null); setAnalysis(null); setSaved([]); setPlaying(null); setPendingSave(null);
    }
  }
  async function refresh() {
    const version = ++sessionVersion.current;
    setError('');
    try {
      const current = await request<Library>('/api/library');
      if (version !== sessionVersion.current) return;
      setLibrary(current);
      if (current.parent) {
        setSaved(current.videos.map(video => video.url));
        const connection = await request<DiscoveryConfig>('/api/discovery/config');
        if (version === sessionVersion.current) setConfig(connection);
      } else { setConfig(null); setResponse(null); setAnalysis(null); setSaved([]); }
    } catch (cause) { if (version === sessionVersion.current) handleError(cause); }
  }
  useEffect(() => {
    void refresh();
    return () => { activeSearch.current?.abort(); activeSearch.current = null; };
  }, []);

  function stopSearch(showStatus = true) {
    const controller = activeSearch.current;
    if (!controller) { if (!showStatus) setSearchStopped(false); return; }
    activeSearch.current = null;
    controller.abort();
    setSearching(false);
    setSearchStopped(showStatus);
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!config?.configured || !selected.length || activeSearch.current) return;
    const version = sessionVersion.current;
    const controller = new AbortController();
    activeSearch.current = controller;
    setSearching(true); setSearchStopped(false); setError(''); setNotice(''); setResponse(null);
    try {
      const results = await request<DiscoveryResponse>('/api/discovery/search', {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify({ query: query.trim(), services: selected, country: 'CZ' }),
      });
      if (version === sessionVersion.current && activeSearch.current === controller && !controller.signal.aborted) setResponse(results);
    } catch (cause) {
      if (version === sessionVersion.current && activeSearch.current === controller && !controller.signal.aborted) handleError(cause);
    } finally {
      if (activeSearch.current === controller) { activeSearch.current = null; setSearching(false); }
    }
  }
  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (analyzing) return;
    const version = sessionVersion.current;
    const linkVersion = ++analysisVersion.current;
    setAnalyzing(true); setError(''); setNotice(''); setAnalysis(null);
    try {
      const details = await request<LinkAnalysis>('/api/links/analyze', { method: 'POST', body: JSON.stringify({ url: url.trim() }) });
      if (version === sessionVersion.current && linkVersion === analysisVersion.current) { setAnalysis(details); setTitle(details.metadata.title); setDurationMinutes(details.metadata.durationSeconds ? String(Math.round(details.metadata.durationSeconds / 60 * 100) / 100) : ''); }
    } catch (cause) { if (version === sessionVersion.current && linkVersion === analysisVersion.current) handleError(cause); }
    finally { setAnalyzing(false); }
  }
  async function save(item: DiscoveryResult | LinkAnalysis, chosenTitle: string, suppliedDuration?: number) {
    if (saving.includes(item.url) || saved.includes(item.url)) return;
    const metadata = 'metadata' in item ? item.metadata : item;
    const duration = suppliedDuration ?? metadata.durationSeconds;
    if (!duration || !Number.isFinite(duration) || duration <= 0 || duration > 86400) { setPendingSave({ item, title: chosenTitle }); setPendingMinutes(''); return; }
    const version = sessionVersion.current;
    setSaving(previous => [...previous, item.url]); setError(''); setNotice('');
    try {
      await request<{ video: Video }>('/api/videos', { method: 'POST', body: JSON.stringify({
        source: item.source, url: item.url, title: chosenTitle.trim(), description: metadata.description,
        creator: 'creator' in metadata ? metadata.creator : '', duration,
        thumbnail: metadata.thumbnail, collection: 'Nature & animals', artwork: metadata.thumbnail ? metadata.artwork || coverArtworkFor({ title: chosenTitle, description: metadata.description }) : coverArtworkFor({ title: chosenTitle, description: metadata.description }),
        tags: [], age: '', approved: true, favorite: false,
      }) });
      if (version === sessionVersion.current) {
        setSaved(previous => [...previous, item.url]);
        setPendingSave(null); setNotice(`„${chosenTitle.trim()}“ je uložené v detskej knižnici.`);
      }
    } catch (cause) { if (version === sessionVersion.current) handleError(cause); }
    finally { setSaving(previous => previous.filter(value => value !== item.url)); }
  }
  async function lock() {
    stopSearch(false);
    sessionVersion.current += 1;
    try {
      await request('/api/auth/logout', { method: 'POST' });
      setLibrary(previous => previous ? { ...previous, parent: false } : null);
      setConfig(null); setResponse(null); setAnalysis(null); setSaved([]); setPlaying(null); setPendingSave(null); setNotice(''); setError('');
      return true;
    } catch (cause) { handleError(cause); return false; }
  }
  function saveButton(item: DiscoveryResult | LinkAnalysis, chosenTitle: string, suppliedDuration?: number) {
    const isSaved = saved.includes(item.url), isSaving = saving.includes(item.url);
    return <button type="button" className={`button ${isSaved ? 'button-soft' : 'button-primary'}`} disabled={isSaved || isSaving || !chosenTitle.trim()} onClick={() => void save(item, chosenTitle, suppliedDuration)}>
      {isSaving ? <LoaderCircle size={16} className="spin" /> : isSaved ? <CheckCircle2 size={16} /> : <LibraryIcon size={16} />}
      {isSaving ? 'Ukladám…' : isSaved ? 'V knižnici' : 'Uložiť do detskej knižnice'}
    </button>;
  }

  return <div className="discover-shell">
    <header className="discover-header">
      <a href="/" className="discover-brand" aria-label="Nest home"><img src="/nest.svg" alt="" /><span>nest<span>.</span></span></a>
      <nav aria-label="Navigácia"><a href="/?parent=1"><ArrowLeft size={15} /> Rodičovská knižnica</a>{library?.parent ? <button onClick={() => void lock().then(ok => { if (ok) window.location.assign('/'); })}><LockKeyhole size={15} /> Detský režim</button> : <a href="/">Detská knižnica</a>}</nav>
    </header>
    <main className="discover-main">
      <div className="discover-heading"><span className="discover-eyebrow"><ShieldCheck size={14} /> RODIČOVSKÝ REŽIM</span><h1>Jedno vyhľadávanie.<br />Videá pre vašu rodinu.</h1><p>Vyhľadajte video, pozrite si ho a uložte ho do detskej knižnice.</p></div>
      {error && <div className="discover-error" role="alert">{error}{!library && <button type="button" onClick={() => void refresh()}>Try again</button>}</div>}
      {!library && !error && <p className="discover-loading" role="status"><LoaderCircle className="spin" size={20} /> Načítavam knižnicu…</p>}
      {library && !library.parent && <section className="discover-private"><div className="discover-private-icon"><LockKeyhole size={29} /></div><h2>Priestor pre rodičov.</h2><p>Zadajte rodičovský PIN. Potom môžete vyhľadávať videá a upravovať knižnicu.</p><button className="button button-primary" onClick={() => setGate(true)}><LockKeyhole size={16} />{library.pinConfigured ? 'Rodičovský režim' : 'Nastaviť knižnicu'}</button><a href="/">Detská knižnica <ArrowRight size={14} /></a></section>}
      {library?.parent && <>
        <div className="discover-tabs" aria-label="Vyhľadať videá"><button className={mode === 'search' ? 'selected' : ''} aria-pressed={mode === 'search'} onClick={() => { setMode('search'); setError(''); }}><Sparkles size={17} /> Ask Nest</button><button className={mode === 'link' ? 'selected' : ''} aria-pressed={mode === 'link'} onClick={() => { stopSearch(false); setMode('link'); setError(''); }}><Link2 size={17} /> Pridať odkaz</button></div>
        {notice && <div className="discover-notice" role="status"><CheckCircle2 size={18} /><span>{notice} <a href="/?parent=1">Rodičovská knižnica <ArrowRight size={13} /></a></span></div>}
        {mode === 'search' ? <>
          <section className="discover-search-panel" aria-label="AI video search">
            <div className="discover-panel-heading"><div><span className="discover-eyebrow">VYHĽADÁVANIE VIDEÍ</span><h2>Čo chcete nájsť?</h2></div><span className="discover-country">Česko · CZ</span></div>
            <form onSubmit={search}>
              <label className="discover-query-label" htmlFor="nest-query">Napíšte názov, tému alebo typ videa.</label>
              <div className="discover-query"><Sparkles size={22} /><textarea id="nest-query" value={query} onChange={event => setQuery(event.target.value)} required minLength={3} maxLength={1000} rows={3} placeholder="Niečo pokojné o zvieratách pre šesťročné dieťa…" /><button type={searching ? "button" : "submit"} className={`button ${searching ? "button-soft discover-stop-search" : "button-primary"}`} disabled={!searching && (!config?.configured || !selected.length || query.trim().length < 3)} onClick={searching ? event => { event.preventDefault(); stopSearch(); } : undefined}>{searching ? <Square size={15} fill="currentColor" /> : <Search size={17} />}{searching ? 'Zastaviť hľadanie' : 'Vyhľadať videá'}</button></div>
              <fieldset className="discover-services"><legend>Prehľadávať služby</legend><div>{(config?.services || services).map(service => <label key={service.id} className={selected.includes(service.id) ? 'selected' : ''}><input type="checkbox" checked={selected.includes(service.id)} onChange={() => setSelected(previous => previous.includes(service.id) ? previous.filter(id => id !== service.id) : [...previous, service.id])} /><span className="discover-check">{selected.includes(service.id) && <Check size={12} />}</span>{service.name}{service.id !== 'youtube' && <small>katalóg</small>}</label>)}</div></fieldset>
              <p className="discover-scope">YouTube má rodičovský prehrávač v Nest. Ostatné služby zatiaľ poskytujú len katalógové výsledky. Výber služby nepripája vaše predplatné.</p>
            </form>
            <div className="discover-examples"><span>Skúste napríklad</span>{examples.map(example => <button key={example} type="button" onClick={() => setQuery(example)}>{example}<ArrowRight size={13} /></button>)}</div>
          </section>
          {config && !config.configured && <aside className="discover-setup"><div className="discover-setup-icon"><Sparkles size={21} /></div><div><h3>Connect AI search when you’re ready.</h3><p>AI search needs an OpenAI API key on the server. You can already paste and save video links.</p><details><summary>How to enable AI search</summary><ol><li>Open this Nest service in your Render dashboard.</li><li>In <strong>Environment</strong>, add <code>NEST_AI_API_KEY</code> with your OpenAI API key as its value.</li><li>Save the change, wait for the deployment to finish, then refresh this page.</li></ol><p>Keep the key in Render’s private environment settings. Searches use your OpenAI API account and may incur charges.</p></details><button type="button" className="discover-inline-link" onClick={() => { stopSearch(false); setMode('link'); }}>Add a video link instead <ArrowRight size={14} /></button></div></aside>}
          {!config && !error && <p className="discover-loading" role="status"><LoaderCircle className="spin" size={17} /> Overujem pripojenie vyhľadávania…</p>}
          {searchStopped && <p className="discover-search-stopped" role="status">Hľadanie je zastavené. Môžete upraviť zadanie a skúsiť to znova.</p>}
          {searching && <div className="discover-search-progress" role="status"><LoaderCircle size={25} className="spin" /><h3>Vyhľadávam videá…</h3><p>Prehľadávam verejné stránky zvolených služieb. Hľadanie môžete kedykoľvek zastaviť.</p></div>}
          {response && <section className="discover-results" aria-label="Search results"><div className="discover-results-heading"><div><span className="discover-eyebrow">NÁJDENÉ VIDEÁ</span><h2>{response.results.length ? `${response.results.length} nájdených videí` : 'Nenašli sa podporované videá'}</h2><p>Pre „{response.query}“ · Česko</p></div></div>{response.summary && <p className="discover-summary">{response.summary}</p>}{response.warnings.length > 0 && <div className="discover-warnings">{response.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}{!response.results.length && <div className="discover-empty"><Search size={28} /><p>Skúste presný názov, menej služieb alebo vložte odkaz na video.</p><button type="button" className="button button-soft" onClick={() => { stopSearch(false); setMode('link'); }}>Pridať odkaz</button></div>}<div className="discover-result-grid">{response.results.map(item => <article className="discover-result" key={item.id}><div className={`discover-result-cover provider-${item.source}`}><VideoCover thumbnail={item.thumbnail} artwork={item.artwork} title={item.title} description={item.description} alt="" /><span>{item.providerName}</span></div><div className="discover-result-content"><h3>{item.title}</h3>{item.description && <p className="discover-description">{item.description}</p>}{item.reason && <p className="discover-reason"><Sparkles size={14} /><span>{item.reason}</span></p>}<div className="discover-result-meta"><span><Clock3 size={13} />{runtime(item.durationSeconds)}</span><span>{item.source === 'youtube' ? 'Rodičovský náhľad v Nest' : 'Katalóg · bez prehrávania v Nest'}</span><span>Dostupnosť neoverená</span></div><div className="discover-evidence">{item.evidence.map((evidence, index) => <a key={`${evidence.url}-${index}`} href={evidence.url} target="_blank" rel="noopener noreferrer">{evidence.title || 'View source'}<ExternalLink size={12} /></a>)}</div>{item.source === 'youtube' && <button type="button" className="button button-soft discover-watch" onClick={() => setPlaying({ url: item.url, title: item.title })}><Play size={16} /> Prehrať v Nest</button>}{saveButton(item, item.title)}</div></article>)}</div><p className="discover-reference-note"><LockKeyhole size={14} />Uložené videá sa zobrazia v detskej knižnici. YouTube je dostupné iba ako rodičovský náhľad. Detské prehrávanie zachováva prísne obmedzenie na vybraný obsah.</p></section>}
        </> : <section className="discover-link-panel"><div className="discover-panel-heading"><div><span className="discover-eyebrow">PRIDAŤ VLASTNÝ VÝBER</span><h2>Vložte odkaz na video.</h2></div><Link2 size={25} /></div><p className="discover-link-intro">Vložte odkaz z YouTube alebo odkaz na titul z ďalších služieb. Nest načíta dostupný obrázok a údaje. Priame prehrávanie zatiaľ podporuje YouTube.</p><form onSubmit={analyze} className="discover-link-form"><label htmlFor="nest-video-link">Odkaz na video</label><div><input id="nest-video-link" type="url" inputMode="url" autoComplete="off" required maxLength={2048} placeholder="https://www.netflix.com/watch/…" value={url} onChange={event => { analysisVersion.current += 1; setUrl(event.target.value); setAnalysis(null); }} /><button className="button button-primary" disabled={analyzing || !url.trim()}>{analyzing ? <LoaderCircle size={17} className="spin" /> : <Link2 size={17} />}{analyzing ? 'Načítavam údaje…' : 'Načítať údaje'}</button></div></form>{analysis && <div className="discover-analysis"><div className="discover-analysis-heading"><span className={`discover-provider provider-${analysis.source}`}>{analysis.providerName}</span><span><CheckCircle2 size={15} /> Odkaz rozpoznaný</span></div><dl><div><dt>Typ obsahu</dt><dd>{analysis.kind === 'unknown' ? 'Not available' : analysis.kind}</dd></div><div><dt>Identifikátor</dt><dd>{analysis.contentId}</dd></div><div><dt>Trvanie</dt><dd>{runtime(analysis.metadata.durationSeconds)}</dd></div></dl><a className="discover-canonical" href={analysis.url} target="_blank" rel="noopener noreferrer">{analysis.url}<ExternalLink size={14} /></a><VideoCover className="discover-link-thumbnail" thumbnail={analysis.metadata.thumbnail} artwork={analysis.metadata.thumbnail ? analysis.metadata.artwork : coverArtworkFor({ title, description: analysis.metadata.description })} title={title} description={analysis.metadata.description} alt="Video preview" /><div className="discover-title-field"><label htmlFor="nest-link-title">Názov v knižnici</label><input id="nest-link-title" value={title} maxLength={200} required placeholder="Zadajte názov videa" onChange={event => setTitle(event.target.value)} />{!analysis.metadata.title && <p>Služba neposkytla názov. Pred uložením ho doplňte.</p>}</div>{analysis.warnings.length > 0 && <div className="discover-warnings">{analysis.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}<label className="discover-duration-field">Trvanie (minúty)<input type="number" min="0.02" max="1440" step="any" inputMode="decimal" value={durationMinutes} onChange={event => setDurationMinutes(event.target.value)} placeholder="Doplňte, ak ho služba neposkytla" /></label><div className="discover-analysis-actions">{analysis.source === 'youtube' && <button type="button" className="button button-soft" onClick={() => setPlaying({ url: analysis.url, title: title.trim() || 'YouTube video' })}><Play size={16} /> Prehrať v Nest</button>}{saveButton(analysis, title, durationMinutes ? Math.round(Number(durationMinutes) * 60) : undefined)}<span><LockKeyhole size={13} />Uložené pre dieťa</span></div></div>}<p className="discover-reference-note"><ShieldCheck size={15} />Samotný odkaz na Netflix alebo inú platenú službu neumožňuje spustiť jej video v prehrávači Nest.</p></section>}
        <footer className="discover-footer"><img src="/nest.svg" alt="" /><span>Vybrané rodičom. Spolu v Nest.</span><a href="/">Detská knižnica <ArrowRight size={14} /></a></footer>
      </>}
    </main>
    {playing && library?.parent && <Modal title={playing.title} wide fullScreen onClose={() => setPlaying(null)}><div className="player-header"><span className="eyebrow">RODIČOVSKÝ NÁHĽAD</span><h2>{playing.title}</h2></div><YouTubeStage url={playing.url} title={playing.title} /></Modal>}
    {pendingSave && library?.parent && <Modal title="Doplniť trvanie videa" onClose={() => setPendingSave(null)}><h2>Doplniť trvanie videa</h2><p className="modal-description">Služba neposkytla dĺžku pre „{pendingSave.title}“. Zadajte ju v minútach, aby bola zobrazená v detskej knižnici.</p><form className="form-stack" onSubmit={event => { event.preventDefault(); void save(pendingSave.item, pendingSave.title, Math.round(Number(pendingMinutes) * 60)); }}><label>Trvanie (minúty)<input type="number" min="0.02" max="1440" step="any" inputMode="decimal" required value={pendingMinutes} onChange={event => setPendingMinutes(event.target.value)} /></label><button className="button button-primary" disabled={saving.includes(pendingSave.item.url) || !pendingMinutes}>Uložiť do detskej knižnice</button></form></Modal>}
    {gate && library && <ParentGate configured={library.pinConfigured} onClose={() => setGate(false)} onDone={() => { setGate(false); void refresh(); }} />}
  </div>;
}
