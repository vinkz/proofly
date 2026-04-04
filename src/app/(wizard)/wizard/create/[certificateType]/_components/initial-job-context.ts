import type { Database } from '@/lib/database.types';
import type { Customer } from '@/server/customer-service';

type JobRow = Database['public']['Tables']['jobs']['Row'];

export type InitialJobContext = {
  job: JobRow;
  customer: Customer | null;
  propertyAddress: {
    summary?: string | null;
    line1?: string | null;
    line2?: string | null;
    town?: string | null;
    postcode?: string | null;
  } | null;
};

const pickText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

export function mergeJobContextFields(
  fields: Record<string, string | null | undefined>,
  context?: InitialJobContext | null,
) {
  if (!context) return fields;

  const propertyAddress = context.propertyAddress;
  const customer = context.customer;
  const propertySummary = pickText(propertyAddress?.summary, propertyAddress?.line1, fields.property_address);

  return {
    ...fields,
    customer_name: pickText(fields.customer_name, customer?.name ?? null),
    customer_address: pickText(fields.customer_address, customer?.address ?? null),
    customer_email: pickText(fields.customer_email, customer?.email ?? null),
    customer_phone: pickText(fields.customer_phone, customer?.phone ?? null),
    customer_contact: pickText(fields.customer_contact, customer?.phone ?? null, customer?.email ?? null),
    property_address: pickText(fields.property_address, propertySummary),
    postcode: pickText(fields.postcode, propertyAddress?.postcode ?? null, customer?.postcode ?? null),
    landlord_name: pickText(fields.landlord_name, customer?.landlord_name ?? null, customer?.name ?? null),
    landlord_company: pickText(fields.landlord_company, customer?.organization ?? null),
    landlord_address: pickText(fields.landlord_address, customer?.landlord_address ?? null, customer?.address ?? null),
  };
}
