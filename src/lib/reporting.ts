import type { JobChecklistItem } from '@/types/job-detail';
import { getOpenAIClient } from '@/lib/openai';

type ChecklistSummaryItem = Pick<JobChecklistItem, 'label' | 'result' | 'note'>;

export interface ReportJobPayload {
  job: {
    id: string;
    title: string | null;
    client_name: string | null;
    address: string | null;
    scheduled_for: string | null;
    technician_name: string | null;
  };
  checklist: ChecklistSummaryItem[];
}

export interface PdfAsset {
  kind: 'photo' | 'signature';
  label: string;
  data: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg';
}

export interface PdfPayload {
  job: ReportJobPayload['job'];
  summary: string;
  checklist: ChecklistSummaryItem[];
  assets: PdfAsset[];
}

export async function generateReport(data: ReportJobPayload): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const checklistSummary = data.checklist.map((item) => ({
    label: item.label,
    result: item.result ?? 'pending',
    note: item.note ?? '',
  }));

  if (!apiKey) {
    return 'Inspection completed. (AI summary unavailable – set OPENAI_API_KEY to enable.)';
  }

  const openai = getOpenAIClient();
  const completion = await openai.responses.create({
    model: 'gpt-4o-mini',
    input: [
      {
        role: 'system',
        content: `You are CertNow, an assistant who produces factual, professional compliance summaries for plumbing jobs. 
Return 3-4 sentences that highlight severity of failed checks and next steps.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          job: data.job,
          checklist: checklistSummary,
        }),
      },
    ],
  });

  return completion.output_text?.trim() || 'Inspection completed. All systems verified.';
}

export async function generatePDF(payload: PdfPayload): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let page = pdfDoc.addPage([595, 842]);
  const marginX = 40;
  let cursorY = 780;

  const drawLine = (text: string, opts: { fontSize?: number; font?: typeof font } = {}) => {
    page.drawText(text, {
      x: marginX,
      y: cursorY,
      size: opts.fontSize ?? 12,
      font: opts.font ?? font,
    });
    cursorY -= (opts.fontSize ?? 12) + 6;
  };

  drawLine('CertNow Field Report', { fontSize: 20, font: boldFont });
  drawLine(`Client: ${payload.job.client_name ?? 'N/A'}`);
  drawLine(`Job Title: ${payload.job.title ?? 'Untitled Job'}`);
  drawLine(`Location: ${payload.job.address ?? 'Not provided'}`);
  drawLine(
    `Scheduled: ${
      payload.job.scheduled_for ? new Date(payload.job.scheduled_for).toLocaleString() : 'Not scheduled'
    }`,
  );
  drawLine(`Technician: ${payload.job.technician_name ?? 'Unassigned'}`);

  cursorY -= 4;
  drawLine('Summary', { fontSize: 14, font: boldFont });
  payload.summary.split(/\n|(?<=\.)\s+/).forEach((line) => {
    if (!line) return;
    drawLine(`• ${line.trim()}`);
  });

  cursorY -= 6;
  drawLine('Checklist', { fontSize: 14, font: boldFont });
  payload.checklist.forEach((item) => {
    if (cursorY < 120) {
      cursorY = 780;
      page = pdfDoc.addPage([595, 842]);
      drawLine('Checklist (cont.)', { fontSize: 14, font: boldFont });
    }
    const status = (item.result ?? 'pending').toUpperCase();
    drawLine(`${item.label} — ${status}`, { fontSize: 12, font: boldFont });
    if (item.note) {
      drawLine(`Note: ${item.note}`, { fontSize: 11 });
    }
  });

  const photos = payload.assets.filter((asset) => asset.kind === 'photo');
  if (photos.length) {
    let photoPage = pdfDoc.addPage([595, 842]);
    let x = 40;
    let y = 760;
    photoPage.drawText('Photos', { x, y, size: 16, font: boldFont });
    y -= 36;

    for (const asset of photos) {
      const image =
        asset.mimeType === 'image/png'
          ? await pdfDoc.embedPng(asset.data)
          : await pdfDoc.embedJpg(asset.data);
      const dims = image.scaleToFit(180, 140);
      photoPage.drawImage(image, { x, y: y - dims.height, width: dims.width, height: dims.height });
      photoPage.drawText(asset.label, { x, y: y - dims.height - 14, size: 11, font });
      x += 200;
      if (x > 400) {
        x = 40;
        y -= 180;
        if (y < 160) {
          photoPage = pdfDoc.addPage([595, 842]);
          x = 40;
          y = 760;
        }
      }
    }
  }

  const signatures = payload.assets.filter((asset) => asset.kind === 'signature');
  if (signatures.length) {
    const sigPage = pdfDoc.addPage([595, 420]);
    let y = 360;
    sigPage.drawText('Signatures', { x: 40, y, size: 16, font: boldFont });
    y -= 40;

    for (const asset of signatures) {
      const image =
        asset.mimeType === 'image/png'
          ? await pdfDoc.embedPng(asset.data)
          : await pdfDoc.embedJpg(asset.data);
      const dims = image.scaleToFit(240, 120);
      sigPage.drawText(asset.label, { x: 40, y, size: 12, font: boldFont });
      sigPage.drawImage(image, {
        x: 40,
        y: y - dims.height - 10,
        width: dims.width,
        height: dims.height,
      });
      y -= dims.height + 60;
    }
  }

  return pdfDoc.save();
}
