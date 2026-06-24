export type WatchStatus = 'active' | 'resigned' | 'removed';

export interface WatchPerson {
  id: string;
  name: string;
  institution: string;
  status: WatchStatus;
  photoUrl?: string;
  photoCredit?: string;
  objectPosition?: string;
}

export const WATCH_LIST: WatchPerson[] = [
  {
    id: 'sulyok-tamas',
    name: 'Sulyok Tamás',
    institution: 'köztársasági elnök',
    status: 'active',
    photoUrl: '/images/persons/sulyok-tamas-koztarsasagi-elnok.png',
    photoCredit: 'Eredeti fotó: hvg.hu',
  },
  {
    id: 'polt-peter',
    name: 'Polt Péter',
    institution: 'Alkotmánybíróság elnöke',
    status: 'active',
    photoUrl: '/images/persons/polt-peter.png',
    photoCredit: 'Eredeti fotó: portfolio.hu',
    objectPosition: 'right top',
  },
  {
    id: 'nagy-gabor-balint',
    name: 'Nagy Gábor Bálint',
    institution: 'legfőbb ügyész',
    status: 'active',
    photoUrl: '/images/persons/nagy-gabor-balint-legfobb-ugyesz.png',
    photoCredit: 'Eredeti fotó: vasarnap.hu',
  },
  {
    id: 'varga-zs-andras',
    name: 'Varga Zs. András',
    institution: 'Kúria elnöke',
    status: 'active',
    photoUrl: '/images/persons/varga-zs-andras-kuria.png',
    photoCredit: 'Eredeti fotó: hvg.hu',
  },
  {
    id: 'windisch-laszlo',
    name: 'Windisch László',
    institution: 'ÁSZ elnöke',
    status: 'active',
    photoUrl: '/images/persons/windisch-laszlo-asz.png',
    photoCredit: 'Eredeti fotó: 24.hu',
  },
  {
    id: 'rigo-csaba-balazs',
    name: 'Rigó Csaba Balázs',
    institution: 'GVH elnöke',
    status: 'active',
    photoUrl: '/images/persons/rigo-csaba-gvh.png',
    photoCredit: 'Eredeti fotó: azutazo.hu',
  },
  {
    id: 'koltay-andras',
    name: 'Koltay András',
    institution: 'Médiahatóság elnöke',
    status: 'active',
    photoUrl: '/images/persons/koltay-andras-mediahatosag.png',
    photoCredit: 'Eredeti fotó: 444.hu',
  },
  {
    id: 'senyei-gyorgy',
    name: 'Senyei György',
    institution: 'OBH elnöke',
    status: 'active',
    photoUrl: '/images/persons/senyei-gyorgy-obh.png',
    photoCredit: 'Eredeti fotó: index.hu',
  },
];
