import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

def create_db_engine():
    db_url = settings.DATABASE_URL
    engine_kwargs = {"pool_pre_ping": True}
    
    if "sqlite" in db_url:
        engine_kwargs["connect_args"] = {"check_same_thread": False}
        return create_engine(db_url, **engine_kwargs)
    
    try:
        # Test PostgreSQL connection with a short timeout
        test_engine = create_engine(db_url, connect_args={"connect_timeout": 2})
        with test_engine.connect() as conn:
            pass
        engine_kwargs.update({
            "pool_size": 10,
            "max_overflow": 20,
        })
        return create_engine(db_url, **engine_kwargs)
    except Exception as e:
        # Fallback to local SQLite database if PostgreSQL server is not active
        sqlite_fallback = "sqlite:///./ops_local.db"
        print(f"[DB Notice] PostgreSQL not reachable ({e}). Falling back to SQLite local storage: {sqlite_fallback}")
        engine_kwargs = {"connect_args": {"check_same_thread": False}}
        return create_engine(sqlite_fallback, **engine_kwargs)

engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency that provides a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
