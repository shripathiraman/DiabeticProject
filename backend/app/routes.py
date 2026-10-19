"""
HTTP routing layer for Diabetes Readmission Intervention Queue.
Handles request validation, HTTP exceptions, and response serialization.
All database access is delegated to repository.py and service.py.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from .models import (
    CareQueueItem,
    Encounter,
    EncounterCreate,
    Intervention,
    InterventionHistoryItem,
    InterventionUpdate,
    ManagementDashboard,
    OperationsSummary,
    PatientSearchResult,
    ReadmissionAnalysis,
    RiskLevel,
)
from .risk import score_encounter
from . import repository
from . import service

router = APIRouter()

VALID_INTERVENTION_STATUSES = {
    "PENDING_REVIEW",
    "ASSIGNED",
    "CONTACTED",
    "FOLLOW_UP_SCHEDULED",
    "CLOSED",
}


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
    """Create and score a new patient hospital encounter."""
    encounter = score_encounter(payload.model_dump())
    return repository.insert_encounter(encounter)


@router.get("/encounters", response_model=list[Encounter], tags=["Encounters"])
def list_encounters(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    """Retrieve a paginated list of patient hospital encounters."""
    return repository.list_encounters(limit=limit, offset=offset)


@router.get("/encounters/{encounter_id}", response_model=Encounter, tags=["Encounters"])
def get_encounter(encounter_id: int):
    """Fetch a single patient encounter by ID."""
    encounter = repository.get_encounter_by_id(encounter_id)
    if not encounter:
        raise HTTPException(status_code=404, detail=f"Encounter {encounter_id} not found.")
    return encounter


# ---------------------------------------------------------------------------
# 3. Patient Search Endpoints
# ---------------------------------------------------------------------------
@router.get("/patients/search", response_model=list[PatientSearchResult], tags=["Patient Search"])
@router.get("/api/patients/search", response_model=list[PatientSearchResult], tags=["Patient Search"], include_in_schema=False)
def search_patients(
    patient_nbr: Optional[int] = Query(default=None, description="Search by Patient Number (ID)"),
    risk_score: Optional[int] = Query(default=None, ge=0, le=8, description="Filter by Risk Score (0-8)"),
    risk_level: Optional[RiskLevel] = Query(default=None, description="Filter by Risk Level (LOW, MEDIUM, HIGH)"),
    limit: int = Query(default=50, ge=1, le=500, description="Max number of records to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
):
    """
    Search for patient encounters by Patient ID (patient_nbr), Risk Score, and/or Risk Level.
    Any combination of filters can be provided ('and/or').
    Returns patient encounter details enriched with care intervention status.
    """
    return service.search_patients(
        patient_nbr=patient_nbr,
        risk_score=risk_score,
        risk_level=risk_level,
        limit=limit,
        offset=offset,
    )


# ---------------------------------------------------------------------------
# 4. Care Queue Endpoints
# ---------------------------------------------------------------------------
@router.get("/care-queue", response_model=list[CareQueueItem], tags=["Care Queue"])
def get_care_queue(
    min_risk_score: Optional[int] = Query(default=None, ge=0, le=8),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    """Retrieve prioritized care queue records (HIGH and MEDIUM risk)."""
    return repository.query_care_queue(
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
    return repository.query_care_queue(
        risk_levels=["HIGH"],
        min_risk_score=None,
        limit=limit,
        offset=offset,
    )


# ---------------------------------------------------------------------------
# 5. Intervention Management Endpoints
# ---------------------------------------------------------------------------
@router.get("/interventions/{encounter_id}", response_model=Intervention, tags=["Interventions"])
@router.get("/api/interventions/{encounter_id}", response_model=Intervention, tags=["Interventions"], include_in_schema=False)
def get_intervention(encounter_id: int):
    """Fetch care intervention record and workflow status for a given encounter ID."""
    intervention = repository.get_intervention_by_encounter_id(encounter_id)
    if not intervention:
        raise HTTPException(
            status_code=404,
            detail=f"Encounter {encounter_id} not found.",
        )
    return intervention


@router.patch("/interventions/{encounter_id}", response_model=Intervention, tags=["Interventions"])
@router.patch("/api/interventions/{encounter_id}", response_model=Intervention, tags=["Interventions"], include_in_schema=False)
def update_intervention(encounter_id: int, payload: InterventionUpdate):
    """Update workflow status, assignee, or clinical notes for an intervention."""
    data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)

    normalized_status = None
    if "status" in data and data["status"] is not None:
        normalized_status = data["status"].strip().upper()
        if normalized_status not in VALID_INTERVENTION_STATUSES:
            allowed = ", ".join(sorted(VALID_INTERVENTION_STATUSES))
            raise HTTPException(status_code=400, detail=f"Invalid status '{data['status']}'. Allowed: {allowed}")

    updated_row = repository.update_intervention(
        encounter_id=encounter_id,
        status=normalized_status,
        assigned_to=data.get("assigned_to"),
        notes=data.get("notes"),
    )

    if not updated_row:
        raise HTTPException(
            status_code=404,
            detail=f"Encounter {encounter_id} not found.",
        )

    return updated_row


@router.get("/interventions/{encounter_id}/history", response_model=list[InterventionHistoryItem], tags=["Interventions"])
@router.get("/api/interventions/{encounter_id}/history", response_model=list[InterventionHistoryItem], tags=["Interventions"], include_in_schema=False)
def get_intervention_history(encounter_id: int):
    """Fetch complete immutable audit history for an encounter from care_intervention_history table."""
    encounter = repository.get_encounter_by_id(encounter_id)
    if not encounter:
        raise HTTPException(
            status_code=404,
            detail=f"Encounter {encounter_id} not found.",
        )
    return repository.get_intervention_history(encounter_id)


# ---------------------------------------------------------------------------
# 6. Operations & Analytics Endpoints
# ---------------------------------------------------------------------------
@router.get("/operations/summary", response_model=OperationsSummary, tags=["Operations & Management"])
def get_operations_summary():
    """Retrieve operational summary metrics across encounter risk tiers and intervention queue."""
    return repository.get_operations_summary()


@router.get("/operations/readmission-analysis", response_model=ReadmissionAnalysis, tags=["Operations & Management"])
def get_readmission_analysis():
    """Retrieve 30-day readmission analytics overall and broken down by risk group."""
    total, groups = repository.get_readmission_raw_data()

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
