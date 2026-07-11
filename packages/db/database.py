from sqlmodel import create_engine, Session, SQLModel
import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://tom:vertoco123@localhost:5432/vertico"
)

engine = create_engine(DATABASE_URL, echo=False)


def get_session():

    with Session(engine) as session:
        yield session


def create_db_and_tables():
    
    SQLModel.metadata.create_all(engine)