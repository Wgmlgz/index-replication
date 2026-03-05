import type { Decorator } from '@storybook/nextjs-vite';

import { TBankConnectionProvider } from '@/components/tbank/tbank-connection-context';
import { UserProvider } from '@/components/user-context';

export const withUserProvider: Decorator = Story => (
  <UserProvider>
    <Story />
  </UserProvider>
);

export const withTBankConnectionProvider: Decorator = Story => (
  <TBankConnectionProvider>
    <Story />
  </TBankConnectionProvider>
);
