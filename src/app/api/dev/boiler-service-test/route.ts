import { NextResponse } from 'next/server';

import {
  createJob,
  saveBoilerServiceJobInfo,
  saveBoilerServiceDetails,
  saveBoilerServiceChecks,
  generateBoilerServicePdf,
} from '@/server/certificates';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { jobId } = await createJob({ certificateType: 'boiler_service', title: 'Boiler Service Test' });

  await saveBoilerServiceJobInfo({
    jobId,
    data: {
      customer_name: 'Test Customer',
      property_address: '15 Acacia Avenue, London',
      postcode: 'SW1A 1AA',
      service_date: today,
      engineer_name: 'Alex Engineer',
      gas_safe_number: '123456',
      company_name: 'certnow Heating Services Ltd',
      company_address: '12 Example Road, London',
    },
  });

  await saveBoilerServiceDetails({
    jobId,
    data: {
      boiler_make: 'Vaillant',
      boiler_model: 'ecoTEC Plus 832',
      boiler_type: 'combi',
      boiler_location: 'Kitchen cupboard',
      serial_number: 'VAI-832-123456',
      gas_type: 'natural gas',
      mount_type: 'wall',
      flue_type: 'room sealed',
    },
  });

  await saveBoilerServiceChecks({
    jobId,
    data: {
      service_visual_inspection: 'yes',
      service_burner_cleaned: 'yes',
      service_heat_exchanger_cleaned: 'yes',
      service_condensate_trap_checked: 'yes',
      service_seals_checked: 'yes',
      service_filters_cleaned: 'yes',
      service_flue_checked: 'yes',
      service_ventilation_checked: 'yes',
      service_controls_checked: 'yes',
      service_leaks_checked: 'yes',
      operating_pressure_mbar: '20',
      inlet_pressure_mbar: '20',
      co_ppm: '8',
      co2_percent: '8.5',
      flue_gas_temp_c: '68',
      system_pressure_bar: '1.2',
      service_summary: 'Serviced boiler, cleaned components, verified safety controls.',
      recommendations: 'Monitor pressure over the next week; consider magnetic filter at next visit.',
      defects_found: 'no',
      defects_details: '',
      parts_used: 'Condensate trap seal',
      next_service_due: `${new Date().getFullYear() + 1}-01-15`,
    },
  });

  const { pdfUrl } = await generateBoilerServicePdf({ jobId, previewOnly: true });

  return NextResponse.json({ jobId, pdfUrl });
}
