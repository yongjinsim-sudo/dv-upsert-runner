# DV Upsert Runner

Preview-first Dataverse bulk upsert utility for VS Code.

**DV Upsert Runner** is a focused DV ForgeLab utility for importing CSV, JSON, or `.dvur.json` packages, validating them, previewing single-entity upsert operations, applying them deliberately, and reviewing execution outcomes.

It is intentionally about **data application**, not migration.

DV Upsert Runner applies staged single-entity data rows. It does not perform ETL, scheduled sync, relationship graph migration, attachment migration, or automatic data cleansing.

---

## Version

v1.0.0

---

## Highlights

* CSV import for flat single-entity rows
* JSON import for flat rows or package-style payloads
* `.dvur.json` package support
* Single-entity Dataverse bulk upsert workflow
* Primary ID or Alternate Key matching
* Preview-first execution model
* Dataverse create/update classification
* Metadata-backed validation
* Execution progress tracking
* Throughput, ETA, and elapsed time monitoring
* Safe batch-aware cancellation
* Export skipped rows
* Requeue skipped rows
* Export failed rows
* Requeue failed rows
* Failure grouping and diagnostics
* Human-readable Dataverse error interpretation
* Raw technical evidence for support and troubleshooting
* Shared DV ForgeLab Dataverse environment settings

---

## Preview-First Workflow

```text
Connect
↓
Import CSV / JSON / DVUR package
↓
Select entity and key
↓
Validate
↓
Preview rows
↓
Check creates / updates
↓
Apply upserts
↓
Review execution report
```

---

## Supported Scope

* Single entity only
* Flat CSV records
* Flat JSON records
* `.dvur.json` package records
* Primary ID upsert
* Alternate-key upsert
* Batch-oriented execution model
* Execution reporting
* Failure export and requeue workflows
* Cancellation and resume workflows

---

## Boundary

DV Upsert Runner is intentionally a runner, not a migration platform.

It does not:

* Perform ETL
* Schedule synchronisation
* Transform data
* Cleanse data
* Infer missing mappings
* Migrate relationship graphs
* Migrate attachments or files
* Automatically resolve complex lookup graphs
* Replace enterprise data migration tooling

---

## DVUR Packages

Generic CSV and JSON imports are useful for common bulk upsert scenarios.

DVUR packages (`.dvur.json`) provide a portable format for staged data operations, execution review, failure export, skipped-row export, and requeue workflows.

DV Upsert Runner remains responsible for validation, preview, classification, execution, and operational review before data changes are applied to Dataverse.

---

## Shared DV ForgeLab Environment Settings

```json
"dvForgeLab.environments": [
  {
    "name": "DEV",
    "url": "https://org.crm6.dynamics.com",
    "tenantId": "optional-tenant-id"
  }
]
```

---

## Command

```text
DV Upsert Runner: Open Upsert Runner
```

---

## Failure Diagnostics

DV Upsert Runner provides operational diagnostics for failed rows.

Common Dataverse execution failures are grouped and summarized to help identify corrective actions quickly.

Examples include:

* Type conversion errors
* Required field violations
* Alternate key conflicts
* Lookup resolution failures
* Choice value validation failures
* Permission and security errors
* Dataverse service errors

Failure review surfaces include:

* Failure summary grouping
* Affected row counts
* Failed column identification (where available)
* Invalid value detection
* Expected Dataverse type
* Suggested corrective actions
* Raw Dataverse technical details for investigation and support escalation

---

## Philosophy

DV Upsert Runner follows the DV ForgeLab preview-first invariant.

Rows are imported locally, validated, previewed, classified, and explicitly applied by the user.

Dataverse data is never changed without an explicit preview and confirmation step.

The goal is simple:

**Understand what will happen before data changes.**

---

## Part of the DV ForgeLab Family

DV Upsert Runner is a focused Dataverse utility from DV ForgeLab.

For operational investigation, execution, runtime analysis, and cross-environment comparison, see [DV Quick Run](https://www.dvquickrun.com).

DV Upsert Runner follows the same principles:

* Preview-first
* Environment-aware
* Metadata-backed
* Explicit execution
* Calm operational UX

---

Built by **[DV ForgeLab](https://www.dvforgelab.com)**.
