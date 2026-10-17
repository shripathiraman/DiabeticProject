from typing import Any, Mapping

REQUIRED_DATASET_COLUMNS = [
    "encounter_id",
    "patient_nbr",
    "age",
    "time_in_hospital",
    "number_inpatient",
    "number_emergency",
    "number_outpatient",
    "num_medications",
    "num_lab_procedures",
    "discharge_disposition_id",
    "admission_type_id",
    "readmitted",
]

VALID_RISK_LEVELS = {"LOW", "MEDIUM", "HIGH"}


def calculate_risk_score(encounter: Mapping[str, Any]) -> int:
    """
    Calculate explainable risk score from operational fields only.
    Historical 'readmitted' outcome is NOT used in scoring.
    """
    score = 0

    if int(encounter["number_inpatient"]) >= 3:
        score += 3
    if int(encounter["number_emergency"]) >= 2:
        score += 2
    if int(encounter["number_outpatient"]) >= 3:
        score += 1
    if int(encounter["time_in_hospital"]) >= 7:
        score += 1
    if int(encounter["num_medications"]) >= 20:
        score += 1

    return score


def calculate_risk_level(risk_score: int) -> str:
    """Map numeric risk score to clinical tier."""
    if risk_score >= 5:
        return "HIGH"
    if risk_score >= 3:
        return "MEDIUM"
    return "LOW"


def score_encounter(encounter: Mapping[str, Any]) -> dict[str, Any]:
    """Return a dictionary enriched with risk_score and risk_level."""
    record = dict(encounter)
    score = calculate_risk_score(record)
    record["risk_score"] = score
    record["risk_level"] = calculate_risk_level(score)
    return record
