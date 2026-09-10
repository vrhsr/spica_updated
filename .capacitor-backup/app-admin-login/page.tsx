
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Admin and rep logins were merged into a single portal at /login. */
export default function AdminLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/login');
  }, [router]);
  return null;
}
