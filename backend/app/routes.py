from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query

from .db import fetch_all, fetch_one, get_dict_connection
from .models import (
    CareQueueItem,
    Encounter,
    EncounterCreate,
    Intervention,
    InterventionUpdate,
    ManagementDashboard,
    OperationsSummary,
    ReadmissionAnalysis,
)
from .risk import score_encounter

router = APIRouter()

VALID_INTERVENTION_STATUSES = {
    "PENDING_REVIEW",
    "ASSIGNED",
    "CONTACTED",
    "FOLLOW_UP_SCHEDULED",
    "CLOSED",
}

ENCOUNTER_COLUMNS = """
    encounter_id, patient_nbr, age, time_in_hospital,
    number_inpatient, number_emergency, number_outpatient,
    num_medications, num_lab_procedures, discharge_disposition_id,
    admission_type_id, readmitted, risk_score, risk_level
"""

CARE_QUEUE_COLUMNS = """
    e.encounter_id, e.patient_nbr, e.age, e.time_in_hospital,
    e.number_inpatient, e.number_emergency, e.number_outpatient,
    e.num_medications, e.num_lab_procedures, e.discharge_disposition_id,
    e.admission_type_id, e.readmitted, e.risk_score, e.risk_level,
    i.intervention_id, i.status, i.assigned_to, i.notes,
    i.created_at, i.updated_at
"""


# ---------------------------------------------------------------------------
# 1. Health Check
# ---------------------------------------------------------------------------
@router.get("/", tags=["Health"])
def health_check():
    """Service health check returning status and documentation path."""
    return {
        "service": "Diabetes Readmission Intervention Queue",
        "status": "running",
        "docs": "/docs",
    }


# ---------------------------------------------------------------------------
# 2. Encounters Endpoints
# ---------------------------------------------------------------------------
@router.post("/encounters", response_model=Encounter, status_code=201, tags=["Encounters"])
def create_encounter(payload: EncounterCreate):
    encounter = score_encounter(payload.model_dump())
    columns = (
        "encounter_id", "patient_nbr", "age", "time_in_hospital",
        "number_inpatient", "number_emergency", "number_outpatient",
        "num_medications", "num_lab_procedures", "discharge_disposition_id",
        "admission_type_id", "readmitted", "risk_score", "risk_level",
    )
    values = tuple(encounter[column] for column in columns)
    placeholders = ", ".join(["%s"] * len(columns))

    sql = f"""
        INSERT INTO patient_encounters ({", ".join(columns)})
        VALUES ({placeholders})
        RETURNING {", ".join(columns)};
    """

    conn = get_dict_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, values)
            inserted_encounter = cursor.fetchone()
        conn.commit()
        return dict(inserted_encounter)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

        
@router.get("/encounters", response_model=list[Encounter], tags=["Encounters"])
def list_encounters(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    """Retrieve a paginated list of patient hospital encounters."""
    sql = f"""
        SELECT {ENCOUNTER_COLUMNS}
        FROM patient_encounters
        ORDER BY encounter_id
        LIMIT %s OFFSET %s;
    """
    return fetch_all(sql, (limit, offset))


@router.get("/encounters/{encounter_id}", response_model=Encounter, tags=["Encounters"])
def get_encounter(encounter_id: int):
    """Fetch a single patient encounter by ID."""
    sql = f"""
        SELECT {ENCOUNTER_COLUMNS}
        FROM patient_encounters
        WHERE encounter_id = %s;
    """
    encounter = fetch_one(sql, (encounter_id,))
    if not encounter:
        raise HTTPException(status_code=404, detail=f"Encounter {encounter_id} not found.")
    return encounter


# ---------------------------------------------------------------------------
# 3. Care Queue Endpoints
# ---------------------------------------------------------------------------
def _query_care_queue(
    risk_levels: list[str],
    min_risk_score: Optional[int],
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    """Helper to query the care queue with ordering by risk priority."""
    where_clauses = ["e.risk_level = ANY(%s)"]
    params: list[Any] = [risk_levels]

    if min_risk_score is not None:
        where_clauses.append("e.risk_score >= %s")
        params.append(min_risk_score)

    params.extend([limit, offset])

    sql = f"""
        SELECT {CARE_QUEUE_COLUMNS}
        FROM patient_encounters e
        JOIN care_interventions i ON i.encounter_id = e.encounter_id
        WHERE {" AND ".join(where_clauses)}
        ORDER BY
            CASE e.risk_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
            e.risk_score DESC,
            e.number_inpatient DESC,
            e.number_emergency DESC,
            e.encounter_id
        LIMIT %s OFFSET %s;
    """
    return fetch_all(sql, params)


@router.get("/care-queue", response_model=list[CareQueueItem], tags=["Care Queue"])
def get_care_queue(
    min_risk_score: Optional[int] = Query(default=None, ge=0, le=8),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    """Retrieve prioritized care queue records (HIGH and MEDIUM risk)."""
    return _query_care_queue(
        risk_levels=["HIGH", "MEDIUM"],
        min_risk_score=min_risk_score,
        limit=limit,
        offset=offset,
    )


@router.get("/care-queue/high", response_model=list[CareQueueItem], tags=["Care Queue"])
def get_high_risk_care_queue(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    """Retrieve care queue records filtered exclusively for HIGH risk patients."""
    return _query_care_queue(
        risk_levels=["HIGH"],
        min_risk_score=None,
        limit=limit,
        offset=offset,
    )


# ---------------------------------------------------------------------------
# 4. Intervention Management Endpoints
# ---------------------------------------------------------------------------
@router.patch("/interventions/{encounter_id}", response_model=Intervention, tags=["Interventions"])
def update_intervention(encounter_id: int, payload: InterventionUpdate):
    """Update workflow status, assignee, or clinical notes for an intervention."""
    data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)

    updates = []
    params: list[Any] = []

    if "status" in data and data["status"] is not None:
        normalized_status = data["status"].strip().upper()
        if normalized_status not in VALID_INTERVENTION_STATUSES:
            allowed = ", ".join(sorted(VALID_INTERVENTION_STATUSES))
            raise HTTPException(status_code=400, detail=f"Invalid status '{data['status']}'. Allowed: {allowed}")
        updates.append("status = %s")
        params.append(normalized_status)

    if "assigned_to" in data:
        updates.append("assigned_to = %s")
        params.append(data["assigned_to"])

    if "notes" in data:
        updates.append("notes = %s")
        params.append(data["notes"])

    if not updates:
        # No fields provided, just return existing record
        existing = fetch_one(
            "SELECT intervention_id, encounter_id, status, assigned_to, notes, created_at, updated_at "
            "FROM care_interventions WHERE encounter_id = %s;",
            (encounter_id,),
        )
        if not existing:
            raise HTTPException(status_code=404, detail=f"Intervention for encounter {encounter_id} not found.")
        return existing

    params.append(encounter_id)
    sql = f"""
        UPDATE care_interventions
        SET {", ".join(updates)}
        WHERE encounter_id = %s
        RETURNING intervention_id, encounter_id, status, assigned_to, notes, created_at, updated_at;
    """

    conn = get_dict_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, tuple(params))
            updated_row = cursor.fetchone()
        conn.commit()
    finally:
        conn.close()

    if not updated_row:
        raise HTTPException(
            status_code=404,
            detail=f"Intervention for encounter {encounter_id} not found. Only MEDIUM and HIGH risk encounters have interventions.",
        )

    return dict(updated_row)


# ---------------------------------------------------------------------------
# 5. Operations & Analytics Endpoints
# ---------------------------------------------------------------------------
@router.get("/operations/summary", response_model=OperationsSummary, tags=["Operations & Management"])
def get_operations_summary():
    """Retrieve operational summary metrics across encounter risk tiers and intervention queue."""
    sql = """
        SELECT
            COUNT(*) AS total_encounters,
            COUNT(*) FILTER (WHERE risk_level = 'HIGH') AS high_risk,
            COUNT(*) FILTER (WHERE risk_level = 'MEDIUM') AS medium_risk,
            COUNT(*) FILTER (WHERE risk_level = 'LOW') AS low_risk,
            (SELECT COUNT(*) FROM care_interventions WHERE status <> 'CLOSED') AS pending_interventions,
            (SELECT COUNT(*) FROM care_interventions WHERE status = 'CLOSED') AS completed_interventions
        FROM patient_encounters;
    """
    row = fetch_one(sql)
    return row or {
        "total_encounters": 0,
        "high_risk": 0,
        "medium_risk": 0,
        "low_risk": 0,
        "pending_interventions": 0,
        "completed_interventions": 0,
    }


@router.get("/operations/readmission-analysis", response_model=ReadmissionAnalysis, tags=["Operations & Management"])
def get_readmission_analysis():
    """Retrieve 30-day readmission analytics overall and broken down by risk group."""
    total_sql = """
        SELECT
            COUNT(*) AS total_encounters,
            COUNT(*) FILTER (WHERE readmitted = '<30') AS readmitted_under_30_days
        FROM patient_encounters;
    """
    groups_sql = """
        SELECT
            risk_level,
            COUNT(*) AS total_patients,
            COUNT(*) FILTER (WHERE readmitted = '<30') AS readmitted_under_30_days
        FROM patient_encounters
        GROUP BY risk_level
        ORDER BY CASE risk_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END;
    """

    total = fetch_one(total_sql) or {"total_encounters": 0, "readmitted_under_30_days": 0}
    groups = fetch_all(groups_sql)

    total_enc = total["total_encounters"]
    readm_30 = total["readmitted_under_30_days"]
    total_rate = round((readm_30 / total_enc * 100), 2) if total_enc > 0 else 0.0

    for g in groups:
        pts = g["total_patients"]
        r = g["readmitted_under_30_days"]
        g["readmission_rate"] = round((r / pts * 100), 2) if pts > 0 else 0.0

    return {
        "total_encounters": total_enc,
        "readmitted_under_30_days": readm_30,
        "readmission_rate": total_rate,
        "risk_groups": groups,
    }


@router.get("/management/dashboard", response_model=ManagementDashboard, tags=["Operations & Management"])
def get_management_dashboard():
    """Retrieve executive dashboard metrics summarizing care queue volume and high-risk readmissions."""
    ops = get_operations_summary()
    readm = get_readmission_analysis()

    high_risk_rate = 0.0
    for g in readm["risk_groups"]:
        if g["risk_level"] == "HIGH":
            high_risk_rate = g["readmission_rate"]
            break

    high_q = ops["high_risk"]
    med_q = ops["medium_risk"]

    return {
        "total_encounters": ops["total_encounters"],
        "care_queue_size": high_q + med_q,
        "high_risk_queue": high_q,
        "medium_risk_queue": med_q,
        "pending_interventions": ops["pending_interventions"],
        "completed_interventions": ops["completed_interventions"],
        "high_risk_readmission_rate": high_risk_rate,
    }


