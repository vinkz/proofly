export type AddressParts = {
  line1?: string | null;
  line2?: string | null;
  town?: string | null;
  postcode?: string | null;
};

export function formatAddressLine(address: AddressParts | null | undefined) {
  if (!address) return '';
  return [address.line1, address.line2, address.town].filter(Boolean).join(', ');
}

export function formatJobAddress(address: AddressParts | null | undefined, options?: { includePostcode?: boolean }) {
  if (!address) return '';
  const base = formatAddressLine(address);
  if (options?.includePostcode && address.postcode) {
    return [base, address.postcode].filter(Boolean).join(', ');
  }
  return base;
}
