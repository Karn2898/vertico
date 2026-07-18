from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
from sqlmodel import SQLModel
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from models import SessionModel, MessageModel, DiffModel

config=context.config
fileConfig(config.config_file_name)

target_metadata=SQLModel.metadata

DATABASE_URL=os.environ.get(
    "DATABASE_URL",
     "postgresql://vertico:vertico@localhost:5432/vertico"
)
config.set_main_option("sqlalchemy.url", DATABASE_URL)

def run_migrations_online():
    connectable=engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection , target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

run_migrations_online()