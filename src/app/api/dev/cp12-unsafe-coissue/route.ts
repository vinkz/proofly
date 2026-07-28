import { NextResponse } from 'next/server';

import { isAdminEmail } from '@/server/mission-control';
import { getSupabaseUser, supabaseServerReadOnly, supabaseServerServiceRole } from '@/lib/supabaseServer';
import { checkCertificateAllowanceForUser } from '@/server/billing-internal';
import { giuspFieldKey } from '@/lib/cp12/giusp';
import {
  createJob,
  generateCertificatePdf,
  saveCp12Appliances,
  saveCp12JobInfo,
  saveJobFields,
  updateField,
} from '@/server/certificates';

/**
 * One-click check of the co-issue path: a CP12 with an Immediately Dangerous
 * appliance should produce the certificate AND its Gas Warning Notice, and
 * should consume exactly one certificate from the monthly allowance.
 *
 * That path writes two certificates in one action and cannot be exercised
 * without a real session and a real database, so it exists to be run once by
 * hand rather than left untested until a customer finds it.
 *
 * Admin-only and never in production: it issues real certificates against real
 * data, which is not something any signed-in user should be able to trigger.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const supabase = await supabaseServerReadOnly();
  const user = await getSupabaseUser(supabase);
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const steps: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  try {
    const before = await checkCertificateAllowanceForUser(user.id);
    steps.push(`allowance before: used ${before.used} of ${before.limit ?? 'unlimited'}`);

    const { jobId } = await createJob({ certificateType: 'cp12', title: 'Co-issue smoke test' });
    steps.push(`job ${jobId}`);

    await saveCp12JobInfo({
      jobId,
      data: {
        customer_name: 'Smoke Test Landlord',
        customer_phone: '',
        property_address: '1 Smoke Test Road, London',
        postcode: 'E1 6AN',
        inspection_date: today,
        landlord_name: 'Smoke Test Landlord',
        landlord_company: '',
        landlord_address_line1: '1 Smoke Test Road',
        landlord_address_line2: '',
        landlord_city: 'London',
        landlord_postcode: 'E1 6AN',
        landlord_tel: '',
        landlord_address: '1 Smoke Test Road, London, E1 6AN',
        engineer_name: 'Smoke Tester',
        gas_safe_number: '123456',
        reg_26_9_confirmed: true,
        company_name: 'Smoke Test Gas',
        company_address: '',
        company_postcode: '',
        company_phone: '',
        engineer_phone: '',
        job_tel: '',
      },
    });

    // Immediately Dangerous, so a warning notice is required.
    await saveCp12Appliances({
      jobId,
      appliances: [
        {
          appliance_type: 'boiler',
          appliance_subtype: 'combi',
          cooker_stability: '',
          landlords_appliance: 'Yes',
          appliance_inspected: 'Yes',
          location: 'Kitchen',
          make_model: 'Vaillant EcoTec',
          operating_pressure: '20 mbar',
          heat_input: '24 kW',
          high_co_ppm: '',
          high_co2: '',
          high_ratio: '',
          low_co_ppm: '',
          low_co2: '',
          low_ratio: '',
          co_reading_high: '',
          co_reading_low: '',
          flue_type: 'Room sealed',
          flue_location: 'Kitchen',
          ventilation_provision: '',
          ventilation_satisfactory: 'pass',
          flue_condition: 'fail',
          stability_test: '',
          gas_tightness_test: 'pass',
          co_reading_ppm: '',
          safety_devices_correct: 'pass',
          flue_performance_test: 'fail',
          appliance_serviced: 'Yes',
          combustion_notes: '',
          safety_rating: '',
          classification_code: 'ID',
          safety_classification: 'id',
          defect_notes: 'Cracked heat exchanger, products of combustion spilling',
          actions_taken: 'Gas supply isolated / capped, Danger Do Not Use label attached',
          actions_required: 'Replace appliance',
          warning_notice_issued: true,
          appliance_disconnected: true,
          danger_do_not_use_attached: true,
          reg_26_9_confirmed: true,
        },
      ],
      defects: {
        defect_description: 'Cracked heat exchanger',
        remedial_action: 'Isolated, capped and labelled',
        warning_notice_issued: 'Yes',
      },
    });

    // The GIUSP answers the wizard now collects, under the shared namespace.
    const giusp: Record<string, string> = {};
    const answers = {
      customer_present: 'Yes',
      customer_informed: 'Yes',
      gas_supply_isolated: 'Yes',
      appliance_capped_off: 'Yes',
      danger_label_fitted: 'Yes',
      emergency_services_contacted: 'No',
      riddor_reported: 'Yes',
      riddor_reference: 'SMOKE-TEST',
    } as const;
    for (const [key, value] of Object.entries(answers)) {
      giusp[giuspFieldKey('appliance_1', key as never)] = value;
    }
    await saveJobFields({ jobId, fields: giusp });
    await updateField({ jobId, key: 'defect_description', value: 'Cracked heat exchanger' });
    await updateField({ jobId, key: 'remedial_action', value: 'Isolated, capped and labelled' });
    await updateField({ jobId, key: 'engineer_signature', value: 'data:image/png;base64,iVBORw0KGgo=' });
    await updateField({ jobId, key: 'completion_date', value: today });
    steps.push('job seeded with an Immediately Dangerous appliance and its GIUSP answers');

    const issued = await generateCertificatePdf({ jobId, certificateType: 'cp12', previewOnly: false });
    steps.push('cp12 issued');

    const notices = (
      'gasWarningNoticeJobs' in issued ? issued.gasWarningNoticeJobs : []
    ) as Array<{ jobId: string; applianceKey: string; issued: boolean; error?: string }>;
    const after = await checkCertificateAllowanceForUser(user.id);

    const admin = await supabaseServerServiceRole();
    const { data: certRows } = await admin
      .from('certificates')
      .select('job_id, cert_type, created_at')
      .in('job_id', [jobId, ...notices.map((n) => n.jobId).filter(Boolean)]);

    const consumed = (after.used ?? 0) - (before.used ?? 0);

    return NextResponse.json({
      ok:
        notices.length === 1 &&
        notices[0]?.issued === true &&
        consumed === 1 &&
        (certRows ?? []).length === 2,
      expected: {
        notices: '1, issued',
        allowanceConsumed: '1 (the notice is attached, so it is free)',
        certificateRows: '2 (cp12 + gas_warning_notice)',
      },
      actual: {
        notices,
        allowanceConsumed: consumed,
        allowance: { before: before.used, after: after.used, limit: after.limit },
        certificateRows: certRows ?? [],
      },
      jobId,
      steps,
      cleanup: `Delete job ${jobId} and any linked notice job when you are done.`,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error', steps },
      { status: 500 },
    );
  }
}
