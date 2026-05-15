'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function SignOutButton({ signOut }: { signOut: () => Promise<void> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="admin-logout"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await signOut();
          router.replace('/admin/login');
        });
      }}
    >
      {pending ? '…' : 'Kilépés'}
    </button>
  );
}
