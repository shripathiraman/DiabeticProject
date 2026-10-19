"""
Data access layer (Repository) for patient encounters and care interventions.
All raw SQL queries and database interactions reside here as pure modular functions.
"""
from typing import Any, Optional
from .db import fetch_all


def search_patients(
    patient_nbr: Optional[int] = None,
    risk_score: Optional[int] = None,
    risk_level: Optional[str] = None,
    encounter_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """
    Execute parameterized search query against patient_encounters.
    Left joins care_interventions to include workflow status.
    Supports filtering by:
      - patient_nbr (Patient ID / Number)
      - risk_score (exact score 0-8)
      - risk_level ('LOW', 'MEDIUM', 'HIGH')
      - encounter_id (optional specific encounter)
    """
    where_clauses: list[str] = []
    params: list[Any] = []

    if patient_nbr is not None:
        where_clauses.append("e.patient_nbr = %s")
        params.append(patient_nbr)

    if encounter_id is not None:
        where_clauses.append("e.encounter_id = %s")
        params.append(encounter_id)

    if risk_score is not None:
        where_clauses.append("e.risk_score = %s")
        params.append(risk_score)

    if risk_level is not None:
        where_clauses.append("e.risk_level = %s")
        params.append(risk_level.upper())

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    sql = f"""
        SELECT
            e.encounter_id,
            e.patient_nbr,
            e.age,
            e.time_in_hospital,
            e.number_inpatient,
            e.number_emergency,
            e.number_outpatient,
            e.num_medications,
            e.num_lab_procedures,
            e.discharge_disposition_id,
            e.admission_type_id,
            e.readmitted,
            e.risk_score,
            e.risk_level,
            i.intervention_id,
            i.status,
            i.status AS intervention_status,
            i.assigned_to,
            i.notes
        FROM patient_encounters e
        LEFT JOIN care_interventions i ON i.encounter_id = e.encounter_id
        {where_sql}
        ORDER BY
            CASE e.risk_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
            e.risk_score DESC,
            e.encounter_id ASC
        LIMIT %s OFFSET %s;
    """
    params.extend([limit, offset])
    return fetch_all(sql, params)

