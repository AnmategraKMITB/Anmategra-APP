import { type Metadata } from 'next';

import { DeckClient } from './deck-client';

export const metadata: Metadata = {
  title: 'Sneak Peek',
  description:
    'Presentasi singkat Anmategra: ekosistem data kemahasiswaan KM ITB dari hulu ke hilir.',
  robots: { index: false },
};

const SneakPeekPage = () => <DeckClient />;

export default SneakPeekPage;
