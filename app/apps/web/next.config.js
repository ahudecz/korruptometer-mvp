/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

// T022 + T073 — Phase-2 CSP. Adds Cloudflare Turnstile (script + frame),
// Supabase (connect + img), and keeps the Phase-1 hardening (default-src,
// frame-ancestors, form-action, base-uri, object-src). The
// `tests/e2e/security-headers.spec.ts` snapshot test pins this list — drift
// fails the build (FR-023, FR-059).
const ContentSecurityPolicy = [
  "default-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  // Next.js inlines a small bootstrap script; nonce-based hardening is the
  // T073 follow-up. 'unsafe-eval' is required by Next's React Refresh
  // runtime in dev only. Cloudflare Turnstile injects an iframe + script.
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com"
    : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "frame-src https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com",
  isDev
    ? "connect-src 'self' http://127.0.0.1:54421 ws: http: https://*.supabase.co https://*.supabase.in https://challenges.cloudflare.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io"
    : "connect-src 'self' https://*.supabase.co https://*.supabase.in https://challenges.cloudflare.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
  "img-src 'self' data: https://*.supabase.co",
  "object-src 'none'",
];

const securityHeaders = [
  { key: 'Content-Security-Policy', value: ContentSecurityPolicy.join('; ') },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  async redirects() {
    return [
      { source: '/adatbazis/budapest-airport-ter-utalmeneti', destination: '/adatbazis/budapest-airport-megterulesi-ugy', permanent: true },
      { source: '/adatbazis/autoipari-prob%C3%A1p%C3%A1lya-zala', destination: '/adatbazis/autoipari-probapalya-zala', permanent: true },
      { source: '/adatbazis/bal%C3%A1sy-euronews-vasarlas', destination: '/adatbazis/balasy-euronews-vasarlas', permanent: true },
      { source: '/adatbazis/balasy-gyula-loginvent-vami-rept%C3%A9r', destination: '/adatbazis/balasy-gyula-loginvent-vami-repter', permanent: true },
      { source: '/adatbazis/balatonf%C3%B6ldvar-kikoto-balabo', destination: '/adatbazis/balatonfoldvar-kikoto-balabo', permanent: true },
      { source: '/adatbazis/balazs-attila-zvk-zugloi-szakrendel%C5%91', destination: '/adatbazis/balazs-attila-zvk-zugloi-szakrendelo', permanent: true },
      { source: '/adatbazis/bethlen-alap-szlov%C3%A1kiai-futball', destination: '/adatbazis/bethlen-alap-szlovakiai-futball', permanent: true },
      { source: '/adatbazis/bethlen-g%C3%A1bor-alap-luxusterepjaro', destination: '/adatbazis/bethlen-gabor-alap-luxusterepjaro', permanent: true },
      { source: '/adatbazis/de%C3%A1k-bill-gyula-nka-fidesz-tamogatas', destination: '/adatbazis/deak-bill-gyula-nka-fidesz-tamogatas', permanent: true },
      { source: '/adatbazis/demeter-szilard-multiplex-multimuzeum-k%C3%B6zpont', destination: '/adatbazis/demeter-szilard-multiplex-multimuzeumkozpont', permanent: true },
      { source: '/adatbazis/demeter-szilard-multiplex-multimuzeum%C3%B6zpont', destination: '/adatbazis/demeter-szilard-multiplex-multimuzeumkozpont', permanent: true },
      { source: '/adatbazis/demeter-szilard-multiplex-multimuzeumk%C3%B6zpont', destination: '/adatbazis/demeter-szilard-multiplex-multimuzeumkozpont', permanent: true },
      { source: '/adatbazis/eurove%CC%81d-security-nav-adohiany', destination: '/adatbazis/euroved-security-nav-adohiany', permanent: true },
      { source: '/adatbazis/eurov%C3%A9d-security-nav-adohiany', destination: '/adatbazis/euroved-security-nav-adohiany', permanent: true },
      { source: '/adatbazis/forr%C3%B3-kriszti%C3%A1n-sk-kampanya', destination: '/adatbazis/forro-krisztian-sk-kampanya', permanent: true },
      { source: '/adatbazis/fulco-de%C3%A1k-egyesulet-penza-osztasa', destination: '/adatbazis/fulco-deak-egyesulet-penza-osztasa', permanent: true },
      { source: '/adatbazis/gatty%C3%A1n-gy%C3%B6rgy-adougy', destination: '/adatbazis/gattyan-gyorgy-adougy', permanent: true },
      { source: '/adatbazis/gatty%C3%A1n-gy%C3%B6rgy-p%C3%A1rt-polg%C3%A1rmesterek', destination: '/adatbazis/gattyan-gyorgy-part-polgarmesterek', permanent: true },
      { source: '/adatbazis/g%C3%B6d%C3%A9ny-k%C3%B6z%C3%B6s-nev%C5%91-p%C3%A1rt-finansz%C3%ADroz%C3%A1s', destination: '/adatbazis/godeny-kozos-nevezo-part-finanszirozas', permanent: true },
      { source: '/adatbazis/hadhaz%CC%A3y-vietnami-korhaz-torz%C3%B3', destination: '/adatbazis/hadhazy-vietnami-korhaz-torzo', permanent: true },
      { source: '/adatbazis/hadhaz%C5%B1y-vietnami-korhaz-torz%C3%B3', destination: '/adatbazis/hadhazy-vietnami-korhaz-torzo', permanent: true },
      { source: '/adatbazis/hernadi-magyar-vagon-ment%C3%A9s%C3%ADt%C3%A9s', destination: '/adatbazis/hernadi-magyar-vagon-mentesites', permanent: true },
      { source: '/adatbazis/hidvegi-jozsed-kifizet%C3%A9s', destination: '/adatbazis/hidvegi-jozsed-kifizetes', permanent: true },
      { source: '/adatbazis/horvath-csepeli-luxush%C3%A1z', destination: '/adatbazis/horvath-csepeli-luxushaz', permanent: true },
      { source: '/adatbazis/hun-ren-vezeto-fizet%C3%A9l%C3%A9sek', destination: '/adatbazis/hun-ren-vezeto-fizetelesek', permanent: true },
      { source: '/adatbazis/huth-elhetorozsadombert', destination: '/adatbazis/huth-elhetorozsadombert', permanent: true },
      { source: '/adatbazis/juhasz-zoltan-b%C3%B6lcsode-uni%C3%B3s-penz', destination: '/adatbazis/juhasz-zoltan-bolcsode-unios-penz', permanent: true },
      { source: '/adatbazis/kazari-b%C3%B6lcsode-ugy', destination: '/adatbazis/kazari-bolcsode-ugy', permanent: true },
      { source: '/adatbazis/kovacs-sandor-bar%C3%A1t-tender', destination: '/adatbazis/kovacs-sandor-barat-tender', permanent: true },
      { source: '/adatbazis/lazar-k%C3%B6zleked%C3%A9si-miniszt%C3%A9rium-korrupcios', destination: '/adatbazis/lazar-kozlekedesi-miniszterium-korrupcios', permanent: true },
      { source: '/adatbazis/lombkorona-s%C3%A9t%C3%A1ny-botr%C3%A1ny', destination: '/adatbazis/lombkoronasetany-botrany', permanent: true },
      { source: '/adatbazis/lombkoronas%C3%A9t%C3%A1ny-botr%C3%A1ny', destination: '/adatbazis/lombkoronasetany-botrany', permanent: true },
      { source: '/adatbazis/magyar-levente-kee%C3%B6ma-szlov%C3%A1kiai', destination: '/adatbazis/magyar-levente-keeoma-szlovakia', permanent: true },
      { source: '/adatbazis/magyar-levente-keeoma-szlovakiai', destination: '/adatbazis/magyar-levente-keeoma-szlovakia', permanent: true },
      { source: '/adatbazis/meszaros-baross-g%C3%A1bor-tokeprogram', destination: '/adatbazis/meszaros-baross-gabor-tokeprogram', permanent: true },
      { source: '/adatbazis/meszaros-envirotis-vagyonkezel%C3%A9s', destination: '/adatbazis/meszaros-envirotis-vagyonkezeles', permanent: true },
      { source: '/adatbazis/meszaros-fej%C3%A9r-bal-oszt%C3%A1l%C3%A9k', destination: '/adatbazis/meszaros-fejer-bal-osztalek', permanent: true },
      { source: '/adatbazis/meszaros-k%C3%B6z%C3%BAtkezel%C5%91-szerviz-kartell', destination: '/adatbazis/meszaros-kozutkezelo-szerviz-kartell', permanent: true },
      { source: '/adatbazis/meszaros-l%C5%91rinc-avcon-jet', destination: '/adatbazis/meszaros-lorinc-avcon-jet', permanent: true },
      { source: '/adatbazis/meszaros-l%C5%91rinc-gyerekaru-fogaszat', destination: '/adatbazis/meszaros-lorinc-gyerekaru-fogaszat', permanent: true },
      { source: '/adatbazis/meszaros-matrai-gazer%C5%91mu-elsewedy', destination: '/adatbazis/meszaros-matrai-gazeromu-elsewedy', permanent: true },
      { source: '/adatbazis/meszaros-%C5%91rz%C5%91v%C3%A9d%C5%91-c%C3%A9g-%C3%BCgy%C3%A9szs%C3%A9g', destination: '/adatbazis/meszaros-orzovedo-ceg-ugyeszseg', permanent: true },
      { source: '/adatbazis/mkkp-nagy-d%C3%A1vid-464mio-kampany', destination: '/adatbazis/mkkp-nagy-david-464mio-kampany', permanent: true },
      { source: '/adatbazis/nagy-marton-haditechnika-%C3%BCgyelete', destination: '/adatbazis/nagy-marton-haditechnika-ugyelete', permanent: true },
      { source: '/adatbazis/nyerges-arno-%C5%91rz%C5%91v%C3%A9d%C5%91', destination: '/adatbazis/nyerges-arno-orzovedo', permanent: true },
      { source: '/adatbazis/orban-k%C3%B6z%C3%A9p-eur%C3%B3pai-akad%C3%A9mia', destination: '/adatbazis/orban-kozep-europai-akademia', permanent: true },
      { source: '/adatbazis/orban-matolcsy-kesma-sajt%C3%B3', destination: '/adatbazis/orban-matolcsy-kesma-sajto', permanent: true },
      { source: '/adatbazis/orban-sara-tiborcz-meszaros-%C3%BCgyeletek', destination: '/adatbazis/orban-sara-tiborcz-meszaros-ugyeletek', permanent: true },
      { source: '/adatbazis/orban-szijjarto-kulgazdasagi-kiad%C3%A1sok', destination: '/adatbazis/orban-szijjarto-kulgazdasagi-kiadasok', permanent: true },
      { source: '/adatbazis/pataky-k%C3%B6z%C3%B6ss%C3%A9gi-misszi%C3%B3-p%C3%BCnk%C3%B6sdi-csal%C3%A1s', destination: '/adatbazis/pataky-kozossegi-misszio-punkosdi-csalas', permanent: true },
      { source: '/adatbazis/pinter-vej%C3%A9nek-vadasztarsasag-nadapiak-ingatlan-gyam', destination: '/adatbazis/pinter-vejenek-vadasztarsasag-nadapiak-ingatlan-gyam', permanent: true },
      { source: '/adatbazis/quaestor-dalkot-adatbiztons%C3%A1g', destination: '/adatbazis/quaestor-dalkot-adatbiztonsag', permanent: true },
      { source: '/adatbazis/rakay-pet%C5%91fi-film-k%C3%B6lts%C3%A9gvet%C3%A9si-t%C3%BAlkezel%C3%A9s', destination: '/adatbazis/rakay-petofi-film-koltsegvetesi-tulkezeles', permanent: true },
      { source: '/adatbazis/rakosrendezett-beruh%C3%A1zas-mak', destination: '/adatbazis/rakosrendezett-beruhazas-mak', permanent: true },
      { source: '/adatbazis/meszaros-vagyon-kitakritsa', destination: '/adatbazis/meszaros-janos-occs-kozbeszerzesi', permanent: true },
      { source: '/adatbazis/meszaros-janos-ocscs-kozbeszerzesi', destination: '/adatbazis/meszaros-janos-occs-kozbeszerzesi', permanent: true },
      { source: '/adatbazis/rakosrendez%C5%91-adasetel', destination: '/adatbazis/rakosrendezo-adasveteli', permanent: true },
      { source: '/adatbazis/rakosrendezo-adasetel', destination: '/adatbazis/rakosrendezo-adasveteli', permanent: true },
      { source: '/adatbazis/evi-61-4-milliot-kaphat-varkonyi-andrea-a-foldjei-utan-amike', destination: '/adatbazis/varkonyi-andrea-csongradi-fold', permanent: true },
      { source: '/adatbazis/r%C3%A1kosrendez%C5%91-eagle-hills', destination: '/adatbazis/rakosrendezo-eagle-hills', permanent: true },
      { source: '/adatbazis/r%C3%A1kosrendez%C5%91-eagle-hills-tiborcz', destination: '/adatbazis/rakosrendezo-eagle-hills-tiborcz', permanent: true },
      { source: '/adatbazis/r%C3%A1kosrendez%C5%91-ecequity-garancsi-habony', destination: '/adatbazis/rakosrendezo-ecequity-garancsi-habony', permanent: true },
      { source: '/adatbazis/rogan-integritashatosag-bels%C5%91-harc', destination: '/adatbazis/rogan-integritashatosag-belso-harc', permanent: true },
      { source: '/adatbazis/rog%C3%A1n-unios-csalas-botrany', destination: '/adatbazis/rogan-unios-csalas-botrany', permanent: true },
      { source: '/adatbazis/rog%C3%A1n-%C3%BAtd%C3%ADj-szponz%C3%A1l%C3%A1s', destination: '/adatbazis/rogan-utdij-szponzalas', permanent: true },
      { source: '/adatbazis/rogan-valton-v%C3%A1rosligeti-megbizas', destination: '/adatbazis/rogan-valton-varosligeti-megbizas', permanent: true },
      { source: '/adatbazis/simonka-b%C3%A9k%C3%A9s-korrupcios-ugy', destination: '/adatbazis/simonka-bekes-korrupcios-ugy', permanent: true },
      { source: '/adatbazis/simonka-k%C3%B6z%C3%B6ss%C3%A9gi-misszi%C3%B3-p%C3%BCnk%C3%B6sdi-csal%C3%A1s', destination: '/adatbazis/simonka-kozossegi-misszio-punkosdi-csalas', permanent: true },
      { source: '/adatbazis/sulyok-p%C3%A1rizsi-hotel-luxusszob%C3%A1k', destination: '/adatbazis/sulyok-parizsi-hotel-luxusszobak', permanent: true },
      { source: '/adatbazis/szepmu%CC%8Bveszeti-muzeum-tender', destination: '/adatbazis/szepmuveszeti-muzeum-tender', permanent: true },
      { source: '/adatbazis/szepm%C5%B1veszeti-muzeum-tender', destination: '/adatbazis/szepmuveszeti-muzeum-tender', permanent: true },
      { source: '/adatbazis/szij-gidr%C3%A1n-honved-biznisz', destination: '/adatbazis/szij-gidran-honved-biznisz', permanent: true },
      { source: '/adatbazis/szijjarto-kee%C3%B6ma-t%C3%A1mogat%C3%A1s', destination: '/adatbazis/szijjarto-keeoma-tamogatas', permanent: true },
      { source: '/adatbazis/szijjarto-kulgazdasagi-kiad%C3%A1sok', destination: '/adatbazis/szijjarto-kulgazdasagi-kiadasok', permanent: true },
      { source: '/adatbazis/sz%C3%B6ll%C5%91si-nemzeti-sport-kesma', destination: '/adatbazis/szollosi-nemzeti-sport-kesma', permanent: true },
      { source: '/adatbazis/tiborcz-konfector-szlov%C3%A1k-k%C3%B3rh%C3%A1z', destination: '/adatbazis/tiborcz-konfector-szlovak-korhaz', permanent: true },
      { source: '/adatbazis/tuzson-bence-de%C3%A1k-d%C3%ADj-ugy', destination: '/adatbazis/tuzson-bence-deak-dij-ugy', permanent: true },
      { source: '/adatbazis/vadaszhazak-foldarverzes-%C3%BCgyelete', destination: '/adatbazis/vadaszhazak-foldarverzes-ugyelete', permanent: true },
      { source: '/adatbazis/varga-judit-k%C3%B6z%C3%A9p-eur%C3%B3pai-akad%C3%A9mia', destination: '/adatbazis/varga-judit-kozep-europai-akademia', permanent: true },
      { source: '/adatbazis/viii-ker%C3%BClet-bastya-gyertabor', destination: '/adatbazis/viii-kerulet-bastya-gyertabor', permanent: true },
      { source: '/adatbazis/lazar-nonius-hotel-menesbir%D1%82%D0%BE%D0%BA', destination: '/adatbazis/lazar-nonius-hotel-menesbirtok', permanent: true },
      { source: '/adatbazis/orban-viktor-kozpenzkonsultacio', destination: '/adatbazis/orban-viktor-kozpenz-konzultacio', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  transpilePackages: ['@korr/db', '@korr/shared', '@korr/ui', '@korr/scrapers'],
};

module.exports = nextConfig;
