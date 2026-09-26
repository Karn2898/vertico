"""add mode column to sessions and messages

Revision ID: 0001_add_mode
Revises:
Create Date: 2026-09-26
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_add_mode"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # sessions: chosen speed mode for the session ("fast" | "thorough")
    op.add_column(
        "sessions",
        sa.Column("mode", sa.String(), nullable=False, server_default="fast"),
    )
    # messages: mode in effect when the message was sent (NULL for legacy rows)
    op.add_column(
        "messages",
        sa.Column("mode", sa.String(), nullable=True),
    )


def downgrade():
    op.drop_column("messages", "mode")
    op.drop_column("sessions", "mode")
