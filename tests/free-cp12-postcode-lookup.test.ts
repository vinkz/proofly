import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The address lookup used to sit only on Address line 1. Someone holding a
 * postcode goes to the box labelled Postcode instead — a real visitor tapped
 * exactly the landlord postcode field, typed nothing, and left after eight
 * minutes on the page.
 *
 * Both postcode boxes look up now, and both address-line-1 boxes still do. The
 * form is a client component these tests do not render, so they assert the
 * wiring, the same way the other free-tool tests do.
 */
const form = readFileSync('src/app/free-cp12/_components/free-cp12-form.tsx', 'utf8');
const lookup = readFileSync('src/components/address/address-lookup-field.tsx', 'utf8');

describe('postcode fields look up', () => {
  it('wires both postcode boxes to the lookup, keeping the postcode not the street', () => {
    const matches = form.match(/resolveSelectedValue=\{\(address\) => address\.postcode\}/g);
    expect(matches).toHaveLength(2);
  });

  it('fills the whole address from a pick, via the same handlers line 1 uses', () => {
    expect(form).toMatch(/label="Postcode"[\s\S]{0,320}onSelect=\{applyLandlordAddress\}/);
    expect(form).toMatch(/label="Postcode"[\s\S]{0,320}onSelect=\{applyPropertyAddress\}/);
  });

  it('no longer leaves either postcode as a plain input', () => {
    expect(form).not.toMatch(/<Field label="Postcode">/);
  });
});

describe('address line 1 lookup is untouched', () => {
  it('still looks up on both address lines', () => {
    expect(form).toMatch(/label="Address line 1"[\s\S]{0,320}onSelect=\{applyLandlordAddress\}/);
    expect(form).toMatch(/label="Address line 1"[\s\S]{0,320}onSelect=\{applyPropertyAddress\}/);
  });

  it('keeps line 1 as the default a field shows after a pick', () => {
    // resolveSelectedValue is opt-in; without it the component must still keep
    // line 1, or every existing caller silently changes behaviour.
    expect(lookup).toMatch(/resolveSelectedValue\?\.\(data\.address\) \|\| resolvedLine1/);
  });

  it('guards the reopening list against the value it actually kept', () => {
    // skipSearchForRef has to hold what is on screen. Holding line 1 while the
    // box shows a postcode would let the debounced search fire again and
    // reopen the list over the next field.
    expect(lookup).toMatch(/skipSearchForRef\.current = kept/);
    expect(lookup).toMatch(/updateQuery\(kept\)/);
  });
});
