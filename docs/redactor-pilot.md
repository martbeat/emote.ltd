# Redaction review pilot

Version 2.0.0-pilot.1 replaces the automatic replacement workflow with a single-document review and clean export workflow. It is an evaluation prototype, not an approved legal disclosure system. Keep the original document unchanged.

## Supported scope

- Plain pasted text and standard UTF-8 transitional DOCX packages.
- Paragraph text, tabs, line breaks, headers, footers, footnotes and endnotes. Tables are flattened in cell order and explicitly flagged.
- Suggestions for email, UK phone, postcode and National Insurance patterns. These are incomplete heuristics, not a privacy or privilege classifier. Names and context need manual review or exact-phrase search.
- Individual or explicitly selected batch decisions with recorded reasons. A user can mark arbitrary passages and remove or revise decisions.
- A new minimal DOCX and UTF-8 text export. Original metadata, relationships, comments, custom XML and other original package entries are never copied.
- An internal JSON decision record with tool version, source/output SHA-256 values, decision offsets, reasons, declared reviewer names and export time. Offsets refer to UTF-16 positions in the reconstructed source text. It is a snapshot, not a tamper-proof event history or authenticated signature. Original filenames and source passages are excluded; reasons and case references can still contain sensitive information.

## Important limitations

Word layout, pagination, automatic list numbering and table structure are not retained. Text reconstruction may be unsuitable where evidence must preserve its appearance or location. Comments and custom XML are omitted with explicit warnings; compare the complete original to establish whether omissions affect the scope of disclosure. Pasted text cannot be checked for content omitted during copying.

Images, embedded/active content, tracked changes, fields, equations, content controls, directly hidden text, hidden settings in the standard styles part and nonstandard text part locations are rejected. A rejection is not permission to delete evidence from the original. Use an approved application and an agreed handling route. Legacy DOC, macro-enabled formats, encrypted packages, ZIP64 and unfamiliar ZIP compression methods are unsupported.

The importer is deliberately conservative, but is not a complete OOXML validator. Representative production documents need interoperability and completeness tests, particularly complex templates, international text, tables, headers and notes. Check generated files in supported Microsoft Word versions before accepting this pilot.

The reviewer/checker fields are declarations. This static application has no sign-in, role separation, enforced second-person approval, secure case store, session recovery, immutable audit log or case-management integration. Refreshing or closing the tab loses the review. This is a material limitation for long-running work.

## Export controls

Every suggestion must be decided and have a reason. The user must provide a case reference, different reviewer/checker names and complete the three declarations. Changing decisions, reviewer details or source invalidates the checks. Export operates on a snapshot and aborts if the revision or declarations change while it is being built.

Each DOCX export is reopened, restricted to three known generated entries and its text reconstructed for exact comparison with the reviewed output. A zero residual pattern count does not establish that all sensitive content was found. Keeping an identifier is allowed when the reviewer records the reason. Downloaded files can subsequently be changed outside these controls.

## Local processing and hosting

There are no runtime third-party libraries, document upload endpoints, analytics calls or persistent browser storage. Source content is processed in the tab. CSP disallows connections, images, frames/objects and form submission; scripts and styles load from this site's own origin. This is not a defence against a compromised hosting origin, device or browser extension. Host only on an approved HTTPS origin for an authorised trial. Server access logs can record page visits, not document contents sent by this application.

Limits: 12 MB input archive, 32 MB expanded ZIP data, 1,000 entries, 350,000 characters and 5,000 decisions. Resource limits reduce accidental overload but do not constitute a security audit. The custom ZIP reader needs independent security review before operational deployment.

## Validation

Core tests:

```sh
node --test tests/redactor-core.test.mjs
```

Browser integration tests require Playwright and Chromium, plus a local HTTP server serving the repository at port 8765:

```sh
python -m http.server 8765
# In a second terminal:
node tests/redactor-browser.cjs
```

Optional environment variables: `PLAYWRIGHT_MODULE` for a nonstandard Playwright installation and `CHROMIUM_EXECUTABLE` for an installed Chromium binary. Test downloads and screenshots go to the operating system temporary directory.

The tests exercise review decisions, download gates, output hashes, stale state invalidation, raw source replacement, unsupported Word content, split runs, header extraction, excluded-comment warnings, corrupt imports, reimport and mobile width. Test cases use synthetic information. They do not establish complete detection, Microsoft Word interoperability, accessibility conformance or organisational approval.

## Evaluation before an operational decision

Use a service-agreed set of synthetic or authorised documents with expected withheld passages and expected retained content. Measure total staff time including import, decision-making, checking, corrections and final export. Record false negatives, unnecessary redactions, unsupported documents and lost context as well as time saved. Compare like-for-like cases against the existing process or selected product.

Service owners should decide whether text reconstruction is acceptable, which legal bases and review procedures apply and how cases and decision records will be retained. Security, accessibility, Microsoft Word interoperability, independent review controls, deployment ownership and ongoing support remain acceptance work. This prototype does not replace those decisions or an existing procurement.

Reference: [ICO guidance on disclosing documents securely](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/security/disclosing-documents-to-the-public-securely/) (checked 13 October 2026). This reference is design context, not a claim of compliance or certification.
