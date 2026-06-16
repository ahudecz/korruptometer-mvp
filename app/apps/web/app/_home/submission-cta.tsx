'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

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

export function SubmissionCTA() {
  const [name, setName] = useState('');
  const [crimes, setCrimes] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const router = useRouter();

  const toggleCrime = useCallback((c: string) => {
    setCrimes((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }, []);

  function proceed() {
    const params = new URLSearchParams();
    if (name.trim()) params.set('name', name.trim());
    const allCrimes = other.trim() ? [...crimes, other.trim()] : crimes;
    if (allCrimes.length) params.set('crimes', allCrimes.join(','));
    const qs = params.toString();
    router.push(`/bejelentes${qs ? '?' + qs : ''}`);
  }

  return (
    <div className="home-cta-form">
      <div className="home-cta-field">
        <label htmlFor="cta-name">Gyanúsított neve</label>
        <input
          id="cta-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Pl. Példa Péter, vagy „ismeretlen"'
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              proceed();
            }
          }}
        />
      </div>
      <div className="home-cta-crimes">
        <div className="home-cta-crimes-label">Mivel gyanúsítod?</div>
        <div className="home-cta-crime-grid">
          {CRIMES.map((c) => (
            <button
              key={c}
              type="button"
              className={`home-cta-crime-chip${crimes.includes(c) ? ' active' : ''}`}
              onClick={() => toggleCrime(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <input
          type="text"
          className="home-cta-other"
          placeholder="Egyéb — írd le röviden"
          value={other}
          onChange={(e) => setOther(e.target.value)}
        />
      </div>
      <button className="home-cta-btn" onClick={proceed}>
        Tovább a bejelentőhöz →
      </button>
    </div>
  );
}
