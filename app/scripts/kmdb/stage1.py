"""
Stage 1 — top persons by mention count across K-Monitor's kmdb_base.

Setup once:
    python3 -m venv /tmp/kmdb-venv
    /tmp/kmdb-venv/bin/pip install duckdb

Run from repo root:
    /tmp/kmdb-venv/bin/python3 app/scripts/kmdb/stage1.py
    /tmp/kmdb-venv/bin/python3 app/scripts/kmdb/stage2.py
    /tmp/kmdb-venv/bin/python3 app/scripts/kmdb/stage2b.py
    /tmp/kmdb-venv/bin/python3 app/scripts/kmdb/stage3a-v2.py

Caveats:
  - kmdb_base persons[] contains every named person in a corruption-relevant
    article (incl. sitting PMs, opposition, lawyers) — editor curation is
    mandatory before any auto-promotion to a Case row.
  - stage3a uses a regex over `text`. Cap is 500 Mrd HUF; amounts above
    are dropped as GDP-scale noise. Median is the most trustworthy column.
  - kmdb_base is cc-by-sa-4.0. Attribution required on derived public surfaces.
"""
import duckdb, csv
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs;")
SRC = "'hf://datasets/K-Monitor/kmdb_base/data/train-00000-of-00001.parquet'"

# Top 200 persons by mention count (across the whole 30-year corpus).
rows = con.execute(f"""
SELECT person,
       COUNT(*) AS mentions,
       MIN(pub_time) AS first_seen,
       MAX(pub_time) AS last_seen
FROM (SELECT UNNEST(persons) AS person, pub_time FROM {SRC})
WHERE person IS NOT NULL AND person != ''
GROUP BY person
HAVING mentions >= 3
ORDER BY mentions DESC
LIMIT 200
""").fetchall()

print(f"=== STAGE 1: {len(rows)} persons with ≥3 mentions ===")
print("(top 30 preview)")
print(f"{'mentions':>8}  {'first':>10}  {'last':>10}  person")
for r in rows[:30]:
    first = r[2][:10] if r[2] else '-'
    last = r[3][:10] if r[3] else '-'
    print(f"{r[1]:8d}  {first:>10}  {last:>10}  {r[0]}")

with open('/tmp/kmdb-out/persons.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['person','mentions','first_seen','last_seen'])
    for r in rows: w.writerow(r)
print(f"\n→ wrote /tmp/kmdb-out/persons.csv ({len(rows)} rows)")
