import { type Metadata } from 'next';

import {
  PRIVACY_POLICY,
  PrivacyPolicyPage,
} from '~/app/_components/legal/privacy-policy';

export const metadata: Metadata = {
  title: PRIVACY_POLICY.id.title,
  description: PRIVACY_POLICY.id.description,
  alternates: {
    canonical: PRIVACY_POLICY.id.href,
    languages: {
      id: PRIVACY_POLICY.id.href,
      en: PRIVACY_POLICY.en.href,
    },
  },
};

export default function KebijakanPrivasiRoute() {
  return <PrivacyPolicyPage locale="id" />;
}
