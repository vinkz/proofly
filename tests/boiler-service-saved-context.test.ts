import { describe, expect, it } from 'vitest';

import {
  arrivedWithBoilerServiceContext,
  savedClientJobInfoPatch,
  savedPropertyJobAddressPatch,
  savedPropertyJobInfoPatch,
  type BoilerServiceSavedClient,
  type BoilerServiceSavedProperty,
} from '@/lib/boiler-service/saved-context';

const property: BoilerServiceSavedProperty = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Flat 4',
  addressLine1: '20 Station Road',
  addressLine2: 'Rear entrance',
  town: 'Leeds',
  postcode: 'LS1 1AA',
  phone: '0113 000 0000',
  nextServiceDue: '2027-08-09',
  status: 'current',
};

const client: BoilerServiceSavedClient = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Alex Morgan',
  organization: 'Morgan Homes',
  phone: '07700 900123',
  address: '1 Home Street, Leeds',
  postcode: 'LS2 2BB',
  landlord_name: 'Alex Morgan',
  landlord_address: '8 Office Park, Suite 2, Leeds',
  properties: [property],
};

describe('boiler-service saved client and property prefill', () => {
  it('offers saved context only when the job arrived without client or property details', () => {
    expect(arrivedWithBoilerServiceContext({})).toBe(false);
    expect(arrivedWithBoilerServiceContext({ customer_name: 'Already entered' })).toBe(true);
    expect(arrivedWithBoilerServiceContext({ property_address: '20 Station Road' })).toBe(true);
    expect(arrivedWithBoilerServiceContext({ job_address_line1: '20 Station Road' })).toBe(true);
  });

  it('fills the client block from the saved landlord without using the job property as their address', () => {
    expect(savedClientJobInfoPatch(client)).toEqual({
      customer_name: 'Alex Morgan',
      customer_company: 'Morgan Homes',
      customer_address_line1: '8 Office Park',
      customer_address_line2: 'Suite 2',
      customer_city: 'Leeds',
      customer_postcode: 'LS2 2BB',
      customer_phone: '07700 900123',
    });
  });

  it('fills the service location from the selected property', () => {
    expect(savedPropertyJobInfoPatch(property)).toEqual({
      property_address: '20 Station Road, Rear entrance, Leeds',
      postcode: 'LS1 1AA',
    });
    expect(savedPropertyJobAddressPatch(property)).toEqual({
      job_address_name: 'Flat 4',
      job_address_line1: '20 Station Road',
      job_address_line2: 'Rear entrance',
      job_address_city: 'Leeds',
      job_postcode: 'LS1 1AA',
      job_tel: '0113 000 0000',
    });
  });
});
