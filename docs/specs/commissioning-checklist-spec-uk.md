# Commissioning Checklist Spec (UK Domestic Boilers)

Purpose
Define required wizard fields and validation rules for a UK domestic boiler commissioning checklist.
This is based on the Benchmark scheme commissioning checklist structure and common manufacturer
checklists, adapted to CertNow data concepts (Job, Client, Property, Appliances, Evidence, Outputs).

Scope and assumptions
- Applies to domestic boiler commissioning (gas).
- The output is a defensible commissioning record and a PDF with AcroForm fields.
- It is not a statutory certificate, but should be complete enough to satisfy a typical
  manufacturer warranty and handover expectations.
- The spec focuses on wizard data capture, validation, and mapping to PDF fields.

Required fields (with rationale)
Job
- job.id: Traceability.
- job.date_commissioned: Commissioning date for warranty and record.
- job.engineer_name: Accountability and handover.
- job.engineer_gas_safe_number: Regulatory identity (best practice; required in Benchmark).
- job.company_name: Business identity on the record.

Client (end user)
- client.name: Occupier/owner record.
- client.phone OR client.email: Contact for follow-up and warranty.

Property
- property.address_line1: Site identification.
- property.postcode: Site identification and service area verification.

Appliance (boiler)
- appliance.make: Manufacturer identification.
- appliance.model: Manufacturer identification.
- appliance.serial_number: Warranty registration.
- appliance.type: Boiler type (combi/system/regular), required by Benchmark.
- appliance.location: Identify installation location.
- appliance.fuel: Gas type (natural/LPG).

System and commissioning checks
- commissioning.work_type: New installation / replacement / conversion (drives check list).
- commissioning.system_flushed: Evidence of system cleanliness.
- commissioning.system_cleaner_added: Protects warranty.
- commissioning.inhibitor_added: Protects system.
- commissioning.system_pressure_cold_bar: Safe operation baseline.
- commissioning.gas_rate: Supports manufacturer commissioning requirements.
- commissioning.dynamic_pressure_mbar: Gas supply check.
- commissioning.flue_type: Required for safety.
- commissioning.flue_integrity_checked: Required for safety.
- commissioning.condensate_disposed_ok: Required for safety.
- commissioning.controls_set: Ensures functional handover.
- commissioning.timeclock_programmed: Common benchmark item.
- commissioning.safety_devices_checked: Safety compliance.
- commissioning.user_instruction_given: Handover compliance.

Signatures
- signatures.engineer: Confirms commissioning performed.
- signatures.client: Confirms handover received.

Optional fields
Job
- job.reference: Internal reference for auditing.
- job.notes: Additional notes.

Client
- client.email, client.phone: Use at least one, optional to capture both.

Property
- property.address_line2, property.city, property.uprn: Additional context.

Appliance
- appliance.install_date: When installed; may match commissioning date.
- appliance.gc_number: Some manufacturers require.
- appliance.manufacturer_warranty_registered: Optional handover detail.

System and commissioning checks
- commissioning.system_volume_litres: May be estimated.
- commissioning.fan_pressure: Manufacturer-specific.
- commissioning.co2_reading: Manufacturer-specific.
- commissioning.o2_reading: Manufacturer-specific.
- commissioning.co_reading_ppm: Manufacturer-specific.
- commissioning.seal_ok: Not always explicitly recorded.
- commissioning.flue_length: If manufacturer requires.
- commissioning.hot_water_flow_lpm: For combi performance check.
- commissioning.radiator_balanced: Handover quality.
- commissioning.trv_installed: Optional.
- commissioning.system_filter_fitted: Best practice.
- commissioning.system_filter_cleaned: If filter fitted.

Evidence
- evidence.photos: Installation, flue termination, gas meter reading.
- evidence.attachments: Manufacturer checklist or handover pack.

Validation rules
Formats
- job.date_commissioned: ISO date (YYYY-MM-DD).
- commissioning.system_pressure_cold_bar: number, range 0.8 to 2.0.
- commissioning.dynamic_pressure_mbar: number, range 10 to 30 (use manufacturer spec if known).
- commissioning.gas_rate: number, unit kW or m3/h (store value + unit).
- appliance.serial_number: 3 to 32 chars, allow alnum and hyphen.
- appliance.gc_number: optional, format "NNN NNN NN".
- engineer_gas_safe_number: 7 to 10 digits (allow spaces).

Required-if conditions
- If appliance.fuel = "LPG", require commissioning.lpg_regulator_checked = true.
- If appliance.type = "combi", require commissioning.hot_water_flow_lpm.
- If commissioning.system_cleaner_added = true, require commissioning.cleaner_brand.
- If commissioning.inhibitor_added = true, require commissioning.inhibitor_brand.
- If commissioning.system_flushed = true, require commissioning.flush_method.
- If commissioning.flue_type includes "room sealed", require commissioning.flue_integrity_checked = true.

Allowed values
- appliance.type: "combi" | "system" | "regular".
- appliance.fuel: "natural_gas" | "lpg".
- commissioning.work_type: "new_install" | "replacement" | "conversion".
- commissioning.controls_set: "on" | "off" | "programmed".

Data model mapping (suggested JSON)
Use a single job record JSON (stored in job_records.record).

{
  "job": {
    "id": "uuid",
    "reference": "CN-XXXXXX",
    "date_commissioned": "2025-03-01",
    "engineer_name": "Alex Green",
    "engineer_gas_safe_number": "1234567",
    "company_name": "CertNow Ltd",
    "notes": "Left user guide in kitchen."
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
  "commissioning": {
    "work_type": "replacement",
    "system_flushed": true,
    "flush_method": "power_flush",
    "system_cleaner_added": true,
    "cleaner_brand": "Fernox F3",
    "inhibitor_added": true,
    "inhibitor_brand": "Fernox F1",
    "system_pressure_cold_bar": 1.2,
    "gas_rate": { "value": 24.0, "unit": "kW" },
    "dynamic_pressure_mbar": 20.0,
    "flue_type": "room_sealed",
    "flue_integrity_checked": true,
    "condensate_disposed_ok": true,
    "controls_set": "programmed",
    "timeclock_programmed": true,
    "safety_devices_checked": true,
    "user_instruction_given": true
  },
  "evidence": {
    "photos": [
      { "id": "photo-1", "kind": "flue_terminal", "url": "..." }
    ],
    "attachments": [
      { "id": "doc-1", "kind": "manufacturer_checklist", "url": "..." }
    ]
  },
  "outputs": {
    "pdf_kind": "commissioning",
    "pdf_path": "reports/..."
  },
  "signatures": {
    "engineer": { "name": "Alex Green", "signed_at": "2025-03-01T14:20:00Z", "path": "signatures/..." },
    "client": { "name": "Jamie Smith", "signed_at": "2025-03-01T14:25:00Z", "path": "signatures/..." }
  },
  "audit": {
    "created_at": "2025-03-01T13:00:00Z",
    "updated_at": "2025-03-01T14:30:00Z"
  }
}

PDF field mapping plan
Goal: map JSON keys to AcroForm fields using clear, stable naming.
Naming convention:
- Prefix sections: job_, client_, property_, appliance_1_, commissioning_.
- For booleans use "yes/no" fields or checkbox pairs if required by PDF.

Suggested field names
Job
- job_date_commissioned
- job_engineer_name
- job_engineer_gas_safe_number
- job_company_name
- job_reference

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

Commissioning checks
- commissioning_work_type
- commissioning_system_flushed
- commissioning_flush_method
- commissioning_system_cleaner_added
- commissioning_cleaner_brand
- commissioning_inhibitor_added
- commissioning_inhibitor_brand
- commissioning_system_pressure_cold_bar
- commissioning_gas_rate_value
- commissioning_gas_rate_unit
- commissioning_dynamic_pressure_mbar
- commissioning_flue_type
- commissioning_flue_integrity_checked
- commissioning_condensate_disposed_ok
- commissioning_controls_set
- commissioning_timeclock_programmed
- commissioning_safety_devices_checked
- commissioning_user_instruction_given

Signatures
- signature_engineer
- signature_client
- signature_engineer_date
- signature_client_date

Mapping rules
- Use setText for text fields and setCheck for checkboxes.
- If the PDF uses yes/no fields, map booleans to "Yes" / "No".
- If a field is missing, do not fail; keep the fallback logic used elsewhere
  (setTextIfExists / setCheckIfExists).

Audit trail + signatures guidance
- Capture who completed the checklist (engineer name + gas safe).
- Capture signature timestamps (engineer + client).
- Store a snapshot of key fields at submission time in job_records.record.audit.
- Keep signature files in a dedicated bucket and store paths in job_records.record.signatures.
- If client signature is not available, allow submission but mark signatures.client.signed_at as null.

Notes for wizard design
- Step order: Client/Property -> Appliance -> Commissioning -> Evidence -> Review/Sign.
- Show required-if fields conditionally to keep the form concise.
- Provide a quick summary panel for installer to review before signature.
