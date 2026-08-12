# OnlyParts — DPDP Act 2023 Compliance

**Version:** 1.0
**Status:** Engineering requirements, not legal advice. A lawyer must review the
consent notices, the privacy policy and the retention schedule before launch.

---

## 1. Why this is an engineering document

India's Digital Personal Data Protection Act 2023 changed the economics of
getting privacy wrong. Penalties are **per violation, with no cap tied to
revenue** — a single incident can exceed the lifetime profit of an early-stage
retailer.

| Violation | Maximum penalty |
|---|---|
| Failure to implement reasonable security safeguards, leading to a breach | **₹250 crore** |
| Failure to notify the Data Protection Board and affected users | **₹200 crore** |
| Violations involving children's data | **₹200 crore** |
| Breach of other obligations | ₹50 crore |

These are numbers that end companies. Every control below exists to reduce the
probability or the blast radius of one of them.

---

## 2. Our position

OnlyParts is a **Data Fiduciary**: we determine the purpose and means of
processing personal data — names, phone numbers, delivery addresses, GSTINs,
purchase history, RFQ files.

The Act requires consent that is **free, specific, informed and unambiguous**, or
a defined legitimate use. Burying broad data collection inside a Terms of Service
nobody reads is no longer a defence.

### 2.1 Lawful basis per data type

| Data | Basis | Notes |
|---|---|---|
| Name, phone, address | Legitimate use — order fulfilment | No separate consent needed to ship what was ordered |
| Email | Legitimate use (transactional) | **Marketing needs separate, opt-in consent** |
| GSTIN, company | Legitimate use — statutory invoicing | |
| Payment data | Never stored by us | Razorpay hosted; we hold only their reference IDs |
| Browsing/analytics | **Consent** | Non-essential; must be declinable and off by default |
| WhatsApp messaging | **Consent**, captured at checkout | Separately revocable |
| RFQ files | Legitimate use — quoting | NDA flag raises the handling standard |

**Consent is granular and separately revocable.** One checkbox covering
"marketing, analytics and WhatsApp" is exactly what the Act prohibits.

---

## 3. Security safeguards

The ₹250 crore exposure attaches to *failure to implement reasonable security
safeguards*. These are the safeguards.

### 3.1 Encryption

- **At rest:** RDS PostgreSQL with **AES-256** (KMS-managed). S3 buckets with
  SSE-KMS. Automated backups and snapshots encrypted with the same keys.
- **Column-level:** phone and GSTIN encrypted at the application layer *in
  addition* to disk encryption, so a leaked backup or a compromised read replica
  still does not yield a usable contact list.
- **In transit:** TLS 1.3 at Cloudflare, TLS between app and RDS enforced, no
  plaintext internal hops.

Disk encryption alone protects against a stolen disk. Column encryption protects
against the realistic threat: a leaked dump.

### 3.2 Access control

- Role-based access per `14-ADMIN-CATALOG-OPS.md` §2.1, enforced in Payload
  access functions — not in the UI, where it can be bypassed by hitting the API.
- **`support` can read one order at a time and cannot export the user table.**
  Bulk customer export is the single highest-risk action in the system; it is
  restricted to `admin`, rate-limited, and every invocation is alerted, not just
  logged.
- **MFA mandatory** on all admin roles.
- Admin panel behind Cloudflare Access (SSO) *and* application RBAC — two
  independent gates, so a single failure is not a breach.
- Database credentials in AWS Secrets Manager, rotated quarterly. No production
  credentials on any developer machine.

### 3.3 Data minimisation

Coded in, not aspirational:

- Registration asks for name, email or phone, and password. Nothing else.
- Date of birth, gender and demographics are **not collected** — we have no
  purpose for them, and unneeded data is pure liability.
- Address is collected at checkout, not at signup.
- Analytics is self-hosted (PostHog) with IP anonymisation; no third-party
  behavioural trackers, no ad pixels by default.
- Logs redact PII by default; a Pino serialiser strips `phone`, `email`,
  `gstin`, `address` before anything is written.

### 3.4 Children's data

The ₹200 crore children's-data penalty is a real risk for a hobby-electronics
retailer with student customers. Position: **we do not knowingly serve under-18s
as account holders.** Registration states 18+, no age-gated marketing, no
behavioural profiling of any user, and no targeted advertising to anyone. If we
ever learn an account holder is a minor, it is deactivated and the data purged.

---

## 4. Breach response — the 72-hour clock

Failure to notify carries ₹200 crore. The clock is short and starts at
*awareness*, so detection and the runbook matter as much as prevention.

```
T+0      Detect (alert, report, or discovery)
T+1h     Contain — revoke credentials, isolate, snapshot for forensics
T+4h     Assess — what data, how many people, what risk
T+24h    Draft notification to the Data Protection Board of India
T+72h    NOTIFY DPBI and every affected Data Principal — hard deadline
Ongoing  Remediate, document, post-incident review
```

Required in advance, not improvised on the day: an incident commander named and
deputised, the DPBI notification template pre-drafted, a user-notification
template pre-drafted, and a legal contact on retainer. `docs/runbooks/breach.md`
holds the operational detail.

Detection controls: CloudTrail on all admin API calls, alerts on bulk export /
mass deletion / privilege change, anomaly alerting on data-egress volume, and
quarterly restore drills that also prove the backups are intact.

---

## 5. Data Principal rights

Each is an endpoint, not a support-ticket workflow.

| Right | Implementation | SLA |
|---|---|---|
| Access / portability | `POST /account/export` → JSON + CSV archive, emailed as a signed 24-hour link | 7 days |
| Correction | Editable in the account area | Immediate |
| Erasure | `POST /account/delete` → queued anonymisation | 30 days |
| Grievance | Named Grievance Officer, published contact, tracked queue | 30 days |
| Consent withdrawal | Per-purpose toggles in the account area | Immediate |

**Erasure has a statutory conflict, and the resolution must be deliberate.** GST
records must be retained for 8 years; the customer has a right to erasure. We
resolve it by **anonymising rather than deleting**: personal identifiers are
replaced with a pseudonymous ID, while the financial record — amounts, HSN, tax,
invoice number — is retained intact for audit. The invoice remains valid; the
person is no longer identifiable from it.

---

## 6. Retention schedule

Enforced by a scheduled job, not by intention.

| Data | Retention | Then |
|---|---|---|
| Orders, invoices, GST records | 8 years (statutory) | Anonymise if erasure requested |
| Abandoned carts | 30 days | Delete |
| Guest sessions | 90 days | Delete |
| Search query logs | 12 months | Aggregate, drop identifiers |
| RFQ files — no job won | 24 months | Delete from S3 |
| RFQ files — job won | 7 years | Retain (contractual) |
| Deleted accounts | 30 days | Anonymise |
| Audit log | 3 years | Archive |
| Application logs | 90 days | Delete |
| Backups | 30 days rolling | Expire |

The nightly `retention` job runs every rule, writes what it did to the audit log,
and alerts if it processes zero rows — silence usually means the job is broken,
not that there was nothing to do.

---

## 7. Third parties

Each processor needs a data-processing agreement and a named purpose.

| Processor | Data shared | Location |
|---|---|---|
| Razorpay | Name, email, phone, amount | India |
| Shiprocket / Delhivery | Name, address, phone | India |
| AWS (ap-south-1) | All hosted data | India |
| MSG91 | Phone, message content | India |
| AWS SES | Email, message content | India |
| PostHog (self-hosted) | Anonymised behaviour | Our infrastructure |

**Everything stays in India.** Not currently mandated for all data, but it
removes the cross-border transfer question entirely and it is far cheaper to
build that way from the start than to migrate later.

---

## 8. Pre-launch checklist

- [ ] Consent notice at every collection point, plain language, granular
- [ ] Privacy policy reviewed by counsel
- [ ] Grievance Officer appointed and contact published
- [ ] RDS + S3 encryption verified, not assumed
- [ ] Column-level encryption on phone and GSTIN
- [ ] MFA enforced on every admin account
- [ ] `support` role verified unable to export users
- [ ] Export and delete endpoints working end to end
- [ ] Retention job running and audited
- [ ] Breach runbook written; templates pre-drafted; owner named
- [ ] DPAs signed with all six processors
- [ ] Log redaction verified on a real production-shaped payload
- [ ] Cookie/analytics consent defaults to **off**
- [ ] Restore drill completed

---

## 9. Standing cadence

| When | What |
|---|---|
| Quarterly | Access review — who has admin, is it still justified |
| Quarterly | Secret rotation |
| Monthly | Restore drill |
| Monthly | Retention job audit |
| Annually | Penetration test |
| Annually | Privacy policy and DPA review |
| On change | Reassess whenever a new data type or processor is added |
