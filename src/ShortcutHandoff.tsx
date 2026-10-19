import { ArrowRight, CheckCircle2, ExternalLink, Layers3, LockKeyhole } from 'lucide-react';
import type { MouseEventHandler } from 'react';
import { defaultShortcutName, handoffUrl, type LaunchMethod } from './handoff';

interface Props {
  method: LaunchMethod;
  name: string;
  confirmed: boolean;
  disabled: boolean;
  onChange: (value: { launchMethod?: LaunchMethod; shortcutName?: string; shortcutConfirmed?: boolean }) => void;
}

export function HandoffLaunch({ url, method = 'direct', name = defaultShortcutName, onLaunch }: { url: string; method?: LaunchMethod; name?: string; onLaunch: MouseEventHandler<HTMLAnchorElement> }) {
  const shortcut = method === 'shortcut';
  return <div className="pilot-launch-ready">
    <div className="pilot-inline-status"><LockKeyhole size={16} /> Nest’s parent controls are locked.</div>
    <h3>{shortcut ? 'Run this video through your Shortcut.' : 'Start the video. Then lock touch.'}</h3>
    {shortcut ? <ol><li>Tap below. If Safari asks to open Shortcuts, confirm.</li><li>Your <strong>{name}</strong> Shortcut should open the selected Netflix link, wait 15 seconds, and attempt to start Guided Access.</li><li>Stay with the iPad. Confirm the exact episode is playing and check that touch is disabled. Use your Guided Access passcode to exit if the wrong screen locks.</li></ol> : <ol><li>Open Netflix and start the exact movie or episode.</li><li>Once playback is running, activate Guided Access manually or run your working locking Shortcut. Verify that <strong>Touch is off</strong>.</li><li>Keep the iPad with you until those restrictions are active.</li></ol>}
    <a className="button button-primary button-full" href={handoffUrl(url, method, name)} onClick={onLaunch}>{shortcut ? 'Run iPad Shortcut — parent action' : 'Open Netflix — parent action'} <ExternalLink size={15} /></a>
    <p>{shortcut ? 'This explicitly invokes your installed Shortcut for this video. The website cannot verify its actions or whether Guided Access started. Record what happens after returning manually to Safari.' : 'iPadOS may open the Netflix app or a Safari page. Either outcome needs recording. Return to this tab manually after the test.'}</p>
  </div>;
}

export type ShortcutOutcome = 'not-tested' | 'automatic' | 'confirmation' | 'failed';

export function ShortcutObservation({ outcome, onChange }: { outcome: ShortcutOutcome; onChange: (outcome: ShortcutOutcome) => void }) {
  return <div className="shortcut-observation"><label htmlFor="shortcut-outcome">Did the Shortcut start Guided Access for the selected video?</label><select id="shortcut-outcome" value={outcome} onChange={e => onChange(e.target.value as ShortcutOutcome)}><option value="not-tested">Not tested</option><option value="automatic">Started automatically on the correct video</option><option value="confirmation">Asked for confirmation</option><option value="failed">Did not lock, or locked the wrong screen</option></select><p>Choose only what you observed on the iPad. Opening Shortcuts or Netflix does not itself establish that touch was restricted.</p></div>;
}

export default function ShortcutHandoff({ method, name, confirmed, disabled, onChange }: Props) {
  return <fieldset className="shortcut-handoff" disabled={disabled}>
    <legend>How should Nest start this video?</legend>
    <label htmlFor="launch-method">Launch method</label>
    <select id="launch-method" value={method} onChange={e => onChange({ launchMethod: e.target.value as LaunchMethod, shortcutConfirmed: false })}>
      <option value="direct">Netflix first — start touch lock afterward</option>
      <option value="shortcut">iPad Shortcut — experiment</option>
    </select>
    {method === 'shortcut' && <div className="shortcut-settings">
      <div className="shortcut-explanation"><Layers3 size={19} /><p>Nest will explicitly run your Shortcut with this video’s link, even if Netflix is already open. The Shortcut must be installed on this iPad.</p></div>
      <label htmlFor="shortcut-name">Installed Shortcut name</label>
      <input id="shortcut-name" maxLength={80} value={name} placeholder={defaultShortcutName} autoComplete="off" onChange={e => onChange({ shortcutName: e.target.value, shortcutConfirmed: false })} />
      <details className="shortcut-recipe"><summary>Set up the Shortcut once</summary><p>In Apple Shortcuts, create a regular shortcut named <strong>{name.trim() || defaultShortcutName}</strong>. Add these actions in order:</p><ol><li><strong>Open URLs</strong> → use the <strong>Shortcut Input</strong> variable.</li><li><strong>Wait</strong> → 15 seconds.</li><li><strong>Start Guided Access</strong>, if available on your iPad.</li></ol><p>Use Shortcut Input so the selected episode is passed through. An “app opened” automation or an “Open App: Netflix” action alone will not receive the episode link.</p></details>
      <label className="shortcut-confirmation"><input type="checkbox" checked={confirmed} onChange={e => onChange({ shortcutConfirmed: e.target.checked })} /><span>I installed this Shortcut with this exact name and the three actions above.</span><CheckCircle2 size={18} /></label>
      <p className="shortcut-caution">The 15 seconds are a grace period. A login or profile screen could still be locked if playback isn’t ready. Keep the iPad with you, verify the selected video, and use the Guided Access passcode to exit.</p>
      <span className="shortcut-flow">Nest <ArrowRight size={12} /> Shortcuts <ArrowRight size={12} /> selected Netflix video</span>
    </div>}
  </fieldset>;
}
