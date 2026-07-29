'use client';

import { useState } from 'react';

import { AddressAutocompleteField, composeAddressText } from '@/components/address/address-autocomplete-field';
import { Input } from '@/components/ui/input';
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
  // Address fields are controlled so the lookup can fill them; name attributes
  // keep them visible to the server action's FormData.
  const [address, setAddress] = useState(initialValues?.address ?? '');
  const [postcode, setPostcode] = useState(initialValues?.postcode ?? '');
  const [landlordAddress, setLandlordAddress] = useState(initialValues?.landlord_address ?? '');

  return (
    <form action={action} className="space-y-3">
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <Input required defaultValue={initialValues?.name ?? ''} name="name" placeholder="Client name" />
      <Input defaultValue={initialValues?.organization ?? ''} name="organization" placeholder="Organization" />
      <Input type="email" defaultValue={initialValues?.email ?? ''} name="email" placeholder="Email" />
      <Input defaultValue={initialValues?.phone ?? ''} name="phone" placeholder="Phone" />
      <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} name="postcode" placeholder="Postcode" />
      <AddressAutocompleteField
        variant="textarea"
        name="address"
        value={address}
        onValueChange={setAddress}
        onAddressSelect={(lookup) => setPostcode(lookup.postcode || '')}
        getSelectionText={(lookup) => composeAddressText(lookup.line1, lookup.line2, lookup.city)}
        placeholder="Address"
        inputClassName="min-h-[80px]"
      />
      <Input
        defaultValue={initialValues?.landlord_name ?? ''}
        name="landlord_name"
        placeholder="Landlord/Agent name"
      />
      <AddressAutocompleteField
        variant="textarea"
        name="landlord_address"
        value={landlordAddress}
        onValueChange={setLandlordAddress}
        getSelectionText={(lookup) => composeAddressText(lookup.line1, lookup.line2, lookup.city, lookup.postcode)}
        placeholder="Landlord/Agent address"
        inputClassName="min-h-[80px]"
      />
      <div className="flex justify-end">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
