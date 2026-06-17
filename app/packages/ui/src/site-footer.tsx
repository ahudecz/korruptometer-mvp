import * as React from 'react';

export function SiteFooter() {
  return (
    <footer className="site-footer" id="methodology" role="contentinfo">
      <div>
        <h4>Kegyencjárat</h4>
        <p>
          Független, közösségi tényfeltáró platform. Adataink nyilvános bírósági
          iratokon és sajtóforrásokon alapulnak.
        </p>
      </div>
      <div>
        <h4>Adatok</h4>
        <ul>
          <li>
            <a href="/modszertan">Módszertan</a>
          </li>
          <li>
            <a href="/forrashivatkozasok">Forráshivatkozások</a>
          </li>
          <li>
            <a href="/adatok">CSV letöltés</a>
          </li>
          <li>
            <a href="/adatok">API hozzáférés</a>
          </li>
        </ul>
      </div>
      <div>
        <h4>Szervezet</h4>
        <ul>
          <li>
            <a href="/csapat">Csapat</a>
          </li>
          <li>
            <a href="/partnerek">Partnerek</a>
          </li>
          <li>
            <a href="/sajto">Sajtó</a>
          </li>
          <li>
            <a href="/adomanyozas">Adományozás</a>
          </li>
        </ul>
      </div>
      <div>
        <h4>Kapcsolat</h4>
        <ul>
          <li>
            <a href="/bejelentes">Bejelentés tétele</a>
          </li>
          <li>
            <a href="/whistleblower">Whistleblower védelem</a>
          </li>
          <li>
            <a href="/sajto">Sajtókapcsolat</a>
          </li>
          <li>
            <a href="mailto:dpo@korruptometer.hu">Hibajelentés</a>
          </li>
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
