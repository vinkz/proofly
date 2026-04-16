// Customers: CP12 generation resolves customer data from jobs.client_id first, then job fields as fallback.
import { createHash, randomUUID } from 'node:crypto';

import { supabaseServerServiceRole } from '@/lib/supabaseServer';
import type { Database } from '@/lib/database.types';
import { renderCp12CertificatePdf, type ApplianceInput, type Cp12FieldMap } from '@/server/pdf/renderCp12Certificate';
import { getCustomerById } from '@/server/customer-service';

type JobRow = Database['public']['Tables']['jobs']['Row'];
type Cp12ApplianceRow = {
  appliance_type?: string | null;
  landlords_appliance?: string | null;
  appliance_inspected?: string | null;
  location?: string | null;
  make_model?: string | null;
  operating_pressure?: string | null;
  heat_input?: string | null;
  high_co_ppm?: string | null;
  high_co2?: string | null;
  high_ratio?: string | null;
  low_co_ppm?: string | null;
  low_co2?: string | null;
  low_ratio?: string | null;
  flue_type?: string | null;
  ventilation_provision?: string | null;
  ventilation_satisfactory?: string | null;
  flue_condition?: string | null;
  stability_test?: string | null;
  gas_tightness_test?: string | null;
  co_reading_ppm?: string | null;
  co_reading_high?: string | null;
  co_reading_low?: string | null;
  combustion_notes?: string | null;
  appliance_serviced?: string | null;
  safety_devices_correct?: string | null;
  flue_performance_test?: string | null;
  safety_rating?: string | null;
  classification_code?: string | null;
  safety_classification?: string | null;
  defect_notes?: string | null;
  actions_taken?: string | null;
  warning_notice_issued?: boolean | null;
};

type ProfileRow = Database['public']['Tables']['profiles']['Row'] & {
  company_name?: string | null;
  logo_url?: string | null;
  plan_tier?: string | null;
  gas_safe_number?: string | null;
  default_engineer_name?: string | null;
  default_engineer_id?: string | null;
  company_address_line1?: string | null;
  company_address_line2?: string | null;
  company_town?: string | null;
  company_postcode?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
};

export type GenerateCp12Result = {
  certificateId: string;
  pdfPath: string;
  pdfUrl: string | null;
  pdfByteLength?: number;
  pdfHash8?: string;
};

const CERTIFICATES_BUCKET = 'certificates';
const LOGO_BUCKET = 'profile-logos';
const JOB_FIELDS_TABLE = 'job_fields' as unknown as keyof Database['public']['Tables'];
const CP12_APPLIANCES_TABLE = 'cp12_appliances' as unknown as keyof Database['public']['Tables'];

function formatCp12SafetyClassification(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'safe') return 'Safe';
  if (normalized === 'ncs' || normalized === 'not to current standards') return 'Not to Current Standards';
  if (normalized === 'ar' || normalized === 'at risk' || normalized === 'at_risk') return 'At Risk';
  if (normalized === 'id' || normalized === 'immediately dangerous' || normalized === 'immediately_dangerous') {
    return 'Immediately Dangerous';
  }
  return '';
}

function buildCp12ApplianceUnsafePdfSummary(row: Cp12ApplianceRow) {
  const classification = formatCp12SafetyClassification(row.safety_classification || row.classification_code || row.safety_rating);
  if (!classification || classification === 'Safe') return '';

  const defectNotes = String(row.defect_notes ?? '').trim();
  const actionsTaken = String(row.actions_taken ?? '').trim();
  return [
    `Class: ${classification}`,
    defectNotes ? `Defect: ${defectNotes}` : '',
    `Warning notice: ${row.warning_notice_issued ? 'Yes' : 'No'}`,
    actionsTaken ? `Action: ${actionsTaken}` : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function formatCp12ApplianceSafeToUse(row: Pick<Cp12ApplianceRow, 'safety_classification' | 'classification_code' | 'safety_rating'>) {
  const normalized = String(row.safety_classification || row.classification_code || row.safety_rating || '')
    .trim()
    .toLowerCase();
  if (!normalized) return '';
  if (normalized === 'safe' || normalized === 'ncs' || normalized === 'not to current standards') return 'Yes';
  if (
    normalized === 'ar' ||
    normalized === 'at risk' ||
    normalized === 'at_risk' ||
    normalized === 'id' ||
    normalized === 'immediately dangerous' ||
    normalized === 'immediately_dangerous'
  ) {
    return 'No';
  }
  return '';
}

export async function generateCp12FromJob(jobId: string, currentUserId: string): Promise<GenerateCp12Result> {
  const supabase = await supabaseServerServiceRole();
  const debugPdf = process.env.CP12_PDF_DEBUG === '1';

  const { data: jobData, error: jobError } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (jobError || !jobData) {
    throw new Error(jobError?.message ?? 'Job not found');
  }
  const job = jobData as JobRow;
  if (job.user_id && job.user_id !== currentUserId) {
    throw new Error('Not authorised to generate certificate for this job');
  }

  const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', currentUserId).maybeSingle();
  if (profileError || !profileData) {
    throw new Error(profileError?.message ?? 'Profile not found');
  }
  const profile = profileData as ProfileRow;
  const customer = job.client_id
    ? await getCustomerById(job.client_id, {
        sb: supabase,
        userId: job.user_id ?? currentUserId,
        requireOwner: false,
      })
    : null;

  const { data: fieldsData, error: fieldsError } = await supabase
    .from(JOB_FIELDS_TABLE)
    .select('field_key, value')
    .eq('job_id', jobId);
  if (fieldsError) {
    throw new Error(`Failed to load job fields: ${fieldsError.message}`);
  }
  const fieldRows = (fieldsData ?? []) as unknown as Array<{ field_key: string; value: string | null }>;
  const fieldMap = Object.fromEntries(fieldRows.map((item) => [item.field_key, item.value ?? null])) as Record<
    string,
    unknown
  >;

  const { data: applianceRows, error: appliancesError } = await supabase
    .from(CP12_APPLIANCES_TABLE)
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  if (appliancesError && appliancesError.code !== '42P01') {
    throw new Error(`Failed to load cp12 appliances: ${appliancesError.message}`);
  }

  const toText = (val: unknown) => (val === undefined || val === null ? '' : String(val));
  const splitAddressParts = (value: unknown) =>
    String(value ?? '')
      .split(/[\r\n,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  const extractPostcode = (value: unknown) => {
    const match = String(value ?? '').toUpperCase().match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/);
    return match ? match[0].replace(/\s+/g, ' ').trim() : '';
  };
  const buildCombustionSummary = (coPpm: string, co2: string, ratio: string, legacy?: string) => {
    const parts = [coPpm && `${coPpm}ppm`, co2 && `${co2}%`, ratio && ratio].filter(Boolean);
    if (parts.length) return parts.join(' / ');
    return legacy ?? '';
  };
  const fallbackJobAddressParts = splitAddressParts(fieldMap.property_address ?? fieldMap.address ?? job.address ?? '');
  const jobAddressLine1 = toText(fieldMap.job_address_line1 ?? fallbackJobAddressParts[0] ?? '');
  const jobAddressLine2 = toText(fieldMap.job_address_line2 ?? fallbackJobAddressParts[1] ?? '');
  const jobAddressTown = toText(
    fieldMap.job_address_city ?? (fallbackJobAddressParts.length > 2 ? fallbackJobAddressParts.slice(2).join('\n') : ''),
  );
  const jobAddressPostcode = toText(fieldMap.job_postcode ?? fieldMap.property_postcode ?? fieldMap.postcode ?? '');
  const jobAddressName = toText(fieldMap.job_address_name ?? fieldMap.property_name ?? '');
  const jobAddressTel = toText(fieldMap.job_tel ?? '');
  const fallbackLandlordParts = splitAddressParts(fieldMap.landlord_address ?? customer?.address ?? '');
  const landlordLine1 = toText(fieldMap.landlord_address_line1 ?? fallbackLandlordParts[0] ?? '');
  const landlordLine2 = toText(
    fieldMap.landlord_address_line2 ?? (fallbackLandlordParts.length > 2 ? fallbackLandlordParts.slice(1, -1).join('\n') : ''),
  );
  const landlordCity = toText(
    fieldMap.landlord_city ?? fieldMap.landlord_town ?? (fallbackLandlordParts.length > 1 ? fallbackLandlordParts.at(-1) ?? '' : ''),
  );
  const landlordPostcode = toText(fieldMap.landlord_postcode ?? extractPostcode(fieldMap.landlord_address ?? ''));
  const landlordTel = toText(fieldMap.landlord_tel ?? '');
  const cp12SafetyReadback = {
    emergency_control_accessible: toText(fieldMap.emergency_control_accessible ?? ''),
    gas_tightness_satisfactory: toText(fieldMap.gas_tightness_satisfactory ?? ''),
    pipework_visual_satisfactory: toText(fieldMap.pipework_visual_satisfactory ?? ''),
    equipotential_bonding_satisfactory: toText(fieldMap.equipotential_bonding_satisfactory ?? ''),
  };
  console.log('CP12 action readback safety fields', { jobId, cp12SafetyReadback });

  const applianceInputs: ApplianceInput[] = (applianceRows ?? []).map((app) => {
    const row = app as Cp12ApplianceRow;
    const highCoPpm = toText(row.high_co_ppm ?? row.co_reading_high ?? '');
    const highCo2 = toText(row.high_co2 ?? '');
    const highRatio = toText(row.high_ratio ?? '');
    const lowCoPpm = toText(row.low_co_ppm ?? row.co_reading_low ?? '');
    const lowCo2 = toText(row.low_co2 ?? '');
    const lowRatio = toText(row.low_ratio ?? '');
    const applianceSafe = formatCp12ApplianceSafeToUse(row);
    return {
      description: toText(row.make_model ?? row.appliance_type ?? ''),
      landlordAppliance: toText(row.landlords_appliance ?? ''),
      applianceInspected: toText(row.appliance_inspected ?? ''),
      location: toText(row.location ?? ''),
      type: toText(row.appliance_type ?? ''),
      flueType: toText(row.flue_type ?? row.ventilation_provision ?? ''),
      operatingPressure: toText(row.operating_pressure ?? ''),
      heatInput: toText(row.heat_input ?? ''),
      safetyDevice: toText(row.safety_devices_correct ?? row.stability_test ?? ''),
      ventilationSatisfactory: toText(row.ventilation_satisfactory ?? row.ventilation_provision ?? ''),
      flueTerminationSatisfactory: toText(row.flue_condition ?? ''),
      spillageTest: toText(row.gas_tightness_test ?? ''),
      applianceSafeToUse: applianceSafe,
      remedialActionTaken: buildCp12ApplianceUnsafePdfSummary(row),
      combustionHighCoPpm: highCoPpm,
      combustionHighCo2: highCo2,
      combustionHighRatio: highRatio,
      combustionLowCoPpm: lowCoPpm,
      combustionLowCo2: lowCo2,
      combustionLowRatio: lowRatio,
      combustionHigh: buildCombustionSummary(highCoPpm, highCo2, highRatio, toText(row.co_reading_ppm ?? '')),
      combustionLow: buildCombustionSummary(lowCoPpm, lowCo2, lowRatio, toText(row.co_reading_low ?? '')),
      combustionNotes: toText(row.combustion_notes ?? ''),
      applianceServiced: toText((row as Record<string, unknown>).appliance_serviced ?? ''),
    };
  });

  const issuedAtIso = job.completed_at ?? job.scheduled_for ?? new Date().toISOString();
  const issuedAtDate = new Date(issuedAtIso);

  const cp12Fields: Cp12FieldMap = {
    certNumber: toText(fieldMap.record_id ?? fieldMap.certificate_number ?? job.id ?? ''),
    issueDate: toText(fieldMap.inspection_date ?? fieldMap.scheduled_for ?? issuedAtIso),
    nextInspectionDue: toText(fieldMap.next_inspection_due ?? fieldMap.completion_date ?? ''),
    landlordName: toText(fieldMap.landlord_name ?? fieldMap.customer_name ?? customer?.name ?? job.client_name ?? ''),
    landlordCompany: toText(fieldMap.landlord_company ?? customer?.organization ?? ''),
    landlordAddressLine1: landlordLine1,
    landlordAddressLine2: landlordLine2,
    landlordTown: landlordCity,
    landlordPostcode: landlordPostcode,
    landlordTel: landlordTel,
    propertyAddressName: jobAddressName,
    propertyAddressLine1: jobAddressLine1,
    propertyAddressLine2: jobAddressLine2,
    propertyTown: jobAddressTown,
    propertyPostcode: jobAddressPostcode,
    propertyTel: jobAddressTel,
    companyName: toText(fieldMap.company_name ?? profile.company_name ?? ''),
    companyAddressLine1: toText(fieldMap.company_address ?? profile.company_address_line1 ?? ''),
    companyAddressLine2: toText(profile.company_address_line2 ?? ''),
    companyTown: toText(profile.company_town ?? ''),
    companyPostcode: toText(profile.company_postcode ?? ''),
    companyPhone: toText(fieldMap.company_phone ?? profile.company_phone ?? ''),
    companyEmail: toText(fieldMap.company_email ?? profile.company_email ?? ''),
    gasSafeRegistrationNumber: toText(fieldMap.gas_safe_number ?? profile.gas_safe_number ?? ''),
    engineerName: toText(fieldMap.engineer_name ?? job.technician_name ?? profile.default_engineer_name ?? profile.full_name ?? ''),
    engineerIdNumber: toText(fieldMap.engineer_id ?? fieldMap.engineer_id_number ?? profile.default_engineer_id ?? ''),
    engineerSignatureText: toText(
      fieldMap.engineer_signature_text ??
        fieldMap.engineer_name ??
        job.technician_name ??
        profile.default_engineer_name ??
        profile.full_name ??
        '',
    ),
    engineerSignatureUrl: toText(fieldMap.engineer_signature ?? ''),
    engineerVisitTime: toText(fieldMap.completion_date ?? fieldMap.inspection_time ?? ''),
    responsiblePersonName: toText(fieldMap.customer_name ?? customer?.name ?? job.client_name ?? ''),
    responsiblePersonSignatureText: toText(
      fieldMap.customer_signature_text ?? fieldMap.customer_name ?? customer?.name ?? job.client_name ?? '',
    ),
    responsiblePersonSignatureUrl: toText(fieldMap.customer_signature ?? ''),
    responsiblePersonAcknowledgementDate: toText(fieldMap.completion_date ?? issuedAtIso),
    defectsIdentified: toText(fieldMap.defect_description ?? fieldMap.defects_identified ?? job.notes ?? ''),
    remedialWorksRequired: toText(fieldMap.remedial_action ?? fieldMap.remedial_works_required ?? ''),
    warningNoticeIssued: toText(fieldMap.warning_notice_issued ?? ''),
    additionalNotes: toText(fieldMap.comments ?? fieldMap.additional_notes ?? ''),
    coAlarmFitted: toText(fieldMap.co_alarm_fitted ?? ''),
    coAlarmTested: toText(fieldMap.co_alarm_tested ?? ''),
    coAlarmSatisfactory: toText(fieldMap.co_alarm_satisfactory ?? ''),
    emergencyControlAccessible: toText(fieldMap.emergency_control_accessible ?? fieldMap.emergency_control ?? ''),
    gasTightnessSatisfactory: toText(fieldMap.gas_tightness_satisfactory ?? ''),
    pipeworkVisualSatisfactory: toText(fieldMap.pipework_visual_satisfactory ?? ''),
    equipotentialBondingSatisfactory: toText(fieldMap.equipotential_bonding_satisfactory ?? ''),
  };
  console.log('CP12 action mapped safety fields', {
    jobId,
    mapped: {
      emergencyControlAccessible: cp12Fields.emergencyControlAccessible ?? '',
      gasTightnessSatisfactory: cp12Fields.gasTightnessSatisfactory ?? '',
      pipeworkVisualSatisfactory: cp12Fields.pipeworkVisualSatisfactory ?? '',
      equipotentialBondingSatisfactory: cp12Fields.equipotentialBondingSatisfactory ?? '',
    },
  });

  let companyLogoBytes: Uint8Array | undefined;
  const planTier = (profile.plan_tier ?? '').toLowerCase();
  if (planTier && planTier !== 'free' && profile.logo_url) {
    try {
      const { data: logoFile, error: logoError } = await supabase.storage.from(LOGO_BUCKET).download(profile.logo_url);
      if (!logoError && logoFile) {
        const arrayBuffer = await logoFile.arrayBuffer();
        companyLogoBytes = new Uint8Array(arrayBuffer);
      }
    } catch (err) {
      console.warn('Failed to load custom logo, using default CertNow logo', err);
    }
  }

  const pdfBytes = await renderCp12CertificatePdf({
    fields: cp12Fields,
    appliances: applianceInputs,
    recordId: job.id,
    issuedAt: issuedAtDate,
    companyLogoBytes,
  });
  const pdfByteLength = pdfBytes.byteLength;
  const pdfHash8 = createHash('sha256').update(pdfBytes).digest('hex').slice(0, 8);

  const certificateId = randomUUID();
  const pdfPath = debugPdf
    ? `cp12/${jobId}/${certificateId}-debug-${Date.now()}.pdf`
    : `cp12/${jobId}/${certificateId}.pdf`;
  const lastSlash = pdfPath.lastIndexOf('/');
  const parentDir = lastSlash > 0 ? pdfPath.slice(0, lastSlash) : '';
  const fileName = lastSlash >= 0 ? pdfPath.slice(lastSlash + 1) : pdfPath;
  const { data: existingFiles, error: listErr } = await supabase.storage.from(CERTIFICATES_BUCKET).list(parentDir, {
    search: fileName,
  });
  if (listErr) {
    console.warn('CP12 action: pre-upload list failed', { jobId, certificateId, pdfPath, error: listErr.message });
  }
  const existedBeforeUpload = Boolean(existingFiles?.some((entry) => entry.name === fileName));
  console.log('CP12 action: upload start', {
    jobId,
    certificateId,
    pdfPath,
    debugPdf,
    existedBeforeUpload,
    pdfByteLength,
    pdfHash8,
  });

  const { error: uploadError } = await supabase.storage.from(CERTIFICATES_BUCKET).upload(pdfPath, Buffer.from(pdfBytes), {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (uploadError) {
    throw new Error(`Failed to upload CP12 PDF: ${uploadError.message}`);
  }
  console.log('CP12 action: upload done', {
    jobId,
    certificateId,
    pdfPath,
    debugPdf,
    existedBeforeUpload,
    upsert: true,
    uploadedPdfByteLength: pdfByteLength,
    uploadedPdfHash8: pdfHash8,
  });

  const { data: publicUrlData } = supabase.storage.from(CERTIFICATES_BUCKET).getPublicUrl(pdfPath);
  const pdfUrl = publicUrlData?.publicUrl ?? null;

  const certificatePayload = {
    id: certificateId,
    job_id: jobId,
    user_id: currentUserId,
    cert_type: 'cp12_gas_safety',
    fields: cp12Fields,
    appliances: applianceInputs,
    issued_at: issuedAtDate.toISOString(),
    template_version: 'cp12-template-v1',
    status: 'final',
    pdf_path: pdfPath,
    pdf_url: pdfUrl,
  };

  const { error: insertError } = await supabase.from('certificates').insert(certificatePayload as never);
  if (insertError) {
    throw new Error(`Failed to insert certificate row: ${insertError.message}`);
  }

  console.log('CP12 action: return payload', {
    jobId,
    certificateId,
    pdfPath,
    pdfUrl,
    returnedPdfByteLength: pdfByteLength,
    returnedPdfHash8: pdfHash8,
  });

  return {
    certificateId,
    pdfPath,
    pdfUrl,
    pdfByteLength,
    pdfHash8,
  };
}
