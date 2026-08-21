"""login rate limits

Revision ID: 20260819_03
Revises: 20260819_02
"""
from alembic import op
import sqlalchemy as sa

revision = '20260819_03'
down_revision = '20260819_02'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('auth_rate_limits', sa.Column('id', sa.String(36), primary_key=True), sa.Column('subject', sa.String(320), nullable=False), sa.Column('action', sa.String(32), nullable=False), sa.Column('attempts', sa.Integer(), nullable=False), sa.Column('window_started_at', sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint('subject', 'action', name='uq_auth_rate_limit_subject_action'))

def downgrade(): op.drop_table('auth_rate_limits')

