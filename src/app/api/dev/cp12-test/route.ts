import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { NextResponse } from 'next/server';

import { createJob, saveCp12JobInfo, saveCp12Appliances, updateField, generateCertificatePdf } from '@/server/certificates';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';
import { renderCp12CertificatePdf, type ApplianceInput, type Cp12FieldMap } from '@/server/pdf/renderCp12Certificate';

export async function GET(request: Request) {
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
      customer_phone: '+44 7700 900000',
      property_address: '12 High Street, London',
      postcode: 'E1 6AN',
      inspection_date: new Date().toISOString().slice(0, 10),
      landlord_name: 'Test Landlord',
      landlord_company: '',
      landlord_address_line1: '12 High Street',
      landlord_address_line2: '',
      landlord_city: 'London',
      landlord_postcode: 'E1 6AN',
      landlord_tel: '+44 7700 900000',
      landlord_address: '12 High Street, London, E1 6AN',
      engineer_name: 'Alex Engineer',
      engineer_phone: '+44 7700 900001',
      gas_safe_number: '123456',
      reg_26_9_confirmed: true,
      company_name: 'certnow Plumbing Ltd',
      company_address: '12 High Street, London',
      company_postcode: 'E1 6AN',
      company_phone: '+44 20 7946 1234',
      job_tel: '+44 7700 900000',
    },
  });

  await saveCp12Appliances({
    jobId,
    appliances: [
      {
        appliance_type: 'Boiler',
        landlords_appliance: 'Yes',
        appliance_inspected: 'Yes',
        location: 'Kitchen',
        make_model: 'Vaillant EcoTec',
        operating_pressure: '20 mbar',
        heat_input: '24 kW',
        high_co_ppm: '9',
        high_co2: '9.3',
        high_ratio: '0.0009',
        low_co_ppm: '6',
        low_co2: '8.9',
        low_ratio: '0.0007',
        co_reading_high: '3 ppm',
        co_reading_low: '2 ppm',
        flue_type: 'Balanced',
        ventilation_provision: 'Adequate',
        ventilation_satisfactory: 'PASS',
        flue_condition: 'PASS',
        stability_test: 'PASS',
        gas_tightness_test: 'PASS',
        co_reading_ppm: '2 ppm',
        safety_devices_correct: 'PASS',
        flue_performance_test: 'PASS',
        appliance_serviced: 'YES',
        combustion_notes: 'Test route combustion values seeded for PDF.',
        safety_rating: 'ncs',
        classification_code: 'NCS',
        safety_classification: 'ncs',
        defect_notes: 'Not to current standards noted during smoke test.',
        actions_taken: 'Customer advised.',
        actions_required: 'Review appliance against current standards.',
        warning_notice_issued: false,
        appliance_disconnected: false,
        danger_do_not_use_attached: false,
      },
    ],
    defects: {
      defect_description: 'None',
      remedial_action: 'N/A',
      warning_notice_issued: 'NO',
    },
  });

  await updateField({ jobId, key: 'completion_date', value: new Date().toISOString().slice(0, 10) });
  const debugPdf = process.env.CP12_PDF_DEBUG === '1';
  const requestUrl = new URL(request.url);
  const bypassStorage = debugPdf && requestUrl.searchParams.get('bypassStorage') === '1';

  if (bypassStorage) {
    const today = new Date().toISOString().slice(0, 10);
    const cp12Fields: Cp12FieldMap = {
      certNumber: jobId,
      issueDate: today,
      landlordName: 'Test Landlord',
      landlordAddressLine1: '12 High Street, London, E1 6AN',
      landlordPostcode: 'E1 6AN',
      propertyAddressLine1: '12 High Street, London',
      propertyPostcode: 'E1 6AN',
      companyName: 'certnow Plumbing Ltd',
      companyAddressLine1: '12 High Street, London',
      companyPostcode: 'E1 6AN',
      companyPhone: '+44 20 7946 1234',
      gasSafeRegistrationNumber: '123456',
      engineerName: 'Alex Engineer',
      engineerSignatureText: 'Alex Engineer',
      responsiblePersonName: 'Test Landlord',
      responsiblePersonSignatureText: 'Test Landlord',
      defectsIdentified: 'None',
      remedialWorksRequired: 'N/A',
      emergencyControlAccessible: 'yes',
      gasTightnessSatisfactory: 'yes',
      pipeworkVisualSatisfactory: 'yes',
      equipotentialBondingSatisfactory: 'yes',
    };
    const appliances: ApplianceInput[] = [
      {
        description: 'Vaillant EcoTec',
        landlordAppliance: 'Yes',
        applianceInspected: 'Yes',
        location: 'Kitchen',
        type: 'Boiler',
        flueType: 'Balanced',
        operatingPressure: '20 mbar',
        heatInput: '24 kW',
        safetyDevice: 'PASS',
        ventilationSatisfactory: 'PASS',
        flueTerminationSatisfactory: 'PASS',
        spillageTest: 'PASS',
        applianceSafeToUse: 'Yes',
        remedialActionTaken: 'NCS',
        combustionHighCoPpm: '9',
        combustionHighCo2: '9.3',
        combustionHighRatio: '0.0009',
        combustionLowCoPpm: '6',
        combustionLowCo2: '8.9',
        combustionLowRatio: '0.0007',
        combustionHigh: '3 ppm',
        combustionLow: '2 ppm',
        combustionNotes: 'Test route combustion values seeded for PDF.',
        applianceServiced: 'Yes',
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
    const directPdfPath = `/tmp/cp12-test-debug-${jobId}-${Date.now()}.pdf`;
    await writeFile(directPdfPath, Buffer.from(directBytes));
    console.log('CP12 test route: bypass storage return', {
      jobId,
      directPdfPath,
      returnedPdfByteLength: directPdfByteLength,
      returnedPdfHash8: directPdfHash8,
    });
    return NextResponse.json({ jobId, mode: 'bypassStorage', directPdfPath, directPdfByteLength, directPdfHash8 });
  }

  const { pdfUrl } = await generateCertificatePdf({ jobId, certificateType: 'cp12', previewOnly: false });
  console.log('CP12 test route: generateCertificatePdf return', { jobId, pdfUrl });

  return NextResponse.json({ jobId, pdfUrl });
}
