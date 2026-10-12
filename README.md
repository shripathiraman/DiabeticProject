# Diabetes Readmission Intervention Queue

## Project Overview

This project is a Forward Deployed Engineer mini project for an enterprise healthcare scenario. The application converts historical diabetes hospital encounter data into an operational care-management queue.

The goal is not to build a clinical prediction model. The goal is to build a backend workflow that helps a hospital prioritize which recently discharged diabetes patients should be reviewed first by the care-management team.

This project is for learning use only and is not intended for real clinical decision-making.

## Business Problem

Hospitals often have more discharged patients than a care-management team can manually review. For diabetes patients, early readmission within 30 days is an important operational and financial concern.

This application helps the hospital identify patients who should be reviewed first by applying a simple, explainable risk rule to historical encounter data.

## Primary Users

- Care Management Team: needs a prioritized queue of patients to review.
- Hospital Operations: needs visibility into workload, backlog, and intervention progress.
- Clinical Leadership: needs an explainable prioritization rationale.
- Finance / Transformation Team: needs early signals about whether the workflow may be worth scaling.

## MVP Hypothesis

Patients with higher prior utilization and more complex hospital encounters may benefit from earlier care-management review. A simple rule-based queue may be more operationally useful than reviewing every discharged patient equally.

## Dataset Fields Used

The application uses a focused subset of the diabetes readmission dataset:

- `encounter_id`
- `patient_nbr`
- `age`
- `time_in_hospital`
- `number_inpatient`
- `number_emergency`
- `number_outpatient`
- `num_medications`
- `num_lab_procedures`
- `discharge_disposition_id`
- `admission_type_id`
- `readmitted`

The `readmitted` field is used only for historical outcome analysis. It is not used to calculate risk score.

## Risk Scoring Rule

The application uses an explainable scoring rule:

| Condition | Points |
| --- | ---: |
| `number_inpatient >= 3` | +3 |
| `number_emergency >= 2` | +2 |
| `number_outpatient >= 3` | +1 |
| `time_in_hospital >= 7` | +1 |
| `num_medications >= 20` | +1 |

Risk level mapping:

| Score | Risk Level |
| ---: | --- |
| 0-2 | LOW |
| 3-4 | MEDIUM |
| 5+ | HIGH |

## Architecture

```text
Healthcare CSV Dataset
        |
        v
data_loader.py
        |
        v
PostgreSQL
        ^
        |
repository.py
        ^
        |
service.py
        ^
        |
main.py / FastAPI
        ^
        |
Swagger / API Consumer
```

Layer responsibilities:

- `database.py`: PostgreSQL connection configuration.
- `schema.sql`: database tables, constraints, indexes, and timestamp trigger.
- `service.py`: business rules, scoring, risk levels, and validation.
- `repository.py`: SQL queries and persistence logic.
- `data_loader.py`: CSV ingestion and initial intervention queue creation.
- `models.py`: API request and response models.
- `main.py`: FastAPI routes and HTTP error handling.

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/encounters` | List encounters |
| GET | `/encounters/{encounter_id}` | Get one encounter |
| GET | `/care-queue` | Return MEDIUM and HIGH risk queue |
| GET | `/care-queue/high` | Return HIGH risk queue |
| PATCH | `/interventions/{encounter_id}` | Update workflow status, owner, or notes |
| GET | `/operations/summary` | Operational metrics |
| GET | `/operations/readmission-analysis` | Compare prioritization against historical outcomes |
| GET | `/management/dashboard` | Executive dashboard metrics |

## Setup Instructions

Install dependencies:

```powershell
pip install -r requirements.txt
```

Create the PostgreSQL database:

```sql
CREATE DATABASE fde_db;
```

Run the schema:

```powershell
psql -U postgres -d fde_db -f D:\fdetraining\DiabeticProject\schema.sql
```

Load the dataset:

```powershell
python data_loader.py
```

Start the API:

```powershell
python -m uvicorn main:app --reload
```

Open Swagger:

```text
http://127.0.0.1:8000/docs
```

## Example Intervention Update

```json
{
  "status": "CONTACTED",
  "assigned_to": "Care Team A",
  "notes": "Follow-up appointment scheduled"
}
```

## FDE Reflection

### 7. What business problem did you solve?

I solved the problem of limited care-management capacity. The hospital cannot manually review every discharged diabetes patient, so the application creates a prioritized review queue based on simple operational risk factors.

The solution turns historical encounter data into an actionable workflow: load patient encounters, calculate risk, create a care queue, track interventions, and measure whether the prioritization aligns with historical readmission outcomes.

### 8. Who is the primary user?

The primary user is the care-management team. They need a practical queue that tells them which patients to review first.

Secondary users include hospital operations leaders, clinical leadership, and finance or transformation teams who need visibility into workload, outcomes, and possible value.

### 9. What decision does your application improve?

The application improves the decision of which recently discharged diabetes patients should receive care-management attention first.

Instead of reviewing patients randomly or equally, the team can focus first on MEDIUM and HIGH risk encounters based on prior utilization and encounter complexity.

### 10. What did the dataset prove?

The dataset proved that historical encounter data contains useful operational signals. Patients with higher prior utilization and more complex encounters can be grouped into higher-risk queues.

The dataset does not prove clinical causality or preventability. It only helps evaluate whether the rule-based queue identifies groups with higher historical `<30` readmission rates.

### 11. What assumptions did you make?

I assumed that prior inpatient, emergency, and outpatient utilization are useful operational signals for follow-up priority.

I assumed that longer hospital stays and a higher number of medications may indicate more complex cases.

I assumed that a simple rule-based approach is acceptable for an MVP because it is explainable, easy to inspect, and easier for business and clinical stakeholders to challenge.

I also assumed that care-management capacity is limited and that a prioritized queue is more useful than asking the team to review every patient.

### 12. What must the hospital validate before this could become a real product?

The hospital must validate whether the scoring rule is clinically appropriate and operationally useful.

It must confirm which readmissions were preventable, what interventions are available, how much each intervention costs, and whether the queue improves outcomes compared with the current workflow.

The hospital must also validate data quality, privacy requirements, security controls, workflow ownership, audit logging, and integration with real discharge and care-management systems.

### 13. Would you use rules, traditional ML, LLM, or another approach next - and why?

For the MVP, I would use rules because they are transparent, fast to implement, and easy for stakeholders to review.

Next, I would compare the rule-based approach with a traditional machine learning model such as logistic regression or gradient boosting. Traditional ML could identify more complex patterns, but it should only be introduced after the hospital agrees on the workflow, outcome definition, intervention process, and evaluation method.

I would not use an LLM as the primary scoring engine for this use case. An LLM may help summarize notes or explain queue rationale, but patient prioritization should rely on validated, measurable, and auditable logic.

## Important Note

This application is a learning prototype. It is not clinically validated and must not be used for real patient care decisions.
