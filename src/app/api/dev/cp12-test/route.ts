import { NextResponse } from 'next/server';

import { createJob, saveCp12JobInfo, saveCp12Appliances, updateField, generateCertificatePdf } from '@/server/certificates';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await createJob({ certificateType: 'cp12', title: 'CP12 Test' });

  await saveCp12JobInfo({
    jobId,
    data: {
      customer_name: 'Test Landlord',
      property_address: '12 High Street, London',
      postcode: 'E1 6AN',
      inspection_date: new Date().toISOString().slice(0, 10),
      engineer_name: 'Alex Engineer',
      gas_safe_number: '123456',
      company_name: 'CertNow Plumbing Ltd',
    },
  });

  await saveCp12Appliances({
    jobId,
    appliances: [
      {
        appliance_type: 'Boiler',
        location: 'Kitchen',
        make_model: 'Vaillant EcoTec',
        operating_pressure: '20 mbar',
        heat_input: '24 kW',
        flue_type: 'Balanced',
        ventilation_provision: 'Adequate',
        ventilation_satisfactory: 'PASS',
        flue_condition: 'PASS',
        stability_test: 'PASS',
        gas_tightness_test: 'PASS',
        co_reading_ppm: '2 ppm',
        safety_rating: 'Safe',
        classification_code: 'NCS',
      },
    ],
    defects: {
      defect_description: 'None',
      remedial_action: 'N/A',
      warning_notice_issued: 'NO',
    },
  });

  await updateField({ jobId, key: 'completion_date', value: new Date().toISOString().slice(0, 10) });

  const { pdfUrl } = await generateCertificatePdf({ jobId, certificateType: 'cp12' });

  return NextResponse.json({ jobId, pdfUrl });
}
