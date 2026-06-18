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
    photoUrl: 'https://img.hvg.hu/Img/8133bb77-3fc3-490f-b374-cb198a0455cc/2877b05d-7db9-4f6b-8dfb-a804416c4d8d.jpg',
    photoCredit: 'hvg.hu',
  },
  {
    id: 'polt-peter',
    name: 'Polt Péter',
    institution: 'Alkotmánybíróság elnöke',
    status: 'active',
    photoUrl: 'https://img.hvg.hu/Img/8133bb77-3fc3-490f-b374-cb198a0455cc/46b4edd9-daf3-49d5-a1ea-7cf6f7396d0a.jpg',
    photoCredit: 'portfolio.hu',
    objectPosition: 'right top',
  },
  {
    id: 'nagy-gabor-balint',
    name: 'Nagy Gábor Bálint',
    institution: 'legfőbb ügyész',
    status: 'active',
    photoUrl: 'https://vasarnap.hu/wp-content/uploads/2025/05/Nagy-Gabor-Balint-780x470.jpg',
    photoCredit: 'vasarnap.hu',
  },
  {
    id: 'varga-zs-andras',
    name: 'Varga Zs. András',
    institution: 'Kúria elnöke',
    status: 'active',
    photoUrl: 'https://img.hvg.hu/Img/8133bb77-3fc3-490f-b374-cb198a0455cc/c2a71573-c25a-4837-add1-b2780630952a.jpg',
    photoCredit: 'hvg.hu',
  },
  {
    id: 'windisch-laszlo',
    name: 'Windisch László',
    institution: 'ÁSZ elnöke',
    status: 'active',
    photoUrl: 'https://s.24.hu/app/uploads/2026/06/central-0812427334-1-1140x758.jpg',
    photoCredit: '24.hu',
  },
  {
    id: 'rigo-csaba-balazs',
    name: 'Rigó Csaba Balázs',
    institution: 'GVH elnöke',
    status: 'active',
    photoUrl: 'https://azutazo.hu/wp-content/uploads/2024/01/PA_20231107_007-777x437.jpg',
    photoCredit: 'azutazo.hu',
  },
  {
    id: 'koltay-andras',
    name: 'Koltay András',
    institution: 'Médiahatóság elnöke',
    status: 'active',
    photoUrl: 'https://assets.4cdn.hu/kraken/7q78siQBw2he1ZYsss.jpeg',
    photoCredit: '444.hu',
  },
  {
    id: 'senyei-gyorgy',
    name: 'Senyei György',
    institution: 'OBH elnöke',
    status: 'active',
    photoUrl: 'https://kep.cdn.indexvas.hu/1/0/3570/35705/357059/35705919_f2cc6a6fec6a1a28563128327e1f00d7_wm.jpg',
    photoCredit: 'index.hu',
  },
];
