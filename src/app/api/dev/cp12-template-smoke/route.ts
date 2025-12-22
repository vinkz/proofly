import { NextResponse } from 'next/server';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { CP12_DEMO_APPLIANCE, CP12_DEMO_INFO } from '@/types/cp12';
import { createJob, generateCertificatePdf, saveCp12Appliances, saveCp12JobInfo, updateField } from '@/server/certificates';

export async function GET() {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await createJob({ certificateType: 'cp12', title: 'CP12 Template Smoke' });
  const today = new Date().toISOString().slice(0, 10);
  const demoInspectionDate =
    typeof CP12_DEMO_INFO.inspection_date === 'function' ? CP12_DEMO_INFO.inspection_date() : CP12_DEMO_INFO.inspection_date;

  await saveCp12JobInfo({
    jobId,
    data: {
      customer_name: CP12_DEMO_INFO.customer_name,
      property_address: CP12_DEMO_INFO.property_address,
      postcode: CP12_DEMO_INFO.postcode,
      inspection_date: demoInspectionDate ?? today,
      engineer_name: CP12_DEMO_INFO.engineer_name,
      gas_safe_number: CP12_DEMO_INFO.gas_safe_number,
      company_name: CP12_DEMO_INFO.company_name,
      landlord_name: CP12_DEMO_INFO.landlord_name,
      landlord_address: CP12_DEMO_INFO.landlord_address,
      reg_26_9_confirmed: true,
    },
  });

  await saveCp12Appliances({
    jobId,
    appliances: [
      {
        ...CP12_DEMO_APPLIANCE,
        appliance_type: CP12_DEMO_APPLIANCE.appliance_type ?? 'boiler',
        location: CP12_DEMO_APPLIANCE.location ?? 'kitchen',
        safety_rating: CP12_DEMO_APPLIANCE.safety_rating ?? 'safe',
      },
    ],
    defects: {
      defect_description: '',
      remedial_action: '',
      warning_notice_issued: 'NO',
    },
  });

  await updateField({ jobId, key: 'completion_date', value: today });

  const { pdfUrl } = await generateCertificatePdf({ jobId, certificateType: 'cp12', previewOnly: true });

  return NextResponse.json({ jobId, pdfUrl });
}
