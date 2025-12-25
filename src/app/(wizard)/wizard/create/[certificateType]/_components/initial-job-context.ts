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
    customer_name: pickText(customer?.name ?? null, fields.customer_name),
    customer_address: pickText(customer?.address ?? null, fields.customer_address),
    customer_email: pickText(customer?.email ?? null, fields.customer_email),
    customer_phone: pickText(customer?.phone ?? null, fields.customer_phone),
    customer_contact: pickText(customer?.phone ?? null, customer?.email ?? null, fields.customer_contact),
    property_address: propertySummary,
    postcode: pickText(customer?.postcode ?? null, propertyAddress?.postcode ?? null, fields.postcode),
    landlord_name: pickText(customer?.landlord_name ?? null, fields.landlord_name),
    landlord_address: pickText(customer?.landlord_address ?? null, fields.landlord_address),
  };
}
