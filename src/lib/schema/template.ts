import { z } from 'zod';

export const TemplateItemSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(2, 'Label required'),
  type: z.enum(['toggle', 'text', 'number', 'note']),
  required: z.boolean().optional(),
  photo: z.boolean().optional(),
});

export const TemplateSchema = z.object({
  name: z.string().min(2, 'Template name required'),
  trade_type: z.string().min(2),
  description: z.string().max(500).optional().nullable(),
  is_public: z.boolean().optional().default(false),
  is_general: z.boolean().optional().default(false),
  items: z.array(TemplateItemSchema).min(1, 'Add at least one item'),
});
