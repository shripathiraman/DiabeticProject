"""
Database migration script to create care_intervention_history table and audit trail trigger.
"""
from backend.app.db import get_dict_connection

SQL = """
CREATE TABLE IF NOT EXISTS care_intervention_history (
    history_id BIGSERIAL PRIMARY KEY,
    encounter_id BIGINT NOT NULL REFERENCES patient_encounters(encounter_id) ON DELETE CASCADE,
    intervention_id BIGINT REFERENCES care_interventions(intervention_id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL,
    assigned_to VARCHAR(100),
    notes TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION log_care_intervention_history()
RETURNS TRIGGER AS $func$
BEGIN
    INSERT INTO care_intervention_history (encounter_id, intervention_id, status, assigned_to, notes, changed_at)
    VALUES (NEW.encounter_id, NEW.intervention_id, NEW.status, NEW.assigned_to, NEW.notes, NOW());
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS care_interventions_audit_trail ON care_interventions;

CREATE TRIGGER care_interventions_audit_trail
AFTER INSERT OR UPDATE ON care_interventions
FOR EACH ROW
EXECUTE FUNCTION log_care_intervention_history();

CREATE INDEX IF NOT EXISTS idx_care_intervention_history_encounter
    ON care_intervention_history(encounter_id, changed_at DESC);

-- Seed existing interventions into history if table is empty
INSERT INTO care_intervention_history (encounter_id, intervention_id, status, assigned_to, notes, changed_at)
SELECT encounter_id, intervention_id, status, assigned_to, notes, COALESCE(updated_at, created_at, NOW())
FROM care_interventions
WHERE NOT EXISTS (SELECT 1 FROM care_intervention_history);
"""

def run_migration():
    conn = get_dict_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(SQL)
        conn.commit()
        print("care_intervention_history table and trigger successfully set up!")
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
