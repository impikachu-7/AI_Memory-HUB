"""store the selected provider on messages

Revision ID: 20260820_06
Revises: 20260819_05
"""
from alembic import op
import sqlalchemy as sa

revision = '20260820_06'
down_revision = '20260819_05'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('messages', sa.Column('provider', sa.String(50), nullable=True))


def downgrade():
    op.drop_column('messages', 'provider')
