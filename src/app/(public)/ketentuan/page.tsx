import { type Metadata } from 'next';

import {
  TERMS_OF_SERVICE,
  TermsOfServicePage,
} from '~/app/_components/legal/terms-of-service';

export const metadata: Metadata = {
  title: TERMS_OF_SERVICE.id.title,
  description: TERMS_OF_SERVICE.id.description,
  alternates: {
    canonical: TERMS_OF_SERVICE.id.href,
    languages: {
      id: TERMS_OF_SERVICE.id.href,
      en: TERMS_OF_SERVICE.en.href,
    },
  },
};

export default function KetentuanRoute() {
  return <TermsOfServicePage locale="id" />;
}
