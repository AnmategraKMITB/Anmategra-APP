import { type Metadata } from 'next';

import {
  PRIVACY_POLICY,
  PrivacyPolicyPage,
} from '~/app/_components/legal/privacy-policy';

export const metadata: Metadata = {
  title: PRIVACY_POLICY.en.title,
  description: PRIVACY_POLICY.en.description,
  alternates: {
    canonical: PRIVACY_POLICY.en.href,
    languages: {
      id: PRIVACY_POLICY.id.href,
      en: PRIVACY_POLICY.en.href,
    },
  },
};

export default function PrivacyPolicyRoute() {
  return <PrivacyPolicyPage locale="en" />;
}
