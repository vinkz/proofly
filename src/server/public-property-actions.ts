'use server';

import { submitPropertyRenewalRequestInternal } from './public-property';

export async function submitPropertyRenewalRequest(
  input: Parameters<typeof submitPropertyRenewalRequestInternal>[0],
) {
  return submitPropertyRenewalRequestInternal(input);
}
