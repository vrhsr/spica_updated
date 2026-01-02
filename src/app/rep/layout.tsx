import { ReactNode } from 'react';
import { RepLayoutClient } from './RepLayoutClient';

type RepLayoutProps = {
  children: ReactNode;
};

// Pure server component layout - NO Firebase, NO browser APIs
export default function RepLayout({ children }: RepLayoutProps) {
  return <RepLayoutClient>{children}</RepLayoutClient>;
}
