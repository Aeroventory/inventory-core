from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from core.config import settings

engine = create_engine(settings.database_url)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# 4. Create the dependency that FastAPI will use to get a database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()