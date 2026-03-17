'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { savePdfToDocuments } from '@/server/documents';

type DocumentActionsProps = {
  jobId: string;
  jobTitle: string;
  pdfUrl: string | null;
  pdfPath: string | null;
  invoiceId: string | null;
  hasDocument: boolean;
  clientEmail: string | null;
  clientPhone: string | null;
};

export function DocumentActions({
  jobId,
  jobTitle,
  pdfUrl,
  pdfPath,
  invoiceId,
  hasDocument,
  clientEmail,
  clientPhone,
}: DocumentActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [showSendOptions, setShowSendOptions] = useState(false);
  const [channel, setChannel] = useState<'email' | 'whatsapp' | null>(null);
  const [email, setEmail] = useState(clientEmail ?? '');
  const [phone, setPhone] = useState(clientPhone ?? '');
  const { pushToast } = useToast();
  const router = useRouter();

  const handleShare = () => {
    if (!pdfUrl) {
      pushToast({ title: 'No PDF available', description: 'Generate a PDF first.', variant: 'error' });
      return;
    }
    startTransition(async () => {
      try {
        if (navigator.share) {
          const response = await fetch(pdfUrl);
          if (!response.ok) throw new Error('Unable to download PDF');
          const blob = await response.blob();
          const file = new File([blob], 'document.pdf', { type: 'application/pdf' });
          await navigator.share({
            files: [file],
            title: 'Document PDF',
            text: 'Shared document PDF',
          });
          return;
        }
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(pdfUrl);
          pushToast({ title: 'Link copied', variant: 'success' });
        } else {
          window.prompt('Copy PDF link', pdfUrl);
        }
        window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      } catch (error) {
        pushToast({
          title: 'Unable to share',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  const handleWhatsapp = () => {
    if (!pdfUrl) {
      pushToast({ title: 'No PDF available', description: 'Generate a PDF first.', variant: 'error' });
      return;
    }
    const digits = phone.replace(/[^\d]/g, '');
    if (!digits) {
      pushToast({ title: 'Add phone number', description: 'Enter a WhatsApp number.', variant: 'error' });
      return;
    }
    const text = encodeURIComponent(`Hi, here is your document for ${jobTitle}:\n${pdfUrl}`);
    const link = `https://wa.me/${digits}?text=${text}`;
    window.open(link, '_blank', 'noopener,noreferrer');
    pushToast({ title: 'Opening WhatsApp', variant: 'success' });
  };

  const handleEmail = () => {
    if (!pdfUrl) {
      pushToast({ title: 'No PDF available', description: 'Generate a PDF first.', variant: 'error' });
      return;
    }
    if (!email.trim()) {
      pushToast({ title: 'Add email', description: 'Enter a recipient email.', variant: 'error' });
      return;
    }
    const subject = encodeURIComponent(`Your ${jobTitle || 'document'}`);
    const body = encodeURIComponent(`Hi,\n\nHere is your document:\n${pdfUrl}\n\nThank you.`);
    window.location.href = `mailto:${encodeURIComponent(email.trim())}?subject=${subject}&body=${body}`;
    pushToast({ title: 'Email draft opened', variant: 'success' });
  };

  const handleCreateInvoice = () => {
    router.push(`/invoices/new?jobId=${jobId}`);
  };

  const handleSaveToDocuments = () => {
    if (!pdfPath) {
      pushToast({ title: 'No PDF available', description: 'Generate a PDF first.', variant: 'error' });
      return;
    }
    startTransition(async () => {
      try {
        await savePdfToDocuments({ jobId, pdfPath });
        pushToast({ title: 'Saved to Documents', variant: 'success' });
        router.refresh();
      } catch (error) {
        pushToast({
          title: 'Unable to save',
          description: error instanceof Error ? error.message : 'Try again.',
          variant: 'error',
        });
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button className="rounded-full bg-[var(--accent)] px-4 py-2 text-white" onClick={handleShare} disabled={isPending}>
        Share
      </Button>
      <div className="relative">
        <Button
          className="rounded-full bg-[var(--action)] px-4 py-2 text-white"
          type="button"
          onClick={() => setShowSendOptions((prev) => !prev)}
          disabled={isPending}
        >
          Send to Client
        </Button>
        {showSendOptions ? (
          <div className="absolute left-0 z-20 mt-2 w-72 rounded-2xl border border-white/20 bg-white p-3 shadow-xl">
            <p className="text-sm font-semibold text-muted">Choose channel</p>
            <div className="mt-2 grid gap-2">
              <Button
                variant={channel === 'email' ? 'primary' : 'outline'}
                className="justify-start rounded-xl"
                onClick={() => setChannel('email')}
              >
                Email
              </Button>
              <Button
                variant={channel === 'whatsapp' ? 'primary' : 'outline'}
                className="justify-start rounded-xl"
                onClick={() => setChannel('whatsapp')}
              >
                WhatsApp
              </Button>
            </div>
            {channel === 'email' ? (
              <div className="mt-3 space-y-2">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/40 bg-white/80 px-3 py-2 text-sm"
                  placeholder="client@example.com"
                />
                <Button className="w-full rounded-xl" onClick={handleEmail}>
                  Draft email
                </Button>
              </div>
            ) : null}
            {channel === 'whatsapp' ? (
              <div className="mt-3 space-y-2">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-white/40 bg-white/80 px-3 py-2 text-sm"
                  placeholder="+44 7..."
                />
                <Button className="w-full rounded-xl" onClick={handleWhatsapp}>
                  Open WhatsApp
                </Button>
              </div>
            ) : null}
            {channel === null ? (
              <p className="mt-2 text-xs text-muted-foreground/70">Select email or WhatsApp to continue.</p>
            ) : null}
          </div>
        ) : null}
      </div>
      <Button asChild variant="outline" className="rounded-full" disabled={!pdfUrl || isPending}>
        <a href={pdfUrl ?? undefined} download target="_blank" rel="noreferrer">
          Download PDF
        </a>
      </Button>
      <Button
        variant="outline"
        className="rounded-full"
        onClick={handleSaveToDocuments}
        disabled={!pdfPath || hasDocument || isPending}
      >
        {hasDocument ? 'Saved to Documents' : 'Save to Documents'}
      </Button>
      {invoiceId ? (
        <Button asChild variant="secondary" className="rounded-full">
          <a href={`/invoices/${invoiceId}`}>View Invoice</a>
        </Button>
      ) : (
        <Button variant="secondary" className="rounded-full" onClick={handleCreateInvoice} disabled={isPending}>
          Create Invoice
        </Button>
      )}
    </div>
  );
}
