import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

import type { Database } from '@/lib/database.types';
import { assertSupabaseEnv, env } from '@/lib/env';
import { createJobSheetForJob } from '@/server/job-sheets';

const DEFAULT_BASE_URL = 'http://localhost:3000';
const PAGE_MARGIN = 48;
const TEXT_COLOR = rgb(0.1, 0.1, 0.1);

type JobRow = Pick<
  Database['public']['Tables']['jobs']['Row'],
  'id' | 'user_id' | 'client_name' | 'address' | 'scheduled_for'
>;

const formatDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const normalizeText = (value: string | null, fallback: string) => {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.replace(/\s*\n\s*/g, ', ');
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  assertSupabaseEnv();
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {
        return;
      },
      remove() {
        return;
      },
    },
  });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, user_id, client_name, address, scheduled_for')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .maybeSingle<JobRow>();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const { code } = await createJobSheetForJob(supabase, jobId);
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_BASE_URL).replace(
    /\/$/,
    '',
  );
  const scanUrl = `${baseUrl}/jobs/scan?code=${encodeURIComponent(code)}`;
  const qrBuffer = await QRCode.toBuffer(scanUrl, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  });

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();

  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = height - PAGE_MARGIN;

  page.drawText('Job Sheet', {
    x: PAGE_MARGIN,
    y,
    size: 28,
    font: titleFont,
    color: TEXT_COLOR,
  });

  y -= 44;

  const customerName = normalizeText(job.client_name, 'Not provided');
  const address = normalizeText(job.address, 'Not provided');
  const jobDate = formatDate(job.scheduled_for);

  const lines = [
    `Customer: ${customerName}`,
    `Address: ${address}`,
    ...(jobDate ? [`Job date: ${jobDate}`] : []),
    `Sheet Code: ${code}`,
  ];

  lines.forEach((line) => {
    page.drawText(line, {
      x: PAGE_MARGIN,
      y,
      size: 14,
      font: bodyFont,
      color: TEXT_COLOR,
    });
    y -= 24;
  });

  const qrImage = await pdfDoc.embedPng(qrBuffer);
  const qrSize = 160;
  const qrX = width - PAGE_MARGIN - qrSize;
  const qrY = PAGE_MARGIN;

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength,
  ) as ArrayBuffer;

  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="job-sheet.pdf"',
    },
  });
}
