import { Provider } from 'react-redux';

import { store } from '@/app/store/store';

import type { ReactNode } from 'react';
import { AuthSync } from '@/features/auth/components/AuthSync';
import { AuthExpiration } from '@/features/auth/components/AuthExpiration';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <Provider store={store}>
      <AuthSync />
      <AuthExpiration />
      {children}
    </Provider>
  );
}
