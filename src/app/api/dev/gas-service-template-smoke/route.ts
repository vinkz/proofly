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
  const serviceDate =
    typeof BOILER_SERVICE_DEMO_INFO.service_date === 'function' ? BOILER_SERVICE_DEMO_INFO.service_date() : BOILER_SERVICE_DEMO_INFO.service_date;

  await saveBoilerServiceJobInfo({
    jobId,
    data: {
      ...BOILER_SERVICE_DEMO_INFO,
      service_date: serviceDate ?? today,
    } as any,
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
