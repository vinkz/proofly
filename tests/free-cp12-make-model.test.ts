import { describe, expect, it } from 'vitest';

import { buildCp12RenderInput } from '@/lib/cp12/buildCp12Render';
import {
  FreeCp12PayloadSchema,
  freeCp12ToRenderSource,
  freeCp12ValidationInput,
  toCp12Appliance,
} from '@/lib/cp12/freeCp12Payload';
import { validateCp12TierOne } from '@/lib/cp12/validation';

/**
 * Make and model are captured separately so the shared appliance catalogue can
 * drive them, then composed into the single description the renderer and the
 * Reg 36(3)(d) issue gate both expect. Free text must keep working for anything
 * the catalogue does not list.
 */
const appliance = (over: Record<string, unknown>) =>
  FreeCp12PayloadSchema.parse({
    fields: {},
    appliances: [{ appliance_type: 'boiler', location: 'Kitchen', ...over }],
  });

const described = (over: Record<string, unknown>) =>
  buildCp12RenderInput(
    freeCp12ToRenderSource(appliance(over), {
      recordId: 'R',
      certNumber: 'R',
      issuedAt: new Date('2026-07-28T00:00:00Z'),
    }),
  ).appliances[0].description;

describe('appliance make and model', () => {
  it('composes catalogue make and model into the printed description', () => {
    expect(described({ make: 'Vaillant', model: 'EcoTec Plus 832' })).toBe('Vaillant EcoTec Plus 832');
  });

  it('accepts a make with no model', () => {
    expect(described({ make: 'Vaillant', model: '' })).toBe('Vaillant');
  });

  it('falls back to free-text make_model when the catalogue has neither', () => {
    expect(described({ make: '', model: '', make_model: 'Obscure Import 2000' })).toBe(
      'Obscure Import 2000',
    );
  });

  it('falls back to the type label when nothing is given', () => {
    // Never blank: Reg 36(3)(d) needs a description of each appliance.
    expect(described({ make: '', model: '', make_model: '' })).toBe('Boiler');
    // With a subtype chosen the label sharpens.
    expect(described({ make: '', model: '', make_model: '', appliance_subtype: 'combi' })).toBe(
      'Combi boiler',
    );
  });

  it('the composed value satisfies the description requirement in the issue gate', () => {
    // appliance_type blank, so the gate must fall back to the composed make/model.
    const payload = FreeCp12PayloadSchema.parse({
      fields: {
        inspection_date: '2026-07-28',
        job_address_line1: '9 Property Road',
        job_postcode: 'SE1 9SG',
        landlord_name: 'A Landlord',
        landlord_address_line1: '1 Landlord Street',
        engineer_name: 'Alex Engineer',
        gas_safe_number: '123456',
        engineer_signature: 'data:image/png;base64,iVBORw0KGgo=',
      },
      appliances: [
        {
          appliance_type: '',
          location: 'Kitchen',
          make: 'Worcester',
          model: 'Greenstar 30i',
          safety_classification: 'safe',
          reg_26_9_confirmed: true,
        },
      ],
    });

    expect(validateCp12TierOne(freeCp12ValidationInput(payload))).toEqual([]);
  });

  it('carries make and model through toCp12Appliance', () => {
    const parsed = appliance({ make: 'Baxi', model: '800 Combi 2' });
    expect(toCp12Appliance(parsed.appliances[0]).make_model).toBe('Baxi 800 Combi 2');
  });
});
