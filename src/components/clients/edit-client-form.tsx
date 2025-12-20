import type { ClientListItem } from '@/types/client';
import { updateClient } from '@/server/clients';
import { ClientForm } from './client-form';

type EditClientFormProps = {
  client: ClientListItem;
};

export function EditClientForm({ client }: EditClientFormProps) {
  const handleSubmit = async (formData: FormData) => {
    'use server';
    formData.append('id', client.id);
    await updateClient(formData);
  };

  return (
    <ClientForm
      action={handleSubmit}
      initialValues={{
        id: client.id,
        name: client.name,
        organization: client.organization,
        email: client.email,
        phone: client.phone,
        address: client.address,
      }}
      submitLabel="Save changes"
    />
  );
}
