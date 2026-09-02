import Link from 'next/link';

/**
 * Az eredmény-nézet tetején megjelenő, kiemelt kettős ajánló — user
 * report, 2026-09-02: 99%-os bounce rate szavazás után, kell egy erős,
 * konkrét "maradj még" felajánlás, nem csak egy generikus tovább-terelés.
 * Az MNB-alapítványok és a lélegeztetőgép-ügy fej-fej mellett állnak a
 * szavazás elején — ez a két, saját ügyoldallal is rendelkező sztori a
 * legerősebb jelölt arra, hogy itt tartsa az olvasót. Mobile-first: ez az
 * eredmény-nézet ELSŐ eleme, hogy szavazás után azonnal, görgetés nélkül
 * látszódjon.
 */
export function TwoCasesPromo() {
  return (
    <div className="poll-two-cases">
      <h2 className="poll-two-cases-title">A két legszorosabb versenyben álló ügy</h2>
      <p className="poll-two-cases-deck">
        Az MNB-alapítványok és a lélegeztetőgép-beszerzések fej-fej mellett állnak — mindkét
        ügyben már van feljelentés. Olvasd el a legfrissebb híreket és nézd meg a kapcsolódó
        videókat.
      </p>
      <div className="poll-two-cases-grid">
        <Link href="/ugyek/mnb-botrany" className="poll-two-cases-card">
          <span className="poll-two-cases-eyebrow">Kiemelt · Feljelentés megtörtént</span>
          <span className="poll-two-cases-name">MNB-alapítványok / Matolcsy-kör</span>
          <span className="poll-two-cases-cta">Hírek és videók →</span>
        </Link>
        <Link href="/ugyek/lelegeztetogep" className="poll-two-cases-card">
          <span className="poll-two-cases-eyebrow">Kiemelt · Feljelentés megtörtént</span>
          <span className="poll-two-cases-name">2020-as lélegeztetőgép-beszerzések</span>
          <span className="poll-two-cases-cta">Hírek és videók →</span>
        </Link>
      </div>
    </div>
  );
}
