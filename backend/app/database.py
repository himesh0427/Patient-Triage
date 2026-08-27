from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# SQLite specific: "check_same_thread" prevents errors when multiple parts of the app try to access the file simultaneously.
connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

# 1. The Engine: This is the "motor" that actually talks to the SQLite file.
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)

# 2. The SessionLocal: This is the "factory" that creates new scratch pads for each web request.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 3. The Base: All our tables (Patient, Visit, etc.) will inherit from this. 
# It tells SQLAlchemy that these Python classes are actually database tables.
Base = declarative_base()

# 4. The Dependency (get_db): This is used by FastAPI.
# Every time a request comes in, it creates a fresh "scratch pad" (session), 
# does the work, and closes it automatically to save memory.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()