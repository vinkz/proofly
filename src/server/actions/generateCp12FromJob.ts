import { randomUUID } from 'node:crypto';

import { supabaseServerServiceRole } from '@/lib/supabaseServer';
import type { Database } from '@/lib/database.types';
import { renderCp12CertificatePdf, type ApplianceInput, type Cp12FieldMap } from '@/server/pdf/renderCp12Certificate';

type JobRow = Database['public']['Tables']['jobs']['Row'] & {
  certificate_type?: string | null;
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
};

const CERTIFICATES_BUCKET = 'certificates';
const LOGO_BUCKET = 'profile-logos';

export async function generateCp12FromJob(jobId: string, currentUserId: string): Promise<GenerateCp12Result> {
  const supabase = await supabaseServerServiceRole();

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

  const { data: fieldsData, error: fieldsError } = await supabase
    .from('job_fields')
    .select('field_key, value')
    .eq('job_id', jobId);
  if (fieldsError) {
    throw new Error(`Failed to load job fields: ${fieldsError.message}`);
  }
  const fieldMap = Object.fromEntries((fieldsData ?? []).map((item) => [item.field_key, item.value ?? null])) as Record<
    string,
    unknown
  >;

  const { data: applianceRows, error: appliancesError } = await supabase
    .from('cp12_appliances')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  if (appliancesError && appliancesError.code !== '42P01') {
    throw new Error(`Failed to load cp12 appliances: ${appliancesError.message}`);
  }

  const toText = (val: unknown) => (val === undefined || val === null ? '' : String(val));

  const applianceInputs: ApplianceInput[] = (applianceRows ?? []).map((app) => ({
    description: toText((app as any).make_model ?? (app as any).appliance_make_model ?? (app as any).appliance_type ?? ''),
    location: toText((app as any).location ?? ''),
    type: toText((app as any).appliance_type ?? ''),
    flueType: toText((app as any).flue_type ?? (app as any).ventilation_provision ?? ''),
    operatingPressure: toText((app as any).operating_pressure ?? ''),
    heatInput: toText((app as any).heat_input ?? ''),
    safetyDevice: toText((app as any).stability_test ?? ''),
    ventilationSatisfactory: toText((app as any).ventilation_satisfactory ?? (app as any).ventilation_provision ?? ''),
    flueTerminationSatisfactory: toText((app as any).flue_condition ?? ''),
    spillageTest: toText((app as any).gas_tightness_test ?? ''),
    applianceSafeToUse: toText((app as any).safety_rating ?? (app as any).classification_code ?? ''),
    remedialActionTaken: toText((app as any).classification_code ?? ''),
  }));

  const issuedAtIso = job.completed_at ?? job.scheduled_for ?? new Date().toISOString();
  const issuedAtDate = new Date(issuedAtIso);

  const cp12Fields: Cp12FieldMap = {
    certNumber: toText(fieldMap.record_id ?? fieldMap.certificate_number ?? job.id ?? ''),
    issueDate: toText(fieldMap.inspection_date ?? fieldMap.scheduled_for ?? issuedAtIso),
    nextInspectionDue: toText(fieldMap.next_inspection_due ?? fieldMap.completion_date ?? ''),
    landlordName: toText(fieldMap.landlord_name ?? fieldMap.customer_name ?? job.client_name ?? ''),
    landlordAddressLine1: toText(fieldMap.landlord_address ?? ''),
    landlordAddressLine2: toText(fieldMap.landlord_address_line2 ?? ''),
    landlordTown: toText(fieldMap.landlord_town ?? ''),
    landlordPostcode: toText(fieldMap.landlord_postcode ?? fieldMap.postcode ?? ''),
    propertyAddressLine1: toText(fieldMap.property_address ?? fieldMap.address ?? job.address ?? ''),
    propertyAddressLine2: toText(fieldMap.property_address_line2 ?? ''),
    propertyTown: toText(fieldMap.property_town ?? ''),
    propertyPostcode: toText(fieldMap.property_postcode ?? fieldMap.postcode ?? ''),
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
    engineerVisitTime: toText(fieldMap.completion_date ?? fieldMap.inspection_time ?? ''),
    responsiblePersonName: toText(fieldMap.customer_name ?? job.client_name ?? ''),
    responsiblePersonSignatureText: toText(fieldMap.customer_signature_text ?? fieldMap.customer_name ?? job.client_name ?? ''),
    responsiblePersonAcknowledgementDate: toText(fieldMap.completion_date ?? issuedAtIso),
    defectsIdentified: toText(fieldMap.defect_description ?? fieldMap.defects_identified ?? job.notes ?? ''),
    remedialWorksRequired: toText(fieldMap.remedial_action ?? fieldMap.remedial_works_required ?? ''),
    additionalNotes: toText(fieldMap.comments ?? fieldMap.additional_notes ?? ''),
  };

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

  const certificateId = randomUUID();
  const pdfPath = `cp12/${jobId}/${certificateId}.pdf`;

  const { error: uploadError } = await supabase.storage.from(CERTIFICATES_BUCKET).upload(pdfPath, Buffer.from(pdfBytes), {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (uploadError) {
    throw new Error(`Failed to upload CP12 PDF: ${uploadError.message}`);
  }

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

  return {
    certificateId,
    pdfPath,
    pdfUrl,
  };
}
