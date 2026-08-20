# CertNow outreach automation runbook

## What this system does

This is a human-in-the-loop B2B outreach system for CertNow.

It:

1. discovers gas-engineering businesses by location with Google Places;
2. deduplicates them in Airtable;
3. requires manual email research, corporate-status verification and approval;
4. sends one initial Gmail message;
5. detects replies by Gmail thread ID;
6. sends one follow-up after five days when no reply has been recorded; and
7. records the result in Airtable.

It does **not** automatically find email addresses, decide that an unknown
business is legally eligible, or approve a lead for sending.

The four Make scenarios are:

```text
01 - Discover Google Places leads
02 - Initial outreach
03 - Detect replies
04 - Five-day follow-up
```

Keep separate TEST and PROD copies of Scenarios 2–4. Never remove the safety
conditions from the only working test copy.

## End-to-end architecture

```text
Locations table
    ↓
01 Google Places discovery
    ↓
Leads table — deduplicated by Google Place ID
    ↓
Human review
    ├── rejected / sole trader / unknown / opted out → never send
    └── qualified corporate business
            ↓
        Approved to send
            ↓
        02 Initial email
            ↓
        Gmail thread ID + five-day Next action
            ├── 03 Reply detected → Replied → stop
            └── no reply when due
                    ↓
                04 Follow-up in original thread
                    ↓
                03 Reply detected → Replied → stop
```

Do not use a five-day Sleep module. The delay is represented by the Airtable
`Next action` date, and Scenario 4 searches for due records on a schedule.

---

## Airtable setup

### Locations table

| Field | Type | Owner |
|---|---|---|
| `Town` | Single-line text | CSV/manual |
| `Region` | Single-line text | CSV/manual |
| `Postcode area` | Single-line text | CSV/manual |
| `Search status` | Single select: `Ready`, `Searching`, `Complete`, `Failed`, `Search again` | Set by Scenario 1 |
| `Last searched` | Date with time | Set by Scenario 1 |
| `Results found` | Number | Set by Scenario 1 |

Two notes on the live field:

- `Results found` is configured with one decimal place, so a count of five reads
  `5.0`. Set its precision to integer.
- The base contains two overlapping views, `Discovery queue` and
  `Ready to search`. Scenario 1 no longer reads either — see below.

Scenario 1 selects its town with an explicit formula and a **blank** View field:

```text
{Search status}="Ready"
```

Use straight quotes, include the equals sign, and do not begin the Airtable
formula with an additional `=`.

Do not drive this search from a view. On 2026-08-15 the `Discovery queue` view
was observed returning `Bath`, a town already marked `Complete`, so every run
re-searched the same town: the upsert matched the same five Place IDs, updated
them instead of inserting, and produced no new leads while still spending
Google Places quota on identical queries. Three consecutive runs returned
byte-identical payloads.

The failure is silent in every log. The scenario reports success, the write-back
dutifully re-stamps `Complete` and `Last searched` on a town that was already
complete, and the only visible symptom is that the Leads table stops growing.

A view filter is a UI setting that can be edited, duplicated or renamed by
anyone with base access, and nothing in Make revalidates it. The formula is
stored with the scenario, so it fails loudly rather than quietly selecting the
wrong record. The same reasoning applies to the `BLANK()` clause in Scenario 2.

To confirm the queue is advancing, sort Locations by `Last searched` descending
after a run. A different town each time is correct. The same town twice means
the selection is wrong, whatever the execution status says.

To re-search a town deliberately, set its `Search status` back to `Ready`.

### Leads table

The table is intentionally split between human-review fields, discovery fields,
and automation tracking.

The base also holds `ZZ-ARCHIVE Leads copy` and `ZZ-ARCHIVE Locations copy`.
These are stale duplicates kept for their data only. No scenario targets them
and none should — pointing a module at the wrong table is a documented failure
mode of this system. The canonical tables are `Leads` and `Locations`.

#### Human-review fields

| Field | Type | Rule |
|---|---|---|
| `Business_name` | Single-line text | Canonical business name used in the email. |
| `Town` | Single-line text | Used for the town-based opening. |
| `Website` | URL | Official business website. |
| `Lead source` | URL | Page used to find/verify the business email. |
| `Business email` | Email | Public business contact address. |
| `Company type` | Single select | Legal structure, verified manually. |
| `Company number` | Single-line text | Companies House number where applicable. |
| `Company status` | Single select | `Active`, `Dissolved`, `Unknown`, `Needs review`. |
| `Email type` | Single select | Use `Generic business` for the first campaign. |
| `Gas Safe verified` | Checkbox | Checked only after verification. |
| `Qualification status` | Single select | `Discovered`, `Enriching`, `Needs review`, `Qualified`, `Rejected`. |
| `Approved to send` | Checkbox | Final manual send gate. |
| `Do not contact` | Checkbox | Permanent suppression gate; automation never clears it. |

The normal manual process is:

1. verify the business is relevant;
2. find its public business email;
3. verify its corporate structure and active status;
4. verify Gas Safe status;
5. mark `Qualification status = Qualified`;
6. mark `Outreach status = Ready`; and
7. check `Approved to send`.

`Business_name` and `Town` come from discovery. The main manual entry is the
business email plus the eligibility checks required before approval.

#### Discovery and deduplication fields

| Field | Type | Rule |
|---|---|---|
| `Google Place ID` | Single-line text | Unique merge/deduplication key. |
| `Google Maps URL` | URL | Returned by Places. |
| `Address` | Long or single-line text | Returned by Places. |
| `Region` | Single-line text | Mapped from the Locations record. |
| `Postcode area` | Single-line text | Mapped from Locations where used. |
| `Lead source` | Single select/text | Fixed value `Google Places`. |
| `Domain` | Single-line text | Optional deduplication helper. |
| `Lead_ID` | Formula/autonumber | Optional internal reference. |

Discovery must never overwrite qualification, approval, outreach, reply or
suppression fields on a previously discovered lead.

#### Automation fields

| Field | Type | Values/use |
|---|---|---|
| `Outreach status` | Single select | See exact options below. |
| `Sequence step` | Number | `0` before send, `1` after email 1, `2` after follow-up. |
| `Last contacted` | Date with time | Written only after a successful Gmail action. |
| `Next action` | Date with time | Five-day follow-up due date; blank at terminal states. |
| `Gmail thread ID` | Single-line text | Joins Gmail replies to Airtable leads. |
| `Reply category` | Single select | Start with `Needs review`; classify manually. |
| `Replied at` | Date with time | Timestamp of the detected reply. |
| `Reply message ID` | Single-line text | Gmail message-level ID for the reply. |
| `Reply text` | Long text | Gmail snippet for review. |
| `Test record` | Checkbox | Excludes test rows from production scenarios. |
| `Live send eligible` | Formula | Final computed production gate. |

Use these exact `Outreach status` options everywhere:

```text
New
Ready
Sending
Email 1 sent
Follow-up 1 sent
Replied
Send failed
Rejected
```

Exact spelling matters. For example, a formula searching for `Follow-up sent`
will not match a row containing `Follow-up 1 sent`.

### Fields removed from the manual workflow

These were removed or hidden because they duplicated other fields or created
unnecessary manual work:

```text
Company name          → use Business_name
Personalisation       → use Business_name + Town in the email
Qualification evidence → retain Website / Lead source instead
```

`Lead score` was intended for removal but still exists in the base. Its formula
referenced a deleted field, so it silently evaluated to blank on every record
rather than erroring. It has been repaired to:

```text
IF(
  {Do not contact},
  0,
  IF({Qualification status}="Qualified", 1, 0) +
  IF({Business email}!="", 1, 0) +
  IF({Website}!="", 1, 0) +
  IF({Qualification evidence}!="", 1, 0)
)
```

Maximum score is 4. It is advisory only — `Live send eligible` remains the gate.

Phone, address, Place ID, created/updated timestamps and similar automation
metadata can remain in the base but should be hidden from the `Manual review`
view.

### Recommended Airtable views

#### Manual entry

Named `Manual entry` in the base — this document previously called it
`Manual review`.

Filter on what is **outstanding**, not on what is unqualified:

```text
Approved to send is unchecked
AND Do not contact is unchecked
AND Qualification status is not Rejected
```

Filtering on `Qualification status` being an early value (`Discovered`,
`Enriching`) removes a record from the view the instant you mark it `Qualified`
— before you can tick `Approved to send`, which is the very next thing the
process asks you to do. The filter above keeps a qualified lead in front of you
until you approve it, then drops it on its own.

Show:

```text
Business_name
Town
Website
Lead source
Business email
Company type
Company number
Company status
Email type
Gas Safe verified
Qualification status
Approved to send
Do not contact
Outreach status
```

#### Automation tracking

Show:

```text
Business_name
Business email
Outreach status
Sequence step
Last contacted
Next action
Gmail thread ID
Reply category
Replied at
Reply message ID
Reply text
Do not contact
Test record
Live send eligible
```

#### Reply review

Filter:

```text
Reply category is Needs review
```

#### Tests

Filter:

```text
Test record is checked
```

### Company type options

Use:

```text
Limited company
PLC
LLP
Scottish partnership
Corporate/public body
Sole trader
Non-corporate partnership
Unknown
```

The production cold-email gate permits only:

```text
Limited company
PLC
LLP
Scottish partnership
Corporate/public body
```

Sole traders, ordinary partnerships and unknown business types remain blocked
unless an appropriate permission or exception has been established separately.

### Live send eligible formula

Create a Formula field named `Live send eligible`:

```text
AND(
  OR(
    {Company type}="Limited company",
    {Company type}="PLC",
    {Company type}="LLP",
    {Company type}="Scottish partnership",
    {Company type}="Corporate/public body"
  ),
  {Company status}="Active",
  {Qualification status}="Qualified",
  {Email type}="Generic business",
  {Gas Safe verified}=1,
  {Business email}!="",
  {Town}!="",
  {Approved to send}=1,
  {Do not contact}=0,
  {Test record}=0
)
```

The formula calculates eligibility; it does not replace human approval.

---

## Scenario 1 — Discover Google Places leads

### Purpose

Take one Ready location, search Google Places, iterate the returned businesses,
and upsert Leads by Google Place ID.

### Module 1: Airtable — Search Records

```text
Base: outreach base
Table: Locations
View: Discovery queue
Formula: blank
Limit: 1
```

Alternatively use:

```text
{Search status}="Ready"
```

### Module 2: HTTP — Make a request

```text
Method: POST
URL: https://places.googleapis.com/v1/places:searchText
```

Headers:

```text
Content-Type: application/json
X-Goog-Api-Key: YOUR_GOOGLE_PLACES_API_KEY
X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.businessStatus
```

Request body:

```json
{
  "textQuery": "Gas Safe engineer in {{Town}}, {{Region}}",
  "pageSize": 5,
  "languageCode": "en",
  "regionCode": "GB",
  "includePureServiceAreaBusinesses": true
}
```

Insert `Town` and `Region` as Airtable mapping pills. Do not type Make
placeholder syntax manually.

Google Places does not provide business email addresses. Email research remains
manual. Website and phone fields require additional Places fields and may change
Google billing, so keep the minimal field mask while proving the workflow.

### Module 3: Iterator

Map:

```text
HTTP → Data → places
```

### Module 4: Airtable — Bulk Upsert Records (Advanced)

```text
Table: Leads
Merge field: Google Place ID
```

Map only discovery fields:

```text
Business_name   ← places.displayName.text
Google Place ID ← places.id
Google Maps URL ← places.googleMapsUri
Address         ← places.formattedAddress
Town            ← Locations.Town
```

**Do not map approval, qualification, outreach status, reply or suppression
fields in the upsert.** This rule is load-bearing and was violated in the live
build for some time. An upsert that matches an existing Place ID *updates* that
record, so mapping

```text
Qualification status ← "Discovered"
Outreach status      ← "New"
Approved to send     ← false
Test record          ← false
```

meant every re-run of a town silently reset leads a human had already qualified,
rejected or approved, and pushed them back into the review queue looking new.
It also stranded leads that had already been emailed: their status was
overwritten to a value no send scenario writes, so the follow-up query stopped
matching them. Discovery must only ever write what Google told it.

Because those defaults are no longer written by the automation, set them as
Airtable **field defaults** instead, so newly created leads still land in the
review queue:

```text
Qualification status  default → Discovered
Outreach status       default → New
```

Checkboxes default to unchecked already, so `Approved to send` and `Test record`
need no configuration.

### Module 3: Airtable — Update Record (Locations write-back)

Sits between the HTTP module and the Iterator, so it runs once per town rather
than once per returned place.

```text
Record ID:     Locations → ID
Search status: Complete
Last searched: now
Results found: length(places)
```

Without this the town is never moved off `Ready`. The search reads the
`Discovery queue` view with a limit of 1, so the *same* town is returned on
every run — which is what turned the upsert problem above from a one-off into a
repeating reset every 15 minutes, and quietly burned Google Places quota on
identical queries.

Confirm the `Search status` single select actually contains `Complete`;
typecast is off, so a missing option fails the run rather than inventing one.

### Discovery operating pattern

1. Set one Location to `Ready`.
2. Run Scenario 1 manually.
3. Inspect the five returned businesses.
4. Confirm Google Place IDs were upserted rather than duplicated.
5. Confirm the Location moved to `Complete` with `Last searched` and
   `Results found` populated. The scenario does this itself now; if it is still
   `Ready` afterwards, the write-back failed and the town will be searched again
   on the next run.
6. Research the new Leads manually.

To re-search a town later, set it back to `Ready` deliberately. Re-running is
now safe for leads you have already judged — the upsert no longer touches their
qualification, approval or outreach status.

---

## Scenario 2 — Initial outreach

### Test version

Test Search Records formula:

```text
AND(
  {Test record}=1,
  {Approved to send}=1,
  {Do not contact}=0,
  {Business email}!="",
  {Outreach status}="Ready",
  OR({Sequence step}=0, {Sequence step}=BLANK()),
  {Gmail thread ID}=""
)
```

Use only an email address controlled by the tester.

### Production version

Production Search Records formula:

```text
AND(
  {Live send eligible}=1,
  OR({Outreach status}="Ready", {Outreach status}="New", {Outreach status}=BLANK()),
  OR({Sequence step}=0, {Sequence step}=BLANK()),
  {Gmail thread ID}=""
)
```

`New` is accepted as well as `Ready` because nothing promotes a lead to `Ready`
automatically. Every other gate still applies through `Live send eligible`.

`BLANK()` matters. Since discovery stopped writing `Outreach status` — see
Scenario 1, where writing it was resetting human decisions — every newly
discovered lead arrives with that field **empty**. Empty matches neither
`"Ready"` nor `"New"`, so without this clause a lead you had qualified and
approved would sit there fully eligible and never be emailed, with nothing in
any log to say why. Setting an Airtable field default of `New` would also solve
it, but the formula should not depend on a UI setting staying configured.

Note the two-argument `OR()` around the status. Writing it as
`{Outreach status}="Ready", "New"` is not a wider match — it is a syntax error,
and Airtable rejects the whole formula with a 422.

Leave the View field **blank** when a formula is set. Setting both a view and a
formula is what produced the invalid-formula failures on this scenario.

Start with:

```text
Sort: oldest approved record first
Limit: 1
Schedule: off / manual run
```

### Recommended production module order

```text
Airtable Search approved lead
    ↓
Airtable reserve record
    ↓
Gmail send initial email
    ↓
Airtable record successful send
```

The reservation step prevents a failed final Airtable update from causing a
duplicate email on the next run.

### Module 1: Airtable — Search Records

Use the relevant TEST or PROD formula above.

### Module 2: Airtable — Update Record (reservation)

```text
Record ID: Search Records → top-level ID
Outreach status: Sending
Approved to send: unchecked
```

This module is not optional. Without it, a Gmail send that succeeds followed by
a failed final Airtable update leaves the record still `Approved to send` and
still matching the search formula, so the next run emails the same business
again. It fails closed: a send that dies mid-flight leaves the record parked at
`Sending` with approval consumed, awaiting a human.

The Airtable record ID begins with `rec`. Do not map `Lead_ID`, Google Place ID,
Gmail Message ID or Gmail Thread ID into Record ID.

### Module 3: Gmail — Send an Email

```text
To: Airtable → Business email
From: "Kel from certnow" <kelvin@certnow.uk>
Subject: A free CP12 generator for {{Business_name}}
Body type: Raw HTML
```

Keep the subject in the same first-person voice as the body. The earlier live
subject, `{{Business_name}} is invited to use our free CP12 generator`, mixed
"our" into a body written as "I" and read like a mail-merge blast.

Insert Airtable values as mapping pills. Do not type `{{Business_name}}`
literally.

Suggested initial body:

```html
<p>Hi,</p>

<p>
I came across {{Business_name}} while looking for gas engineering businesses
serving {{Town}}.
</p>

<p>
We’ve built <strong>CertNow</strong>, a mobile tool for completing CP12s and
boiler service records while on site. It reduces repeat entry with appliance
dropdowns and saved property, landlord and appliance details. If an appliance
is marked unsafe, CertNow can also prefill the corresponding Gas Warning Notice.
</p>

<p>
Once issued, the certificate can be shared by email or WhatsApp through a
secure property page—no landlord login required. CertNow keeps the property
history together and prompts you when a renewal is approaching; you decide
when to contact the landlord.
</p>

<p>
We’ve only recently launched and would genuinely value feedback from working
engineers. Would you be open to trying it on your next certificate? There’s no
card required to get started.
</p>

<p>
  <a
    href="https://certnow.uk/?utm_source=outreach&amp;utm_medium=email&amp;utm_campaign=engineer_launch&amp;utm_content=email_1"
    style="color:#123c34;font-weight:600;"
  >
    Take a look at CertNow
  </a>
</p>

<p style="font-size:12px;color:#777;line-height:1.5;">
  We found your business contact details from publicly available business sources.
  <a href="https://certnow.uk/legal/privacy#business-outreach" style="color:#777;">
    How we use business contact data
  </a>.
  Reply “no thanks” and we won’t contact you again.
</p>
```

Logo/signature HTML:

```html
<a href="https://certnow.uk" style="text-decoration:none;">
  <img
    src="https://certnow.uk/certnow-email-logo.png"
    width="150"
    alt="CertNow"
    style="display:block;width:150px;max-width:150px;height:auto;border:0;margin-top:12px;"
  >
</a>
```

Make does not automatically append the signature configured in the Gmail web
interface. Put the signature or logo in Make's Signature content field or in the
HTML body.

This block sits in the body of **both** emails, directly below the sign-off and
above the small-print privacy paragraph. The asset is served from
`public/certnow-email-logo.png` in this repo, so it ships with a normal deploy;
if the logo ever stops rendering, check that path is still deployed before
touching the scenarios.

Never paste the version Gmail shows you back into Make. Gmail rewrites the
markup it renders, so "copy the logo out of a received email" yields something
like:

```html
<img src="https://ci3.googleusercontent.com/meips/…#https://certnow.uk/certnow-email-logo.png"
     class="CToWUd" data-bit="iit">
```

plus a `data-saferedirecturl` wrapper on the anchor. Those are Gmail's caching
proxy and click-tracking artefacts, valid only inside that one mailbox. Sent to
a real recipient they point at a Google URL scoped to someone else's session,
so the image is liable to break for everyone but you — and it will still look
correct while you are testing in your own inbox, which is the trap. Always
author from the clean source above.

### Module 4: Airtable — Update Record (success)

```text
Record ID: original Search Records → top-level ID
Outreach status: Email 1 sent
Sequence step: 1
Last contacted: now
Next action: addDays(now; 5)
Gmail thread ID: Gmail Send an Email → Thread ID
Approved to send: unchecked
```

`Next action` must be an Airtable Date field with time enabled. Insert
`addDays(now; 5)` through Make's date/time function editor rather than as plain
text.

If Gmail fails after the reservation, leave the record in `Sending` for manual
review or set it to `Send failed`. Do not simply return it to Ready without
checking Gmail, because the message may already have been accepted.

---

## Scenario 3 — Detect replies

### Purpose

Watch the CertNow inbox, match each incoming Gmail thread to a lead, stop the
sequence, and log the reply.

### Module 1: Gmail — Watch Emails

Production Gmail query:

```text
in:inbox -from:me -from:kelvin@certnow.uk
```

Configuration:

```text
Mark as read: No
Content format: Full
Limit: 20
```

For a controlled test, temporarily narrow the sender:

```text
in:inbox from:YOUR_TEST_RECIPIENT_EMAIL
```

Watch Emails is stateful. Once it has returned a message, it will not return the
same message again. It is a polling trigger, not a live webhook.

For a new controlled test:

1. choose `Where to start → From now on`;
2. send a new reply from the recipient account;
3. wait until the reply appears in the CertNow inbox; and
4. run the complete scenario.

The reply should have a new Message ID and the same Thread ID as the original
outreach conversation.

### Module 2: Airtable — Search Records

TEST formula:

```text
AND(
  {Gmail thread ID}="{{Gmail Watch Emails → Thread ID}}",
  {Test record}=1,
  OR(
    {Outreach status}="Email 1 sent",
    {Outreach status}="Follow-up 1 sent"
  )
)
```

PROD formula:

```text
AND(
  {Gmail thread ID}="{{Gmail Watch Emails → Thread ID}}",
  {Test record}=0,
  OR(
    {Outreach status}="Email 1 sent",
    {Outreach status}="Follow-up 1 sent"
  )
)
```

Insert the Gmail Thread ID as a Make mapping pill. The resolved execution Input
should contain a real value, for example:

```text
AND(
  {Gmail thread ID}="19f9495394173b6e",
  {Test record}=1,
  OR(
    {Outreach status}="Email 1 sent",
    {Outreach status}="Follow-up 1 sent"
  )
)
```

Unrelated inbox messages should return zero Airtable bundles and stop safely.

### Module 3: Airtable — Update Record

```text
Record ID: Airtable Search Records → top-level ID
Outreach status: Replied
Reply category: Needs review
Replied at: now
Reply message ID: Gmail Watch Emails → Message ID
Reply text: Gmail Watch Emails → Snippet
Approved to send: unchecked
Next action: erase()
```

Do not overwrite `Sequence step` or `Last contacted`. They describe which email
received the reply and when the outbound contact occurred.

Schedule the PROD scenario every 15 minutes after the production smoke test.

### Manual reply review

Review each `Needs review` reply and classify it, for example:

```text
Interested
Question
Not now
Not interested
Unsubscribe
Out of office
Bounce
```

For “no thanks”, unsubscribe or any objection:

```text
Do not contact: checked
Approved to send: unchecked
Next action: blank
```

Keep the minimal record as a suppression entry rather than deleting it and
losing the objection.

---

## Scenario 4 — Five-day follow-up

### Purpose

Find initial emails whose Next action is due and whose status has not changed to
Replied, reply in the original Gmail thread, and stop after one follow-up.

### Module 1: Airtable — Search Records

TEST formula:

```text
AND(
  {Test record}=1,
  {Outreach status}="Email 1 sent",
  {Sequence step}=1,
  LEN(TRIM({Gmail thread ID}&""))>0,
  LEN(TRIM({Business email}&""))>0,
  NOT({Next action}=BLANK()),
  IS_BEFORE({Next action}, NOW()),
  {Do not contact}=0
)
```

PROD formula:

```text
AND(
  {Test record}=0,
  {Outreach status}="Email 1 sent",
  {Sequence step}=1,
  LEN(TRIM({Gmail thread ID}&""))>0,
  LEN(TRIM({Business email}&""))>0,
  NOT({Next action}=BLANK()),
  IS_BEFORE({Next action}, NOW()),
  {Do not contact}=0
)
```

Configuration:

```text
Sort: Next action ascending
Limit: 1 initially
```

Scenario 3 should run frequently enough that replies normally change the status
to Replied before Scenario 4 searches the queue.

### Filter: Required follow-up fields present

Add a filter on the connection between Airtable Search Records and Gmail. Name
it `Required follow-up fields present` and require all conditions:

```text
Airtable Search Records → Gmail thread ID: Exists
Airtable Search Records → Gmail thread ID: Is not equal to [blank]
Airtable Search Records → Business email: Exists
Airtable Search Records → Business email: Is not equal to [blank]
```

This is a second safety boundary in addition to the Airtable formula. It
prevents an empty search result or incomplete record from reaching Gmail and
causing:

```text
Missing value of required parameter 'threadId'
Missing value of required parameter 'to'
```

When no follow-up is due, the correct Airtable result is zero bundles. Gmail
must not run, and the scheduled execution should finish without sending or
raising an error.

### Module 2: Gmail — Reply to an Email

```text
Thread ID: Airtable Search Records → Gmail thread ID
Reply mode: Reply to specific recipients
Recipient: Airtable Search Records → Business email
From: "Kelvin from CertNow" <kelvin@certnow.uk>
Body type: Raw HTML
```

Use `Reply to specific recipients`. If the thread contains only the original
outbound email, `Reply to sender` may address the CertNow sender rather than the
lead.

Suggested follow-up:

```html
<p>Hi,</p>

<p>Just following up in case my earlier email got buried.</p>

<p>
CertNow helps gas engineers complete and share CP12s and boiler service records
while on site, while keeping property and appliance details ready for future visits.
</p>

<p>Would you be open to trying it on your next certificate?</p>

<p>
  <a
    href="https://certnow.uk/?utm_source=outreach&amp;utm_medium=email&amp;utm_campaign=engineer_launch&amp;utm_content=follow_up_1"
    style="color:#123c34;font-weight:600;"
  >
    Take a look at CertNow
  </a>
</p>

<p style="font-size:12px;color:#777;line-height:1.5;">
  We found your business contact details from publicly available business sources.
  <a href="https://certnow.uk/legal/privacy#business-outreach" style="color:#777;">
    How we use business contact data
  </a>.
  Reply “no thanks” and we won’t contact you again.
</p>
```

### Module 3: Airtable — Update Record

```text
Record ID: Airtable Search Records → top-level ID
Outreach status: Follow-up 1 sent
Sequence step: 2
Last contacted: now
Next action: erase()
Approved to send: unchecked
```

Do not clear or replace the Gmail Thread ID.

Schedule the PROD scenario once per weekday at approximately 10–11am UK time.
Start with limit `1`.

---

## Clean end-to-end TEST run

Run in this order:

```text
Scenario 2 initial email
    ↓
Scenario 4 follow-up
    ↓
Scenario 3 reply detection
```

Reply detection is tested last because replying to email 1 should correctly
prevent the follow-up.

### Prepare one isolated test record

Uncheck `Test record` on older test rows so only one record can match.

Create:

```text
Business_name: CertNow E2E Test YYYY-MM-DD
Business email: separate email controlled by the tester
Town: Bristol
Company type: Limited company
Company status: Active
Qualification status: Qualified
Email type: Generic business
Gas Safe verified: checked
Outreach status: Ready
Sequence step: 0
Test record: checked
Approved to send: checked
Do not contact: unchecked
Gmail thread ID: blank
Last contacted: blank
Next action: blank
Reply category: blank
```

### Test Scenario 2

Run the complete scenario, not Update Record alone.

Confirm:

```text
Email received
Outreach status = Email 1 sent
Sequence step = 1
Approved to send = unchecked
Gmail thread ID populated
Last contacted populated
Next action five days ahead
```

Do not reply.

### Test Scenario 4

Set `Next action` manually to at least 15 minutes in the past, then run the
complete scenario.

Confirm:

```text
Follow-up appears in the same Gmail conversation
Outreach status = Follow-up 1 sent
Sequence step = 2
Next action blank
Approved to send unchecked
```

### Test Scenario 3

1. Set Watch Emails to `From now on`.
2. Reply from the separate recipient account in the same conversation.
3. Wait until the reply is visible in the CertNow inbox.
4. Run the complete scenario.

Confirm:

```text
Gmail reply Thread ID matches Airtable
Airtable Search returns one rec... ID
Outreach status = Replied
Reply category = Needs review
Replied at / message ID / text populated
```

---

## Production smoke test

The smoke test exercises the exact PROD formulas without weakening them.

### Safety preparation

1. Turn off every PROD schedule.
2. Set all Search Records limits to `1`.
3. Uncheck `Approved to send` on every real lead.
4. Confirm the Live send queue contains no real businesses.

### Create the smoke-test record

```text
Business_name: CERTNOW PROD SMOKE TEST
Business email: separate personal recipient email
Town: Bristol
Company type: Limited company
Company status: Active
Qualification status: Qualified
Email type: Generic business
Gas Safe verified: checked
Approved to send: checked
Do not contact: unchecked
Test record: unchecked
Outreach status: Ready
Sequence step: 0
Gmail thread ID: blank
Last contacted: blank
Next action: blank
Reply category: blank
```

`Test record` is intentionally unchecked so the row passes the unmodified PROD
formulas. The clearly labelled smoke-test record must be the only row where
`Live send eligible = 1`.

Run PROD Scenario 2, then set `Next action` to yesterday and run PROD Scenario
4, then reply and run PROD Scenario 3.

After success:

```text
Test record: checked
Approved to send: unchecked
Next action: blank
```

Keep the row as test evidence. Once `Test record` is checked,
`Live send eligible` should become `0`.

---

## Production scheduling and operating routine

Recommended starting configuration:

| Scenario | Initial schedule | Limit |
|---|---|---:|
| 01 Discovery | Manual | 1 Location / 5 Places |
| 02 Initial outreach | Manual | 1 |
| 03 Reply detection | Every 15 minutes | 20 inbox messages |
| 04 Follow-up | Once per weekday, 10–11am UK | 1 |

Start Scenario 2 manually. Increase only after checking actual delivery,
replies, suppression handling and domain reputation.

### Current live configuration

As of 2026-08-15 all four scenarios are active and unattended:

| Scenario | Schedule (Make org TZ = Europe/Berlin) | UK time | Limit |
|---|---|---|---:|
| 01 Discovery | Daily 08:00 | 07:00 | 1 town / 5 Places |
| 02 Initial outreach | Weekly, Mon–Fri 11:00 | 10:00 | 3 |
| 03 Reply detection | Every 15 minutes | — | 20 |
| 04 Follow-up | Weekly, Mon–Fri 11:30 | 10:30 | 3 |

Make interprets the `time` field in the organisation timezone, which is
Europe/Berlin, not UK time. A schedule written as `10:00` fires at 09:00 UK.
Check `nextExec` after any schedule change to confirm the real firing time.

Scenario 2's limit of 3 means the search returns up to three bundles and the
reserve → send → record chain runs once per bundle, so the cap is three initial
emails per weekday. The daily ceiling is only ever reached if three leads are
actually approved and eligible; the approved queue, not the schedule, is the
binding constraint on volume.

Keep Scenario 4's limit equal to Scenario 2's. They were briefly 3 and 1, which
does not hold: three leads emailed on the same day all fall due on the same day,
and a follow-up limit of 1 drains that backlog one per weekday, so the second
and third contacts slip to six and nine days instead of five. The gap compounds
every day more leads are approved than can be followed up. Raise both together,
never one alone.

The worst case is bounded at six emails on a weekday — three initial at 10:00
and three follow-ups at 10:30 — which is still a low, consistent volume from a
single mailbox. Check delivery and reputation before going beyond that.

### Daily routine

1. Check Make execution errors.
2. Review `Needs review` replies.
3. Set `Do not contact` for objections.
4. Research and approve only a small number of new leads.
5. Confirm the live queue contains exactly the records expected.
6. Run Scenario 2 manually.
7. Check sent email, Airtable status and Next action.

### Weekly routine

1. Review bounced/failed sends.
2. Confirm no suppressed lead is eligible.
3. Review company status and source quality.
4. Check Gmail spam/delivery signals.
5. Review Google Places usage/cost.
6. Capture screenshots and outcome counts for the portfolio case study.

---

## Troubleshooting

### Airtable error: invalid formula (422)

Use exact Airtable formula syntax:

```text
{Search status}="Ready"
```

Common causes:

- curly quotation marks;
- missing equals sign;
- an extra leading equals sign;
- mistyped field name;
- Make mapping pill inserted where plain Airtable formula text is required; or
- the module is searching the wrong table.

Using a filtered Airtable view with Formula left blank avoids this class of
error.

### Update Record: missing required parameter `id`

This means Update Record received no Airtable record ID.

Check the preceding Search Records module:

- If Search returned zero bundles, fix the search condition. The Update error is
  only the downstream symptom.
- If Search returned a bundle, map its top-level `ID`, which starts with `rec`.
- Do not map `Lead_ID`, Google Place ID, Gmail Message ID or Gmail Thread ID.
- Do not run Update Record by itself; upstream mappings are empty in an isolated
  run.

Diagnostic formula for one known Airtable record:

```text
RECORD_ID()="recXXXXXXXXXXXXXX"
```

### Search Records returns zero reply matches

Compare:

```text
Gmail Watch output → Thread ID
Airtable lead → Gmail thread ID
```

They must match character for character.

Also check:

- `Test record` matches the TEST/PROD formula;
- the status is exactly `Email 1 sent` or `Follow-up 1 sent`;
- the reply is in the same Gmail conversation; and
- the Gmail Thread ID stored by Scenario 2 belongs to the latest initial email.

### Watch Emails returned a newsletter or an outgoing email

Use:

```text
in:inbox -from:me -from:kelvin@certnow.uk
```

For testing, use an exact recipient sender filter.

Unrelated incoming messages are harmless when Airtable finds no matching thread.

### Watch Emails returned a reply once, then nothing

That is expected. Watch Emails is stateful and will not emit the same message
twice. Send a new reply in the same conversation to generate a new Message ID.

### Search/Watch Gmail finds nothing despite the reply being visible

1. Confirm the module is the first module, not downstream of an inactive
   trigger.
2. Confirm the exact Gmail account connection.
3. Test a blank Gmail Search Emails module with:

   ```text
   Folder: Inbox
   Criteria: All emails
   Limit: 50
   ```

4. Re-authorise or recreate the Gmail connection if the blank search returns
   nothing.

### Airtable error: `Field "Sequence step" cannot accept the provided value`

The single most damaging failure mode this system has had. It is a type error,
not a value error, and it fails **after** Gmail has already sent.

`Sequence step` is a Number field. If the Make mapper supplies the value as a
quoted string and the module has **Smart links (typecast) off**, Airtable
rejects the whole update with a 422:

```text
"fldpAFSX6cLDi3Z9n": "1"     ← string, rejected
"fldpAFSX6cLDi3Z9n": 1       ← number, accepted
```

Both send scenarios shipped with this defect and both were repaired on
2026-08-15 by writing the value as a number and enabling typecast on the
module.

Why it matters more than an ordinary error:

- In **Scenario 2** the failing module is the final one, so the email is sent
  and nothing is recorded. The record is left parked at `Sending` with approval
  already consumed by the reservation step. No thread ID is stored, so a reply
  can never be matched and no follow-up can ever fire. This is fail-closed —
  it does not re-send — but the contact is invisible to the rest of the system.
- In **Scenario 4** it is worse. The failed update never clears `Next action`
  and never advances the status past `Email 1 sent`, so the record still
  matches the follow-up search on the next run. Left scheduled, that sends the
  same business a follow-up **every single day**.

Symptoms to check for:

```text
AND({Outreach status}="Sending", {Gmail thread ID}="")
```

Any record matching that was probably emailed. Confirm against the Gmail Sent
folder before deciding what to do with it — the Airtable record cannot tell
you, because the write that would have told you is the one that failed.

An execution that fails this way still bills the Gmail operation. A four
operation run on Scenario 2 that ends in an Airtable error means all four
modules ran, including the send. Compare against a clean run in the execution
list before assuming nothing went out.

### A lead reads `Ready` but has a thread ID and `Sequence step` 1

The same stranding described above, seen from the data side. The record was
emailed but its status was never advanced. Scenario 4 matches only
`Email 1 sent`, so no follow-up fires however overdue `Next action` is, and
Scenario 2 skips it because `Gmail thread ID` is not empty. The lead is inert.

Repair by setting the status to `Email 1 sent` and clearing `Next action` in
the same edit, which records the true state without arming a surprise
follow-up. Uncheck `Approved to send`, since the approval was already spent.
Re-arm the follow-up deliberately, by setting a fresh `Next action`, only if
the contact is still worth pursuing.

### `Next action` remains blank after email 1

Open Scenario 2's successful-send Airtable module and map:

```text
Next action: addDays(now; 5)
```

Refresh the Airtable fields if `Next action` was created after the module. Check
the module execution Input: if `Next action` is absent, it was not mapped.

### Follow-up was not recognised as reply-eligible

Use the exact shared status:

```text
Follow-up 1 sent
```

Every scenario and Airtable option must use the same spelling.

### Follow-up addresses the CertNow sender

In Gmail Reply to an Email, select:

```text
Reply mode: Reply to specific recipients
Recipient: Airtable → Business email
```

Do not use Reply to sender for a thread that contains only the original outbound
email.

### Follow-up fails with missing `threadId` and `to`

This means Gmail received no usable Airtable follow-up record, or its fields are
mapped from the wrong module.

1. Open the failed execution and inspect Airtable Search Records.
2. If it returned zero bundles, no follow-up was due; confirm the
   `Required follow-up fields present` filter is installed before Gmail.
3. If it returned one bundle, confirm that bundle contains both `Business
   email` and `Gmail thread ID`.
4. In Gmail Reply to an Email, remap both values from the immediately preceding
   Airtable Search Records module:

   ```text
   Thread ID: Airtable Search Records → Gmail thread ID
   Recipient: Airtable Search Records → Business email
   ```

5. Run Airtable Search Records first. Do not test the Gmail reply module by
   itself because it will not have the mapped upstream values.

The validation failure happens before Gmail sends, so it does not represent a
partially sent follow-up.

### A lead was emailed but its status reads `New`

Scenario 2 never writes `New`. If a record has a `Gmail thread ID` and a
`Last contacted` timestamp but an `Outreach status` of `New`, the status was
changed after the send — by a manual edit or a re-import that overwrote the
column.

The record is stranded: Scenario 4 matches only `Email 1 sent`, so no follow-up
will ever fire, however overdue `Next action` is.

Diagnose across the whole table with:

```text
AND({Gmail thread ID}!="", {Outreach status}="New")
```

Before correcting the status to `Email 1 sent`, decide what should happen to the
follow-up. Setting the status makes the record immediately eligible for Scenario
4, which will send a real email on its next run. To record the true state
without sending, set the status and clear `Next action` in the same edit.

Also confirm the lead should have been contacted at all. A record emailed while
`Qualification status` is anything other than `Qualified` means the approval gate
was bypassed, which is a compliance problem, not just a data problem.

### Known manual cleanup

These cannot be changed through the Airtable API and need the UI:

- The `Outreach status` option `Send failed ` has a **trailing space**. Any
  formula matching `="Send failed"` will silently never match it. Rename it.
- A CSV header row was once imported as a record. Deleting the record does not
  remove the select options it created. Six fields still carry a junk option
  named after the field itself: `Company type`, `Company status`,
  `Qualification status`, `Email type`, `Outreach status`, `Reply category`.
- `Company type` has both `Partnership` and `Non-corporate partnership`. Only
  the latter is referenced here. Merge them.
- Scenarios 2 and 4 use two different Gmail connections for the same mailbox
  (`My Gmail connection` and `certnow inbox`). Re-authorising one leaves the
  other stale. Consolidate onto one.

---

## Privacy, compliance and deliverability boundary

This runbook documents operational safeguards and is not legal advice.

Before live outreach:

- publish and link
  [CertNow's privacy notice](https://certnow.uk/legal/privacy#business-outreach);
- identify CertNow and use a working reply address;
- include the simple “reply no thanks” opt-out in both emails;
- restrict unsolicited outreach to verified eligible corporate businesses;
- never email a `Do not contact` record;
- retain minimal suppression data instead of deleting objections;
- verify SPF, DKIM and preferably DMARC for `certnow.uk`; and
- start with a low, consistent volume rather than a burst.

Current ICO guidance distinguishes corporate subscribers from sole traders and
certain partnerships, which PECR treats like individuals. Publicly available
business contact data may still be personal data, so transparency, lawful-basis,
objection and suppression requirements can apply.

References:

- [ICO: Business-to-business marketing](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/)
- [ICO: Right to be informed](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/)
- [Google: Email sender guidelines](https://support.google.com/mail/answer/81126)
- [Google Places: Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search)
- [Make: Gmail connection](https://apps.make.com/google-email)
- [Make: Gmail modules](https://apps.make.com/gmail-modules)
- [Make: Airtable modules](https://apps.make.com/airtable-modules)

---

## Reproducing this system for another client

1. Duplicate the Airtable base or recreate the two tables and views above.
2. Replace the business niche and locations.
3. Create a new Google Places project/key with billing controls.
4. Connect the client's Airtable and Gmail accounts in Make.
5. Build Scenario 1 and prove deduplication.
6. Define the client's legal eligibility and manual approval rules.
7. Replace the sender identity, domain, privacy URL and email copy.
8. Build TEST copies of Scenarios 2–4.
9. Complete the clean end-to-end test.
10. Duplicate TEST scenarios into PROD and replace only the TEST formulas.
11. Complete one production smoke test with an address controlled by the client.
12. Enable reply detection first, follow-up second and initial sending last.
13. Start at limit `1` and document every production change.

The reusable pattern is:

```text
Source → deduplicate → enrich → qualify → approve → send
       → wait by stored due date → detect reply → follow up once → suppress/log
```

---

## Portfolio description

Use an accurate description:

> Built a human-in-the-loop B2B outreach system in Airtable and Make that
> discovers and deduplicates local prospects, requires corporate verification
> and explicit approval, sends a controlled two-step Gmail sequence, matches
> replies by thread ID, cancels follow-ups on response, maintains suppression,
> and logs the full outreach state.

Do not claim that the system automatically finds email addresses or that it
generated signups, replies or revenue unless those results actually occurred.
The working scenarios, execution logs, smoke test, safeguards and documentation
are sufficient for an initial portfolio case study.
