'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupStep3Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/signup/step2');
  }, [router]);

  return null;
}
