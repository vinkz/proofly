import { NextResponse } from 'next/server';

import { createJob, saveGeneralWorksInfo, generateGeneralWorksPdf } from '@/server/certificates';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await createJob({ certificateType: 'general_works', title: 'General Works Test' });
  const today = new Date().toISOString().slice(0, 10);

  await saveGeneralWorksInfo({
    jobId,
    data: {
      property_address: '10 Demo Street, London',
      postcode: 'N1 1AA',
      work_date: today,
      customer_name: 'Demo Customer',
      engineer_name: 'Alex Engineer',
      company_name: 'certnow Services Ltd',
      work_summary: 'Fixed leak and serviced system',
      work_completed: 'Replaced faulty valve, bled radiators, checked pressure and safety devices.',
      parts_used: 'Valve kit, PTFE tape',
      defects_found: 'no',
      defects_details: '',
      recommendations: 'Monitor pressure for 48 hours; schedule annual service.',
      invoice_amount: '£180',
      payment_status: 'Pending',
      follow_up_required: 'yes',
      follow_up_date: today,
      engineer_signature: 'On file',
      customer_signature: 'On file',
    },
  });

  const { pdfUrl } = await generateGeneralWorksPdf({ jobId, previewOnly: true });

  return NextResponse.json({ jobId, pdfUrl });
}
