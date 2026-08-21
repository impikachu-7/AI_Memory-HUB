"""memory engine metadata

Revision ID: 20260819_04
Revises: 20260819_03
"""
from alembic import op
import sqlalchemy as sa
revision='20260819_04'; down_revision='20260819_03'; branch_labels=None; depends_on=None
def upgrade():
    op.add_column('memories', sa.Column('importance', sa.Float(), nullable=False, server_default='0.5'))
    op.add_column('memories', sa.Column('confidence', sa.Float(), nullable=False, server_default='0.7'))
    op.add_column('memories', sa.Column('is_pinned', sa.Boolean(), nullable=False, server_default=sa.false()))
    with op.batch_alter_table('memories') as batch:
        batch.alter_column('category', existing_type=sa.String(100), nullable=False, server_default='Other')
def downgrade():
    op.drop_column('memories', 'is_pinned'); op.drop_column('memories', 'confidence'); op.drop_column('memories', 'importance')

