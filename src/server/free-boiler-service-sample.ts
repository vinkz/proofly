import 'server-only';

import {
  FreeBoilerServiceSchema,
  freeBoilerServiceToRenderInput,
} from '@/lib/boiler-service/freeBoilerServicePayload';
import { renderGasServicePdf } from '@/server/pdf/renderGasServicePdf';
import { watermarkAsSample } from '@/server/sample-watermark';

/**
 * A filled-in example service record, so an engineer can see what they get
 * before typing anything.
 *
 * Rendered through the same mapping and renderer as a real record, so it cannot
 * drift from the template. Everything in it is obviously fictitious, and it is
 * watermarked.
 *
 * Filled in more fully than the issue gate requires — the Benchmark service
 * tasks and combustion readings are optional, but a sample showing only the
 * bare required spine would undersell what the tool actually produces.
 */
const SAMPLE = FreeBoilerServiceSchema.parse({
  service_date: '2026-07-14',
  job_address_line1: '14 Sample Street',
  job_address_city: 'Manchester',
  job_postcode: 'M1 2AB',

  customer_name: 'Example Property Co',
  customer_phone: '0161 496 0000',

  engineer_name: 'A. Example',
  gas_safe_number: '000000',
  engineer_id_card_number: 'ID-0000',
  company_name: 'Example Gas Services',
  company_phone: '0161 496 0001',

  boiler_make: 'Worcester Bosch',
  boiler_model: 'Greenstar 25i',
  boiler_type: 'combi',
  boiler_location: 'Kitchen',
  serial_number: '7731600000',
  gas_type: 'Natural gas',
  flue_type: 'Room sealed',

  appliance_flueing_safe: 'pass',
  appliance_ventilation_safe: 'pass',
  operating_pressure: '20 mbar',
  heat_input: '24 kW',
  appliance_safe: 'Yes',
  tightness_test: 'Pass',

  service_visual_inspection: 'Yes',
  service_burner_cleaned: 'Yes',
  service_heat_exchanger_cleaned: 'Yes',
  service_condensate_checked: 'Yes',
  service_seals_checked: 'Yes',
  service_controls_tested: 'Yes',

  high_co_ppm: '12',
  high_co2: '9.1',
  high_ratio: '0.0013',
  low_co_ppm: '4',
  low_co2: '4.2',
  low_ratio: '0.0009',

  defects_found: 'No',
  engineer_comments: 'Appliance serviced and left in safe working order.',
  next_service_date: '2027-07-14',
});

export async function renderSampleBoilerService(): Promise<Uint8Array> {
  const bytes = await renderGasServicePdf(
    freeBoilerServiceToRenderInput(SAMPLE, {
      recordId: 'SAMPLE',
      certNumber: 'SAMPLE',
      // Fixed date so the sample is byte-stable and cacheable.
      issuedAt: new Date('2026-07-14T09:00:00Z'),
    }),
  );
  return watermarkAsSample(bytes);
}
