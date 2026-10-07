from sqlmodel import create_engine, Session, SQLModel
import os

from . import models  # noqa: F401 - registers SQLModel tables

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://tom:vertoco123@localhost:5432/vertico"
)

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=60,
    pool_size=10,
    max_overflow=20,
    connect_args={"keepalives": 1, "keepalives_idle": 30, "keepalives_interval": 10, "keepalives_count": 5},
)


def get_session():

    with Session(engine) as session:
        yield session


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)