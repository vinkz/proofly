import type { BoilerServiceJobInfo } from '@/types/boiler-service';
import type { ClientPropertyHealth, ClientWithCompliance } from '@/server/clients';

export type BoilerServiceSavedProperty = Pick<
  ClientPropertyHealth,
  'id' | 'name' | 'addressLine1' | 'addressLine2' | 'town' | 'postcode' | 'phone' | 'nextServiceDue' | 'status'
>;

export type BoilerServiceSavedClient = Pick<
  ClientWithCompliance,
  'id' | 'name' | 'organization' | 'phone' | 'address' | 'postcode' | 'landlord_name' | 'landlord_address'
> & {
  properties: BoilerServiceSavedProperty[];
};

const text = (value: string | null | undefined) => String(value ?? '').trim();

const splitAddress = (value: string | null | undefined) =>
  text(value)
    .split(/[\r\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const composeAddress = (...parts: Array<string | null | undefined>) =>
  parts.map(text).filter(Boolean).join(', ');

/**
 * Decide from the server-loaded snapshot, never from live form state.
 *
 * This keeps the selector stable while the engineer types and prevents saved
 * data from being offered over details already captured in /jobs/new, a public
 * prefill form, or the other certificate in a combined job.
 */
export function arrivedWithBoilerServiceContext(fields: Record<string, string | null | undefined>) {
  return Boolean(
    text(fields.customer_name) ||
      text(fields.landlord_name) ||
      text(fields.customer_address) ||
      text(fields.customer_address_line1) ||
      text(fields.property_address) ||
      text(fields.job_address_line1),
  );
}

export function boilerServiceSavedClientLabel(client: BoilerServiceSavedClient) {
  return [text(client.landlord_name) || text(client.name) || 'Unnamed client', text(client.organization)]
    .filter(Boolean)
    .join(' · ');
}

export function boilerServiceSavedPropertyLabel(property: BoilerServiceSavedProperty) {
  const address = composeAddress(property.addressLine1, property.town, property.postcode);
  return [text(property.name) || text(property.addressLine1), address].filter(Boolean).join(' · ');
}

export function savedClientJobInfoPatch(client: BoilerServiceSavedClient): Partial<BoilerServiceJobInfo> {
  const addressParts = splitAddress(client.landlord_address ?? client.address);
  return {
    customer_name: text(client.landlord_name) || text(client.name),
    customer_company: text(client.organization),
    customer_address_line1: addressParts[0] ?? '',
    customer_address_line2: addressParts.length > 2 ? addressParts.slice(1, -1).join(', ') : '',
    customer_city: addressParts.length > 1 ? addressParts.at(-1) ?? '' : '',
    customer_postcode: text(client.postcode),
    customer_phone: text(client.phone),
  };
}

export function savedPropertyJobInfoPatch(property: BoilerServiceSavedProperty): Partial<BoilerServiceJobInfo> {
  return {
    property_address: composeAddress(property.addressLine1, property.addressLine2, property.town),
    postcode: text(property.postcode),
  };
}

export function savedPropertyJobAddressPatch(property: BoilerServiceSavedProperty) {
  return {
    job_address_name: text(property.name),
    job_address_line1: text(property.addressLine1),
    job_address_line2: text(property.addressLine2),
    job_address_city: text(property.town),
    job_postcode: text(property.postcode),
    job_tel: text(property.phone),
  };
}
