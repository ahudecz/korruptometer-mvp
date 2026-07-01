/**
 * Per-person YouTube videos for ADATBÁZIS case detail pages — embedded the same
 * way the /galeria person pages do. Keyed by the normalized primary person name
 * of the case (scandal.person). Editorial / hand-curated.
 */
export interface CaseVideo {
  videoId: string;
  channel?: string;
  title?: string;
  /** Optional link rendered after the video (e.g. an earlier part / galeria page). */
  moreLabel?: string;
  moreUrl?: string;
}

function normPerson(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

// Keyed by normalized person name.
const VIDEOS: Record<string, CaseVideo> = {
  [normPerson('Mészáros Lőrinc')]: {
    videoId: 'BsNbeQ5imq4',
    channel: 'Partizán',
    title: 'Ki az a Mészáros Lőrinc? — 2. rész',
    moreLabel: '1. rész és további anyagok: Mészáros Lőrinc (Galéria) →',
    moreUrl: '/galeria/meszaros-lorinc',
  },
  [normPerson('Orbán Viktor')]: { videoId: 'bZ4SXv9qJHM' },
  [normPerson('Rogán Antal')]: { videoId: 'jg7YksSZJ7k' },
  [normPerson('Tiborcz István')]: { videoId: 'jxlGamO6cZo' },
  [normPerson('Matolcsy György')]: { videoId: 'r6hrhIeykdc' },
  [normPerson('Kósa Lajos')]: { videoId: 'ZdeulAaa8J0' },
  [normPerson('Habony Árpád')]: { videoId: 'oLnmzAlDTNM' },
  [normPerson('Tarsoly Csaba')]: { videoId: 'U0Agw-tk6Qo' },
  [normPerson('Horváth Csaba')]: { videoId: 'lFQxesQQcCU' },
  [normPerson('Orbán Balázs')]: { videoId: 'bLp9BT3me6Y' },
  [normPerson('Szíjj László')]: { videoId: '7_04o5IK8E4' },
  [normPerson('Bige László')]: { videoId: '8AC5uDI6iMQ' },
  [normPerson('Hernádi Zsolt')]: { videoId: 'OHYMfUNmelw' },
  [normPerson('Homlok Zsolt')]: { videoId: 'rtJQpXsM1zs' },
  [normPerson('Lázár János')]: { videoId: 'UMxS_p4zDwY' },
  [normPerson('Sára Botond')]: { videoId: 'j17gTeG50uM' },
  [normPerson('Leisztinger Tamás')]: { videoId: 'Ap4-mMM3sb0' },
  [normPerson('Nagy Márton')]: { videoId: '2UYi1_606hk' },
  [normPerson('Balázs Attila')]: { videoId: 'KT6ErV2CLxM' },
};

export function getCaseVideo(person: string | null | undefined): CaseVideo | null {
  if (!person) return null;
  return VIDEOS[normPerson(person)] ?? null;
}
