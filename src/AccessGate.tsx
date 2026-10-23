import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';

interface Access { required: boolean; authenticated: boolean }

/** The site PIN is deliberately separate from the parent editing PIN. */
export default function AccessGate({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  async function check() {
    try {
      const response = await fetch('/api/access', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not check access. Please try again.');
      const result = await response.json();
      if (typeof result.required !== 'boolean' || typeof result.authenticated !== 'boolean') throw new Error('The app could not verify access.');
      setAccess(result); setError('');
    } catch (error) { setError((error as Error).message); }
  }
  useEffect(() => { void check(); }, []);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  async function unlock(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/access/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'That PIN did not work.');
      setPin(''); setAccess(result);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  async function lockWebsite() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/access/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error('Could not lock the website. Please try again.');
      setAccess(await response.json());
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  if (access && (!access.required || access.authenticated)) return <>{children}{access.required && <div className="site-lock-control">{error && <span role="alert">{error}</span>}<button disabled={busy} onClick={() => void lockWebsite()}><LockKeyhole size={14} /> Lock website</button></div>}</>;
  return <div className="site-access-page"><a className="brand" href="/" aria-label="Nest home"><img src="/nest.svg" alt="" /><span>nest<span className="brand-dot">.</span></span></a><main className="site-access-card"><div className="site-access-emblem"><LockKeyhole size={27} /></div><span className="eyebrow">PRVÉ NASTAVENIE KNIŽNICE</span><h1>Nastavenie rodičovského prístupu</h1><p>{access ? 'Zadajte administračný PIN pre prvé nastavenie rodičovskej knižnice.' : 'Overujem prístup…'}</p>{access ? <form onSubmit={unlock}><label htmlFor="site-access-pin">Administračný PIN</label><input id="site-access-pin" type="password" inputMode="numeric" pattern="[0-9]{8,12}" minLength={8} maxLength={12} required autoComplete="current-password" placeholder="8–12 digits" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-primary button-full" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <>Pokračovať <ArrowRight size={17} /></>}</button></form> : error ? <><div className="form-error" role="alert">{error}</div><button className="button button-primary" onClick={() => void check()}>Try again</button></> : <LoaderCircle size={24} className="spin" />}<div className="site-access-note"><ShieldCheck size={16} /><span>Tento PIN chráni prvé nastavenie. Pri bežnom používaní zadávate iba rodičovský PIN.</span></div></main><footer>Small moments. A little more peace of mind.</footer></div>;
}
