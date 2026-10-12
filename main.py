from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query

import repository
from models import (
    CareQueueItem,
    Encounter,
    Intervention,
    InterventionUpdate,
    ManagementDashboard,
    OperationsSummary,
    ReadmissionAnalysis,
)


app = FastAPI(
    title="Diabetes Readmission Intervention Queue",
    description="Operational MVP for prioritizing diabetes readmission care-management review.",
    version="1.0.0",
)


@app.get("/")
def health_check():
    return {
        "service": "Diabetes Readmission Intervention Queue",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/encounters", response_model=List[Encounter])
def list_encounters(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    return repository.get_encounters(limit=limit, offset=offset)


@app.get("/encounters/{encounter_id}", response_model=Encounter)
def get_encounter(encounter_id: int):
    encounter = repository.get_encounter_by_id(encounter_id)

    if encounter is None:
        raise HTTPException(
            status_code=404,
            detail=f"Encounter {encounter_id} was not found.",
        )

    return encounter


@app.get("/care-queue", response_model=List[CareQueueItem])
def get_care_queue(
    min_risk_score: Optional[int] = Query(default=None, ge=0, le=8),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    return repository.get_care_queue(
        min_risk_score=min_risk_score,
        limit=limit,
        offset=offset,
    )


@app.get("/care-queue/high", response_model=List[CareQueueItem])
def get_high_risk_care_queue(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    return repository.get_care_queue(
        high_only=True,
        limit=limit,
        offset=offset,
    )


@app.patch("/interventions/{encounter_id}", response_model=Intervention)
def update_intervention(encounter_id: int, payload: InterventionUpdate):
    update_data = _model_to_dict(payload)

    try:
        intervention = repository.update_intervention(
            encounter_id=encounter_id,
            status=update_data.get("status"),
            assigned_to=update_data.get("assigned_to"),
            notes=update_data.get("notes"),
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if intervention is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Intervention for encounter {encounter_id} was not found. "
                "Only MEDIUM and HIGH risk encounters are added to the care queue."
            ),
        )

    return intervention


@app.get("/operations/summary", response_model=OperationsSummary)
def get_operations_summary():
    return repository.get_operations_summary()


@app.get("/operations/readmission-analysis", response_model=ReadmissionAnalysis)
def get_readmission_analysis():
    return repository.get_readmission_analysis()


@app.get("/management/dashboard", response_model=ManagementDashboard)
def get_management_dashboard():
    return repository.get_management_dashboard()


def _model_to_dict(model):
    """
    Support both Pydantic v1 and v2.
    """
    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_unset=True)
    return model.dict(exclude_unset=True)
