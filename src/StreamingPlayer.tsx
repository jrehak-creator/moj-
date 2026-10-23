import { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, Play, ShieldCheck, Square } from 'lucide-react';
import { youtubeEmbedUrl } from './player';
import './player.css';

/** YouTube's official player; its ads and navigation remain controlled by YouTube. */
export default function YouTubeStage({ url, title, parentPreview = true }: { url: string; title: string; parentPreview?: boolean }) {
  const [stopped, setStopped] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const playerRef = useRef<HTMLElement>(null);
  useEffect(() => { setStopped(false); setFailed(false); }, [url]);
  useEffect(() => {
    const player = playerRef.current;
    const changed = () => setNativeFullscreen(document.fullscreenElement === player);
    document.addEventListener('fullscreenchange', changed);
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      if (document.fullscreenElement === player) void document.exitFullscreen().catch(() => {});
    };
  }, []);
  async function fullscreen() {
    if (expanded) { setExpanded(false); return; }
    if (document.fullscreenElement === playerRef.current) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    try {
      if (playerRef.current?.requestFullscreen) {
        await playerRef.current.requestFullscreen();
        return;
      }
    } catch { /* Safari can require a viewport layout instead of the Fullscreen API. */ }
    setExpanded(true);
  }
  let embed = '';
  try { embed = youtubeEmbedUrl(url, window.location.origin); } catch { /* Show a safe local error below. */ }
  return <section ref={playerRef} className={`youtube-player ${expanded ? 'youtube-player-expanded' : ''}`} aria-label={`Prehrávač YouTube: ${title}`}>
    <div className="youtube-player-frame">
      {!embed || failed ? <div className="youtube-player-message" role="alert"><h3>Video sa nepodarilo otvoriť.</h3><p>Skontrolujte odkaz alebo vyberte iné video. Niektoré videá nepovoľujú prehrávanie v aplikácii.</p></div> : stopped ? <div className="youtube-player-message" role="status"><Play size={32} /><h3>Prehrávanie je zastavené.</h3><p>Stále ste v Nest. Vybrané video môžete spustiť znova.</p></div> : <iframe
        src={embed}
        title={`YouTube video: ${title}`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation"
        referrerPolicy="strict-origin-when-cross-origin"
        onError={() => setFailed(true)}
      />}
    </div>
    <div className="youtube-player-controls"><span><ShieldCheck size={15} /> {parentPreview ? 'Rodičovský režim · ' : ''}YouTube</span><div className="youtube-player-actions"><button type="button" className="button button-soft" onClick={() => void fullscreen()}>{expanded || nativeFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}{expanded || nativeFullscreen ? 'Zmenšiť obrazovku' : 'Celá obrazovka'}</button>{embed && <button type="button" className="button button-soft" onClick={() => { setStopped(stopped || failed ? false : true); setFailed(false); }}>{stopped || failed ? <Play size={16} /> : <Square size={15} />}{stopped || failed ? 'Prehrať znova' : 'Zastaviť video'}</button>}</div></div>
    <p className="youtube-player-note">YouTube sa prehráva priamo v Nest. Jeho prehrávač môže zobrazovať reklamy, odporúčania a odkazy na ďalší obsah.</p>
  </section>;
}
