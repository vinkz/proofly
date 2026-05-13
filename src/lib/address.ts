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

const UK_POSTCODE_PATTERN = /^([A-Z]{1,2}\d[A-Z\d]?)\s?(\d[A-Z]{2})$/i;

export function formatUkPostcode(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim();
  const compact = trimmed.replace(/\s+/g, '').toUpperCase();
  const match = compact.match(UK_POSTCODE_PATTERN);
  return match ? `${match[1]} ${match[2]}` : trimmed.toUpperCase();
}

export function toTitleCase(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .replace(/^(\d+)([A-Za-z])/, '$1 $2')
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function formatDisplayAddress(value: string | null | undefined) {
  return String(value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (UK_POSTCODE_PATTERN.test(part.replace(/\s+/g, '')) ? formatUkPostcode(part) : toTitleCase(part)))
    .join(', ');
}
