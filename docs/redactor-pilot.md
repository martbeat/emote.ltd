# Redaction review pilot

## Required original layout preservation

Requirement confirmed 13 October 2026: the original Word layout must be preserved. Text reconstruction is therefore unacceptable for Word-source release copies. This build allows Word-source review for evaluation but blocks every prepared export from that source, even if the review declarations are complete. Pasted-text evaluation exports remain available. A separate PDF page-review route is implemented at redactor-rbc.html. It rebuilds the rendered page appearance as a fresh image-only release PDF; native DOCX exports remain blocked.

Acceptance requires the same page count, page size, orientation, margins, section breaks, table geometry, numbering, headers, footers and positions of retained content as the checked original, with differences confined to approved redaction areas. Required withheld content must also be absent from text extraction, metadata, links, comments, attachments and other recoverable representations. Equal-length replacement strings alone do not satisfy page-layout preservation because glyph widths and line wrapping can change.

Output decision confirmed 13 October 2026: a fixed-page PDF release copy is acceptable. The working review must stay revisable so missing redactions can be added and a new release copy produced from the unchanged original. The PDF route is an image-only evaluation implementation at 144 DPI, with direct Word conversion still outstanding. A PDF route needs an approved Word rendering step, reviewer comparison with the original page appearance, true removal of redacted content and package sanitisation. A native DOCX route needs structural preservation plus rendering/comparison in the target Word environment. Neither route may treat black overlays over retained source text as redaction.

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

Serve the repository using an ordinary static server and open `/redactor-rbc-text.html` over HTTPS, or localhost for development. ES modules, Web Crypto and `DecompressionStream('deflate-raw')` are required. No production dependency installation or build step is needed. Test on the actual managed browser before any pilot.

Run the automated checks with Node 24 or later:

```sh
cd tests/redactor
npm ci
npm test
```

The test-only jsdom dependency is locked. It is never loaded by the deployed page.

As of this implementation, 40 substantive checks pass (41 reported by Node including the workflow parent). They cover stored and compressed ZIPs, corrupted archives, text extraction, unsupported features, metadata exclusion, Unicode offsets, overlapping selections, human-review gates, output hashes, preview-to-Word verification, stale output invalidation, interrupted exports, automatic suggestion restoration and literal rendering of HTML-like input.

A generated Word file was independently opened with Python's zipfile and python-docx, then rendered with LibreOffice. Latin and Greek text, XML special characters, redaction markers and tab handling were inspected. CJK text remained present in XML and python-docx extraction but did not render in the available environment, which has no CJK font. Multilingual display must be checked on the target devices. No claim of full Microsoft Word compatibility is made from that limited check.

The saved-review and PDF page workflows were exercised in headless Chromium and desktop/mobile screenshots inspected. Full keyboard/screen-reader assessment and managed Microsoft Edge compatibility remain outstanding. jsdom workflow tests exercise DOM events and state, not a real browser layout engine. Treat the following acceptance work as outstanding.

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

Before the PDF engine can be used operationally, acceptance must demonstrate: original page appearance and positions are preserved; expected redacted material is absent from every recoverable representation, including images and OCR where present; metadata and hidden content are handled; the final PDF is checked as rendered; the working review can be revised and resumed against the unchanged source; and missed or indirect identifying information is addressed by human review. Automated pattern suggestions cannot establish full redaction. The existing Word-source export block remains in force.

## PDF page review and release implementation

Open `redactor-rbc.html` for the new PDF route. Word users first export a PDF in Word and compare that PDF with the original. Automatic Word conversion is not implemented. Loading a DOCX in the text route still blocks release rather than reconstructing its layout.

The PDF source is rendered locally with pinned, self-hosted PDF.js 5.6.205 assets and standard fonts. PDF-Lib 1.17.1 creates the new release PDF. Original pages and objects are never copied: the renderer produces opaque page pixels, approved areas are replaced with black pixels including a one-point safety margin, those altered pixels are encoded as fresh PNGs and the new images are placed on new pages of the displayed original dimensions. Cropping and rotation are accounted for by the page viewport. The output is rasterised at 144 DPI, which preserves the rendered appearance rather than the original vector representation. It loses searchable text, selectable text, tags, links and vector scalability. It is not appropriate for every litigation or accessibility requirement, even where PDF is acceptable.

The working viewer supports rectangle dragging, keyboard coordinate entry, adjusting/removing areas, reasons and keep/redact decisions. Pattern suggestions and phrase searches operate on PDF text fragments, not glyph-level selections or OCR. The proposed box covers the whole fragment, which may include other text. Inspect and adjust these suggestions to avoid unnecessary withholding. Scanned/image content needs manual areas. The trial does not guarantee complete detection, correct OCR or correct rendering of every PDF feature or font.

Review requires every working page to be displayed and confirmed, every area to be resolved with a reason, two different declared reviewer names and acceptance of the image-only trade-off. The prepared output is reopened and checked for its page count/sizes, absent text layers, absent annotations/attachments and scripts. Every page of that actual final PDF must then be displayed and confirmed before downloads are enabled. These confirmations are process prompts, not authenticated identities. Any decision change cancels the prepared output and resets the checks.

PDF working-review JSON files contain the original byte fingerprint, displayed page sizes, area coordinates, decisions, reasons and reviewer details, without original PDF bytes or extracted passages. Resume requires the unchanged original PDF and clears all page confirmations and declarations. Internal release records contain the exact output fingerprint and area decisions. These files are not encrypted, immutable or suitable for public disclosure. Saving the working review is explicit; unsaved changes can still be lost.

The PDF pilot limits inputs to 12 MB, 50 pages, 16 million rendered pixels per page, 120 million pixels across the document, 50,000 extracted fragments, 500,000 extracted characters and 2,000 areas. Final PDFs are limited to 80 MB and saved reviews to 2 MB. Encrypted sources, attachments, scripts, optional-content layers, forms/signatures and non-link annotations are rejected. Links with separate appearance streams or visible borders are also rejected; inert borderless links are stripped while their body text remains rendered. Some complex image codecs or nonstandard font/CMap configurations may be unsupported. Those limits and rejection paths need representative-document evaluation and independent security review before operational adoption.

The PDF page uses a separate CSP permitting only local worker/font/asset requests. It makes no document uploads or external service calls in the tested flow. Distribution versions, checksums and licence files are in `js/redactor/vendor`. Dependency review and updates remain a maintenance responsibility.

### Reproduce the PDF checks

Requires Python with reportlab, Pillow and pypdf plus Playwright and Chromium. The repository must be served at port 8767.

```sh
python tests/redactor/generate_pdf_fixtures.py /tmp/emote-pdf-qa
python -m http.server 8767
# In another terminal, with Playwright installed:
node tests/redactor/pdf-browser.cjs
python tests/redactor/verify_pdf_release.py /tmp/emote-pdf-qa
```

`PLAYWRIGHT_MODULE`, `CHROMIUM_EXECUTABLE` and `PDF_FIXTURE_ROOT` select nonstandard test installations/paths. The tests use fictional documents only. Browser tests exercise automatic fragment areas, manual image areas, final-page download gates, recovery, wrong-source rejection, malformed coordinates, blocked sources, local network requests and mobile width. A rotated/cropped fixture verifies exact retained pixel equality outside the redaction area at the test resolution.

The independent Python check opens the downloaded PDF, verifies original page dimensions and source/output fingerprints, checks absent original metadata/text/annotations/attachments and inspects recoverable embedded images. It checks both fully black approved regions and the surrounding email band for leaked letter fragments. An initial descender leak was found through this check and fixed in the fragment geometry; a black rectangle alone was not treated as evidence of full removal. Generated portrait/landscape/rotated pages and desktop/mobile views were visually inspected.

These checks establish behaviour on the synthetic fixtures, not completeness for all legal documents or approval for live disclosure. Next acceptance inputs are representative synthetic Word/PDF documents, service agreement on image-only outputs, supported fonts/managed browser versions and an approved Word-rendering approach if one-step import is required.

## Static-server script compatibility

Browser modules and the PDF worker use `.js` filenames. The live eMote server serves `.mjs` as `application/octet-stream`, which browsers reject for module scripts. Keep the JavaScript MIME type when deploying. The renamed PDF.js distribution bytes and pinned checksums are unchanged.

## Assisted PDF first pass, 14 October 2026

The RBC PDF page now proposes areas automatically on import. Default scope includes deterministic identifiers, street addresses and conservative person-name suggestions. Names use the original site's local `assets/name-lexicon.json` plus contextual labels and honorifics. Broad name inference, company suffixes and dates are optional. No document content is sent to a model or remote service. If the local list is unavailable, a visible message explains that only name context and supplied terms were used.

Known terms and exclusions accept up to 200 entries of 300 characters, bounded to 20,000 characters per list. Supplied phrases match across whitespace and PDF fragment boundaries, with Unicode token boundaries. Matches map to the full original fragment rectangles, including multiple fragments for a split name. Excluded terms suppress proposals; if another matched identifier shares an excluded fragment, that fragment is left for manual review and reported. Exclusions never cancel existing decisions. Scans report unpositioned matches and pages without extracted text. OCR is not included.

Suggestions are grouped by detected category. Groups can be selected, reviewed in sequence and batch-redacted or batch-kept across the document or displayed page, using an explicit shared reason. Only pending automatic proposals are changed. Existing decided and manual areas remain unchanged on rescans. Proposals overlapping those existing regions are not reintroduced and are reported for manual review. Adjusting a suggested box converts it to a manual area. Names are heuristic candidates, not verified identities or legal judgements. First names, surnames and organisation names without suffixes can be supplied explicitly.

Detection-setting changes cancel prepared output and require a rescan. Batch changes revoke working/final page checks and release declarations. The existing human review gates remain mandatory. Working-review files preserve only the suggestion category alongside coordinates and decisions, without matched excerpts or term lists; old files remain supported. Session clearing removes supplied terms, exclusions and the batch reason. Static name-list data can remain cached in memory.

Validation: 57 reported Node tests pass. The additions test category scope, conservative/broad names, accented names, split fragments, exclusions, unpositioned text, limits, rescans, overlapping fragments and manual adjustments. JSDOM workflow tests execute the real UI event handlers with mocked PDF rendering to check the demonstration button, required batch reasons, page scope, prepared-copy invalidation, final-page download gates, saved group recovery and clearing. These are not a new browser/PDF-rendering verification run. Previous raster/PDF checks are unchanged; managed-browser evaluation of the expanded UI remains necessary.

## Balanced name inference, 14 October 2026

Balanced is now the default between Conservative and Broad. It accepts a recognised first name plus a plausible title-cased surname even when that surname is absent from the local list. Explicit person labels or honorifics also support unfamiliar given names. The parser supports middle initials and surname particles, filters form/role vocabulary and rejects trailing all-capital organisation acronyms as surnames. Organisation suffixes prevent obvious named organisations being treated as people. Conservative and Broad remain available. These are heuristics; unknown given names without context, all-capital names and ambiguous phrases can still need known terms or manual review.

PDF fragments are joined only when their rectangles suggest adjacency on the same line or a nearby aligned line. Hard text boundaries between distant rows and columns stop invented names spanning unrelated table cells. Matches still use whole original fragment rectangles, so an accompanying role in the same fragment may be included in the box. Supplied terms and exclusions also respect these geometric boundaries.

The screenshot's narrowness and heading-noise pattern is reproduced using fictional names in the public test fixture. The balanced test finds all three intended names, including two surnames missing from the supplied name list, while leaving approval/role headings unmarked. Additional tests cover initials, particles, contextual unknown names, table columns and line wrapping. All 62 reported Node tests pass. The screenshot was inspected, but its original PDF was not available to verify actual extracted fragments or final pixels. No new real-browser run was available. Previously approved broad decisions remain preserved on rescan; load the unchanged source afresh to discard them if a new baseline is wanted.

## Reason presets, 14 October 2026

Individual and batch reason fields now offer radio presets for personal information, contact details, sensitive information, confidentiality, privileged material, outside-scope information, retaining reviewed information and custom text. Choosing a preset fills the editable field. Automatic suggestions fill empty fields for recognised personal/contact categories only; they never overwrite existing or custom text and can be disabled separately for each field. Unknown supplied terms, dates and organisations do not infer a withholding basis. Confidentiality and privilege are reviewer-selected, not legal determinations made by the software.

Selecting an area proposes a reason without deciding the area. The normal Redact/Keep action still records the reason. Editing a stored area reason through its radio or textbox cancels prepared output and resets checks. Batch presets affect future batch decisions only. Session clearing resets both reason controls. All 65 reported Node tests pass, covering preset filling, custom text, auto-off behaviour, category suggestions, individual and batch event handlers and existing release gates. No new real-browser run was available.

## Browser-local learning, 14 October 2026

The RBC PDF page can learn category-level reason and redact/keep preferences from explicit area or batch decisions. Local storage uses the isolated `emote.rbc.redaction-learning.v1` key. Only bounded counters for the fixed detection categories, preset reason codes and the learning-enabled setting are persisted. Source text, actual names, matched terms, coordinates, case/reviewer details, source IDs and custom reason wording are not stored. This is preference learning, not document-specific entity recognition or an approval history.

An empty reason field can use the unique preferred personal/contact/scope preset from previous redactions. Mixed batches require the same preferred reason across every included category; otherwise normal suggestions remain. Privilege, confidentiality and sensitivity are never inferred into a new case. Previous redact/keep counts are shown as guidance; no decisions, page checks or release declarations are applied automatically. Existing and custom reasons remain unchanged.

The expandable learning section displays counts and preset choices, offers an off switch and a Forget button. Turning off disables both use and recording but retains existing history until forgotten. Clear session preserves learned preferences. Forget removes learned counters without altering current document decisions and preserves an explicit opt-out. People using the same browser profile share these preferences; clearing site data removes them. Storage failures disable learning without blocking the document workflow.

Session-local contribution tracking prevents repeated identical clicks inflating counters and replaces a recorded contribution when its decision/reason is corrected. Removed or adjusted areas withdraw the active-session contribution. No session IDs are persisted. Reopening a document is another review session, so these counters are not counts of unique released documents.

All 74 reported Node tests pass, including persistence across model reloads, preference suggestions, custom-data exclusion, corrections, opt-out, forgetting, malformed bounded counters, storage failures and actual UI learning/clearing handlers with mocked rendering. No new real-browser run was available.

## Author fields and role evidence, 14 October 2026

Name fields now include Report Author, Author, Prepared/Written/Reviewed/Approved by, Report Owner and Contact Officer. Field labels are matched case-insensitively without relaxing the casing requirements for their name values. Balanced mode can also use a trailing job title (for example Senior Auditor or Principal Solicitor) as evidence for an unfamiliar full name. Person-name filters still exclude form/role vocabulary and obvious organisation suffixes.

An explicit personal-field label can bridge a wider neighbouring table-cell gap on the same line. Ordinary columns and distant rows retain their hard boundaries. No names are added to local-storage learning or hardcoded into the dictionary for this fix. Whole-fragment boxes can still include an adjoining role, so visual review remains required.

All 78 reported Node tests pass, including fictional unfamiliar author names with empty dictionaries, upper/lower-case labels, name-plus-role evidence, label/value table cells and rejected organisation values. A local check of the screenshot's transcribed author line succeeds. The source PDF was not supplied, so its actual extraction and rendered redaction bounds have not been verified. No new real-browser run was available.

## Downloadable sourced dictionary, 14 October 2026

The RBC route now loads a separate published-name dictionary with 113,448 given names and 156,632 surnames from SSA (1880–2025), the US Census 2020 release (published 2026) and the UK DfE Autumn 2014 top-1,000 lists. See [source attribution, input hashes, rebuild commands and limitations](redactor-name-dictionary.md). No generated spelling variants are merged. The original page and its dictionary remain untouched.

Download and cache-bypassing Refresh controls expose the same self-hosted JSON. The page reports its loaded counts/date. Refreshing a loaded review requires a fresh scan and revokes prepared output. Matching folds accents and apostrophes while preserving the source text. Limits expand to 200,000 entries per list and 6 MB; all 82 reported Node tests pass. No document requests are sent to upstream publishers.
