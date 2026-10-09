import { extractText, getDocumentProxy } from 'unpdf';

/**
 * Magyar Közlöny — a hivatalos lap személyi döntései (felmentés, megbízatás
 * megszűnése, lemondás). User kérés, 2026-10-09: a GVH elnökhelyettesének
 * lemondása csak a Közlönyben és néhány, általunk nem gyűjtött lapban jelent
 * meg — a Közlöny gyakran a sajtó ELŐTT közli ezeket.
 *
 * Költség: a szűrés (tartalomjegyzék → személyi döntés) LLM NÉLKÜL fut, csak
 * a kiválogatott rövid határozatszöveg megy a lemondás-detektorhoz.
 * robots.txt mindent enged (2026-10-09-én ellenőrizve).
 */

const FEED_URL = 'https://magyarkozlony.hu/feed';
const UA = 'Mozilla/5.0 (compatible; KegyencjaratBot/1.0; +https://www.kegyencjarat.hu)';

export type KozlonyIssue = {
  title: string;
  year: number;
  serial: number;
  /** A böngészős „megtekintés” oldal — ez megy forrásként a lemondás-sorra. */
  viewUrl: string;
  pdfUrl: string;
  publishedAt: Date;
};

export type KozlonyDecision = {
  /** Pl. „253/2026. (X. 8.) KE” */
  ref: string;
  /** A tartalomjegyzékbeli cím, pl. „A Gazdasági Versenyhivatal elnökhelyettese megbízatása megszűnése időpontjának megállapításáról” */
  title: string;
  /** A határozat teljes szövege a fejlécétől az „SP ügyszám” soráig (max. ~1800 karakter). */
  body: string;
};

function cdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

export function parseKozlonyFeed(xml: string): KozlonyIssue[] {
  const out: KozlonyIssue[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = m[1]!;
    const get = (tag: string) => {
      const r = item.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      return r ? cdata(r[1]!) : '';
    };
    // Csak maga a Magyar Közlöny — a hivatalos értesítők és mellékletek nem.
    if (get('mag:type') !== 'Magyar Közlöny') continue;
    const pdfUrl = item.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="application\/pdf"/)?.[1];
    const viewUrl = get('link');
    const publishedAt = new Date(get('pubDate'));
    const year = Number(get('mag:year'));
    const serial = Number(get('mag:serial'));
    if (!pdfUrl || !viewUrl || isNaN(publishedAt.getTime()) || !serial) continue;
    out.push({ title: get('title'), year, serial, viewUrl, pdfUrl, publishedAt });
  }
  return out;
}

export async function fetchKozlonyFeed(): Promise<KozlonyIssue[]> {
  const res = await fetch(FEED_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Magyar Közlöny feed: HTTP ${res.status}`);
  return parseKozlonyFeed(await res.text());
}

export async function fetchKozlonyText(pdfUrl: string): Promise<string> {
  const res = await fetch(pdfUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Magyar Közlöny PDF: HTTP ${res.status}`);
  const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : text;
}

/** Személyi döntésre utaló cím — felmentés, megbízatás megszűnése, lemondás, visszahívás. */
const PERSONNEL_TITLE = /(felment|megbízatás\S*\s+megsz[űü]n|megbízatás\S*\s+megszüntet|lemond|visszahív|menesz|hivatalából|tisztségéből)/i;
/** Rutin, nem politikai: bírák nyugállományba vonulása, katonai rendfokozatok. */
const ROUTINE_TITLE = /(bírák?\s+felmentés|bírói|rendfokozat|nyugállomány)/i;

const REF = String.raw`\d+\/\d{4}\.\s\([IVXLC]+\.\s\d{1,2}\.\)`;
const TOC_START = new RegExp(`^(${REF})\\s(\\S+)\\shatározat\\s(.*)$`);

/**
 * A tartalomjegyzékből kiválogatja a személyi döntéseket, és a törzsből
 * kiolvassa a hozzájuk tartozó határozatszöveget.
 */
export function extractPersonnelDecisions(text: string): KozlonyDecision[] {
  const lines = text.split('\n').map((l) => l.trim());
  const toc: { ref: string; type: string; title: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(TOC_START);
    if (!m) continue;
    // A cím több sorba is törhet; a bejegyzés az oldalszámmal zárul.
    let title = m[3]!;
    let j = i;
    while (!/\s\d{3,5}$/.test(title) && j + 1 < lines.length && j - i < 4 && !TOC_START.test(lines[j + 1]!)) {
      j++;
      title += ' ' + lines[j]!;
    }
    if (!/\s\d{3,5}$/.test(title)) continue; // nem tartalomjegyzék-sor (pl. a törzs hivatkozása)
    toc.push({ ref: m[1]!, type: m[2]!, title: title.replace(/\s\d{3,5}$/, '').trim() });
  }

  const out: KozlonyDecision[] = [];
  const seen = new Set<string>();
  for (const t of toc) {
    if (seen.has(t.ref)) continue;
    seen.add(t.ref);
    if (!PERSONNEL_TITLE.test(t.title) || ROUTINE_TITLE.test(t.title)) continue;

    // A törzsben a fejléc „… 253/2026. (X. 8.) KE határozata” alakú.
    const header = `${t.ref} ${t.type} határozata`;
    const start = text.indexOf(header);
    if (start < 0) continue;
    let body = text.slice(start, start + 2500);
    const end = body.search(/SP ügyszám|\n[^\n]*\d+\/\d{4}\.\s\([IVXLC]+\.\s\d{1,2}\.\)\s\S+\shatározata/);
    if (end > 0) body = body.slice(0, end);
    body = body.replace(/\d{4}\s+M A G Y A R K Ö Z L Ö N Y\s+•\s+\d{4}\. évi \d+\. szám/g, ' ').replace(/\s+/g, ' ').trim();
    out.push({ ref: `${t.ref} ${t.type}`, title: t.title, body: body.slice(0, 1800) });
  }
  return out;
}
