import { type Metadata } from 'next';

import { AltLoginFlow } from '~/app/_components/auth/alt-login-flow';

export const metadata: Metadata = {
  title: 'Akses Alternatif',
  robots: { index: false },
};

export default function AltLoginPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-100 px-4 py-8">
      <AltLoginFlow />
    </div>
  );
}
