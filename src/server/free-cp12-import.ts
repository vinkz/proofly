'use server';

import { FreeCp12PayloadSchema, toCp12Appliance } from '@/lib/cp12/freeCp12Payload';
import { createJob, saveCp12Appliances, saveCp12JobInfo } from '@/server/certificates';
import { supabaseServerReadOnly } from '@/lib/supabaseServer';

/**
 * Adopt a certificate built in the free tool into the signed-in user's account.
 *
 * The free tool stores nothing server-side, so a visitor who filled one in and
 * then created an account used to lose the lot — the signup CTA was a plain
 * link that unmounted the form. The payload now travels through the visitor's
 * own browser and arrives here only once they have an account and have chosen
 * to keep it, which is what lets the free tool go on promising it keeps nothing.
 *
 * Deliberately creates a normal draft job rather than issuing anything: the
 * engineer lands in the wizard on their own work and decides when to issue. No
 * certificate row, no PDF, no delivery, and no certificate_usage — importing
 * must never silently spend one of their monthly allowance.
 *
 * The engineer's signature is not carried across. In the free tool it is a data
 * URL typed into that one document; the account has a stored signature and the
 * wizard captures one at issue, so importing it would put a signature on a draft
 * the engineer has not yet chosen to sign.
 */
export async function importFreeCp12Draft(
  payload: unknown,
): Promise<{ ok: true; jobId: string } | { ok: false; message: string }> {
  const readClient = await supabaseServerReadOnly();
  const {
    data: { user },
  } = await readClient.auth.getUser();
  if (!user) return { ok: false, message: 'Sign in to save this certificate.' };

  const parsed = FreeCp12PayloadSchema.safeParse(payload);
  if (!parsed.success) {
    // The draft is versioned in the browser, so this means a genuinely corrupt
    // or hand-edited entry rather than a shape we should try to migrate.
    return { ok: false, message: 'That saved certificate could not be read.' };
  }
  const { fields, appliances } = parsed.data;

  const propertyAddress = [
    fields.job_address_line1,
    fields.job_address_line2,
    fields.job_address_city,
    fields.job_postcode,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');

  const landlordName = fields.landlord_name.trim() || fields.landlord_company.trim();

  try {
    const { jobId } = await createJob({
      certificateType: 'cp12',
      title: landlordName ? `CP12 for ${landlordName}` : 'CP12',
      clientName: landlordName || undefined,
      address: propertyAddress || undefined,
    });

    await saveCp12JobInfo({
      jobId,
      data: {
        customer_name: landlordName,
        customer_phone: fields.landlord_tel,
        property_address: propertyAddress,
        postcode: fields.job_postcode,
        inspection_date: fields.inspection_date,
        landlord_name: fields.landlord_name,
        landlord_company: fields.landlord_company,
        landlord_address_line1: fields.landlord_address_line1,
        landlord_address_line2: fields.landlord_address_line2,
        landlord_city: fields.landlord_city,
        landlord_postcode: fields.landlord_postcode,
        landlord_tel: fields.landlord_tel,
        landlord_address: [
          fields.landlord_address_line1,
          fields.landlord_address_line2,
          fields.landlord_city,
          fields.landlord_postcode,
        ]
          .map((part) => part.trim())
          .filter(Boolean)
          .join(', '),
        engineer_name: fields.engineer_name,
        gas_safe_number: fields.gas_safe_number,
        engineer_phone: fields.company_phone,
        company_name: fields.company_name,
        company_address: fields.company_address,
        company_postcode: '',
        company_phone: fields.company_phone,
        job_tel: fields.landlord_tel,
        // Per-appliance Reg 26(9) declarations carry across on the appliance
        // rows; the record-level flag is not something the free tool captures,
        // so it stays false for the engineer to confirm in the wizard.
        reg_26_9_confirmed: false,
      },
    });

    await saveCp12Appliances({
      jobId,
      appliances: appliances.map(toCp12Appliance),
      defects: {
        defect_description: fields.defect_description,
        remedial_action: fields.remedial_action,
        warning_notice_issued: appliances.some((a) => a.warning_notice_issued) ? 'YES' : 'NO',
      },
    });

    return { ok: true, jobId };
  } catch (error) {
    console.error('free CP12 carry-over import failed', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: 'We could not save it just now. Your copy is still in this browser.' };
  }
}
