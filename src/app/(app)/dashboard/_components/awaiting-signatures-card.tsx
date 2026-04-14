'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

export type AwaitingSignatureJobCard = {
  id: string;
  client_name: string;
  title?: string | null;
  address: string;
  created_at: string;
  shareLink: string | null;
  expiresAt: string | null;
};

export function AwaitingSignaturesCard({
  jobs,
}: {
  jobs: AwaitingSignatureJobCard[];
}) {
  const { pushToast } = useToast();

  const handleCopyLink = async (shareLink: string | null) => {
    if (!shareLink) return;
    try {
      const absoluteUrl =
        shareLink.startsWith('http') || typeof window === 'undefined'
          ? shareLink
          : new URL(shareLink, window.location.origin).toString();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl);
      } else {
        window.prompt('Copy signature link', absoluteUrl);
      }
      pushToast({ title: 'Signature link copied', variant: 'success' });
    } catch (error) {
      console.error('Clipboard error', error);
      pushToast({
        title: 'Copy failed',
        description: 'Unable to copy the signature link.',
        variant: 'error',
      });
    }
  };

  return (
    <Card className="border border-white/10">
      <CardHeader>
        <CardTitle className="text-lg text-muted">PDFs Awaiting Signatures</CardTitle>
        <CardDescription className="text-sm text-muted-foreground/70">
          CP12 certificates sent out for remote landlord signature.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {jobs.length ? (
          jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-white/10 bg-white/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-muted">{job.client_name ?? job.title ?? 'Job'}</p>
                  <p className="text-xs text-muted-foreground/70">{job.address}</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Created {formatDateTime(job.created_at)}
                  </p>
                  {job.expiresAt ? (
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      Link expires {formatDate(job.expiresAt)}
                    </p>
                  ) : null}
                </div>
                <Badge variant="brand" className="uppercase">
                  Awaiting signature
                </Badge>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => handleCopyLink(job.shareLink)}
                >
                  Copy link
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href={`/jobs/${job.id}`}>Open job</Link>
                </Button>
                <Button asChild variant="secondary" className="rounded-full">
                  <Link href={job.shareLink ?? '#'} target="_blank">
                    Open signing link
                  </Link>
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground/70">No PDFs are currently awaiting remote signature.</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatDateTime(dateString: string) {
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
}

function formatDate(dateString: string) {
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
