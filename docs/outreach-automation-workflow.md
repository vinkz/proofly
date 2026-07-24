# CertNow Lead Outreach Automation

## Purpose

This workflow discovers relevant gas-engineering businesses, stores them in
Airtable, requires a human qualification decision, sends only approved outreach,
follows up once, and records the result.

The workflow is deliberately human-in-the-loop. Make automates repetitive work;
it does not decide whether an unknown business should receive an email.

## Recommended build order

1. Finish and verify lead discovery.
2. Define the qualification and approval process.
3. Qualify a small set of test leads.
4. Write and approve the initial and follow-up email copy.
5. Connect Gmail and test exclusively with addresses owned by the tester.
6. Build the approved-lead sending scenario.
7. Build reply detection and follow-up cancellation.
8. Run a very small, manually approved live batch.

Do not finish the live Gmail sending workflow before the qualification gate is
working. A Gmail connection can be created earlier, but the sending scenario
must remain inactive.

## End-to-end flow

```text
Locations queue
    ↓
Google Places discovery
    ↓
Deduplicate by Google Place ID
    ↓
Human research and qualification
    ├── Rejected → record reason; never send
    └── Qualified corporate subscriber
            ↓
        Manual approval
            ↓
        Initial email
            ↓
        Wait five days
            ├── Reply found → classify and stop
            └── No reply → one follow-up
                              ↓
                         Log final outcome
```

## Locations table

| Field | Owner | Rule |
|---|---|---|
| `Town` | CSV/manual | The town, city, borough, or metropolitan district to search. |
| `Region` | CSV/manual | Used to disambiguate names such as Richmond or Sutton. |
| `Postcode area` | CSV/manual | Search/reporting metadata; it is not an exact administrative boundary. |
| `Search status` | Manual initially; Make later | `Ready`, `Complete`, or `Error`. |
| `Last searched` | Make later | Set after a successful discovery run. |
| `Results found` | Make later | Number of Places results returned. |

The discovery scenario searches only:

```text
{Search status}="Ready"
```

Keep the Airtable `Search Records` limit at `1` while testing. Until completion
updates are automated, manually change each successfully processed location to
`Complete`.

## Leads table: field ownership

### Populated by discovery

| Field | Source |
|---|---|
| `Business name` | Google Places `displayName.text` |
| `Google Place ID` | Google Places `id`; deduplication key |
| `Google Maps URL` | Google Places `googleMapsUri` |
| `Address` | Google Places `formattedAddress` |
| `Town` | Locations record |
| `Region` | Locations record |
| `Postcode area` | Locations record |
| `Lead source` | Fixed value: `Google Places` |

Discovery must not change approval, outreach, reply, or suppression fields when
an existing lead is rediscovered.

### Completed during human review

| Field | Required? | Rule |
|---|---:|---|
| `Website` | Yes | Official business website, verified manually. |
| `Email` | Yes | Public business contact address from the official website. |
| `Company type` | Yes | Verified legal structure used to distinguish corporate from individual subscribers. |
| `Qualification status` | Yes | `New`, `Researching`, `Qualified`, or `Rejected`. |
| `Qualification evidence` | Recommended | One factual sentence explaining product fit and the source checked. |
| `Personalisation` | Yes before approval | One truthful, email-ready observation. |
| `Gas Safe number` | Optional | Record only if independently verified. |
| `Rejection reason` | Required when rejected | Why the lead is unsuitable or unsafe to contact. |
| `Approved to send` | Yes | Final human-controlled sending gate. |
| `Do not contact` | As needed | Permanent suppression; automation must never clear it. |

Use the existing `Company type` single-select field with:

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

The reviewer must not infer that a business is a limited company merely because
it has a website. Verify the legal form through the business website, Companies
House, or another reliable source.

Only `Limited company`, `PLC`, `LLP`, `Scottish partnership`, and
`Corporate/public body` are eligible for the live automated-email queue.
`Sole trader`, `Non-corporate partnership`, and `Unknown` remain blocked.

### Populated by outreach automation

| Field | Rule |
|---|---|
| `Outreach status` | `Not started`, `Queued`, `Sent`, `Follow-up due`, `Replied`, `No response`, `Bounced`, or `Suppressed`. |
| `Sequence step` | `0`, `1`, or `2`. |
| `Last contacted` | Timestamp written after Gmail confirms a send. |
| `Next action` | Follow-up date or a terminal result. |
| `Gmail thread ID` | Gmail thread identifier used for reply matching. |

### Populated by reply handling

| Field | Rule |
|---|---|
| `Reply category` | `Positive`, `Question`, `Not now`, `Not interested`, `Unsubscribe`, `Out of office`, or `Bounce`. |
| `Do not contact` | Set immediately for unsubscribe or explicit objection. |
| `Next action` | Cleared when a genuine reply, objection, or bounce stops the sequence. |

Reply classification can begin as a human decision. AI classification is an
optional later enhancement and must not be allowed to override suppression.

## Qualification examples

Suitable evidence:

```text
Official website lists landlord gas-safety certificates and boiler servicing
in Bristol. Corporate identity and public business email verified.
```

Suitable personalisation:

```text
I noticed you provide landlord gas-safety checks across Bristol and Bath.
```

Reject a lead when it is unrelated, outside the target market, duplicated,
closed, lacks a verifiable business identity, is a sole trader/individual for
unsolicited email purposes, has previously objected, or is otherwise unsafe to
contact.

## Readiness score

Use an Airtable Formula field called `Readiness score`; do not score it manually:

```text
IF(
  {Do not contact},
  0,
  IF({Qualification status}="Qualified", 1, 0) +
  IF(
    OR(
      {Company type}="Limited company",
      {Company type}="PLC",
      {Company type}="LLP",
      {Company type}="Scottish partnership",
      {Company type}="Corporate/public body"
    ),
    1,
    0
  ) +
  IF({Email}!="", 1, 0) +
  IF({Qualification evidence}!="", 1, 0) +
  IF({Personalisation}!="", 1, 0)
)
```

A score of `5` means the record is ready for a human approval decision. It does
not authorise sending.

## Hard sending gate

The Gmail scenario must search only records matching:

```text
AND(
  {Qualification status}="Qualified",
  OR(
    {Company type}="Limited company",
    {Company type}="PLC",
    {Company type}="LLP",
    {Company type}="Scottish partnership",
    {Company type}="Corporate/public body"
  ),
  {Approved to send}=1,
  {Do not contact}=0,
  {Email}!="",
  {Personalisation}!="",
  {Outreach status}="Not started"
)
```

For test runs, use a separate test-only filter:

```text
AND(
  {Test record}=1,
  {Approved to send}=1,
  {Do not contact}=0,
  {Email}!=""
)
```

Use only email addresses controlled by the tester. Test records may keep
`Company type = Unknown`; the test filter must never be used for a live run.
Before any live run, remove test addresses from the queue and change the filter
deliberately. Never select every Airtable record as the source for a Gmail send.

## Gmail implementation order

### Scenario 2: initial email

1. Airtable `Search Records` using the hard sending gate.
2. Limit to one record during testing.
3. Gmail `Send an Email`.
4. Only after a successful send, update:
   - `Outreach status = Sent`
   - `Sequence step = 1`
   - `Last contacted = now`
   - `Next action = addDays(now; 5)`
   - `Gmail thread ID = returned thread ID`

### Scenario 3: replies and follow-up

Run reply detection before follow-up sending:

1. Search/watch Gmail for replies belonging to stored threads.
2. If a genuine reply exists, set `Outreach status = Replied`, classify it,
   clear `Next action`, and stop.
3. If the reply is an objection or unsubscribe, set `Do not contact`.
4. Only when no reply exists and `Next action` is due, send one follow-up in the
   existing thread.
5. Set `Sequence step = 2` and do not send further automated emails.

Do not implement a five-day blocking sleep inside one scenario. Store
`Next action` in Airtable and run a scheduled follow-up scenario.

## Test checklist

- Discovery returns the expected town or borough.
- Re-running discovery does not create duplicate Place IDs.
- Rediscovery does not reset qualification or suppression.
- An unapproved record cannot reach Gmail.
- A sole-trader or unknown subscriber cannot reach Gmail.
- A `Do not contact` record cannot reach Gmail.
- A test send reaches only an address controlled by the tester.
- Airtable updates only after Gmail confirms the send.
- A reply prevents the follow-up.
- An unsubscribe sets permanent suppression.
- A failed or bounced send does not appear as a successful outreach result.

## Compliance boundary

This is an operational safeguard, not legal advice. Current ICO guidance
distinguishes corporate subscribers from sole traders and certain partnerships,
which PECR treats like individuals. Publicly available business contact data may
still be personal data, so UK GDPR, transparency, lawful-basis, objection, and
suppression requirements can apply.

Every live email must identify CertNow, explain why the recipient is receiving
the message, provide a valid and simple opt-out method, and link to appropriate
privacy information. Maintain the `Do not contact` list rather than deleting
opted-out records.

References:

- [ICO: Business-to-business marketing](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/)
- [ICO: Electronic mail marketing](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/)
- [Make: Gmail connection](https://apps.make.com/google-email)
- [Make: Gmail modules](https://apps.make.com/gmail-modules)

## Portfolio description

Use an accurate description:

> Built a human-in-the-loop B2B outreach system that discovers and deduplicates
> local prospects, calculates outreach readiness, requires explicit approval,
> sends a controlled two-step Gmail sequence, stops on replies or objections,
> and logs outcomes in Airtable.

Do not claim signup, reply, or conversion results that have not occurred. The
working system, test evidence, safeguards, and execution logs are sufficient for
the initial portfolio case study.
