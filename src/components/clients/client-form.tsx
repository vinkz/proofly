import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type ClientFormProps = {
  action: (formData: FormData) => Promise<void>;
  initialValues?: {
    name?: string | null;
    organization?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    postcode?: string | null;
    landlord_name?: string | null;
    landlord_address?: string | null;
    id?: string;
  };
  submitLabel?: string;
};

export function ClientForm({ action, initialValues, submitLabel = 'Save' }: ClientFormProps) {
  return (
    <form action={action} className="space-y-3">
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <Input required defaultValue={initialValues?.name ?? ''} name="name" placeholder="Client name" />
      <Input defaultValue={initialValues?.organization ?? ''} name="organization" placeholder="Organization" />
      <Input type="email" defaultValue={initialValues?.email ?? ''} name="email" placeholder="Email" />
      <Input defaultValue={initialValues?.phone ?? ''} name="phone" placeholder="Phone" />
      <Input defaultValue={initialValues?.postcode ?? ''} name="postcode" placeholder="Postcode" />
      <Textarea
        defaultValue={initialValues?.address ?? ''}
        name="address"
        placeholder="Address"
        className="min-h-[80px]"
      />
      <Input
        defaultValue={initialValues?.landlord_name ?? ''}
        name="landlord_name"
        placeholder="Landlord/Agent name"
      />
      <Textarea
        defaultValue={initialValues?.landlord_address ?? ''}
        name="landlord_address"
        placeholder="Landlord/Agent address"
        className="min-h-[80px]"
      />
      <div className="flex justify-end">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
