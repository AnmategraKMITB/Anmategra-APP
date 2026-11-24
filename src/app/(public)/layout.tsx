import React, { type ReactNode } from 'react';
import { getServerAuthSession } from '~/server/auth';

import { WidthWrapper } from '../_components/layout/width-wrapper';

const HalamanPublicLayout = async ({ children }: { children: ReactNode }) => {
  const session = await getServerAuthSession();
  return (
    <WidthWrapper session={session} landingPath="/">
      {children}
    </WidthWrapper>
  );
};

export default HalamanPublicLayout;
