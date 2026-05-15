import duckdb, csv
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs;")
SRC = "'hf://datasets/K-Monitor/kmdb_base/data/train-00000-of-00001.parquet'"

# Person + institution co-occurrence
pi = con.execute(f"""
SELECT p, i, COUNT(*) AS n
FROM (SELECT UNNEST(persons) p, UNNEST(institutions) i FROM {SRC})
WHERE p IS NOT NULL AND p != '' AND i IS NOT NULL AND i != ''
GROUP BY p, i
HAVING n >= 10
ORDER BY n DESC
LIMIT 200
""").fetchall()

print(f"=== STAGE 2a: PERSON+INSTITUTION ({len(pi)} pairs) ===")
print("(top 20 preview — natural case clusters)")
print(f"{'n':>6}  person │ institution")
for r in pi[:20]:
    print(f"{r[2]:6d}  {r[0]} │ {r[1]}")

with open('/tmp/kmdb-out/person_institution.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['person','institution','count'])
    for r in pi: w.writerow(r)

# Person + person co-occurrence (top accomplices / co-mentioned)
pp = con.execute(f"""
WITH pairs AS (
  SELECT a, b
  FROM (
    SELECT UNNEST(persons) AS a, UNNEST(persons) AS b
    FROM {SRC}
  )
  WHERE a < b
)
SELECT a, b, COUNT(*) AS n
FROM pairs
GROUP BY a, b
HAVING n >= 10
ORDER BY n DESC
LIMIT 200
""").fetchall()

print(f"\n=== STAGE 2b: PERSON+PERSON ({len(pp)} pairs) ===")
print("(top 15 preview — likely co-defendants or repeatedly co-mentioned)")
for r in pp[:15]:
    print(f"{r[2]:6d}  {r[0]} ↔ {r[1]}")

with open('/tmp/kmdb-out/person_person.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['person_a','person_b','count'])
    for r in pp: w.writerow(r)

print(f"\n→ wrote /tmp/kmdb-out/person_institution.csv ({len(pi)} rows)")
print(f"→ wrote /tmp/kmdb-out/person_person.csv ({len(pp)} rows)")
