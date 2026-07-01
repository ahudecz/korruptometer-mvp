'use client';

import { useState, useRef, type FormEvent, type DragEvent } from 'react';

const REGIONS = [
  'Budapest',
  'Pest',
  'Borsod-Abaúj-Zemplén',
  'Csongrád-Csanád',
  'Fejér',
  'Győr-Moson-Sopron',
  'Hajdú-Bihar',
  'Veszprém',
  'Egyéb',
];

const CRIMES = [
  'Korrupció',
  'Túlárazás',
  'Kartell',
  'Közbeszerzési csalás',
  'EU-csalás',
  'Hivatali visszaélés',
  'Sikkasztás',
  'Vesztegetés',
  'Hűtlen kezelés',
  'Pénzmosás',
  'Zsarolás',
  'Tiltott pártfinanszírozás',
  'Adócsalás',
  'Befolyással való üzérkedés',
  'Nepotizmus',
];

interface FormProps {
  initialName?: string;
  initialCrimes?: string[];
}

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ok'; ref: string }
  | { kind: 'err'; message: string };

function fmtSize(b: number): string {
  if (b > 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
  if (b > 1024) return (b / 1024).toFixed(0) + ' KB';
  return b + ' B';
}

/**
 * Mockup-fidelity submission form. Mirrors the 4-section layout from
 * 01-tesla/index.html (sections .form-section #01..#04 + .file-drop + .form-toggles).
 * Posts to /api/submissions (Phase 2 endpoint) when submitted.
 */
export function MockupSubmissionForm({ initialName = '', initialCrimes = [] }: FormProps = {}) {
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [anon, setAnon] = useState(true);
  const [contact, setContact] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList) {
    setFiles((prev) => {
      const next = [...prev];
      for (const f of Array.from(list)) {
        if (next.length >= 10) break;
        if (f.size > 25 * 1024 * 1024) continue;
        next.push(f);
      }
      return next;
    });
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ kind: 'pending' });
    const form = e.currentTarget;
    const fd = new FormData(form);

    const crimes: string[] = [];
    for (const c of CRIMES) {
      if (fd.get(`crime:${c}`) === 'on') crimes.push(c);
      fd.delete(`crime:${c}`);
    }
    fd.set('crimes', crimes.join(','));
    fd.set('allowContact', contact ? 'true' : 'false');
    if (!fd.get('turnstileToken')) fd.set('turnstileToken', '1x');
    fd.delete('files');
    for (const f of files) fd.append('files', f);

    try {
      const res = await fetch('/api/submissions', { method: 'POST', body: fd });
      const body = (await res.json()) as { ref?: string; error?: string };
      if (!res.ok) {
        setState({ kind: 'err', message: body.error ?? 'Ismeretlen hiba.' });
        return;
      }
      setState({ kind: 'ok', ref: body.ref ?? '?' });
    } catch (err) {
      setState({
        kind: 'err',
        message: err instanceof Error ? err.message : 'Hálózati hiba.',
      });
    }
  }

  if (state.kind === 'ok') {
    return (
      <div className="form-card">
        <div className="form-success">
          <div className="icon">✓</div>
          <h3>Megérkezett.</h3>
          <p>Köszönjük. A bejelentésedet a szerkesztőség 72 órán belül átnézi.</p>
          <div className="ref">REF: {state.ref}</div>
        </div>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={onSubmit} autoComplete="off">
      <div className="form-section">
        <h3>
          <span className="step">01</span> A gyanúsított
        </h3>
        <p>
          Akiről a bejelentés szól. Ha pontos adatokat nem ismersz, az is rendben van —
          egészítsük ki közösen.
        </p>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="s-name">
              Név <span className="req">*</span>
            </label>
            <input
              id="s-name"
              name="suspectName"
              type="text"
              required
              minLength={2}
              defaultValue={initialName}
              placeholder="Pl. Példa Péter, vagy »ismeretlen«"
            />
          </div>
          <div className="form-field">
            <label htmlFor="s-pos">Pozíció / cég</label>
            <input
              id="s-pos"
              name="suspectPosition"
              type="text"
              placeholder="Pl. Volt államtitkár, XY Kft. vezetője"
            />
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 18 }}>
          <div className="form-field">
            <label htmlFor="s-region">Régió</label>
            <select id="s-region" name="suspectRegion" defaultValue="">
              <option value="">Választás…</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="s-period">Időszak</label>
            <input id="s-period" name="period" type="text" placeholder="Pl. 2019–2022" />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3>
          <span className="step">02</span> A vád
        </h3>
        <p>Mi a gyanú? Több is választható.</p>
        <div className="crime-checks">
          {CRIMES.map((c, i) => (
            <div className="crime-check" key={c}>
              <input type="checkbox" id={`c${i + 1}`} name={`crime:${c}`} defaultChecked={initialCrimes.includes(c)} />
              <label htmlFor={`c${i + 1}`}>{c}</label>
            </div>
          ))}
        </div>
        <div className="form-row single" style={{ marginTop: 14 }}>
          <div className="form-field">
            <label htmlFor="s-crime-other">Egyéb</label>
            <input
              id="s-crime-other"
              name="crimeOther"
              type="text"
              placeholder="Írd le röviden, ha nem szerepel fent"
            />
          </div>
        </div>
        <div className="form-row single" style={{ marginTop: 18 }}>
          <div className="form-field">
            <label htmlFor="s-amount">Becsült kár (Ft)</label>
            <input
              id="s-amount"
              name="estimatedAmount"
              type="text"
              inputMode="numeric"
              placeholder="Pl. 850 000 000"
            />
          </div>
        </div>
        <div className="form-row single" style={{ marginTop: 18 }}>
          <div className="form-field">
            <label htmlFor="s-summary">
              Az ügy rövid leírása <span className="req">*</span>
            </label>
            <textarea
              id="s-summary"
              name="summary"
              required
              minLength={20}
              placeholder="Mi történt? Hogyan tudtál róla? Miért gondolod, hogy az adatbázisba való?"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3>
          <span className="step">03</span> Bizonyíték
        </h3>
        <p>
          Csak nyilvános forrásokat fogadunk el: <b>közbeszerzési hivatkozások</b>,{' '}
          <b>bírósági ügyiratszámok</b>, <b>cikkek</b>, <b>cégadatbázis-linkek</b>. Egy URL / sor.
        </p>
        <div className="form-row single">
          <div className="form-field">
            <label htmlFor="s-sources">
              Források (linkek, ügyiratszámok) <span className="req">*</span>
            </label>
            <textarea
              id="s-sources"
              name="sourceUrls"
              required
              placeholder={'https://kozbeszerzes.hu/...\nhttps://birosag.hu/ugyirat/12345\nhttps://telex.hu/cikk/...'}
            />
          </div>
        </div>
        <label
          className={`file-drop${drag ? ' drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          style={{ marginTop: 18 }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <div className="icon">+</div>
          <div className="lbl">
            Mellékletek hozzáadása · <b>kattints vagy ejtsd ide</b>
          </div>
          <div className="hint">
            PDF, kép, dokumentum vagy archív fájl · max. 25 MB / fájl · max. 10 fájl
          </div>
        </label>
        {files.length > 0 && (
          <div className="file-list">
            {files.map((f, i) => (
              <div className="file-item" key={`${f.name}-${i}`}>
                <span className="nm">{f.name}</span>
                <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <span className="sz">{fmtSize(f.size)}</span>
                  <button
                    type="button"
                    aria-label="Eltávolítás"
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    ×
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-section">
        <h3>
          <span className="step">04</span> Te
        </h3>
        <p>Megadhatod magad — vagy maradhatsz teljesen anonim.</p>
        <div className="form-toggles">
          <label className="toggle">
            <input
              type="checkbox"
              checked={anon}
              onChange={(e) => setAnon(e.target.checked)}
            />
            <span className="switch"></span>
            <span className="t-text">
              <strong>Anonim bejelentés</strong>
              <span>
                Sem nevedet, sem e-mailedet nem rögzítjük. Visszaigazolás csak a hivatkozási
                számoddal lehetséges.
              </span>
            </span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={contact}
              onChange={(e) => setContact(e.target.checked)}
            />
            <span className="switch"></span>
            <span className="t-text">
              <strong>Kapcsolódhatok</strong>
              <span>Engedélyezem, hogy a szerkesztő egy védett csatornán visszakérdezzen.</span>
            </span>
          </label>
        </div>
        <div className="form-row" style={{ marginTop: 18 }}>
          <div className="form-field">
            <label htmlFor="s-email">Kapcsolat (csak ha bekapcsoltad)</label>
            <input
              id="s-email"
              name="reporterEmail"
              type="email"
              placeholder="te@example.hu vagy ProtonMail"
              disabled={!contact}
            />
          </div>
          <div className="form-field">
            <label htmlFor="s-name-y">Név (opcionális)</label>
            <input
              id="s-name-y"
              name="reporterName"
              type="text"
              placeholder="Csak ha vállalod"
              disabled={!contact}
            />
          </div>
        </div>
      </div>

      <input type="hidden" name="turnstileToken" defaultValue="1x" />

      <div className="form-submit">
        <p className="ack">
          A küldéssel elfogadod, hogy a tartalmat a szerkesztőség nyilvánosan ellenőrizheti és —
          közforrások alapján — felhasználhatja.{' '}
          <strong>Zaklatás vagy alaptalan vádaskodás esetén jogi felelősséget vállalsz.</strong>
        </p>
        <button type="submit" disabled={state.kind === 'pending'}>
          {state.kind === 'pending' ? 'Küldés…' : 'Bejelentés küldése →'}
        </button>
      </div>

      {state.kind === 'err' && (
        <div className="form-section" style={{ borderTop: '1px solid var(--accent)' }}>
          <p style={{ color: 'var(--accent)', fontWeight: 600 }}>{state.message}</p>
        </div>
      )}
    </form>
  );
}
