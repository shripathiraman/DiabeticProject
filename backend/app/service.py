"""
Business logic layer (Service) for patient operations and workflows.
Contains pure modular functions for business rules and input validations.
"""
from typing import Any, Optional
from fastapi import HTTPException
from .models import RiskLevel
from . import repository

VALID_RISK_LEVELS = {"LOW", "MEDIUM", "HIGH"}


def search_patients(
    patient_nbr: Optional[int] = None,
    risk_score: Optional[int] = None,
    risk_level: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """
    Validate business rules and execute patient search.

    Business Rules & Validations:
    1. patient_nbr must be a positive integer if provided.
    2. risk_score must be an integer between 0 and 8 (inclusive) if provided.
    3. risk_level must be one of 'LOW', 'MEDIUM', 'HIGH' (case-insensitive) if provided.
    4. limit must be between 1 and 500 (inclusive).
    5. offset must be >= 0.
    """
    # Validate patient_nbr
    if patient_nbr is not None and patient_nbr <= 0:
        raise HTTPException(
            status_code=400,
            detail="Patient Number must be a positive integer.",
        )

    # Validate risk_score
    if risk_score is not None and (risk_score < 0 or risk_score > 8):
        raise HTTPException(
            status_code=400,
            detail="Risk score must be between 0 and 8.",
        )

    # Validate and normalize risk_level
    normalized_risk_level: Optional[str] = None
    if risk_level is not None:
        normalized_risk_level = risk_level.strip().upper()
        if normalized_risk_level not in VALID_RISK_LEVELS:
            allowed = ", ".join(sorted(VALID_RISK_LEVELS))
            raise HTTPException(
                status_code=400,
                detail=f"Invalid risk_level '{risk_level}'. Allowed values: {allowed}.",
            )

    # Sanitize limit and offset
    sanitized_limit = max(1, min(limit, 500))
    sanitized_offset = max(0, offset)

    return repository.search_patients(
        patient_nbr=patient_nbr,
        risk_score=risk_score,
        risk_level=normalized_risk_level,
        limit=sanitized_limit,
        offset=sanitized_offset,
    )

