# Changelog

## 1.0.3 — DVBUR Naming Cleanup

### Changed

- Renamed remaining legacy package references to DVBUR across README, package metadata, UI copy, samples, and screenshots.
- Standardised package references on `.dvbur.json`.
- Cleaned up irrelevant inherited internal source naming to reflect DV Bulk Upsert Runner.
- Refreshed sample artifact filenames to use `dvbur` naming.

## 1.0.2 — Feedback Integration & DVBUR Naming Cleanup

### Added

- Added a Feedback button linking to the shared DV ForgeLab feedback portal.
- Feedback opens with DV Bulk Upsert Runner and the current extension version preselected.

## 1.0.1 — Preview-First Bulk Upsert Runner

Marketplace README update.

## 1.0.0 — Preview-First Bulk Upsert Runner

Initial public release.

### Added

* CSV import support
* JSON import support
* `.dvbur.json` package support
* Single-entity Dataverse bulk upsert workflow
* Primary ID upsert support
* Alternate-key upsert support
* Metadata-backed entity and column validation
* Read-only column detection
* Create / Update classification before execution
* Preview-first execution workflow
* Batch execution planning and progress tracking
* Elapsed time, throughput, and ETA reporting
* Cancellation after current batch
* Failure grouping and failure review experience
* Human-readable Dataverse error summaries
* Technical detail expansion for advanced troubleshooting
* Failure export support
* Failure requeue support
* Shared DV ForgeLab environment settings
* Environment-aware execution indicators

### Workflow

```text
Connect
↓
Import CSV / JSON / DVBUR Package
↓
Validate
↓
Preview
↓
Check Creates / Updates
↓
Apply Upserts
↓
Review Results
↓
Export / Requeue Failures
```

### Boundary

DV Bulk Upsert Runner is a preview-first data application utility.

It supports staged single-entity Dataverse upserts and execution review.

It is not:

* an ETL platform
* a migration platform
* a synchronisation engine
* a relationship migration tool
* an attachment migration tool
* an automatic data cleansing solution

Built by DV ForgeLab.
