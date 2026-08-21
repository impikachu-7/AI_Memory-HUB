"""secure authentication state

Revision ID: 20260819_02
Revises: 20260819_01
"""
from alembic import op
import sqlalchemy as sa

revision = '20260819_02'
down_revision = '20260819_01'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('users', sa.Column('auth_version', sa.Integer(), nullable=False, server_default='0'))
    op.create_table('auth_otps', sa.Column('id', sa.String(36), primary_key=True), sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('purpose', sa.String(32), nullable=False), sa.Column('code_hash', sa.String(64), nullable=False), sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False), sa.Column('attempts', sa.Integer(), nullable=False), sa.Column('max_attempts', sa.Integer(), nullable=False), sa.Column('used_at', sa.DateTime(timezone=True)), sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False))
    op.create_index('ix_auth_otps_user_id', 'auth_otps', ['user_id']); op.create_index('ix_auth_otps_purpose', 'auth_otps', ['purpose']); op.create_index('ix_auth_otps_expires_at', 'auth_otps', ['expires_at'])
    op.create_table('auth_sessions', sa.Column('id', sa.String(36), primary_key=True), sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False), sa.Column('revoked_at', sa.DateTime(timezone=True)), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False))
    op.create_index('ix_auth_sessions_user_id', 'auth_sessions', ['user_id']); op.create_index('ix_auth_sessions_expires_at', 'auth_sessions', ['expires_at'])
    op.create_table('oauth_identities', sa.Column('id', sa.String(36), primary_key=True), sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('provider', sa.String(50), nullable=False), sa.Column('subject', sa.String(255), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False), sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False), sa.UniqueConstraint('provider', 'subject', name='uq_oauth_provider_subject'))
    op.create_index('ix_oauth_identities_user_id', 'oauth_identities', ['user_id'])

def downgrade():
    op.drop_table('oauth_identities'); op.drop_table('auth_sessions'); op.drop_table('auth_otps'); op.drop_column('users', 'auth_version')

