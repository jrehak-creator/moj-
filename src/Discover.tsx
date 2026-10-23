import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, ExternalLink, Film, Library as LibraryIcon, Link2, LoaderCircle, LockKeyhole, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { ParentGate } from './App';
import type { Library, Video } from './types';
import type { DiscoveryConfig, DiscoveryResponse, DiscoveryResult, LinkAnalysis, StreamingSource } from './discovery-types';
import './discover.css';

const services: DiscoveryConfig['services'] = [
  { id: 'youtube', name: 'YouTube' }, { id: 'netflix', name: 'Netflix' },
  { id: 'disney', name: 'Disney+' }, { id: 'prime', name: 'Prime Video' }, { id: 'max', name: 'HBO Max' },
];
const examples = ['Gentle animal stories for a six-year-old', 'Find Toy Story across these services', 'Space adventures we can watch together'];

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
  if (!seconds) return 'Length not available';
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export default function Discover() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [config, setConfig] = useState<DiscoveryConfig | null>(null);
  const [gate, setGate] = useState(false);
  const [mode, setMode] = useState<'search' | 'link'>('search');
  const [selected, setSelected] = useState<StreamingSource[]>(services.map(service => service.id));
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<DiscoveryResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [url, setUrl] = useState('');
  const [analysis, setAnalysis] = useState<LinkAnalysis | null>(null);
  const [title, setTitle] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const sessionVersion = useRef(0);
  const analysisVersion = useRef(0);

  function handleError(cause: unknown) {
    setError(cause instanceof Error ? cause.message : 'Please try again.');
    if (cause instanceof RequestError && cause.status === 401) {
      sessionVersion.current += 1;
      setLibrary(previous => previous ? { ...previous, parent: false } : null);
      setConfig(null); setResponse(null); setAnalysis(null); setSaved([]);
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
  useEffect(() => { void refresh(); }, []);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!config?.configured || !selected.length || searching) return;
    const version = sessionVersion.current;
    setSearching(true); setError(''); setNotice(''); setResponse(null);
    try {
      const results = await request<DiscoveryResponse>('/api/discovery/search', {
        method: 'POST', body: JSON.stringify({ query: query.trim(), services: selected, country: 'CZ' }),
      });
      if (version === sessionVersion.current) setResponse(results);
    } catch (cause) { if (version === sessionVersion.current) handleError(cause); }
    finally { setSearching(false); }
  }
  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (analyzing) return;
    const version = sessionVersion.current;
    const linkVersion = ++analysisVersion.current;
    setAnalyzing(true); setError(''); setNotice(''); setAnalysis(null);
    try {
      const details = await request<LinkAnalysis>('/api/links/analyze', { method: 'POST', body: JSON.stringify({ url: url.trim() }) });
      if (version === sessionVersion.current && linkVersion === analysisVersion.current) { setAnalysis(details); setTitle(details.metadata.title); }
    } catch (cause) { if (version === sessionVersion.current && linkVersion === analysisVersion.current) handleError(cause); }
    finally { setAnalyzing(false); }
  }
  async function save(item: DiscoveryResult | LinkAnalysis, chosenTitle: string) {
    if (saving.includes(item.url) || saved.includes(item.url)) return;
    const version = sessionVersion.current;
    setSaving(previous => [...previous, item.url]); setError(''); setNotice('');
    const metadata = 'metadata' in item ? item.metadata : item;
    try {
      await request<{ video: Video }>('/api/videos', { method: 'POST', body: JSON.stringify({
        source: item.source, url: item.url, title: chosenTitle.trim(), description: metadata.description,
        creator: 'creator' in metadata ? metadata.creator : '', duration: metadata.durationSeconds,
        thumbnail: metadata.thumbnail, collection: 'Nature & animals', artwork: 'forest',
        tags: [], age: '', approved: false, favorite: false,
      }) });
      if (version === sessionVersion.current) {
        setSaved(previous => [...previous, item.url]);
        setNotice(`“${chosenTitle.trim()}” was added to your parent library.`);
      }
    } catch (cause) { if (version === sessionVersion.current) handleError(cause); }
    finally { setSaving(previous => previous.filter(value => value !== item.url)); }
  }
  async function lock() {
    sessionVersion.current += 1;
    try {
      await request('/api/auth/logout', { method: 'POST' });
      setLibrary(previous => previous ? { ...previous, parent: false } : null);
      setConfig(null); setResponse(null); setAnalysis(null); setSaved([]); setNotice(''); setError('');
    } catch (cause) { handleError(cause); }
  }
  function saveButton(item: DiscoveryResult | LinkAnalysis, chosenTitle: string) {
    const isSaved = saved.includes(item.url), isSaving = saving.includes(item.url);
    return <button type="button" className={`button ${isSaved ? 'button-soft' : 'button-primary'}`} disabled={isSaved || isSaving || !chosenTitle.trim()} onClick={() => void save(item, chosenTitle)}>
      {isSaving ? <LoaderCircle size={16} className="spin" /> : isSaved ? <CheckCircle2 size={16} /> : <LibraryIcon size={16} />}
      {isSaving ? 'Adding…' : isSaved ? 'In your library' : 'Add to library'}
    </button>;
  }

  return <div className="discover-shell">
    <header className="discover-header">
      <a href="/" className="discover-brand" aria-label="Nest home"><img src="/nest.svg" alt="" /><span>nest<span>.</span></span></a>
      <nav aria-label="Parent navigation"><a href="/library"><ArrowLeft size={15} /> Library</a><a href="/">iPad pilot</a>{library?.parent && <button onClick={() => void lock()}><LockKeyhole size={15} /> Lock parent space</button>}</nav>
    </header>
    <main className="discover-main">
      <div className="discover-heading"><span className="discover-eyebrow"><ShieldCheck size={14} /> PARENT SPACE</span><h1>A little search.<br />A world of possibilities.</h1><p>Find videos across your chosen services, then keep the ones you love in Nest.</p></div>
      {error && <div className="discover-error" role="alert">{error}{!library && <button type="button" onClick={() => void refresh()}>Try again</button>}</div>}
      {!library && !error && <p className="discover-loading" role="status"><LoaderCircle className="spin" size={20} /> Opening your Nest…</p>}
      {library && !library.parent && <section className="discover-private"><div className="discover-private-icon"><LockKeyhole size={29} /></div><h2>Just for the grown-ups.</h2><p>Unlock parent space to search streaming services and add links to your family’s collection.</p><button className="button button-primary" onClick={() => setGate(true)}><LockKeyhole size={16} />{library.pinConfigured ? 'Enter parent space' : 'Set up our library'}</button><a href="/library">Back to the library <ArrowRight size={14} /></a></section>}
      {library?.parent && <>
        <div className="discover-tabs" aria-label="Find videos"><button className={mode === 'search' ? 'selected' : ''} aria-pressed={mode === 'search'} onClick={() => { setMode('search'); setError(''); }}><Sparkles size={17} /> Ask Nest</button><button className={mode === 'link' ? 'selected' : ''} aria-pressed={mode === 'link'} onClick={() => { setMode('link'); setError(''); }}><Link2 size={17} /> Add a link</button></div>
        {notice && <div className="discover-notice" role="status"><CheckCircle2 size={18} /><span>{notice} <a href="/library">View library <ArrowRight size={13} /></a></span></div>}
        {mode === 'search' ? <>
          <section className="discover-search-panel" aria-label="AI video search">
            <div className="discover-panel-heading"><div><span className="discover-eyebrow">ONE SEARCH, MORE DISCOVERIES</span><h2>What would you like to find?</h2></div><span className="discover-country">Czechia · CZ</span></div>
            <form onSubmit={search}>
              <label className="discover-query-label" htmlFor="nest-query">Describe a title, topic, or kind of story.</label>
              <div className="discover-query"><Sparkles size={22} /><textarea id="nest-query" value={query} onChange={event => setQuery(event.target.value)} required minLength={3} maxLength={1000} rows={3} placeholder="Something gentle about animals for a six-year-old…" /><button className="button button-primary" disabled={!config?.configured || !selected.length || searching || query.trim().length < 3}>{searching ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />}{searching ? 'Searching…' : 'Find videos'}</button></div>
              <fieldset className="discover-services"><legend>Search these services</legend><div>{(config?.services || services).map(service => <label key={service.id} className={selected.includes(service.id) ? 'selected' : ''}><input type="checkbox" checked={selected.includes(service.id)} onChange={() => setSelected(previous => previous.includes(service.id) ? previous.filter(id => id !== service.id) : [...previous, service.id])} /><span className="discover-check">{selected.includes(service.id) && <Check size={12} />}</span>{service.name}</label>)}</div></fieldset>
              <p className="discover-scope">Nest searches public service pages. Selecting a service doesn’t connect your subscription. Czech availability, prices, and age suitability need a parent’s check.</p>
            </form>
            <div className="discover-examples"><span>Try asking</span>{examples.map(example => <button key={example} type="button" onClick={() => setQuery(example)}>{example}<ArrowRight size={13} /></button>)}</div>
          </section>
          {config && !config.configured && <aside className="discover-setup"><div className="discover-setup-icon"><Sparkles size={21} /></div><div><h3>Connect AI search when you’re ready.</h3><p>AI search needs an OpenAI API key on the server. You can already paste and save video links.</p><details><summary>How to enable AI search</summary><ol><li>Open this Nest service in your Render dashboard.</li><li>In <strong>Environment</strong>, add <code>NEST_AI_API_KEY</code> with your OpenAI API key as its value.</li><li>Save the change, wait for the deployment to finish, then refresh this page.</li></ol><p>Keep the key in Render’s private environment settings. Searches use your OpenAI API account and may incur charges.</p></details><button type="button" className="discover-inline-link" onClick={() => setMode('link')}>Add a video link instead <ArrowRight size={14} /></button></div></aside>}
          {!config && !error && <p className="discover-loading" role="status"><LoaderCircle className="spin" size={17} /> Checking search connection…</p>}
          {searching && <div className="discover-search-progress" role="status"><LoaderCircle size={25} className="spin" /><h3>Looking for something wonderful…</h3><p>Searching public pages from your selected services. This can take a little while.</p></div>}
          {response && <section className="discover-results" aria-label="Search results"><div className="discover-results-heading"><div><span className="discover-eyebrow">SUGGESTIONS FOR YOUR NEST</span><h2>{response.results.length ? `${response.results.length} ${response.results.length === 1 ? 'find' : 'finds'} to explore` : 'No supported video links found'}</h2><p>For “{response.query}” · Czechia</p></div></div>{response.summary && <p className="discover-summary">{response.summary}</p>}{response.warnings.length > 0 && <div className="discover-warnings">{response.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}{!response.results.length && <div className="discover-empty"><Search size={28} /><p>Try an exact title or fewer services, or paste a link you already have.</p><button type="button" className="button button-soft" onClick={() => setMode('link')}>Add a link</button></div>}<div className="discover-result-grid">{response.results.map(item => <article className="discover-result" key={item.id}><div className={`discover-result-cover provider-${item.source}`}><Film size={37} strokeWidth={1.3} />{item.thumbnail && <img src={item.thumbnail} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} />}<span>{item.providerName}</span></div><div className="discover-result-content"><h3>{item.title}</h3>{item.description && <p className="discover-description">{item.description}</p>}{item.reason && <p className="discover-reason"><Sparkles size={14} /><span>{item.reason}</span></p>}<div className="discover-result-meta"><span><Clock3 size={13} />{runtime(item.durationSeconds)}</span><span>Availability unverified</span></div><div className="discover-evidence">{item.evidence.map((evidence, index) => <a key={`${evidence.url}-${index}`} href={evidence.url} target="_blank" rel="noopener noreferrer">{evidence.title || 'View source'}<ExternalLink size={12} /></a>)}</div>{saveButton(item, item.title)}</div></article>)}</div><p className="discover-reference-note"><LockKeyhole size={14} />Saved streaming links are parent references. Adding a link doesn’t enable controlled child playback.</p></section>}
        </> : <section className="discover-link-panel"><div className="discover-panel-heading"><div><span className="discover-eyebrow">FOUND SOMETHING YOU LOVE?</span><h2>Bring the link into Nest.</h2></div><Link2 size={25} /></div><p className="discover-link-intro">Paste a video or title link from YouTube, Netflix, Disney+, Prime Video, or HBO Max. Nest will recognize the service and import public details where available.</p><form onSubmit={analyze} className="discover-link-form"><label htmlFor="nest-video-link">Video link</label><div><input id="nest-video-link" type="url" inputMode="url" autoComplete="off" required maxLength={2048} placeholder="https://www.netflix.com/watch/…" value={url} onChange={event => { analysisVersion.current += 1; setUrl(event.target.value); setAnalysis(null); }} /><button className="button button-primary" disabled={analyzing || !url.trim()}>{analyzing ? <LoaderCircle size={17} className="spin" /> : <Link2 size={17} />}{analyzing ? 'Reading link…' : 'Read link'}</button></div></form>{analysis && <div className="discover-analysis"><div className="discover-analysis-heading"><span className={`discover-provider provider-${analysis.source}`}>{analysis.providerName}</span><span><CheckCircle2 size={15} /> Link recognized</span></div><dl><div><dt>Content type</dt><dd>{analysis.kind === 'unknown' ? 'Not available' : analysis.kind}</dd></div><div><dt>Content ID</dt><dd>{analysis.contentId}</dd></div><div><dt>Length</dt><dd>{runtime(analysis.metadata.durationSeconds)}</dd></div></dl><a className="discover-canonical" href={analysis.url} target="_blank" rel="noopener noreferrer">{analysis.url}<ExternalLink size={14} /></a>{analysis.metadata.thumbnail && <img className="discover-link-thumbnail" src={analysis.metadata.thumbnail} alt="Imported video thumbnail" />}<div className="discover-title-field"><label htmlFor="nest-link-title">Title for your library</label><input id="nest-link-title" value={title} maxLength={200} required placeholder="Give this video a name" onChange={event => setTitle(event.target.value)} />{!analysis.metadata.title && <p>This service’s title isn’t available through its public link. Add a name before saving.</p>}</div>{analysis.warnings.length > 0 && <div className="discover-warnings">{analysis.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}<div className="discover-analysis-actions">{saveButton(analysis, title)}<span><LockKeyhole size={13} />Parent reference</span></div></div>}<p className="discover-reference-note"><ShieldCheck size={15} />A service link identifies content. It doesn’t give Nest control over that service’s player, intro, or episode ending.</p></section>}
        <footer className="discover-footer"><img src="/nest.svg" alt="" /><span>Chosen with care. Kept together in Nest.</span><a href="/library">Your family library <ArrowRight size={14} /></a></footer>
      </>}
    </main>
    {gate && library && <ParentGate configured={library.pinConfigured} onClose={() => setGate(false)} onDone={() => { setGate(false); void refresh(); }} />}
  </div>;
}
