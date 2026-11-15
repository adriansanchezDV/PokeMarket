import { Provider } from 'react-redux';

import { store } from '@/app/store/store';

import type { ReactNode } from 'react';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return <Provider store={store}>{children}</Provider>;
}
