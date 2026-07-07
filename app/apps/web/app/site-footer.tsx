import Image from 'next/image';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer" id="methodology" role="contentinfo">
      <div>
        <Image
          src="/images/brand/logo-wordmark.png"
          alt="Kegyencjárat"
          width={160}
          height={40}
          className="footer-logo"
        />
        <p>
          Független híraggregátor. Adataink nyilvános sajtóforrásokon és bírósági iratokon alapulnak.
        </p>
      </div>
      <div>
        <h4>Adatok</h4>
        <ul>
          <li><Link href="/modszertan">Módszertan</Link></li>
          <li><Link href="/forrashivatkozasok">Forráshivatkozások</Link></li>
          <li><Link href="/adatok">CSV letöltés</Link></li>
          <li><Link href="/adatok">API hozzáférés</Link></li>
          <li><Link href="/adatvedelem">Adatvédelem</Link></li>
          <li><Link href="/impresszum">Impresszum</Link></li>
          <li><Link href="/aszf">ÁSZF</Link></li>
        </ul>
      </div>
      <div>
        <h4>Szervezet</h4>
        <ul>
          <li><Link href="/csapat">Csapat</Link></li>
          <li><Link href="/partnerek">Partnerek</Link></li>
          <li><Link href="/legfontosabb-hangok">Legfontosabb hangok</Link></li>
          <li><Link href="/sajto">Sajtó</Link></li>
          <li><Link href="/adomanyozas">Adományozás</Link></li>
        </ul>
      </div>
      <div>
        <h4>Kapcsolat</h4>
        <ul>
          <li><Link href="/bejelentes">Bejelentés tétele</Link></li>
          <li><Link href="/whistleblower">Whistleblower védelem</Link></li>
          <li><Link href="/sajto">Sajtókapcsolat</Link></li>
          <li><a href="mailto:hello@kegyencjarat.hu">Hibajelentés</a></li>
        </ul>
      </div>
      <div className="foot-disclaimer">
        <strong>Adatvédelmi figyelmeztetés:</strong> Az adatbázisban szereplő
        ügyek nyilvános bírósági és sajtóforrásokon alapulnak. © {new Date().getFullYear()}{' '}
        Kegyencjárat · v0.1
      </div>
    </footer>
  );
}
