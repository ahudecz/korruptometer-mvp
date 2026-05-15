import duckdb, csv
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs;")
SRC = "'hf://datasets/K-Monitor/kmdb_base/data/train-00000-of-00001.parquet'"

# Proper person×person co-occurrence: two-FROM UNNEST.
pp = con.execute(f"""
SELECT a, b, COUNT(*) AS n
FROM {SRC} k,
     UNNEST(k.persons) AS u1(a),
     UNNEST(k.persons) AS u2(b)
WHERE a < b AND a != '' AND b != ''
GROUP BY a, b
HAVING n >= 15
ORDER BY n DESC
LIMIT 200
""").fetchall()

print(f"=== STAGE 2b: PERSON+PERSON ({len(pp)} pairs ≥15) ===")
for r in pp[:20]:
    print(f"{r[2]:5d}  {r[0]} ↔ {r[1]}")

with open('/tmp/kmdb-out/person_person.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['person_a','person_b','count'])
    for r in pp: w.writerow(r)
print(f"\n→ /tmp/kmdb-out/person_person.csv ({len(pp)} rows)")
