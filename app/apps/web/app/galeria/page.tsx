import type { Metadata } from 'next';
import GaleriaClient from './GaleriaClient';

export const metadata: Metadata = {
  title: { absolute: 'Galéria' },
  description: '10 kiemelt NER-vezető arcképcsarnoka — Orbántól Mészárosig, ügyekkel és összegekkel. Kattints, és nézd meg, milyen gyanús ügyeik vannak!',
  openGraph: { title: 'Galéria — Kegyencjárat', description: 'A NER kegyenceinek arcképcsarnoka.' },
};

export default function GaleriaPage() {
  return <GaleriaClient />;
}
