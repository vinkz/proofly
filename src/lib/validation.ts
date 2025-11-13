import { z } from 'zod';

export const createJobSchema = z.object({
  clientName: z.string().trim().min(1, 'Client name is required').max(120),
  address: z.string().trim().min(1, 'Address is required').max(200),
  templateId: z.string().uuid('Invalid template selection'),
});

export const checklistUpdateSchema = z.object({
  jobId: z.string().uuid(),
  checklistId: z.string().uuid(),
  status: z.enum(['pending', 'pass', 'fail']).optional(),
  note: z.string().trim().max(500).optional(),
});

export const photoUploadSchema = z.object({
  jobId: z.string().uuid(),
  checklistId: z.string().uuid().optional(),
});

export const signatureSchema = z.object({
  jobId: z.string().uuid(),
  signer: z.enum(['plumber', 'client']),
  dataUrl: z
    .string()
    .regex(/^data:image\/png;base64,/, 'Signature data must be base64 PNG'),
});

export const reportSchema = z.object({
  jobId: z.string().uuid(),
});
