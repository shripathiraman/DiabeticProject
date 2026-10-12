from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel


RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]
InterventionStatus = Literal[
    "PENDING_REVIEW",
    "ASSIGNED",
    "CONTACTED",
    "FOLLOW_UP_SCHEDULED",
    "CLOSED",
]


class Encounter(BaseModel):
    encounter_id: int
    patient_nbr: int
    age: str
    time_in_hospital: int
    number_inpatient: int
    number_emergency: int
    number_outpatient: int
    num_medications: int
    num_lab_procedures: int
    discharge_disposition_id: int
    admission_type_id: int
    readmitted: str
    risk_score: int
    risk_level: RiskLevel


class Intervention(BaseModel):
    intervention_id: int
    encounter_id: int
    status: InterventionStatus
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CareQueueItem(Encounter):
    intervention_id: int
    status: InterventionStatus
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class InterventionUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class OperationsSummary(BaseModel):
    total_encounters: int
    high_risk: int
    medium_risk: int
    low_risk: int
    pending_interventions: int
    completed_interventions: int


class RiskGroupReadmissionAnalysis(BaseModel):
    risk_level: RiskLevel
    total_patients: int
    readmitted_under_30_days: int
    readmission_rate: float


class ReadmissionAnalysis(BaseModel):
    total_encounters: int
    readmitted_under_30_days: int
    readmission_rate: float
    risk_groups: List[RiskGroupReadmissionAnalysis]


class ManagementDashboard(BaseModel):
    total_encounters: int
    care_queue_size: int
    high_risk_queue: int
    medium_risk_queue: int
    pending_interventions: int
    completed_interventions: int
    high_risk_readmission_rate: float
