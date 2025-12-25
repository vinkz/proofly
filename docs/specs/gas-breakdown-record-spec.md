# Gas Breakdown Record Spec (UK)

Purpose
Define a defensible breakdown visit record for a gas appliance callout. This is not a statutory
certificate. It documents findings, actions taken, parts used, and customer advice. Designed for
wizard data capture and AcroForm PDF output.

Scope and assumptions
- Applies to domestic gas breakdown visits.
- Intended to provide an auditable record for the client and for internal QA.
- Should be usable without a full commissioning checklist.

Required fields
Job
- job.id: Traceability.
- job.visit_date: When the callout happened.
- job.engineer_name: Accountability.
- job.engineer_gas_safe_number: Regulatory identity (best practice).

Client
- client.name: Recipient of service.
- client.phone OR client.email: Follow-up contact.

Property
- property.address_line1: Location identification.
- property.postcode: Location identification.

Appliance (at least one)
- appliance.make: Appliance identification.
- appliance.model: Appliance identification.
- appliance.serial_number: Helps diagnose and track repeat faults.
- appliance.location: Appliance location at property.

Breakdown details
- breakdown.fault_description: Client reported issue.
- breakdown.diagnosis: Engineer diagnosis.
- breakdown.action_taken: Repair actions performed.
- breakdown.safety_status: Safe/unsafe classification.
- breakdown.work_completed: true/false (sets status).

Outputs
- outputs.summary: Text summary for client copy.

Signatures
- signatures.engineer: Confirms visit.
- signatures.client OR signatures.client_declined: Handover acknowledgment.

Optional fields
Job
- job.reference: Internal ref (CN-XXXXXX).
- job.notes: Additional notes.
- job.time_on_site_minutes: Time spent.

Client
- client.email, client.phone: Capture both if available.

Property
- property.address_line2, property.city, property.uprn.

Appliance
- appliance.gc_number.
- appliance.fuel.
- appliance.type.

Breakdown details
- breakdown.fault_code: Manufacturer fault code.
- breakdown.parts_used: Array of parts with qty.
- breakdown.further_work_required: true/false.
- breakdown.recommendation: Suggested next steps.
- breakdown.isolation_required: If unsafe, gas isolation performed.
- breakdown.notice_issued: If warning notice provided.
- breakdown.photos: Evidence photos.

Validation rules
Formats
- job.visit_date: ISO date or datetime (YYYY-MM-DD or YYYY-MM-DDTHH:mm).
- engineer_gas_safe_number: 7 to 10 digits (allow spaces).
- appliance.serial_number: 3 to 32 chars, allow alnum and hyphen.
- breakdown.safety_status: "safe" | "at_risk" | "immediately_dangerous".

Required-if conditions
- If breakdown.safety_status != "safe", require breakdown.isolation_required (boolean).
- If breakdown.notice_issued = true, require breakdown.notice_reference.
- If breakdown.work_completed = false, require breakdown.recommendation.
- If breakdown.parts_used has entries, require part.name and part.quantity for each.

Allowed values
- appliance.fuel: "natural_gas" | "lpg" | "unknown".
- appliance.type: "combi" | "system" | "regular" | "unknown".

Suggested JSON structure
{
  "job": {
    "id": "uuid",
    "reference": "CN-XXXXXX",
    "visit_date": "2025-03-01T10:00:00Z",
    "engineer_name": "Alex Green",
    "engineer_gas_safe_number": "1234567",
    "time_on_site_minutes": 75,
    "notes": "Access via side gate."
  },
  "client": {
    "name": "Jamie Smith",
    "phone": "+44 7700 900000",
    "email": "jamie@example.com"
  },
  "property": {
    "address_line1": "12 High Street",
    "address_line2": "Flat 3",
    "city": "Bristol",
    "postcode": "BS1 1AA",
    "uprn": "123456789012"
  },
  "appliances": [
    {
      "id": "appliance-1",
      "make": "Vaillant",
      "model": "ecoTEC Plus 832",
      "serial_number": "VAI-12345-XYZ",
      "gc_number": "41-044-26",
      "type": "combi",
      "fuel": "natural_gas",
      "location": "Kitchen"
    }
  ],
  "breakdown": {
    "fault_description": "No hot water",
    "fault_code": "F.28",
    "diagnosis": "Gas supply intermittently dropping",
    "action_taken": "Cleaned gas filter, reset appliance, tested restart",
    "parts_used": [
      { "name": "Gas filter", "quantity": 1, "part_number": "GF-101" }
    ],
    "safety_status": "safe",
    "work_completed": true,
    "further_work_required": false,
    "recommendation": "",
    "isolation_required": false,
    "notice_issued": false,
    "notice_reference": null
  },
  "evidence": {
    "photos": [
      { "id": "photo-1", "kind": "fault_code", "url": "..." }
    ]
  },
  "outputs": {
    "pdf_kind": "breakdown",
    "pdf_path": "reports/..."
  },
  "signatures": {
    "engineer": { "name": "Alex Green", "signed_at": "2025-03-01T10:45:00Z", "path": "signatures/..." },
    "client": { "name": "Jamie Smith", "signed_at": "2025-03-01T10:47:00Z", "path": "signatures/..." },
    "client_declined": false
  },
  "audit": {
    "created_at": "2025-03-01T10:00:00Z",
    "updated_at": "2025-03-01T10:50:00Z"
  }
}

PDF mapping plan
Naming convention:
- job_, client_, property_, appliance_1_, breakdown_, evidence_, signature_.

Suggested field names
Job
- job_reference
- job_visit_date
- job_engineer_name
- job_engineer_gas_safe_number
- job_time_on_site_minutes
- job_notes

Client / Property
- client_name
- client_phone
- client_email
- property_address_line1
- property_address_line2
- property_city
- property_postcode

Appliance (first)
- appliance_1_make
- appliance_1_model
- appliance_1_serial
- appliance_1_gc_number
- appliance_1_type
- appliance_1_fuel
- appliance_1_location

Breakdown
- breakdown_fault_description
- breakdown_fault_code
- breakdown_diagnosis
- breakdown_action_taken
- breakdown_parts_used
- breakdown_safety_status
- breakdown_work_completed
- breakdown_further_work_required
- breakdown_recommendation
- breakdown_isolation_required
- breakdown_notice_issued
- breakdown_notice_reference

Signatures
- signature_engineer
- signature_engineer_date
- signature_client
- signature_client_date
- signature_client_declined

Mapping rules
- Store parts_used as a single text field for PDF (e.g., "Filter x1; Thermistor x1").
- For boolean fields, map to checkboxes or "Yes/No" fields.
- If client declined signature, mark signature_client_declined and leave client signature blank.

Notes for wizard design
- Step order: Client/Property -> Appliance -> Breakdown details -> Evidence -> Review/Sign.
- Use a single appliance by default, allow adding more.
- If safety_status != safe, require an action and notice decision before submission.
