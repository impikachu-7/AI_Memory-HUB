"""initial AI Memory Hub schema

Revision ID: 20260819_01
Revises:
Create Date: 2026-08-19
"""
from alembic import op
import sqlalchemy as sa

revision = '20260819_01'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    def timestamps(): return [sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False)]
    op.create_table('users', sa.Column('id', sa.String(36), primary_key=True), sa.Column('email', sa.String(320), nullable=False), sa.Column('password_hash', sa.String(512), nullable=False), sa.Column('full_name', sa.String(200)), sa.Column('is_active', sa.Boolean(), nullable=False), sa.Column('is_email_verified', sa.Boolean(), nullable=False), *timestamps(), sa.UniqueConstraint('email'))
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_table('model_registry', sa.Column('id', sa.String(36), primary_key=True), sa.Column('provider', sa.String(50), nullable=False), sa.Column('model_key', sa.String(150), nullable=False), sa.Column('display_name', sa.String(150), nullable=False), sa.Column('is_local', sa.Boolean(), nullable=False), sa.Column('is_active', sa.Boolean(), nullable=False), *timestamps(), sa.UniqueConstraint('model_key'))
    op.create_table('conversations', sa.Column('id', sa.String(36), primary_key=True), sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('title', sa.String(300), nullable=False), sa.Column('selected_model_id', sa.String(36), sa.ForeignKey('model_registry.id', ondelete='SET NULL')), sa.Column('is_archived', sa.Boolean(), nullable=False), *timestamps())
    op.create_index('ix_conversations_user_id', 'conversations', ['user_id'])
    for name, extra in [('messages', [sa.Column('conversation_id', sa.String(36), sa.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False), sa.Column('role', sa.String(20), nullable=False), sa.Column('content', sa.Text(), nullable=False), sa.Column('model_id', sa.String(100))]), ('memories', [sa.Column('content', sa.Text(), nullable=False), sa.Column('category', sa.String(100)), sa.Column('source_conversation_id', sa.String(36), sa.ForeignKey('conversations.id', ondelete='SET NULL')), sa.Column('is_archived', sa.Boolean(), nullable=False), sa.Column('metadata', sa.JSON(), nullable=False)]), ('provider_configurations', [sa.Column('provider', sa.String(50), nullable=False), sa.Column('encrypted_api_key', sa.Text()), sa.Column('is_enabled', sa.Boolean(), nullable=False), sa.UniqueConstraint('user_id', 'provider', name='uq_user_provider')])]:
        op.create_table(name, sa.Column('id', sa.String(36), primary_key=True), sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), *extra, *timestamps())
        op.create_index(f'ix_{name}_user_id', name, ['user_id'])
def downgrade():
    for table in ['provider_configurations','memories','messages','conversations','model_registry','users']: op.drop_table(table)

