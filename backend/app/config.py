import os
from dotenv import load_dotenv

# This loads the .env file
load_dotenv()

class Settings:
    # If DATABASE_URL isn't found in .env, default to SQLite.
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./triage.db")
    MODEL_PATH = os.getenv("MODEL_PATH", "../model/esi_triage_best_weight7.txt")
    
    # Surge mode flag (we will toggle this later)
    SURGE_MODE = False  

settings = Settings()