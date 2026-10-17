from contextlib import contextmanager
from typing import Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

from .config import settings


def get_connection():
    """Establish and return a standard PostgreSQL connection."""
    return psycopg2.connect(**settings.db_config)


def get_dict_connection():
    """Establish and return a connection that produces dictionary rows (RealDictCursor)."""
    return psycopg2.connect(**settings.db_config, cursor_factory=RealDictCursor)


@contextmanager
def get_db():
    """
    Context manager that yields a dictionary cursor and handles commit/rollback.
    Usage:
        with get_db() as cur:
            cur.execute("SELECT ...")
            rows = cur.fetchall()
    """
    conn = get_dict_connection()
    try:
        with conn.cursor() as cursor:
            yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fetch_all(sql: str, params: tuple[Any, ...] | list[Any] = ()) -> list[dict[str, Any]]:
    """Execute a SELECT query and return all matching rows as dictionaries."""
    conn = get_dict_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, tuple(params))
            return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def fetch_one(sql: str, params: tuple[Any, ...] | list[Any] = ()) -> Optional[dict[str, Any]]:
    """Execute a SELECT query and return a single row as a dictionary, or None."""
    conn = get_dict_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, tuple(params))
            row = cursor.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def execute_batch_insert(sql: str, values: list[tuple[Any, ...]], page_size: int = 1000) -> int:
    """Execute high-performance bulk insert using psycopg2's execute_values."""
    if not values:
        return 0

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            execute_values(cursor, sql, values, page_size=page_size)
        conn.commit()
        return len(values)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def test_connection() -> bool:
    """Test database connectivity and print diagnostic status."""
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT current_database(), current_user, version();")
            db_name, db_user, version = cursor.fetchone()
            print("Successfully connected to PostgreSQL database!")
            print(f"  Database : {db_name}")
            print(f"  User     : {db_user}")
            print(f"  Version  : {version.split(',')[0]}")

            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'patient_encounters'
                );
                """
            )
            table_exists = cursor.fetchone()[0]
            if table_exists:
                cursor.execute("SELECT COUNT(*) FROM patient_encounters;")
                count = cursor.fetchone()[0]
                print(f"  Found {count} records in 'patient_encounters' table.")
            else:
                print("  Table 'patient_encounters' does not exist yet. Run schema.sql first.")

        conn.close()
        return True
    except Exception as error:
        print(f"Connection test failed: {error}")
        return False


if __name__ == "__main__":
    test_connection()
