"""
kmdb_base → JSONL importer (v2). Emits THREE files:

  - persons.jsonl           one record per candidate person (mentions ≥ 3)
                            with p1/p10/p50/p90/p99 amount percentiles,
                            top 5 institutions, top 5 co-persons, top 8 topics
                            (rolled up from per-article `others[]`).

  - articles.jsonl          one record per kmdb_base article that mentions at
                            least one qualifying person. Carries source URL,
                            title, pub time, extracted HUF amount, newspaper,
                            K-Monitor `category`, the rich `others[]`
                            taxonomy (=topics), institutions, places.

  - person_articles.jsonl   one record per (normalized_name, news_id) pair —
                            the join the side panel queries to list a
                            person's top-N articles by claimed amount.

Setup once:
    python3 -m venv /tmp/kmdb-venv
    /tmp/kmdb-venv/bin/pip install duckdb

Run from app/:
    /tmp/kmdb-venv/bin/python3 scripts/kmdb/import.py

Output dir is controlled by KMDB_OUT (defaults to /tmp/kmdb-out).

Caveats unchanged: persons[] is "everyone mentioned in a corruption-relevant
article", not "the accused"; editor curation mandatory. Cap is 500 Mrd HUF.
kmdb_base is cc-by-sa-4.0.
"""
import duckdb, json, os, re, statistics, sys, unicodedata
from collections import defaultdict, Counter

SRC = "'hf://datasets/K-Monitor/kmdb_base/data/train-00000-of-00001.parquet'"
OUT_DIR = os.environ.get('KMDB_OUT', '/tmp/kmdb-out')

CROSS = {'EUR': 400, 'USD': 360, 'GBP': 460, 'CHF': 420, 'HUF': 1}
NUM = r'\d{1,3}(?:[ .]\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?'
MAG = r'(?:milliárd|milliárdos|millió|milliós|mrd|md|mft|m|mio|milliard|million)'
CUR = r'(?:forint|forintos|forintot|forintnak|forintnyi|forintba|forintért|Ft\.?|HUF|euró|eurós|eurót|EUR|€|dollár|dolláros|USD|\$|GBP|font|fontos|CHF|frank)'
PATTERN = re.compile(rf'\b({NUM})\s*({MAG})?\s*({CUR})', re.IGNORECASE | re.UNICODE)

UPPER_CAP_HUF = 500_000_000_000
LOWER_CAP_HUF = 10_000_000
MIN_MENTIONS = 3


def normalize_name(s: str) -> str:
    s = s.strip()
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'\s+', ' ', s)
    return s.lower()


def parse_number(s: str):
    s = s.replace(' ', '').replace('.', '')
    if ',' in s:
        s = s.replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return None


def base_currency(c: str):
    c = c.upper().rstrip('.')
    if c.startswith(('EUR', 'EURÓ', 'EURO')) or c == '€': return 'EUR'
    if c.startswith('DOLL') or c == 'USD' or c == '$': return 'USD'
    if c.startswith('FONT') or c == 'GBP': return 'GBP'
    if c.startswith('FRANK') or c == 'CHF': return 'CHF'
    if c.startswith('FORINT') or c.startswith('FT') or c == 'HUF': return 'HUF'
    return None


def to_huf(num, mag, cur):
    base = num
    if mag:
        m = mag.upper().rstrip('.')
        if m.startswith('MILLIÁRD') or m in ('MRD', 'MD'):
            base *= 1_000_000_000
        elif m.startswith('MILLIÓ') or m.startswith('MILLION') or m.startswith('MIO') or m in ('M', 'MFT'):
            base *= 1_000_000
    bc = base_currency(cur)
    if bc is None:
        return None
    huf = int(base * CROSS[bc])
    if huf < LOWER_CAP_HUF or huf > UPPER_CAP_HUF:
        return None
    return huf


def extract_max_amount(text):
    biggest = None
    for m in PATTERN.finditer(text):
        num = parse_number(m.group(1))
        if num is None:
            continue
        huf = to_huf(num, m.group(2), m.group(3))
        if huf is not None and (biggest is None or huf > biggest):
            biggest = huf
    return biggest


def parse_pub_time(s):
    if not s:
        return None
    s = s.strip()
    # kmdb_base uses ISO-ish formats; let duckdb-style strings through and
    # fall back to None on anything weird.
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?', s):
        return s
    return None


def percentile(vals, q):
    """Linear interpolation, 0 <= q <= 100. vals must be pre-sorted."""
    if not vals: return None
    if len(vals) == 1: return vals[0]
    k = (len(vals) - 1) * (q / 100.0)
    lo, hi = int(k), min(int(k) + 1, len(vals) - 1)
    if lo == hi: return vals[lo]
    return int(vals[lo] + (vals[hi] - vals[lo]) * (k - lo))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")

    print('[importer] loading kmdb_base…', file=sys.stderr)
    rows = con.execute(f"""
        SELECT news_id, source_url, archive_url, title, pub_time, newspaper,
               category, persons, institutions, places, others, text
        FROM {SRC}
        WHERE len(persons) > 0
    """).fetchall()
    print(f'[importer] {len(rows)} person-bearing rows', file=sys.stderr)

    # First pass: count mentions to find qualifying persons (mentions ≥ 3).
    mention_count = Counter()
    for *_, persons, _institutions, _places, _others, _text in (
        (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11]) for r in rows
    ):
        for p in persons or []:
            if p: mention_count[p] += 1
    qualifying = {p for p, c in mention_count.items() if c >= MIN_MENTIONS}
    print(f'[importer] {len(qualifying)} persons with ≥{MIN_MENTIONS} mentions', file=sys.stderr)

    # Second pass: build per-person aggregates AND per-article records (only
    # articles that mention at least one qualifying person).
    per_person_amts = defaultdict(list)     # person -> [huf, ...]
    inst_co = defaultdict(Counter)          # person -> Counter[institution]
    person_co = defaultdict(Counter)        # person -> Counter[other_person]
    topic_co = defaultdict(Counter)         # person -> Counter[others]
    pub_first = {}; pub_last = {}
    articles_out = []                       # list of dicts
    pa_links = []                           # list of (normalized_name, news_id, huf)

    for (news_id, source_url, archive_url, title, pub_time, newspaper,
         category, persons, institutions, places, others, text) in rows:
        persons = [p for p in (persons or []) if p]
        institutions = [i for i in (institutions or []) if i]
        places = [pl for pl in (places or []) if pl]
        others = [o for o in (others or []) if o]
        if not any(p in qualifying for p in persons):
            continue
        amount = extract_max_amount(text or '')
        # Per-person bookkeeping.
        for p in persons:
            if p not in qualifying:
                continue
            if amount is not None:
                per_person_amts[p].append(amount)
            for i in institutions: inst_co[p][i] += 1
            for o in others: topic_co[p][o] += 1
            for q in persons:
                if q != p and q in qualifying: person_co[p][q] += 1
            if pub_time:
                if p not in pub_first or pub_time < pub_first[p]:
                    pub_first[p] = pub_time
                if p not in pub_last or pub_time > pub_last[p]:
                    pub_last[p] = pub_time
        # Per-article record.
        articles_out.append({
            'newsId': int(news_id),
            'sourceUrl': source_url or '',
            'archiveUrl': archive_url or None,
            'title': (title or '').strip(),
            'pubTime': parse_pub_time(pub_time),
            'amountHuf': amount,
            'newspaper': newspaper or None,
            'category': category or None,
            'topics': others,
            'institutions': institutions,
            'places': places,
        })
        # Person-article links.
        for p in persons:
            if p in qualifying:
                pa_links.append((normalize_name(p), int(news_id), amount))

    # Emit persons.jsonl.
    persons_path = os.path.join(OUT_DIR, 'persons.jsonl')
    articles_path = os.path.join(OUT_DIR, 'articles.jsonl')
    pa_path = os.path.join(OUT_DIR, 'person_articles.jsonl')

    n_emitted = 0
    with open(persons_path, 'w') as f:
        for person in qualifying:
            amts = sorted(per_person_amts.get(person, []))
            record = {
                'displayName': person,
                'normalizedName': normalize_name(person),
                'mentionCount': mention_count[person],
                'articleCountWithAmount': len(amts),
                'p1AmountHuf':  percentile(amts, 1)  if amts else None,
                'p10AmountHuf': percentile(amts, 10) if amts else None,
                'p50AmountHuf': percentile(amts, 50) if amts else None,
                'p90AmountHuf': percentile(amts, 90) if amts else None,
                'p99AmountHuf': percentile(amts, 99) if amts else None,
                'topInstitutions': [{'institution': k, 'count': v} for k, v in inst_co[person].most_common(5)],
                'topPersons':      [{'person': k, 'count': v}      for k, v in person_co[person].most_common(5)],
                'topTopics':       [{'topic': k, 'count': v}       for k, v in topic_co[person].most_common(8)],
                'firstSeenPub': pub_first.get(person),
                'lastSeenPub':  pub_last.get(person),
            }
            f.write(json.dumps(record, ensure_ascii=False) + '\n')
            n_emitted += 1

    # Emit articles.jsonl (deduplicated by news_id — same article may have been
    # collected multiple times if more than one qualifying person mentioned it).
    seen_ids = set()
    with open(articles_path, 'w') as f:
        for a in articles_out:
            if a['newsId'] in seen_ids: continue
            seen_ids.add(a['newsId'])
            f.write(json.dumps(a, ensure_ascii=False) + '\n')

    # Emit person_articles.jsonl.
    with open(pa_path, 'w') as f:
        # Dedup join rows (each person should appear once per news_id).
        seen_pa = set()
        for normname, news_id, amt in pa_links:
            key = (normname, news_id)
            if key in seen_pa: continue
            seen_pa.add(key)
            f.write(json.dumps({'normalizedName': normname, 'newsId': news_id, 'amountHuf': amt},
                               ensure_ascii=False) + '\n')

    print(f'[importer] wrote {n_emitted} persons → {persons_path}', file=sys.stderr)
    print(f'[importer] wrote {len(seen_ids)} articles → {articles_path}', file=sys.stderr)
    print(f'[importer] wrote {len(seen_pa)} person↔article links → {pa_path}', file=sys.stderr)


if __name__ == '__main__':
    main()
