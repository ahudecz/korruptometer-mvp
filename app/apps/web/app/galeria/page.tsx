import type { Metadata } from 'next';
import GaleriaClient from './GaleriaClient';

export const metadata: Metadata = {
  title: 'Galéria',
  description: 'A NER kegyenceinek arcképcsarnoka — ügyek, összegek és státuszok egy helyen.',
  openGraph: { title: 'Galéria — Kegyencjárat', description: 'A NER kegyenceinek arcképcsarnoka.' },
};

export default function GaleriaPage() {
  return <GaleriaClient />;
}
