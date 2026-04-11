# Gas Warning Notice PDF Field Audit

## 1. Template summary

- Template file: `src/assets/templates/gas-warning-notice.pdf`
- Page count: `1`
- Page size: `841.89 x 595.28 pt` (`A4 landscape`)
- Coordinate system: PDF points, origin at bottom-left
- AcroForm inventory: `47` raw fields, `49` visible widgets

General notes:

- Every AcroForm field in this template is a `PDFTextField`.
- Every field carries the same field flags value, `4096`, and the same default appearance, `/F3 12 Tf 0 0 0 rg`.
- In practice that means the template was authored as if every box were a `12pt` multiline text box, including small checkboxes and signature areas.
- Two raw fields are reused across multiple visible widgets: `text6` and `text24`.
- Several raw field names are seeded sample strings rather than stable identifiers.
- The issue-category boxes and RIDDOR boxes are not real checkboxes.
- The signature boxes are not real signature fields.
- The visible "notice left on premises" checkbox at the bottom of the page has no AcroForm field.
- The printed mid-page banner is hard-coded as `IMMEDIATELY DANGEROUS`, which makes AR rendering inherently awkward even when the classification box is filled correctly.

## 2. Full field inventory

Recommended use buckets:

- `safe usable field`
- `widget-aware draw only`
- `overlay-only`
- `ambiguous / avoid`

| raw field | field type | widget index | page | rect | inferred meaning | recommended use | notes |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| `text100` | `PDFTextField` | 0 | 1 | `x=40.26, y=564.99, w=70.02, h=17.89` | Certificate / record number (`Cert. No.`) | `safe usable field` | Small single-line box. Override template default font size. |
| `Job Address Name Address 10 Example Street Example Town Post Code EX1 1XE Tel No` | `PDFTextField` | 0 | 1 | `x=380.89, y=500.13, w=173.87, h=17.89` | Job address name | `safe usable field` | Raw name is ugly but widget meaning is clear. |
| `Client  LandLord Name Mr John Example Company Address 10 Example Street Example Town Post Code EX1 1XE Tel No Mob No` | `PDFTextField` | 0 | 1 | `x=657.83, y=499.69, w=174.01, h=17.89` | Client / landlord name | `safe usable field` | Raw name is ugly but widget meaning is clear. |
| `Company  Installer Engineer arran Company SWFY Address 1 Example Street Example Town Post Code EX1 1EX Tel No 00000000000 Gas Safe Reg 545 ID Card No` | `PDFTextField` | 0 | 1 | `x=103.81, y=499.59, w=172.78, h=17.89` | Engineer / installer name | `safe usable field` | Raw name is ugly but widget meaning is clear. |
| `text10` | `PDFTextField` | 0 | 1 | `x=380.74, y=485.46, w=172.78, h=17.89` | Job address line 1 | `safe usable field` | First visible line under `Address` in Job Address section. |
| `text6` | `PDFTextField` | 0 | 1 | `x=657.61, y=485.46, w=172.78, h=17.89` | Client / landlord company | `widget-aware draw only` | Shared raw field with widget 1. Do not treat `text6` as one simple field. |
| `text6` | `PDFTextField` | 1 | 1 | `x=103.86, y=413.68, w=172.78, h=17.89` | Unclear extra box in Company / Installer block, between postcode and telephone | `ambiguous / avoid` | No printed label. Not safe to populate. |
| `text1` | `PDFTextField` | 0 | 1 | `x=103.64, y=485.02, w=172.78, h=17.89` | Engineer company | `safe usable field` | Visible `Company` row in Company / Installer section. |
| `text2` | `PDFTextField` | 0 | 1 | `x=103.64, y=471.06, w=172.78, h=17.89` | Engineer address line 1 | `safe usable field` | First address line in Company / Installer section. |
| `text11` | `PDFTextField` | 0 | 1 | `x=381.17, y=471.06, w=172.78, h=17.89` | Job address line 2 | `safe usable field` | Second visible line in Job Address block. |
| `text17` | `PDFTextField` | 0 | 1 | `x=657.83, y=471.06, w=172.78, h=17.89` | Client / landlord address line 1 | `safe usable field` | First address line in Client / LandLord block. |
| `text3` | `PDFTextField` | 0 | 1 | `x=103.94, y=456.81, w=172.78, h=17.89` | Engineer address line 2 | `safe usable field` | Second address line in Company / Installer section. |
| `text12` | `PDFTextField` | 0 | 1 | `x=380.95, y=456.44, w=172.78, h=17.89` | Job address line 3 | `safe usable field` | Third visible line in Job Address block. |
| `text18` | `PDFTextField` | 0 | 1 | `x=657.90, y=456.15, w=172.78, h=17.89` | Client / landlord address line 2 | `safe usable field` | Second address line in Client / LandLord block. |
| `text13` | `PDFTextField` | 0 | 1 | `x=380.81, y=442.19, w=172.78, h=17.89` | Job address line 4 / overflow line | `safe usable field` | There are four visible address rows in the Job Address block. |
| `text4` | `PDFTextField` | 0 | 1 | `x=103.57, y=442.11, w=172.78, h=17.89` | Engineer address line 3 | `safe usable field` | Third visible address line in Company / Installer section. |
| `text19` | `PDFTextField` | 0 | 1 | `x=658.19, y=442.11, w=172.78, h=17.89` | Client / landlord address line 3 | `safe usable field` | Third visible address line in Client / LandLord block. |
| `text5` | `PDFTextField` | 0 | 1 | `x=103.86, y=427.86, w=172.78, h=17.89` | Engineer postcode | `safe usable field` | Visible `Post Code` row in Company / Installer section. |
| `text20` | `PDFTextField` | 0 | 1 | `x=657.83, y=427.86, w=172.78, h=17.89` | Client / landlord postcode | `safe usable field` | Visible `Post Code` row in Client / LandLord section. |
| `text14` | `PDFTextField` | 0 | 1 | `x=380.44, y=427.71, w=172.78, h=17.89` | Job postcode | `safe usable field` | Visible `Post Code` row in Job Address section. |
| `text21` | `PDFTextField` | 0 | 1 | `x=657.61, y=413.46, w=172.78, h=17.89` | Client / landlord telephone | `safe usable field` | Visible `Tel No.` row in Client / LandLord section. |
| `text15` | `PDFTextField` | 0 | 1 | `x=380.52, y=413.24, w=172.78, h=17.89` | Job site telephone | `safe usable field` | Visible `Tel No.` row in Job Address section. |
| `text7` | `PDFTextField` | 0 | 1 | `x=103.64, y=399.50, w=172.78, h=17.89` | Engineer company telephone | `safe usable field` | Visible `Tel No.` row in Company / Installer section. |
| `text22` | `PDFTextField` | 0 | 1 | `x=657.83, y=399.28, w=172.78, h=17.89` | Client / landlord mobile | `safe usable field` | Visible `Mob. No.` row in Client / LandLord section. |
| `text23` | `PDFTextField` | 0 | 1 | `x=658.12, y=385.24, w=172.78, h=17.89` | Unclear extra box below client mobile | `ambiguous / avoid` | Visible widget exists, but there is no printed label or confirmed meaning. |
| `text8` | `PDFTextField` | 0 | 1 | `x=103.72, y=384.59, w=172.78, h=17.89` | Gas Safe registration number | `safe usable field` | Visible `Gas Safe Reg` row. |
| `text9` | `PDFTextField` | 0 | 1 | `x=103.79, y=370.33, w=172.78, h=17.89` | Engineer ID card number | `safe usable field` | Visible `ID Card No.` row. |
| `text28` | `PDFTextField` | 0 | 1 | `x=620.74, y=336.50, w=113.22, h=17.89` | Appliance type | `safe usable field` | Small single-line box. Appearance override needed. |
| `text26` | `PDFTextField` | 0 | 1 | `x=376.33, y=336.10, w=113.22, h=17.89` | Appliance make | `safe usable field` | Small single-line box. Appearance override needed. |
| `text24` | `PDFTextField` | 0 | 1 | `x=132.37, y=335.53, w=113.22, h=17.89` | Appliance location (`Location (Position/Room)`) | `widget-aware draw only` | Shared raw field with widget 1. Must target widget rect, not field name alone. |
| `text24` | `PDFTextField` | 1 | 1 | `x=131.90, y=321.66, w=113.22, h=17.89` | Appliance model | `widget-aware draw only` | Shared raw field with widget 0. Must target widget rect, not field name alone. |
| `text29` | `PDFTextField` | 0 | 1 | `x=620.70, y=322.13, w=113.22, h=17.89` | Appliance classification (`AR` / `ID`) | `safe usable field` | Best treated as centered single-line text. |
| `text27` | `PDFTextField` | 0 | 1 | `x=376.63, y=321.73, w=113.22, h=17.89` | Appliance serial number | `safe usable field` | Small single-line box. Appearance override needed. |
| `text30` | `PDFTextField` | 0 | 1 | `x=557.83, y=303.51, w=82.13, h=17.89` | `Other issue` details | `safe usable field` | Only meaningful when `Other issue` is selected. |
| `text34` | `PDFTextField` | 0 | 1 | `x=354.70, y=303.24, w=23.55, h=17.89` | `Meter Issue` mark box | `overlay-only` | Tiny text field used as pseudo-checkbox. Draw mark into rect. |
| `text31` | `PDFTextField` | 0 | 1 | `x=57.72, y=303.22, w=23.55, h=17.89` | `Gas Escape` mark box | `overlay-only` | Tiny text field used as pseudo-checkbox. Draw mark into rect. |
| `text32` | `PDFTextField` | 0 | 1 | `x=159.72, y=303.17, w=23.55, h=17.89` | `Pipework Issue` mark box | `overlay-only` | Tiny text field used as pseudo-checkbox. Draw mark into rect. |
| `text33` | `PDFTextField` | 0 | 1 | `x=268.01, y=302.88, w=23.55, h=17.89` | `Ventilation Issue` mark box | `overlay-only` | Tiny text field used as pseudo-checkbox. Draw mark into rect. |
| `text35` | `PDFTextField` | 0 | 1 | `x=468.55, y=302.30, w=23.55, h=17.89` | `Chimney/Flue Issue` mark box | `overlay-only` | Tiny text field used as pseudo-checkbox. Draw mark into rect. |
| `text36` | `PDFTextField` | 0 | 1 | `x=10.45, y=217.11, w=822.22, h=39.59` | `Details of Faults` text area | `safe usable field` | Large multiline box. Still needs explicit appearance updates. |
| `text38` | `PDFTextField` | 0 | 1 | `x=424.09, y=158.41, w=409.59, h=39.59` | `Actions Required` text area | `safe usable field` | Large multiline box. Still needs explicit appearance updates. |
| `text37` | `PDFTextField` | 0 | 1 | `x=7.80, y=157.36, w=409.59, h=39.59` | `Actions Taken` text area | `safe usable field` | Large multiline box. Still needs explicit appearance updates. |
| `text39` | `PDFTextField` | 0 | 1 | `x=257.90, y=119.08, w=24.07, h=17.89` | RIDDOR `11(1)` mark box | `overlay-only` | Tiny text field acting as checkbox. Draw mark into rect. |
| `text40` | `PDFTextField` | 0 | 1 | `x=670.29, y=118.79, w=23.55, h=17.89` | RIDDOR `11(2)` mark box | `overlay-only` | Tiny text field acting as checkbox. Draw mark into rect. |
| `text42` | `PDFTextField` | 0 | 1 | `x=420.16, y=53.54, w=122.12, h=30.44` | `Received by` signature box | `overlay-only` | Use rect as image anchor only. Do not set raw signature URL as field text. |
| `text41` | `PDFTextField` | 0 | 1 | `x=130.33, y=52.76, w=122.12, h=30.44` | `Issued by` signature box | `overlay-only` | Use rect as image anchor only. Do not set raw signature URL as field text. |
| `text45` | `PDFTextField` | 0 | 1 | `x=711.07, y=64.76, w=121.08, h=17.89` | Notice date | `safe usable field` | Best rendered as centered single-line text. |
| `text44` | `PDFTextField` | 0 | 1 | `x=420.16, y=35.20, w=121.07, h=17.89` | `Received by` print name | `safe usable field` | Single-line print-name field below received signature. |
| `text43` | `PDFTextField` | 0 | 1 | `x=130.85, y=34.94, w=121.07, h=17.89` | `Issued by` print name | `safe usable field` | Single-line print-name field below issued signature. |

## 3. Safe usable fields

These fields/widgets can be filled via normal text-field updates as long as code overrides the template defaults for font size, alignment, and multiline behavior:

- `text100`
- `Company  Installer Engineer arran Company SWFY Address 1 Example Street Example Town Post Code EX1 1EX Tel No 00000000000 Gas Safe Reg 545 ID Card No`
- `text1`
- `text2`
- `text3`
- `text4`
- `text5`
- `text7`
- `text8`
- `text9`
- `Job Address Name Address 10 Example Street Example Town Post Code EX1 1XE Tel No`
- `text10`
- `text11`
- `text12`
- `text13`
- `text14`
- `text15`
- `Client  LandLord Name Mr John Example Company Address 10 Example Street Example Town Post Code EX1 1XE Tel No Mob No`
- `text17`
- `text18`
- `text19`
- `text20`
- `text21`
- `text22`
- `text26`
- `text27`
- `text28`
- `text29`
- `text30`
- `text36`
- `text37`
- `text38`
- `text43`
- `text44`
- `text45`

## 4. Widget-aware fields

These fields must not be treated as one raw field name with one meaning:

- `text24`
  - widget `0` is appliance `Location (Position/Room)`
  - widget `1` is appliance `Model`
  - code should target widget rects explicitly or use widget-index-aware overlay logic
- `text6`
  - widget `0` is client / landlord `Company`
  - widget `1` is an unresolved extra widget in the installer block
  - code must never do a naive `setText('text6', value)` unless the same value is intentionally meant for both widgets

## 5. Overlay-only fields

These widgets should be treated as anchors for drawing, not as normal text fields:

- Issue-category pseudo-checkboxes:
  - `text31` Gas Escape
  - `text32` Pipework Issue
  - `text33` Ventilation Issue
  - `text34` Meter Issue
  - `text35` Chimney/Flue Issue
- RIDDOR pseudo-checkboxes:
  - `text39` RIDDOR 11(1)
  - `text40` RIDDOR 11(2)
- Signature boxes:
  - `text41` Issued by signature
  - `text42` Received by signature

Implementation rule:

- Use the widget rect only as an anchor.
- Draw `X` marks or signature images into that rect.
- Do not store signature URLs or checkbox marker text in the field value.

## 6. Ambiguous or broken fields

- `text6` widget `1`
  - Rect: `x=103.86, y=413.68, w=172.78, h=17.89`
  - Visible in the Company / Installer block between `Post Code` and `Tel No.`
  - No printed label
  - Current recommendation: avoid entirely until the source PDF is corrected or its purpose is confirmed
- `text23`
  - Rect: `x=658.12, y=385.24, w=172.78, h=17.89`
  - Visible below `Mob. No.` in the Client / LandLord block
  - No printed label
  - Current recommendation: avoid entirely until the source PDF is corrected or its purpose is confirmed

## 7. Missing visible controls with no usable field

- `Notice left on premises` checkbox in the signatures/footer sentence
  - The checkbox is visibly printed on the PDF
  - There is no AcroForm field or widget for it
  - Current renderer can only simulate the state by drawing an overlay at a hard-coded location if needed
- Classification banner copy
  - The page contains printed `IMMEDIATELY DANGEROUS` wording and supporting sentence copy in the center band
  - This is static artwork, not a field
  - AR cases can only fill the small `Classification` box; the surrounding printed wording remains ID-specific

## 8. Highest-risk template problems

1. Shared raw fields are reused across unrelated widgets.
   `text24` covers both `Location` and `Model`, and `text6` covers `Client Company` plus an unrelated unresolved installer-area widget.
2. The entire form is authored as `12pt` multiline text fields.
   That default is inappropriate for almost every visible box, especially the small top-section fields and micro mark boxes.
3. Checkboxes are not checkboxes.
   Issue categories and RIDDOR choices are plain text fields, so clean output depends on custom overlay drawing rather than field state.
4. Signature areas are not signature fields.
   They are plain text widgets, so a naive fill leaks raw signature URLs or other source strings into the PDF.
5. The template has both missing and ambiguous controls.
   The footer `notice left on premises` checkbox has no field at all, while `text6` widget `1` and `text23` are visible but unlabeled and unresolved.

## 9. Recommended long-term template fixes

- Give every visible box its own unique, stable field name.
- Replace the long seeded sample-string field names with short semantic names.
- Split reused fields into separate raw fields:
  - `text24` -> `appliance_location`, `appliance_model`
  - `text6` -> `client_company`, plus either a correctly named installer field or removal of the stray widget
- Replace issue and RIDDOR text fields with real checkbox fields.
- Replace signature text fields with proper signature or button/image-anchor fields.
- Add a real field for `notice left on premises`.
- Remove or relabel unused widgets like `text23` and `text6` widget `1`.
- Author sensible field defaults in the PDF itself:
  - single-line where appropriate
  - smaller default font sizes
  - correct alignment per box
- If AR must be supported in the same template, replace the hard-coded `IMMEDIATELY DANGEROUS` center-band artwork with neutral or dynamic wording.
