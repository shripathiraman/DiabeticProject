import sys
from pathlib import Path
import pandas as pd

# Ensure project root is in sys.path when running script directly
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from backend.app.db import execute_batch_insert, get_connection
from backend.app.risk import REQUIRED_DATASET_COLUMNS, score_encounter

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "diabetic_data.csv"

INTEGER_COLUMNS = [
    "encounter_id",
    "patient_nbr",
    "time_in_hospital",
    "number_inpatient",
    "number_emergency",
    "number_outpatient",
    "num_medications",
    "num_lab_procedures",
    "discharge_disposition_id",
    "admission_type_id",
]

PATIENT_ENCOUNTER_COLUMNS = [
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
    "risk_score",
    "risk_level",
]


def load_dataset(csv_path: Path = DATA_FILE) -> pd.DataFrame:
    """Read CSV dataset, select required columns, and convert data types."""
    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset not found at: {csv_path}")

    df = pd.read_csv(csv_path, usecols=REQUIRED_DATASET_COLUMNS)

    for col in INTEGER_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="raise").astype(int)

    df["age"] = df["age"].astype(str)
    df["readmitted"] = df["readmitted"].astype(str)
    return df


def prepare_encounters(df: pd.DataFrame) -> list[dict]:
    """Convert dataframe rows to dictionaries and calculate operational risk scores."""
    records = df.to_dict(orient="records")
    return [score_encounter(r) for r in records]


def upsert_patient_encounters(records: list[dict]) -> int:
    """Insert or update patient encounter records in PostgreSQL."""
    if not records:
        return 0

    values = [
        tuple(record[col] for col in PATIENT_ENCOUNTER_COLUMNS)
        for record in records
    ]

    sql = """
        INSERT INTO patient_encounters (
            encounter_id, patient_nbr, age, time_in_hospital,
            number_inpatient, number_emergency, number_outpatient,
            num_medications, num_lab_procedures, discharge_disposition_id,
            admission_type_id, readmitted, risk_score, risk_level
        )
        VALUES %s
        ON CONFLICT (encounter_id) DO UPDATE SET
            patient_nbr = EXCLUDED.patient_nbr,
            age = EXCLUDED.age,
            time_in_hospital = EXCLUDED.time_in_hospital,
            number_inpatient = EXCLUDED.number_inpatient,
            number_emergency = EXCLUDED.number_emergency,
            number_outpatient = EXCLUDED.number_outpatient,
            num_medications = EXCLUDED.num_medications,
            num_lab_procedures = EXCLUDED.num_lab_procedures,
            discharge_disposition_id = EXCLUDED.discharge_disposition_id,
            admission_type_id = EXCLUDED.admission_type_id,
            readmitted = EXCLUDED.readmitted,
            risk_score = EXCLUDED.risk_score,
            risk_level = EXCLUDED.risk_level;
    """
    return execute_batch_insert(sql, values, page_size=1000)


def create_care_interventions_for_queue() -> int:
    """Populate care_interventions table for encounters classified as MEDIUM or HIGH risk."""
    sql = """
        INSERT INTO care_interventions (encounter_id)
        SELECT encounter_id
        FROM patient_encounters
        WHERE risk_level IN ('MEDIUM', 'HIGH')
        ON CONFLICT (encounter_id) DO NOTHING;
    """
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql)
            count = cursor.rowcount
        conn.commit()
        return count
    finally:
        conn.close()


def main():
    """Main ETL pipeline runner."""
    print(f"Loading dataset from: {DATA_FILE}")
    df = load_dataset(DATA_FILE)

    print(f"Scoring {len(df)} records using risk rules...")
    scored_records = prepare_encounters(df)

    print("Upserting records into PostgreSQL patient_encounters...")
    encounter_count = upsert_patient_encounters(scored_records)

    print("Creating care queue interventions for MEDIUM and HIGH risk patients...")
    intervention_count = create_care_interventions_for_queue()

    print(f"Successfully loaded {encounter_count} encounters.")
    print(f"Created {intervention_count} care intervention records.")
    print("ETL pipeline complete.")


if __name__ == "__main__":
    main()
