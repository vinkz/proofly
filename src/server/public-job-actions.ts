'use server';

import {
  capturePublicJobLandlordEmailInternal,
  submitPublicJobRenewalRequestInternal,
} from './public-job';

export async function capturePublicJobLandlordEmail(
  input: Parameters<typeof capturePublicJobLandlordEmailInternal>[0],
) {
  return capturePublicJobLandlordEmailInternal(input);
}

export async function submitPublicJobRenewalRequest(
  input: Parameters<typeof submitPublicJobRenewalRequestInternal>[0],
) {
  return submitPublicJobRenewalRequestInternal(input);
}
