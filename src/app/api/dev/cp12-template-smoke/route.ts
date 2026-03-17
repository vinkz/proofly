import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { NextResponse } from 'next/server';

import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { CP12_DEMO_APPLIANCE, CP12_DEMO_INFO } from '@/types/cp12';
import { createJob, generateCertificatePdf, saveCp12Appliances, saveCp12JobInfo, updateField } from '@/server/certificates';
import { renderCp12CertificatePdf, type ApplianceInput, type Cp12FieldMap } from '@/server/pdf/renderCp12Certificate';

export async function GET(request: Request) {
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
      customer_phone: CP12_DEMO_INFO.customer_phone,
      property_address: CP12_DEMO_INFO.property_address,
      postcode: CP12_DEMO_INFO.postcode,
      inspection_date: demoInspectionDate ?? today,
      engineer_phone: CP12_DEMO_INFO.engineer_phone ?? '',
      engineer_name: CP12_DEMO_INFO.engineer_name,
      gas_safe_number: CP12_DEMO_INFO.gas_safe_number,
      company_name: CP12_DEMO_INFO.company_name,
      company_address: CP12_DEMO_INFO.company_address ?? '',
      company_postcode: CP12_DEMO_INFO.company_postcode ?? '',
      company_phone: CP12_DEMO_INFO.company_phone ?? '',
      job_tel: CP12_DEMO_INFO.job_tel ?? CP12_DEMO_INFO.customer_phone ?? '',
      landlord_name: CP12_DEMO_INFO.landlord_name,
      landlord_company: '',
      landlord_address_line1: CP12_DEMO_INFO.landlord_address,
      landlord_address_line2: '',
      landlord_city: '',
      landlord_postcode: CP12_DEMO_INFO.postcode,
      landlord_tel: '',
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
  const debugPdf = process.env.CP12_PDF_DEBUG === '1';
  const requestUrl = new URL(request.url);
  const bypassStorage = debugPdf && requestUrl.searchParams.get('bypassStorage') === '1';

  if (bypassStorage) {
    const cp12Fields: Cp12FieldMap = {
      certNumber: jobId,
      issueDate: demoInspectionDate ?? today,
      nextInspectionDue: today,
      landlordName: CP12_DEMO_INFO.landlord_name,
      landlordAddressLine1: CP12_DEMO_INFO.landlord_address,
      landlordPostcode: CP12_DEMO_INFO.postcode,
      propertyAddressLine1: CP12_DEMO_INFO.property_address,
      propertyPostcode: CP12_DEMO_INFO.postcode,
      companyName: CP12_DEMO_INFO.company_name,
      companyAddressLine1: CP12_DEMO_INFO.company_address,
      companyPostcode: CP12_DEMO_INFO.company_postcode,
      companyPhone: CP12_DEMO_INFO.company_phone,
      gasSafeRegistrationNumber: CP12_DEMO_INFO.gas_safe_number,
      engineerName: CP12_DEMO_INFO.engineer_name,
      engineerSignatureText: CP12_DEMO_INFO.engineer_name,
      responsiblePersonName: CP12_DEMO_INFO.customer_name,
      responsiblePersonSignatureText: CP12_DEMO_INFO.customer_name,
      defectsIdentified: CP12_DEMO_INFO.defect_description,
      remedialWorksRequired: CP12_DEMO_INFO.remedial_action,
      emergencyControlAccessible: 'yes',
      gasTightnessSatisfactory: 'yes',
      pipeworkVisualSatisfactory: 'yes',
      equipotentialBondingSatisfactory: 'yes',
    };
    const appliances: ApplianceInput[] = [
      {
        description: CP12_DEMO_APPLIANCE.make_model,
        location: CP12_DEMO_APPLIANCE.location,
        type: CP12_DEMO_APPLIANCE.appliance_type,
        flueType: CP12_DEMO_APPLIANCE.flue_type,
        operatingPressure: CP12_DEMO_APPLIANCE.operating_pressure,
        heatInput: CP12_DEMO_APPLIANCE.heat_input,
        safetyDevice: CP12_DEMO_APPLIANCE.safety_devices_correct,
        ventilationSatisfactory: CP12_DEMO_APPLIANCE.ventilation_satisfactory,
        flueTerminationSatisfactory: CP12_DEMO_APPLIANCE.flue_condition,
        spillageTest: CP12_DEMO_APPLIANCE.gas_tightness_test,
        applianceSafeToUse: CP12_DEMO_APPLIANCE.safety_rating,
        remedialActionTaken: CP12_DEMO_APPLIANCE.classification_code,
        combustionHighCoPpm: CP12_DEMO_APPLIANCE.high_co_ppm,
        combustionHighCo2: CP12_DEMO_APPLIANCE.high_co2,
        combustionHighRatio: CP12_DEMO_APPLIANCE.high_ratio,
        combustionLowCoPpm: CP12_DEMO_APPLIANCE.low_co_ppm,
        combustionLowCo2: CP12_DEMO_APPLIANCE.low_co2,
        combustionLowRatio: CP12_DEMO_APPLIANCE.low_ratio,
        combustionHigh: CP12_DEMO_APPLIANCE.co_reading_high,
        combustionLow: CP12_DEMO_APPLIANCE.co_reading_low,
        combustionNotes: CP12_DEMO_APPLIANCE.combustion_notes,
        applianceServiced: CP12_DEMO_APPLIANCE.appliance_serviced,
      },
    ];
    const directBytes = await renderCp12CertificatePdf({
      fields: cp12Fields,
      appliances,
      recordId: jobId,
      issuedAt: new Date(),
    });
    const directPdfByteLength = directBytes.byteLength;
    const directPdfHash8 = createHash('sha256').update(directBytes).digest('hex').slice(0, 8);
    const directPdfPath = `/tmp/cp12-debug-${jobId}-${Date.now()}.pdf`;
    await writeFile(directPdfPath, Buffer.from(directBytes));
    console.log('CP12 template smoke: bypass storage return', {
      jobId,
      directPdfPath,
      returnedPdfByteLength: directPdfByteLength,
      returnedPdfHash8: directPdfHash8,
    });
    return NextResponse.json({ jobId, mode: 'bypassStorage', directPdfPath, directPdfByteLength, directPdfHash8 });
  }

  const { pdfUrl } = await generateCertificatePdf({ jobId, certificateType: 'cp12', previewOnly: true });
  console.log('CP12 template smoke: generateCertificatePdf return', { jobId, pdfUrl });

  return NextResponse.json({ jobId, pdfUrl });
}
