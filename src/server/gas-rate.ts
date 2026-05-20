'use server';

import { z } from 'zod';

import {
  calculateGasRate,
  DEFAULT_CALORIFIC_VALUE_MJ_PER_M3,
  DEFAULT_VOLUME_CORRECTION_FACTOR,
  type GasRateInput,
  type GasRateResult,
} from '@/lib/gas-rate-calculator';
import { requireUser } from '@/lib/supabaseServer';

const gasRateInputSchema = z
  .object({
    meterType: z.enum(['metric', 'imperial']),
    durationSeconds: z.coerce.number().positive(),
    volume: z.coerce.number().positive().optional().nullable(),
    startReading: z.coerce.number().optional().nullable(),
    endReading: z.coerce.number().optional().nullable(),
    calorificValue: z.coerce.number().positive().optional().nullable(),
    correctionFactor: z.coerce.number().positive().optional().nullable(),
  })
  .refine(
    (value) =>
      value.volume !== undefined && value.volume !== null
        ? true
        : value.startReading !== undefined &&
          value.startReading !== null &&
          value.endReading !== undefined &&
          value.endReading !== null,
    {
      message: 'Enter a timed volume or both start and end readings.',
      path: ['volume'],
    },
  );

export type GasRateCalculationResponse =
  | { ok: true; result: GasRateResult }
  | { ok: false; error: string };

export async function calculateGasRateForTool(input: GasRateInput): Promise<GasRateCalculationResponse> {
  await requireUser();

  const parsed = gasRateInputSchema.safeParse({
    ...input,
    calorificValue: input.calorificValue ?? DEFAULT_CALORIFIC_VALUE_MJ_PER_M3,
    correctionFactor: input.correctionFactor ?? DEFAULT_VOLUME_CORRECTION_FACTOR,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Check the gas rate inputs and try again.',
    };
  }

  try {
    return {
      ok: true,
      result: calculateGasRate(parsed.data),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to calculate gas rate.',
    };
  }
}
