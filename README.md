# DV Bulk Upsert Runner

Preview-first Dataverse bulk upsert utility inside VS Code.

**DV Bulk Upsert Runner** is a focused DV ForgeLab utility for importing CSV, JSON, or `.dvur.json` packages, validating them, previewing single-entity upsert operations, applying them deliberately, and reviewing execution outcomes.

It is intentionally about **data application**, not migration.

DV Bulk Upsert Runner applies staged single-entity data rows. It does not perform ETL, scheduled sync, relationship graph migration, attachment migration, or automatic data cleansing.

---

## Version

**v1.0.0 — Preview-First Bulk Upsert Runner**

---

## Highlights

- CSV import
- JSON import
- `.dvur.json` package support
- Single-entity bulk upsert workflow
- Primary ID support
- Alternate-key support
- Metadata-backed key selection
- Create / Update classification
- Preview-first execution
- Batch execution progress tracking
- Failure grouping and review
- Failure export
- Failure requeue
- Environment-aware execution
- Shared DV ForgeLab environment settings

---

## Preview-First Workflow

```text
Connect
↓
Import CSV / JSON / DVUR Package
↓
Validate
↓
Preview Rows
↓
Check Creates / Updates
↓
Apply Upserts
↓
Review Results
↓
Export / Requeue Failures
```

---

# Screenshots

## Import & Preview

![DVUR Home](docs/images/dvur-page-top.png)

Import CSV, JSON, or DVUR packages and preview staged rows before Dataverse is modified.

---

## Create / Update Classification

![Create Update Classification](docs/images/dvur-page-create-update-checks.png)

DVUR can classify staged rows as creates or updates before execution.

Metadata-backed key selection helps identify valid primary IDs and active alternate keys.

---

## Applying Upserts

![Applying Upserts](docs/images/dvur-page-applying-upserts.png)

Execution is performed in batches with live progress, throughput, elapsed time, and estimated completion tracking.

---

## Preview Review Surface

![Preview Upserts](docs/images/dvur-page-preview-upserts.png)

Review classified creates and updates before applying changes.

DVUR follows a preview-first workflow and never modifies Dataverse without explicit user action.

---

## Failure Analysis

![Failure Review](docs/images/dvur-page-failure-summary.png)

Execution failures are grouped and summarised.

DVUR surfaces:

- failure category
- affected column
- invalid value
- expected type
- suggested corrective action
- raw Dataverse technical details

Failures can be exported or requeued for later correction and replay.

---

## Supported Scope

### Supported

- Single entity imports
- CSV records
- JSON records
- DVUR package records
- Primary ID upserts
- Alternate-key upserts
- Batch execution
- Failure export
- Failure requeue
- Create / Update classification

### Not Supported

- ETL pipelines
- Scheduled synchronisation
- Relationship graph migration
- Attachment migration
- Data cleansing
- Transformation workflows
- Cross-entity dependency resolution
- Enterprise migration orchestration

---

## Boundary

DV Bulk Upsert Runner is intentionally a runner, not a migration platform.

It does not:

- Perform ETL
- Schedule synchronisation
- Transform data
- Cleanse data
- Infer mappings
- Migrate relationship graphs
- Migrate files or attachments
- Automatically repair data quality issues
- Replace enterprise migration tooling

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
DV Bulk Upsert Runner: Open Upsert Runner
```

---

## Philosophy

DV Bulk Upsert Runner follows the DV ForgeLab preview-first invariant.

Rows are imported locally, validated, previewed, classified, and explicitly applied by the user.

Dataverse data is never changed without an explicit review and apply step.

---

## Part of the DV ForgeLab Family

DV Bulk Upsert Runner is a focused Dataverse utility from DV ForgeLab.

For operational investigation, execution, runtime analysis, and cross-environment comparison, see [DV Quick Run](https://www.dvquickrun.com).

DV Bulk Upsert Runner follows the same principles:

* Preview-first
* Environment-aware
* Metadata-backed
* Explicit execution
* Calm operational UX

---

Built by **[DV ForgeLab](https://www.dvforgelab.com)**.
