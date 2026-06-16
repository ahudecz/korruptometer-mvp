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
            <a href="/hamarosan">Módszertan</a>
          </li>
          <li>
            <a href="/hamarosan">Forráshivatkozások</a>
          </li>
          <li>
            <a href="/hamarosan">CSV letöltés</a>
          </li>
          <li>
            <a href="/hamarosan">API hozzáférés</a>
          </li>
        </ul>
      </div>
      <div>
        <h4>Szervezet</h4>
        <ul>
          <li>
            <a href="/hamarosan">Csapat</a>
          </li>
          <li>
            <a href="/hamarosan">Partnerek</a>
          </li>
          <li>
            <a href="/hamarosan">Sajtó</a>
          </li>
          <li>
            <a href="/hamarosan">Adományozás</a>
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
            <a href="/hamarosan">Whistleblower védelem</a>
          </li>
          <li>
            <a href="/hamarosan">Sajtóügynökség</a>
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
