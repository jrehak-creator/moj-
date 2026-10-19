import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ClipboardCheck, Clock3, Download, ExternalLink, Film, FlaskConical, Heart, HelpCircle, Leaf, LoaderCircle, LockKeyhole, Play, Plus, RotateCcw, ShieldCheck, Tablet, X } from 'lucide-react';
import { ParentGate } from './App';
import type { Library, Video } from './types';

type Outcome = 'not-tested' | 'pass' | 'fail';
const checks = [
  { id: 'title', title: 'The exact approved movie or episode played', detail: 'Verify the actual video, not just the show’s page.' },
  { id: 'touch', title: 'Touch and gestures could not reach other content', detail: 'Try tapping, swiping, and revealing the player controls after disabling touch.' },
  { id: 'ending', title: 'No unapproved title started at the end', detail: 'Observe the actual ending and credits, including any next-episode countdown.' },
  { id: 'return', title: 'A parent could unlock and return to Nest', detail: 'Manually end Guided Access and return to this Safari tab.' },
  { id: 'limit', title: 'The Guided Access time limit behaved as expected', detail: 'Observe the screen and audio when the iPad’s time limit expires. Do not assume it stops playback.' },
] as const;
interface Trial {
  id: string;
  title: string;
  url: string;
  reminderMinutes: number;
  preparedAt: number;
  startedAt: number | null;
  results: Record<string, Outcome>;
  notes: string;
  playbackApp: string;
  device: string;
  recordedAt?: number;
}
const storageKey = 'nest-ipad-trial-v1';
const reportKey = 'nest-ipad-reports-v1';
const blankChecks = () => Object.fromEntries(checks.map(check => [check.id, 'not-tested' as Outcome]));
function readTrial(): Trial | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!value || typeof value.title !== 'string' || !Number.isFinite(value.preparedAt) || !Number.isFinite(value.reminderMinutes)) return null;
    const url = new URL(value.url);
    if (url.protocol !== 'https:' || url.hostname !== 'www.netflix.com' || !/^\/(title|watch)\/\d{4,16}$/.test(url.pathname)) return null;
    return { ...value, results: { ...blankChecks(), ...value.results } };
  } catch { return null; }
}
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json().catch(() => ({ error: 'The server could not complete this request.' }));
  if (!response.ok) throw new Error(data.error || 'Please try again.');
  return data;
}
function canonicalNetflix(input: string) {
  const url = new URL(input);
  if (!['https:', 'http:'].includes(url.protocol) || !['netflix.com', 'www.netflix.com'].includes(url.hostname) || url.username || url.password || url.port) throw new Error('Use a Netflix title or watch link.');
  const match = url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(title|watch)\/(\d{4,16})\/?$/i);
  if (!match) throw new Error('Use netflix.com/watch/… for an exact video, or netflix.com/title/… to let a parent choose the episode.');
  return `https://www.netflix.com/${match[1].toLowerCase()}/${match[2]}`;
}
function outcomeSummary(results: Trial['results']) {
  const values = checks.map(check => results[check.id]);
  if (values.includes('fail')) return 'Needs changes';
  if (values.some(value => value !== 'pass')) return 'Test incomplete';
  return 'Observed checks passed';
}
function shortTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }

export default function IpadPilot() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState('');
  const [gate, setGate] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [minutes, setMinutes] = useState('2');
  const [trial, setTrial] = useState<Trial | null>(readTrial);
  const [launchReady, setLaunchReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preflight, setPreflight] = useState<boolean[]>([false, false, false]);
  const [guide, setGuide] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [saved, setSaved] = useState(false);
  const [isIpad] = useState(() => /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  async function refresh() {
    try { setLibrary(await request<Library>('/api/library')); setError(''); }
    catch (error) { setError((error as Error).message); }
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);
  function persist(value: Trial | null) {
    try { if (value) localStorage.setItem(storageKey, JSON.stringify(value)); else localStorage.removeItem(storageKey); }
    catch { throw new Error('Safari storage is unavailable. Enable website storage before starting this test.'); }
    setTrial(value); setSaved(false);
  }
  const remaining = trial?.startedAt ? Math.max(0, Math.ceil((trial.startedAt + trial.reminderMinutes * 60000 - now) / 1000)) : null;
  const step = !trial ? 1 : !trial.startedAt ? 2 : 3;
  const savedVideos = library?.parent && !library.demo ? library.videos.filter(video => video.source === 'netflix') : [];

  async function prepare(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const normalized = canonicalNetflix(url.trim());
      if (!title.trim()) throw new Error('Give this session a title.');
      const reminder = Number(minutes);
      if (!Number.isFinite(reminder) || reminder < 1 || reminder > 240) throw new Error('Set a parent check-in from 1 to 240 minutes.');
      const existing = savedVideos.find(video => video.url === normalized && video.title === title.trim());
      if (!existing) await request('/api/videos', { method: 'POST', body: JSON.stringify({ title: title.trim(), url: normalized, source: 'netflix', approved: false, duration: null, collection: 'Stories & imagination', artwork: 'stories', tags: ['iPad pilot'], description: 'Parent-assisted iPad playback test. Not verified for independent child use.', creator: 'Netflix', age: '', thumbnail: '' }) });
      const next: Trial = { id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: title.trim(), url: normalized, reminderMinutes: reminder, preparedAt: Date.now(), startedAt: null, results: blankChecks(), notes: '', playbackApp: 'Not recorded', device: '' };
      persist(next);
      await refresh();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  async function readyForHandoff() {
    setError(''); setBusy(true);
    try {
      await request('/api/auth/logout', { method: 'POST' });
      setLibrary(old => old && { ...old, parent: false, videos: [] });
      setLaunchReady(true);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  function launch(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!trial) { event.preventDefault(); return; }
    try { persist({ ...trial, startedAt: Date.now() }); setLaunchReady(false); }
    catch (error) { event.preventDefault(); setError((error as Error).message); }
  }
  async function logout() {
    try { await request('/api/auth/logout', { method: 'POST' }); await refresh(); setLaunchReady(false); }
    catch (error) { setError((error as Error).message); }
  }
  function updateTrial(values: Partial<Trial>) {
    if (!trial) return;
    try { persist({ ...trial, ...values }); } catch (error) { setError((error as Error).message); }
  }
  function saveReport() {
    if (!trial) return;
    try {
      const report = { ...trial, recordedAt: Date.now() };
      const stored = JSON.parse(localStorage.getItem(reportKey) || '[]');
      const reports: Trial[] = Array.isArray(stored) ? stored : [];
      localStorage.setItem(reportKey, JSON.stringify([report, ...reports.filter(item => item.id !== trial.id)].slice(0, 30)));
      persist(report); setSaved(true); setError('');
    } catch { setError('Could not save the report. Check Safari website storage.'); }
  }
  function downloadReport() {
    if (!trial) return;
    const report = { ...trial, summary: outcomeSummary(trial.results), scope: 'Manual observation on the recorded iPad only. Web app cannot control Netflix or Guided Access.', exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = `nest-ipad-test-${new Date(trial.preparedAt).toISOString().slice(0, 10)}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  function reset() {
    try { persist(null); setLaunchReady(false); setPreflight([false, false, false]); setError(''); }
    catch (error) { setError((error as Error).message); }
  }
  function selectVideo(video: Video) { setTitle(video.title); setUrl(video.url); }

  return <div className="pilot-app">
    <header className="pilot-header"><a className="brand" href="/" aria-label="Nest home"><img src="/nest.svg" alt="" /><span>nest<span className="brand-dot">.</span></span></a><span className="pilot-header-center"><FlaskConical size={14} /> THE IPAD EXPERIMENT</span><div className="pilot-header-actions"><button className="pilot-guide-button" onClick={() => setGuide(value => !value)}><HelpCircle size={16} /><span>How it works</span></button>{library?.parent ? <button className="pilot-lock-button" onClick={() => void logout()}><LockKeyhole size={14} /> Lock parent controls</button> : <button className="pilot-lock-button" onClick={() => setGate(true)}><LockKeyhole size={14} /> Parent access</button>}</div></header>
    <main className="pilot-main">
      <section className="pilot-intro"><div><span className="pilot-eyebrow"><span /> ONE IPAD. ONE TITLE. ONE LITTLE TEST.</span><h1>A little less wandering.<br /><em>A little more wonder.</em></h1><p>Let’s see if a chosen Netflix video can stay just that.<br className="desktop-break" /> A small, parent-assisted test before a bigger adventure.</p><div className="pilot-device-tag"><Tablet size={14} />{isIpad ? 'You’re on an iPad · Ready for a device test' : 'Prepare here · Run the playback test on an iPad'}</div></div><div className="pilot-intro-art"><img src="/artwork/hero.svg" alt="A bear and rabbit exploring a peaceful green landscape" /><span><Heart size={12} /> Good things, picked by you.</span></div></section>
      <div className="pilot-scope"><ShieldCheck size={20} /><div><strong>The parent stays in the loop.</strong><p>Nest prepares the session. You start the exact video, activate Guided Access, and return here yourself. This website cannot lock Netflix or detect when it finishes.</p></div><span className="pilot-experiment-label">FEASIBILITY TEST</span></div>
      {guide && <section className="pilot-guide" aria-label="How the iPad experiment works"><div className="pilot-panel-heading"><h2>A small test. A clear answer.</h2><button className="icon-button" aria-label="Close guide" onClick={() => setGuide(false)}><X size={18} /></button></div><ol><li>On the iPad, enable <strong>Settings → Accessibility → Guided Access</strong>. Set a parent-only passcode.</li><li>In the Netflix profile, check autoplay settings. Choose a short, suitable video, or move to its closing minutes before locking touch.</li><li>Start that exact video. Use the iPad’s accessibility shortcut to open Guided Access. In Options, turn <strong>Touch off</strong>, choose a short time limit, and start.</li><li>Stay nearby. Try navigation gestures, observe the real ending and time-limit behavior, then manually unlock and return to this Safari tab.</li></ol><p className="pilot-guide-footnote">Touch off also disables on-screen play/pause. The shortcut depends on the iPad model. Browser tab locks and fullscreen are not substitutes for Guided Access.</p><a href="https://support.apple.com/en-us/111795" target="_blank" rel="noopener noreferrer" className="pilot-external-help">Apple’s Guided Access instructions <ExternalLink size={12} /></a></section>}
      <nav className="pilot-steps" aria-label="Test progress">{[{ n: 1, title: 'Pick one good thing', description: 'Choose the video' }, { n: 2, title: 'A grown-up handoff', description: 'Start & restrict touch' }, { n: 3, title: 'See what happened', description: 'Record the real result' }].map(({ n, title: name, description }) => <div key={n} className={`${step === n ? 'current' : ''} ${step > n ? 'completed' : ''}`} aria-current={step === n ? 'step' : undefined}><span className="pilot-step-number">{step > n ? <Check size={15} /> : `0${n}`}</span><div><strong>{name}</strong><small>{description}</small></div>{n < 3 && <ArrowRight size={15} />}</div>)}</nav>

      {error && <div className="pilot-error" role="alert">{error}{!library && <button className="button button-soft" onClick={() => void refresh()}>Try connection again</button>}</div>}
      {!library && !error ? <div className="pilot-loading"><LoaderCircle className="spin" size={25} /> Getting your Nest ready…</div> : !trial ? <div className="pilot-content-grid"><section className="pilot-panel"><div className="pilot-panel-heading"><div><span className="pilot-eyebrow">START SMALL</span><h2>What are we watching?</h2></div><span className="pilot-netflix">N</span></div><p className="pilot-panel-description">One Netflix title on one iPad. We’ll test the boundary before we add more services.</p>{!library?.parent ? <div className="pilot-parent-gate"><span><LockKeyhole size={27} /></span><h3>A little help from a grown-up.</h3><p>{library?.pinConfigured ? 'Unlock parent access to choose the video and prepare this test.' : 'Create a parent PIN to choose a video. Your real library starts empty; example cards are removed.'}</p><button className="button button-primary" disabled={!library} onClick={() => setGate(true)}><LockKeyhole size={15} />{library?.pinConfigured ? 'Unlock parent access' : 'Create parent PIN'}<ArrowRight size={15} /></button><small>Your PIN protects library changes. It does not control Netflix.</small></div> : <form onSubmit={prepare} className="pilot-form">{savedVideos.length > 0 && <label>Choose a saved title<div className="pilot-select"><select aria-label="Choose a saved Netflix title" defaultValue="" onChange={e => { const video = savedVideos.find(item => item.id === e.target.value); if (video) selectVideo(video); }}><option value="">Start with a saved video, or add one below</option>{savedVideos.map(video => <option key={video.id} value={video.id}>{video.title}</option>)}</select><ChevronDown size={14} /></div></label>}<label>Movie or episode name<input required maxLength={200} value={title} placeholder="e.g. Our Planet · Episode 1" onChange={e => setTitle(e.target.value)} /></label><label>Netflix video link<input required type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.netflix.com/watch/…" /><small>A /watch/ link identifies a video. A /title/ link may open a title page; a parent must select the exact episode.</small></label><label>Parent check-in after<div className="pilot-time-input"><Clock3 size={17} /><input aria-label="Check-in minutes" type="number" min="1" max="240" step="1" value={minutes} onChange={e => setMinutes(e.target.value)} required /><span>minutes</span></div><small>This is a foreground reminder, not a playback timer. Set a separate iPad Clock alarm for the actual test.</small></label><div className="pilot-form-footer"><span><LockKeyhole size={13} /> Saved as a parent-only reference</span><button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle size={15} className="spin" /> : <>Prepare the test <ArrowRight size={15} /></>}</button></div></form>}</section><aside className="pilot-side-card"><span className="pilot-side-icon"><Leaf size={24} /></span><h3>What we’re finding out.</h3><p>Can the iPad keep little hands on one chosen story?</p><ul><li><CheckCircle2 size={15} /> The right title starts.</li><li><CheckCircle2 size={15} /> Touch can’t lead elsewhere.</li><li><CheckCircle2 size={15} /> No next title starts on its own.</li><li><CheckCircle2 size={15} /> A grown-up can return here.</li></ul><div className="pilot-side-bottom"><Tablet size={29} /><span>Real device. Real observations.<br />No assumed passes.</span></div></aside></div> : !trial.startedAt ? <div className="pilot-content-grid"><section className="pilot-panel"><div className="pilot-panel-heading"><div><span className="pilot-eyebrow">JUST BEFORE THE ADVENTURE</span><h2>A grown-up handoff.</h2></div><span className="pilot-round-icon"><ShieldCheck size={22} /></span></div><div className="pilot-chosen-title"><span className="pilot-netflix">N</span><div><small>THE ONE CHOSEN VIDEO</small><strong>{trial.title}</strong><span>{trial.url.includes('/watch/') ? 'Specific video link · Verify the episode in Netflix' : 'Title page link · Choose the exact episode in Netflix'}</span></div></div>{launchReady ? <div className="pilot-launch-ready"><div className="pilot-inline-status"><LockKeyhole size={16} /> Nest’s parent controls are locked.</div><h3>Start the video. Then lock touch.</h3><ol><li>Open Netflix and start the exact movie or episode.</li><li>Activate Guided Access, turn <strong>Touch off</strong>, set a short time limit, and start.</li><li>Keep the iPad with you until those restrictions are active.</li></ol><a className="button button-primary button-full" href={trial.url} onClick={launch}>Open Netflix — parent action <ExternalLink size={15} /></a><p>iPadOS may open the Netflix app or a Safari page. Either outcome needs recording. Return to this tab manually after the test.</p></div> : library?.parent ? <><p className="pilot-panel-description">Before opening Netflix, check these three things yourself.</p><div className="pilot-preflight">{['Guided Access is enabled, and I know the parent passcode and exit shortcut.', 'I have checked Netflix’s autoplay settings and will verify the exact video.', 'I’ll stay nearby, set an iPad Clock alarm, and activate touch restrictions before handing over the device.'].map((label, i) => <label key={label}><input type="checkbox" checked={preflight[i]} onChange={e => setPreflight(old => old.map((value, index) => index === i ? e.target.checked : value))} /><span>{label}</span></label>)}</div><div className="pilot-action-row"><button className="button button-plain" onClick={reset}><ArrowLeft size={15} /> Change title</button><button className="button button-primary" disabled={busy || !preflight.every(Boolean)} onClick={() => void readyForHandoff()}>{busy ? <LoaderCircle className="spin" size={15} /> : <LockKeyhole size={15} />} Lock Nest & prepare handoff</button></div></> : <div className="pilot-parent-gate compact"><LockKeyhole size={25} /><h3>A grown-up needs to start this.</h3><p>No service link is available until a parent unlocks this step.</p><button className="button button-primary" onClick={() => setGate(true)}>Unlock parent access</button></div>}</section><aside className="pilot-side-card pilot-side-warm"><span className="pilot-side-icon"><HelpCircle size={24} /></span><h3>Lock touch.<br />Check autoplay.</h3><p>These do different jobs. Guided Access blocks interaction; Netflix’s own settings determine what plays next.</p><div className="pilot-note-divider" /><p>Touch off also turns off on-screen play/pause. A parent will need to intervene to pause.</p><button className="pilot-text-link" onClick={() => setGuide(true)}>Show the setup steps <ArrowRight size={14} /></button></aside></div> : <section className="pilot-panel pilot-result-panel"><div className="pilot-panel-heading"><div><span className="pilot-eyebrow">BACK IN YOUR NEST</span><h2>What really happened?</h2></div><span className="pilot-round-icon"><ClipboardCheck size={23} /></span></div><div className="pilot-session-overview"><div><span className="pilot-netflix">N</span><strong>{trial.title}</strong></div><div className={`pilot-reminder ${remaining === 0 ? 'due' : ''}`}><Clock3 size={16} /><span>{remaining === 0 ? 'Time for a parent check-in' : `Parent check-in in ${shortTime(remaining || 0)}`}</span></div></div><p className="pilot-timer-note">This counts elapsed time since the Netflix link was tapped. It cannot track the video, pause with playback, stop Netflix, or alert reliably while Safari is in the background.</p>{!library?.parent ? <div className="pilot-parent-gate compact"><span><LockKeyhole size={26} /></span><h3>Leave the observations to a grown-up.</h3><p>Finish Guided Access manually, return to Safari, then unlock to record the test. Nest hasn’t detected whether playback ended.</p><button className="button button-primary" onClick={() => setGate(true)}><LockKeyhole size={15} /> Parent: record the results</button></div> : <><div className="pilot-observation-fields"><label>Where did the link open?<select value={trial.playbackApp} onChange={e => updateTrial({ playbackApp: e.target.value })}><option>Not recorded</option><option>Netflix app</option><option>Safari player</option><option>Title page only</option><option>Could not start playback</option></select></label><label>iPad model / iPadOS version <span>optional</span><input value={trial.device} maxLength={150} placeholder="e.g. iPad Air, iPadOS …" onChange={e => updateTrial({ device: e.target.value })} /></label></div><div className="pilot-results-heading"><h3>Mark only what you observed.</h3><span>No result is pre-filled as passed.</span></div><div className="pilot-observation-list">{checks.map((check, index) => <div key={check.id} className="pilot-observation"><span className="pilot-check-index">0{index + 1}</span><div><label htmlFor={`result-${check.id}`}>{check.title}</label><p>{check.detail}</p></div><select id={`result-${check.id}`} className={`result-${trial.results[check.id]}`} value={trial.results[check.id]} onChange={e => updateTrial({ results: { ...trial.results, [check.id]: e.target.value as Outcome } })}><option value="not-tested">Not tested</option><option value="pass">Passed</option><option value="fail">Failed</option></select></div>)}</div><label className="pilot-notes-label">Anything we should know?<textarea rows={3} value={trial.notes} maxLength={4000} placeholder="Did another episode start? Could the child leave the player? What happened when the time limit expired?" onChange={e => updateTrial({ notes: e.target.value })} /></label><div className="pilot-report-summary"><span className={`pilot-result-status ${outcomeSummary(trial.results) === 'Needs changes' ? 'has-failure' : ''}`}><ClipboardCheck size={16} />{outcomeSummary(trial.results)}</span><p>Observations apply to this iPad, profile, and video. They don’t establish support for every title or device.</p></div><div className="pilot-report-actions"><button className="button button-plain" onClick={reset}><Plus size={15} /> New test</button><div><button className="button button-soft" onClick={downloadReport}><Download size={15} /> Export JSON</button><button className="button button-primary" onClick={saveReport}>{saved ? <CheckCircle2 size={15} /> : <ClipboardCheck size={15} />}{saved ? 'Observations saved' : 'Save observations'}</button></div></div><p className="pilot-local-note">Reports stay in this Safari browser’s storage. Export a copy to keep or share them. Your title reference is saved in the shared family library.</p></>}</section>}
      <div className="pilot-bottom-strip"><span><Film size={20} /></span><div><strong>One experiment before a whole library.</strong><p>AI discovery, more services, and automatic handoffs come later. First, let’s test the part that matters most.</p></div><a href="/library">Library preview <ArrowRight size={13} /></a></div>
      <footer className="pilot-footer"><span><img src="/nest.svg" alt="" /> Small steps. Thoughtful screens.</span><span>Made for a little more peace of mind.</span></footer>
    </main>
    {gate && library && <ParentGate configured={library.pinConfigured} onClose={() => setGate(false)} onDone={() => { setGate(false); void refresh(); }} />}
  </div>;
}
