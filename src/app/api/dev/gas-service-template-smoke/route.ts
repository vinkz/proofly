import { NextResponse } from 'next/server';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { BOILER_SERVICE_DEMO_CHECKS, BOILER_SERVICE_DEMO_DETAILS, BOILER_SERVICE_DEMO_INFO } from '@/types/boiler-service';
import { createJob, generateCertificatePdf, saveBoilerServiceChecks, saveBoilerServiceDetails, saveBoilerServiceJobInfo } from '@/server/certificates';

export async function GET() {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await createJob({ certificateType: 'gas_service', title: 'Gas Service Template Smoke' });
  const today = new Date().toISOString().slice(0, 10);
  const serviceDate = BOILER_SERVICE_DEMO_INFO.service_date ?? today;

  await saveBoilerServiceJobInfo({
    jobId,
    data: {
      customer_name: BOILER_SERVICE_DEMO_INFO.customer_name,
      customer_company: BOILER_SERVICE_DEMO_INFO.customer_company,
      customer_address_line1: BOILER_SERVICE_DEMO_INFO.customer_address_line1,
      customer_address_line2: BOILER_SERVICE_DEMO_INFO.customer_address_line2,
      customer_city: BOILER_SERVICE_DEMO_INFO.customer_city,
      customer_postcode: BOILER_SERVICE_DEMO_INFO.customer_postcode,
      customer_phone: BOILER_SERVICE_DEMO_INFO.customer_phone,
      property_address: BOILER_SERVICE_DEMO_INFO.property_address,
      postcode: BOILER_SERVICE_DEMO_INFO.postcode,
      service_date: serviceDate ?? today,
      engineer_name: BOILER_SERVICE_DEMO_INFO.engineer_name,
      gas_safe_number: BOILER_SERVICE_DEMO_INFO.gas_safe_number,
      company_name: BOILER_SERVICE_DEMO_INFO.company_name,
      company_address: BOILER_SERVICE_DEMO_INFO.company_address,
    },
  });

  await saveBoilerServiceDetails({
    jobId,
    data: {
      ...BOILER_SERVICE_DEMO_DETAILS,
    },
  });

  await saveBoilerServiceChecks({
    jobId,
    data: {
      ...BOILER_SERVICE_DEMO_CHECKS,
    },
  });

  const { pdfUrl } = await generateCertificatePdf({ jobId, certificateType: 'gas_service', previewOnly: true });

  return NextResponse.json({ jobId, pdfUrl });
}
