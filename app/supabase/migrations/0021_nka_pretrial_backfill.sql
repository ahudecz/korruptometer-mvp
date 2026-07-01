-- Backfill: NKA-botrány 5 előzetes letartóztatott (2026-06-23)
-- Ughy Attila már a 0020-as migrációban szerepel.
-- Forrás: 444.hu, 2026-06-25

INSERT INTO "CourtVerdict" ("personName", position, crimes, "sentenceYears", "sentenceLabel", "verdictType", "verdictDate", court, summary, "sourceUrls", "sourceNames", "sourceHeadlines", "sourceDates")
SELECT * FROM (VALUES
  (
    'Bús Balázs',
    'NKA korábbi alelnöke, Óbuda–Békásmegyer volt polgármestere',
    ARRAY['hűtlen kezelés'],
    0,
    'előzetes letartóztatás',
    'előzetesben',
    '2026-06-23 00:00:00+00'::timestamptz,
    'Ismeretlen bíróság',
    'Bús Balázst, az NKA korábbi alelnökét és Óbuda–Békásmegyer volt polgármesterét 2026. június 23-án előzetes letartóztatásba helyezte a NAV hűtlen kezelés bűntett megalapozott gyanúja miatt az NKA-botrányban.',
    ARRAY['https://444.hu/2026/06/25/ughy-attila-elozetes-letartoztatas'],
    ARRAY['444.hu'],
    ARRAY['Hat személy előzetesben az NKA-botrányban'],
    ARRAY['2026-06-25']
  ),
  (
    'Krucsainé Herter Anikó',
    'NKTK főigazgatója',
    ARRAY['hűtlen kezelés'],
    0,
    'előzetes letartóztatás',
    'előzetesben',
    '2026-06-23 00:00:00+00'::timestamptz,
    'Ismeretlen bíróság',
    'Krucsainé Herter Anikót, az NKTK főigazgatóját 2026. június 23-án előzetes letartóztatásba helyezte a NAV hűtlen kezelés bűntett megalapozott gyanúja miatt az NKA-botrányban.',
    ARRAY['https://444.hu/2026/06/25/ughy-attila-elozetes-letartoztatas'],
    ARRAY['444.hu'],
    ARRAY['Hat személy előzetesben az NKA-botrányban'],
    ARRAY['2026-06-25']
  ),
  (
    'Burom Gábor',
    'Kulturális és Innovációs Minisztérium korábbi miniszteri kabinetfőnök-helyettese',
    ARRAY['hűtlen kezelés'],
    0,
    'előzetes letartóztatás',
    'előzetesben',
    '2026-06-23 00:00:00+00'::timestamptz,
    'Ismeretlen bíróság',
    'Burom Gábort, a KIM korábbi miniszteri kabinetfőnök-helyettesét 2026. június 23-án előzetes letartóztatásba helyezte a NAV hűtlen kezelés bűntett megalapozott gyanúja miatt az NKA-botrányban.',
    ARRAY['https://444.hu/2026/06/25/ughy-attila-elozetes-letartoztatas'],
    ARRAY['444.hu'],
    ARRAY['Hat személy előzetesben az NKA-botrányban'],
    ARRAY['2026-06-25']
  ),
  (
    'Unger Erika',
    'NKTK kabinetvezető',
    ARRAY['hűtlen kezelés'],
    0,
    'előzetes letartóztatás',
    'előzetesben',
    '2026-06-23 00:00:00+00'::timestamptz,
    'Ismeretlen bíróság',
    'Unger Erikát, az NKTK kabinetvezetőjét 2026. június 23-án előzetes letartóztatásba helyezte a NAV hűtlen kezelés bűntett megalapozott gyanúja miatt az NKA-botrányban.',
    ARRAY['https://444.hu/2026/06/25/ughy-attila-elozetes-letartoztatas'],
    ARRAY['444.hu'],
    ARRAY['Hat személy előzetesben az NKA-botrányban'],
    ARRAY['2026-06-25']
  ),
  (
    'Zámbó Nóra',
    'Kulturális és Innovációs Minisztérium korábbi miniszteri kabinetfőnök-helyettese',
    ARRAY['hűtlen kezelés'],
    0,
    'előzetes letartóztatás',
    'előzetesben',
    '2026-06-23 00:00:00+00'::timestamptz,
    'Ismeretlen bíróság',
    'Zámbó Nórát, a KIM korábbi miniszteri kabinetfőnök-helyettesét 2026. június 23-án előzetes letartóztatásba helyezte a NAV hűtlen kezelés bűntett megalapozott gyanúja miatt az NKA-botrányban.',
    ARRAY['https://444.hu/2026/06/25/ughy-attila-elozetes-letartoztatas'],
    ARRAY['444.hu'],
    ARRAY['Hat személy előzetesben az NKA-botrányban'],
    ARRAY['2026-06-25']
  )
) AS v("personName", position, crimes, "sentenceYears", "sentenceLabel", "verdictType", "verdictDate", court, summary, "sourceUrls", "sourceNames", "sourceHeadlines", "sourceDates")
WHERE NOT EXISTS (
  SELECT 1 FROM "CourtVerdict" cv
  WHERE cv."personName" = v."personName"
    AND cv."verdictType" = 'előzetesben'
);
