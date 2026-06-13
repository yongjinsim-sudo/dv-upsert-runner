# Changelog

## 1.0.0

- Added failure severity badges and grouped failure summary chips.
- Humanised Dataverse failure messages while keeping technical details available.
- Marked DV Upsert Runner as the v1.0.0 ship candidate.

## 0.1.11

- Added more actionable failure diagnostics with expected values and suggested actions.
- Inferred failed columns for type conversion errors where row payload and metadata allow it.
- Kept raw Dataverse technical details available behind expandable sections.

## 0.1.10

- Added normalized failure categories for Dataverse execution errors.
- Condensed failure group summaries for type conversion and Dataverse payload errors.
- Collapsed raw technical details behind expandable sections.
- Improved failed row detail cards for export/requeue workflows.

# Change Log

## 0.1.9

- Fixed source state before import.
- Disabled Preview until import/entity/key details are ready.
- Added live create/update/unresolved counters during classification.
- Improved throughput wording and completion summary.

# Changelog

## 0.1.8 - Cancellation Resume & State Preservation

- Preserved resolved Create/Update preview state while applying rows.
- Added skipped-row collection when cancellation stops after the current batch.
- Added Export skipped rows and Requeue skipped rows actions.
- Requeued skipped rows require Preview and Check Creates / Updates before applying.

## 0.1.7

- Split fast local package preview from Dataverse create/update checking.
- Added explicit Check Creates / Updates action with progress, elapsed time, throughput and ETA.
- Disabled Apply until all rows are resolved as Create or Update.
- Kept Apply confirmation immediate and before backend work.

## 0.1.6

- Added operational progress transparency for Preview and Apply.
- Added live elapsed time, throughput, and ETA while rows are being processed.
- Apply confirmation now appears before any backend execution work.
- Added safe "Cancel after current batch" handling for bulk runs.
- Final execution summaries now preserve elapsed time, throughput, batch counts, and skipped rows after cancellation.

## 0.1.5

- Added compact row previews with expandable field details for wide imports.
- Reduced normal preview density while preserving full payload inspection on demand.
- Persisted elapsed time and average throughput in execution results.
- Improved grouped validation messages with affected-row examples.


## 0.1.4

- Reduced normal sample and preview row rendering to 5 rows for bulk readability.
- Added elapsed-time display for apply progress and completion summary.
- Summarised successful bulk row results by default.
- Kept detailed row rendering focused on failures with scrollable failure lists.
- Added horizontal overflow handling for wide-row previews with many fields.

# Change Log

## [0.1.3] - Bulk upsert readiness

### Added

- Metadata-backed column validation before preview/apply.
- Unknown-column detection, including custom primary-name column mistakes such as `name` vs publisher-prefixed logical names.
- Read-only column detection for non-create/non-update payload fields.
- Additional DVUR test-table samples for create, update, trusted package, and 1000-row bulk testing.

### Changed

- Import summary now separates record count and column count for clearer bulk-import review.
- Preview rows now include field values in the data operation preview, not only key values.

## [0.1.2] - Import and execution maturity

### Changed

- CSV import now treats the first row as the header row and imports remaining rows as data.
- Sample preview now shows actual row field values instead of only column names.
- Entity selection now uses a themed dropdown when Dataverse metadata is loaded.
- Batch size is now a controlled dropdown: 100, 250, 500, or 1000.
- Preview now shows an execution plan with batch count and batch size.

### Added

- Import summary showing source, row count, column count, entity, key mode, and key column.
- Grouped validation notes to avoid noisy repeated row-level errors.
- Apply progress surface for processed rows, batches, applied rows, and failed rows.
- Execution failure grouping.
- Export failed rows to a DVUR package.
- Requeue failed rows for another preview/apply cycle.

## [0.1.1] - Launch and preview polish

### Changed

- DVUR no longer connects automatically on launch.
- Validation notes now remain empty until a CSV, JSON, or DVUR package is imported.
- Added a 10-row sample preview after import.
- Refresh now reloads Dataverse metadata when connected.
- Added sample CSV and DVUR JSON files for quick testing.


All notable changes to the "DV Upsert Runner" extension will be documented in this file.

## [0.1.0] - Initial DVUR scaffold

### Added

- DV Upsert Runner VS Code command and branded DV ForgeLab webview.
- Shared DV ForgeLab environment connection support.
- CSV import for flat upsert rows.
- JSON import for flat rows and package-style payloads.
- `.dvur.json` package export support.
- Trusted DVQR package detection semantics.
- Single-entity upsert staging model.
- Primary ID and alternate-key key mode selection.
- Preview-first validation workflow.
- Create/update detection during preview where possible.
- Explicit apply workflow for Dataverse upserts.
- Execution results for applied and failed rows.
- Environment-aware safety indicators.
- Boundary messaging for runner-not-migration-platform scope.

### Boundaries

- Single entity only.
- No ETL.
- No scheduled sync.
- No relationship graph migration.
- No attachment/file migration.
- No automatic data cleansing or transformation engine.
