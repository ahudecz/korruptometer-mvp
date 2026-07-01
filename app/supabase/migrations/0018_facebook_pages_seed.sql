-- Kezdeti Facebook oldal lista a sync-facebook-posts Inngest funkcióhoz
insert into "FacebookPage" ("pageId", "pageName", "pageHandle") values
  ('atlatszo.hu',              'Átlátszó',           'atlatszo.hu'),
  ('molnararonofficial',       'Molnár Áron',         'molnararonofficial'),
  ('peter.magyar.102',         'Magyar Péter',        'peter.magyar.102'),
  ('kapitanyistvan.tisza',     'Kapitány István',     'kapitanyistvan.tisza'),
  ('tarrzoltan.tisza',         'Tárr Zoltán',         'tarrzoltan.tisza'),
  ('vastagbor',                'Vastagbőr',           'vastagbor'),
  ('Juhi.JuhaszPeter',         'Juhász Péter',        'Juhi.JuhaszPeter'),
  ('hadhazyakos',              'Hadházy Ákos',        'hadhazyakos'),
  ('dullszabolcsujsagiro',     'Dull Szabolcs',       'dullszabolcsujsagiro'),
  ('panyiszabolcs',            'Pányi Szabolcs',      'panyiszabolcs'),
  ('61575111935495',           'Maydayhungary',       null),
  ('NAVprofil',                'NAV',                 'NAVprofil'),
  ('kormanyzat',               'Kormányzat',          'kormanyzat'),
  ('tarkanyizsoltdebrecen',    'Tarkányi Zsolt',      'tarkanyizsoltdebrecen'),
  ('kontrollponthu',           'Kontrollpont',        'kontrollponthu'),
  ('jamborandrasoldala',       'Jámbor András',       'jamborandrasoldala'),
  ('avakmajom',                'A Vak Majom',         'avakmajom'),
  ('bodiskrisztaofficial',     'Bódis Kriszta',       'bodiskrisztaofficial'),
  ('drkuljaandras',            'Kulja András',        'drkuljaandras'),
  ('balogh.balazs.tisza',      'Balogh Balázs',       'balogh.balazs.tisza'),
  ('tisza.budapest.06oevk',    'Tisza Budapest 06. ÖVK', 'tisza.budapest.06oevk')
on conflict ("pageId") do nothing;
