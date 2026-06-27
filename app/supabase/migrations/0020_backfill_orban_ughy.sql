-- Backfill: Orbán Balázs MCC lemondás (2026-06-19) + Ughy Attila előzetes (2026-06-23)
-- These predate Inngest being synced, so auto-detection never ran on these articles.

-- Orbán Balázs: lemondott az MCC kuratóriumi elnöki posztjáról
INSERT INTO "PoliticalResignation" (name, position, institution, "resignationType", "resignationDate", description, pinned)
VALUES (
  'Orbán Balázs',
  'kuratóriumi elnök',
  'Mathias Corvinus Collegium (MCC)',
  'lemondás',
  '2026-06-19 00:00:00+00',
  'Orbán Balázs, a Miniszterelnökség parlamenti és stratégiai államtitkára lemondott a Mathias Corvinus Collegium kuratóriumi elnöki tisztségéről.',
  false
)
ON CONFLICT DO NOTHING;

-- Ughy Attila: előzetes letartóztatásba helyezték (NKA-botrány, 2026-06-23)
INSERT INTO "CourtVerdict" ("personName", position, crimes, "sentenceYears", "sentenceLabel", "verdictType", "verdictDate", court, summary, "sourceUrls", "sourceNames", "sourceHeadlines", "sourceDates")
VALUES (
  'Ughy Attila',
  'Budapest XVIII. kerület volt polgármestere',
  ARRAY['hűtlen kezelés'],
  0,
  'előzetes letartóztatás',
  'előzetesben',
  '2026-06-23 00:00:00+00',
  'Ismeretlen bíróság',
  'Ughy Attilát, Budapest XVIII. kerületének volt polgármesterét az NKA-botrány keretében 2026. június 23-án előzetes letartóztatásba helyezték hűtlen kezelés bűntett megalapozott gyanúja miatt.',
  ARRAY['https://444.hu/2026/06/25/ughy-attila-elozetes-letartoztatas'],
  ARRAY['444.hu'],
  ARRAY['Ughy Attila előzetesbe — az NKA-botrány újabb letartóztatottja'],
  ARRAY['2026-06-25']
)
ON CONFLICT DO NOTHING;
