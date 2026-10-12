
from sqlalchemy import text

from app.db.session import engine

try:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT DATABASE(), VERSION()"))
        database, version = result.one()

        print("Database connection successful!")
        print(f"Database: {database}")
        print(f"MySQL version: {version}")
except Exception as exc:
    print("Database connection failed.")
    print(f"Error: {exc}")
