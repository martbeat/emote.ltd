# Redaction review pilot

## Required original layout preservation

Requirement confirmed 13 October 2026: the original Word layout must be preserved. Text reconstruction is therefore unacceptable for Word-source release copies. This build allows Word-source review for evaluation but blocks every prepared export from that source, even if the review declarations are complete. Pasted-text evaluation exports remain available. No layout-preserving engine has been implemented yet.

Acceptance requires the same page count, page size, orientation, margins, section breaks, table geometry, numbering, headers, footers and positions of retained content as the checked original, with differences confined to approved redaction areas. Required withheld content must also be absent from text extraction, metadata, links, comments, attachments and other recoverable representations. Equal-length replacement strings alone do not satisfy page-layout preservation because glyph widths and line wrapping can change.

Output decision confirmed 13 October 2026: a fixed-page PDF release copy is acceptable. The working review must stay revisable so missing redactions can be added and a new release copy produced from the unchanged original. PDF output is not implemented yet. A PDF route needs an approved Word rendering step, reviewer comparison with the original page appearance, true removal of redacted content and package sanitisation. A native DOCX route needs structural preservation plus rendering/comparison in the target Word environment. Neither route may treat black overlays over retained source text as redaction.

Both draft implementations originally reconstructed text. PR 479 is the continuing review implementation; PR 478 is an alternative earlier draft, not a layout-preserving solution.


This change replaces the previous automatic DOCX rewriting page with a human review workflow. It is an evaluation build, not an approved legal disclosure product. Use synthetic or service-authorised test data until assurance is complete. The production deployment is not changed by creating this branch or pull request.

## Existing evaluation functionality

- DOCX and pasted text are processed in browser memory. There are no document upload endpoints, AI requests, analytics, external scripts or persistent session storage in this page. Its Content Security Policy disables connections.
- Pattern suggestions cover email addresses, UK telephone numbers, UK postcodes and National Insurance numbers. They remain pending until a reviewer decides. Names, addresses, privilege and indirect identification require human judgement.
- Literal search, case matching and selected passages support additional decisions. A larger passage replaces decisions fully enclosed by it and resets their review. Partial overlaps are skipped. Removing decisions restores any uncovered automatic suggestions.
- Every final decision requires a reason. Group redaction is limited to the pending decisions on the displayed page and requires confirmation of the count and common reason.
- Source and release text are displayed together. Exports require a case reference, two different self-declared reviewer names and three review declarations. These are process prompts, not identity verification or authenticated approval.
- Source or review changes invalidate prepared exports. Asynchronous imports and export preparation use generation/revision guards so obsolete results cannot become current.
- DOCX exports are created from scratch with only three package entries: content types, the root relationship and the reviewed document text. Original attachments, metadata, comments, relationship targets and custom XML are never copied into the new package.
- Each Word export is reopened, its ZIP integrity checked and its paragraph/tab text compared with the exact preview before enabling downloads.
- A separate JSON decision record contains source and output SHA-256 hashes, extracted-text offsets, reviewer declarations and final decisions. It excludes matched excerpts and original filenames. Reasons and reviewer details may still be sensitive. This record is mutable and is not an append-only audit trail or digital signature.

## Supported content and boundaries

The pilot reads standard transitional DOCX main-body text, headers, footers, footnotes and endnotes. Split text runs are joined within paragraphs. Tables are flattened in cell/paragraph order with a prominent warning. Headers, footers and notes become labelled text sections.

Text reconstruction does not preserve layout, pagination, fonts, numbering, cross-references or table structure. A service must decide whether that is acceptable for each test case. This is not suitable for court bundles that must preserve document appearance or page references. The original must be retained separately.

Import blocks detected images, embedded files, charts, diagrams, active content, tracked changes, fields, equations, content controls, hidden-text settings and nonstandard locations for the supported Word text parts. PDF, OCR, legacy DOC, encrypted Office files and scanned content are unsupported. No attempt is made to silently convert blocked material. Comments and custom XML are excluded with warnings that their disclosure relevance must be checked in the original.

ZIP handling rejects unsupported compression, encryption, duplicate/traversal paths, directory inconsistencies and CRC/size mismatches. File limits are 12 MB compressed, 32 MB expanded, 1,000 ZIP entries, 350,000 characters and 5,000 decisions. These are pilot bounds, not a tested performance guarantee.

The source and reviewed text remain in memory until the page is abandoned or the session is cleared. Users can explicitly save an internal working-review JSON file containing source fingerprints, decisions, reasons and reviewer details, but no original source text. Resume requires the unchanged original to be loaded again and checks both its byte fingerprint and extracted-text fingerprint. Release declarations are never restored. Saved working reviews are not encrypted or tamper-proof; treat them as potentially sensitive internal files and follow retention policy. There is no automatic checkpoint. Browser crashes, refresh or closing the page can lose changes since the last explicit save. Memory clearing is not a secure-erasure guarantee. Files intentionally downloaded remain on the device.

## Run and test

Serve the repository using an ordinary static server and open `/redactor.html` over HTTPS, or localhost for development. ES modules, Web Crypto and `DecompressionStream('deflate-raw')` are required. No production dependency installation or build step is needed. Test on the actual managed browser before any pilot.

Run the automated checks with Node 24 or later:

```sh
cd tests/redactor
npm ci
npm test
```

The test-only jsdom dependency is locked. It is never loaded by the deployed page.

As of this implementation, 34 substantive checks pass (35 reported by Node including the workflow parent). They cover stored and compressed ZIPs, corrupted archives, text extraction, unsupported features, metadata exclusion, Unicode offsets, overlapping selections, human-review gates, output hashes, preview-to-Word verification, stale output invalidation, interrupted exports, automatic suggestion restoration and literal rendering of HTML-like input.

A generated Word file was independently opened with Python's zipfile and python-docx, then rendered with LibreOffice. Latin and Greek text, XML special characters, redaction markers and tab handling were inspected. CJK text remained present in XML and python-docx extraction but did not render in the available environment, which has no CJK font. Multilingual display must be checked on the target devices. No claim of full Microsoft Word compatibility is made from that limited check.

Browser layout, keyboard/screen-reader behaviour and managed Microsoft Edge compatibility were not visually tested in this environment. jsdom workflow tests exercise DOM events and state, not a real browser layout engine. Treat the following acceptance work as outstanding.

## Service acceptance before live use

| Area | Evidence to collect | Proposed owner |
| --- | --- | --- |
| Fit for purpose | Confirm output format, page/numbering fidelity, document types, case sizes and whether a reconstructed copy is ever acceptable | Service and Legal |
| Redaction effectiveness | Independently marked synthetic test corpus; every expected withheld passage absent from extracted output and all package entries; kept information remains understandable | Legal/IG reviewer |
| Content completeness | Compare original and reconstructed text including tables, notes, headers, footers, comments and unsupported content; no misleading omissions | Second reviewer |
| Browser and Word operation | Actual managed Edge and Microsoft Word versions; keyboard-only use, screen reader, zoom, long files, cancellation, network restrictions and download behaviour | ICT and pilot users |
| Security | Independent code and dependency review, hostile DOCX tests, supply-chain controls, device/download policies, server headers and hosting ownership | ICT security |
| Release governance | Agreed reviewer roles, approval process, original/output retention, handling of the decision record and incident response | Service owner and IG |
| Operational continuity | Ownership, support, change control, recovery requirements and handling of interrupted multi-hour reviews | Product/service owner |

For hosting, review response headers as well as the page's meta CSP. In particular, `frame-ancestors 'none'` must be delivered in an HTTP header, not a meta element. Ensure HTTPS, correct module MIME types, no content-injecting analytics and no unreviewed service worker affecting this route. A page-level local-processing design does not establish council approval of a public hosting arrangement.

## Benefits measurement

Use a paired sample of representative cases and measure the whole process, including preparation, suggested-match review, manual additions, second review, corrections and release administration. Record document length, complexity and excluded features. Record both reviewers' time, not just the first pass.

Report median and upper-range staff hours per case, cases completed, false positives, missed required redactions, rework and unsuitable/blocked documents. Establish quality acceptance before claiming time saved. Avoid treating a worst-case manual baseline and an untested software prediction as a proven average saving. Retain a manual comparison or the procured supplier's output for independent evaluation.

## Relationship to procurement

This pilot can help the service test requirements and compare workflows. It does not establish that a home-built replacement is preferable to an already selected supplier. Evaluate the full supported document set, assurance, maintenance, accessibility, authentication, audit, service support and total cost before making that decision. Do not interrupt the service's procurement solely on the strength of this prototype.

## Reference guidance

The ICO's guidance explains the risks from hidden document information and the need for irreversible removal. This is background for engineering and service assurance, not a compliance certification:

- https://ico.org.uk/media2/pbwchh24/disclosing-documents-to-the-public-securely-all-1-0-0.pdf
- https://ico.org.uk/for-organisations/foi/guide-to-managing-an-foi-request/finding-and-preparing-the-information/

## PDF release and editable working review

A PDF is not inherently read-only, but a correctly applied redaction must permanently remove the selected content. The internal review remains revisable. The release copy is a separate, final artefact generated only after reviewing the full document and repeating the second check. Any subsequent change to a decision cancels the prepared release and requires a newly generated copy. Changing decisions after a file has been disclosed does not retract that disclosure.

Before a PDF engine can be enabled, acceptance must demonstrate: original page appearance and positions are preserved; expected redacted material is absent from every recoverable representation, including images and OCR where present; metadata and hidden content are handled; the final PDF is checked as rendered; the working review can be revised and resumed against the unchanged source; and missed or indirect identifying information is addressed by human review. Automated pattern suggestions cannot establish full redaction. The existing Word-source export block remains in force.
