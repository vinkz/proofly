'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

export function CopyRequestLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      className="rounded-full"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? 'Copied' : 'Copy request link'}
    </Button>
  );
}
