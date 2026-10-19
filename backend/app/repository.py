"""
Data access layer (Repository) for patient encounters and care interventions.
All raw SQL queries and database interactions reside here as pure modular functions.
"""
from typing import Any, Optional
from .db import fetch_all, fetch_one, get_dict_connection

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
    i.intervention_id, i.status, i.status AS intervention_status,
    i.assigned_to, i.notes, i.created_at, i.updated_at
"""


# ---------------------------------------------------------------------------
# Patient Search
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Encounters
# ---------------------------------------------------------------------------
def insert_encounter(encounter: dict[str, Any]) -> dict[str, Any]:
    """Insert a new scored encounter into patient_encounters."""
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
            inserted = cursor.fetchone()
        conn.commit()
        return dict(inserted)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_encounters(limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
    """Retrieve a paginated list of patient hospital encounters."""
    sql = f"""
        SELECT {ENCOUNTER_COLUMNS}
        FROM patient_encounters
        ORDER BY encounter_id
        LIMIT %s OFFSET %s;
    """
    return fetch_all(sql, (limit, offset))


def get_encounter_by_id(encounter_id: int) -> Optional[dict[str, Any]]:
    """Fetch a single patient encounter by ID."""
    sql = f"""
        SELECT {ENCOUNTER_COLUMNS}
        FROM patient_encounters
        WHERE encounter_id = %s;
    """
    return fetch_one(sql, (encounter_id,))


# ---------------------------------------------------------------------------
# Care Queue
# ---------------------------------------------------------------------------
def query_care_queue(
    risk_levels: list[str],
    min_risk_score: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Query the care queue ordered by risk level and score priority."""
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


# ---------------------------------------------------------------------------
# Interventions
# ---------------------------------------------------------------------------
def get_intervention_by_encounter_id(encounter_id: int) -> Optional[dict[str, Any]]:
    """Fetch intervention record for a given encounter ID enriched with patient details."""
    sql = """
        SELECT 
            COALESCE(i.intervention_id, 0) AS intervention_id,
            e.encounter_id,
            e.patient_nbr,
            e.risk_level,
            e.risk_score,
            COALESCE(i.status, 'PENDING_REVIEW') AS status,
            i.assigned_to,
            i.notes,
            COALESCE(i.created_at, NOW()) AS created_at,
            COALESCE(i.updated_at, NOW()) AS updated_at
        FROM patient_encounters e
        LEFT JOIN care_interventions i ON i.encounter_id = e.encounter_id
        WHERE e.encounter_id = %s;
    """
    return fetch_one(sql, (encounter_id,))


def update_intervention(
    encounter_id: int,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    notes: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """Update workflow status, assignee, or clinical notes for an intervention."""
    encounter = get_encounter_by_id(encounter_id)
    if not encounter:
        return None

    existing = fetch_one("SELECT intervention_id, encounter_id, status, assigned_to, notes, created_at, updated_at FROM care_interventions WHERE encounter_id = %s", (encounter_id,))

    conn = get_dict_connection()
    try:
        with conn.cursor() as cursor:
            if existing:
                updates: list[str] = []
                params: list[Any] = []

                if status is not None:
                    updates.append("status = %s")
                    params.append(status)

                if assigned_to is not None:
                    updates.append("assigned_to = %s")
                    params.append(assigned_to)

                if notes is not None:
                    updates.append("notes = %s")
                    params.append(notes)

                if updates:
                    params.append(encounter_id)
                    sql = f"""
                        UPDATE care_interventions
                        SET {", ".join(updates)}
                        WHERE encounter_id = %s
                        RETURNING intervention_id, encounter_id, status, assigned_to, notes, created_at, updated_at;
                    """
                    cursor.execute(sql, tuple(params))
                    updated_row = cursor.fetchone()
                else:
                    updated_row = existing
            else:
                sql = """
                    INSERT INTO care_interventions (encounter_id, status, assigned_to, notes)
                    VALUES (%s, COALESCE(%s, 'PENDING_REVIEW'), %s, %s)
                    RETURNING intervention_id, encounter_id, status, assigned_to, notes, created_at, updated_at;
                """
                cursor.execute(sql, (encounter_id, status, assigned_to, notes))
                updated_row = cursor.fetchone()

        conn.commit()
        if updated_row:
            row_dict = dict(updated_row)
            row_dict["patient_nbr"] = encounter["patient_nbr"]
            row_dict["risk_level"] = encounter["risk_level"]
            row_dict["risk_score"] = encounter["risk_score"]
            return row_dict
        return None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_intervention_history(encounter_id: int) -> list[dict[str, Any]]:
    """Fetch complete immutable audit history for an encounter from care_intervention_history."""
    sql = """
        SELECT 
            h.history_id,
            h.encounter_id,
            e.patient_nbr,
            h.status,
            h.assigned_to,
            h.notes,
            h.changed_at
        FROM care_intervention_history h
        JOIN patient_encounters e ON e.encounter_id = h.encounter_id
        WHERE h.encounter_id = %s
        ORDER BY h.changed_at DESC, h.history_id DESC;
    """
    return fetch_all(sql, (encounter_id,))


# ---------------------------------------------------------------------------
# Operations & Analytics
# ---------------------------------------------------------------------------
def get_operations_summary() -> dict[str, Any]:
    """Retrieve operational summary metrics across encounters and interventions."""
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


def get_readmission_raw_data() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Retrieve raw readmission counts overall and grouped by risk level."""
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
    return total, groups
