"""
Manual database connection test.

Run from the backend/ folder (with your venv active and .env configured):

    python test_db_connection.py

It will:
1. Attempt to connect to DATABASE_URL.
2. Create all tables (users, leads, automation_logs, conversations) if missing.
3. List the tables that exist after creation.
"""
from sqlalchemy import inspect, text

from app.database.database import Base, engine, SessionLocal
from app.database import models  # noqa: F401 - registers models on Base


def main():
    print(f"Connecting to: {engine.url.render_as_string(hide_password=True)}")

    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        print("✅ Connection successful.")
    except Exception as exc:
        print(f"❌ Connection failed: {exc}")
        return

    print("Creating tables (if they don't already exist)...")
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    tables = sorted(inspector.get_table_names())
    print(f"✅ Tables present in database: {tables}")

    expected = {"users", "leads", "automation_logs", "conversations"}
    missing = expected - set(tables)
    if missing:
        print(f"⚠️  Missing expected tables: {missing}")
    else:
        print("✅ All expected tables exist.")


if __name__ == "__main__":
    main()
