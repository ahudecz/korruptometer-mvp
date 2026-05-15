"""Stage 3A v2 — tighter cap, median primary sort, drop sub-million 'ezer' amounts."""
import duckdb, csv, re, statistics
from collections import defaultdict

con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs;")
SRC = "'hf://datasets/K-Monitor/kmdb_base/data/train-00000-of-00001.parquet'"

CROSS = {'EUR': 400, 'USD': 360, 'GBP': 460, 'CHF': 420, 'HUF': 1}

NUM = r'\d{1,3}(?:[ .]\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?'
MAG = r'(?:milliárd|milliárdos|millió|milliós|mrd|md|mft|m|mio|milliard|million)'  # no 'ezer'
CUR = r'(?:forint|forintos|forintot|forintnak|forintnyi|forintba|forintért|Ft\.?|HUF|euró|eurós|eurót|EUR|€|dollár|dolláros|USD|\$|GBP|font|fontos|CHF|frank)'
PATTERN = re.compile(rf'\b({NUM})\s*({MAG})?\s*({CUR})', re.IGNORECASE | re.UNICODE)

UPPER_CAP_HUF = 500_000_000_000        # 500 B HUF — bigger than any documented HU corruption case
LOWER_CAP_HUF = 10_000_000              # 10 M HUF — below this is petty / fines / fees

def parse_number(s: str) -> float | None:
    s = s.replace(' ', '').replace('.', '')
    if ',' in s: s = s.replace(',', '.')
    try: return float(s)
    except ValueError: return None

def base_currency(c: str) -> str | None:
    c = c.upper().rstrip('.')
    if c.startswith('EUR') or c.startswith('EURÓ') or c.startswith('EURO') or c == '€': return 'EUR'
    if c.startswith('DOLL') or c == 'USD' or c == '$': return 'USD'
    if c.startswith('FONT') or c == 'GBP': return 'GBP'
    if c.startswith('FRANK') or c == 'CHF': return 'CHF'
    if c.startswith('FORINT') or c.startswith('FT') or c == 'HUF': return 'HUF'
    return None

def to_huf(num: float, mag: str | None, cur: str) -> int | None:
    base = num
    if mag:
        m = mag.upper().rstrip('.')
        if m.startswith('MILLIÁRD') or m in ('MRD','MD'): base *= 1_000_000_000
        elif m.startswith('MILLIÓ') or m.startswith('MILLION') or m.startswith('MIO') or m in ('M','MFT'):
            base *= 1_000_000
    bc = base_currency(cur)
    if bc is None: return None
    huf = int(base * CROSS[bc])
    if huf < LOWER_CAP_HUF or huf > UPPER_CAP_HUF: return None
    return huf

print("Loading rows…")
rows = con.execute(f"""
SELECT news_id, source_url, title, persons, text
FROM {SRC}
WHERE len(persons) > 0 AND text IS NOT NULL AND text != ''
""").fetchall()
print(f"  {len(rows)} rows to process")

mention_count = defaultdict(int)
article_amounts = defaultdict(list)

for news_id, source_url, title, persons, text in rows:
    for p in persons:
        if p: mention_count[p] += 1
    amounts = []
    for m in PATTERN.finditer(text):
        num = parse_number(m.group(1))
        if num is None: continue
        huf = to_huf(num, m.group(2), m.group(3))
        if huf is not None: amounts.append(huf)
    if not amounts: continue
    max_huf = max(amounts)
    for p in persons:
        if p: article_amounts[p].append((max_huf, news_id, source_url, title))

out = []
for person, mc in mention_count.items():
    amts = article_amounts.get(person, [])
    amt_vals = [a[0] for a in amts]
    if amt_vals:
        out.append({
            'person': person,
            'mentions': mc,
            'articles_with_amount': len(amts),
            'max_huf': max(amt_vals),
            'median_huf': int(statistics.median(amt_vals)),
            'p75_huf': int(statistics.quantiles(amt_vals + amt_vals, n=4)[2]) if len(amt_vals) >= 2 else max(amt_vals),
            'sum_distinct_huf': sum(sorted(set(amt_vals), reverse=True)[:50]),
            'top5_urls': ' | '.join(
                f'{a[1]}::{a[2]}' for a in sorted(amts, key=lambda x: -x[0])[:5] if a[2]
            ),
        })
    else:
        out.append({
            'person': person, 'mentions': mc, 'articles_with_amount': 0,
            'max_huf': '', 'median_huf': '', 'p75_huf': '', 'sum_distinct_huf': '', 'top5_urls': '',
        })

with_amt = [r for r in out if r['median_huf'] != '']
# Primary sort: median × evidence density (= articles_with_amount)
with_amt.sort(key=lambda r: -(int(r['median_huf']) * r['articles_with_amount']))

with open('/tmp/kmdb-out/person_amounts.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['person','mentions','articles_with_amount','max_huf','median_huf','p75_huf','sum_distinct_huf','top5_urls'])
    w.writeheader()
    # Persons with amounts first (sorted), then those without
    for r in with_amt: w.writerow(r)
    for r in (x for x in out if x['median_huf'] == ''):
        w.writerow(r)

def fmt(n): return f'{n:>15,}'.replace(',', ' ')

print(f"\n{len(out)} persons total, {len(with_amt)} with ≥1 article carrying a credible amount")
print(f"\nTop 30 by (median × evidence density) — best 'this person is around X HUF' signal:")
print(f"{'ment':>4}  {'#$':>4}  {'median HUF':>15}  {'p75 HUF':>15}  {'max HUF':>15}  person")
for r in with_amt[:30]:
    print(f"{r['mentions']:4d}  {r['articles_with_amount']:4d}  "
          f"{fmt(int(r['median_huf']))}  {fmt(int(r['p75_huf']))}  {fmt(int(r['max_huf']))}  "
          f"{r['person']}")
print(f"\n→ /tmp/kmdb-out/person_amounts.csv ({len(out)} rows)")
