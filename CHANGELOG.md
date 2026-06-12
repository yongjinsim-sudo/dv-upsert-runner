# Changelog

## 1.0.0 - Preview-First Bulk Upsert Runner

DV Upsert Runner reaches v1.0.0 as a preview-first Dataverse bulk upsert utility focused on safe execution, operational visibility, resumable workflows, and actionable diagnostics.

### Added

* CSV, JSON, and DVUR package import workflows.
* Single-entity Dataverse bulk upsert execution.
* Primary ID and Alternate Key matching modes.
* Preview-first execution model with explicit apply step.
* Dataverse create/update classification before execution.
* Bulk execution progress tracking with batch awareness.
* Throughput, elapsed time, and ETA monitoring.
* Safe cancellation after current batch completion.
* Export skipped rows after cancellation.
* Requeue skipped rows for continued execution.
* Export failed rows as DVUR packages.
* Requeue failed rows for correction and retry.
* Failure grouping and review workflows.
* Human-readable Dataverse failure diagnostics.
* Failure severity classification and summary badges.
* Suggested corrective actions for common Dataverse errors.
* Raw technical diagnostics for support and engineering investigations.
* Environment-aware execution safety indicators.
* Validation and metadata-backed column checking.
* Trusted DVUR package support.

### Changed

* Separated local package preview from Dataverse classification checks.
* Improved bulk-import readability with compact row rendering and expandable details.
* Reduced noise in validation and execution reporting.
* Improved operational visibility throughout preview and execution workflows.

### Boundaries

DV Upsert Runner is a preview-first Dataverse bulk upsert utility.

It intentionally does not provide:

* ETL pipelines
* Scheduled synchronization
* Relationship graph migration
* Attachment or file migration
* Automatic data cleansing
* Data transformation engines
* Multi-entity migration orchestration

### Philosophy

Preview first.

Understand what will happen before data changes.

Apply deliberately.

Investigate failures with evidence.

Resume safely when operations are interrupted.
