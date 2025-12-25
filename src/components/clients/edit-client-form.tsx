import type { ClientListItem } from '@/types/client';
import { updateClient } from '@/server/clients';
import { ClientForm } from './client-form';

type EditClientFormValues = {
  name?: string | null;
  organization?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  postcode?: string | null;
  landlord_name?: string | null;
  landlord_address?: string | null;
};

type EditClientFormProps = {
  client: ClientListItem;
  initialValues?: EditClientFormValues;
};

export function EditClientForm({ client, initialValues }: EditClientFormProps) {
  const handleSubmit = async (formData: FormData) => {
    'use server';
    formData.append('id', client.id);
    await updateClient(formData);
  };

  const resolvedValues = {
    id: client.id,
    name: initialValues?.name ?? client.name,
    organization: initialValues?.organization ?? client.organization,
    email: initialValues?.email ?? client.email,
    phone: initialValues?.phone ?? client.phone,
    address: initialValues?.address ?? client.address,
    postcode: initialValues?.postcode ?? client.postcode,
    landlord_name: initialValues?.landlord_name ?? client.landlord_name,
    landlord_address: initialValues?.landlord_address ?? client.landlord_address,
  };

  return (
    <ClientForm
      action={handleSubmit}
      initialValues={resolvedValues}
      submitLabel="Save changes"
    />
  );
}
