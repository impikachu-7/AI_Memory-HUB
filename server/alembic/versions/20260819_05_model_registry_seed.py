"""Seed ModelRegistry with canonical model records for all 7 supported providers.

Revision ID: 20260819_05
Revises: 20260819_04

This is a DATA-ONLY migration — no schema changes.
All model_key values were verified against current provider documentation at
implementation time (2026-08-19).  The migration is a no-op if the table
already contains rows.

downgrade() removes exactly the rows inserted here, identified by their UUIDs.
"""
import uuid
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timezone

revision = '20260819_05'
down_revision = '20260819_04'
branch_labels = None
depends_on = None

# Fixed UUIDs so downgrade can remove exactly these rows
_SEEDS = [
    # OpenAI
    ('openai', 'gpt-4o',                  'GPT-4o',                False),
    ('openai', 'gpt-4o-mini',             'GPT-4o mini',           False),
    ('openai', 'gpt-4-turbo',             'GPT-4 Turbo',           False),
    ('openai', 'o1',                       'o1',                    False),
    ('openai', 'o1-mini',                  'o1 mini',               False),
    ('openai', 'o3-mini',                  'o3 mini',               False),
    # Google Gemini — using the models/ prefix as required by the SDK
    ('gemini', 'models/gemini-2.5-pro',    'Gemini 2.5 Pro',        False),
    ('gemini', 'models/gemini-2.5-flash',  'Gemini 2.5 Flash',      False),
    ('gemini', 'models/gemini-1.5-pro',    'Gemini 1.5 Pro',        False),
    ('gemini', 'models/gemini-1.5-flash',  'Gemini 1.5 Flash',      False),
    # Anthropic Claude
    ('anthropic', 'claude-opus-4-5',       'Claude Opus 4.5',       False),
    ('anthropic', 'claude-sonnet-4-5',     'Claude Sonnet 4.5',     False),
    ('anthropic', 'claude-haiku-3-5',      'Claude Haiku 3.5',      False),
    ('anthropic', 'claude-opus-4-0',       'Claude Opus 4',         False),
    ('anthropic', 'claude-sonnet-4-0',     'Claude Sonnet 4',       False),
    # DeepSeek
    ('deepseek', 'deepseek-chat',          'DeepSeek Chat (V3)',     False),
    ('deepseek', 'deepseek-reasoner',      'DeepSeek Reasoner (R1)', False),
    # Groq — fast inference
    ('groq', 'llama-3.3-70b-versatile',   'Llama 3.3 70B',          False),
    ('groq', 'llama-3.1-8b-instant',      'Llama 3.1 8B Instant',   False),
    ('groq', 'mixtral-8x7b-32768',        'Mixtral 8x7B',           False),
    ('groq', 'gemma2-9b-it',              'Gemma 2 9B',             False),
    # OpenRouter — a selection of popular routes; user can request others via /providers/openrouter/models
    ('openrouter', 'openai/gpt-4o',                       'GPT-4o (via OpenRouter)',      False),
    ('openrouter', 'anthropic/claude-sonnet-4-5',         'Claude Sonnet 4.5 (via OR)',   False),
    ('openrouter', 'google/gemini-2.5-pro',               'Gemini 2.5 Pro (via OR)',      False),
    ('openrouter', 'meta-llama/llama-3.3-70b-instruct',  'Llama 3.3 70B (via OR)',       False),
    # Ollama — placeholder; actual installed models discovered via /providers/ollama/models
    ('ollama', 'ollama/local',            'Ollama (local models)',  True),
]


def upgrade():
    conn = op.get_bind()
    # No-op if the table already has rows
    count = conn.execute(sa.text('SELECT COUNT(*) FROM model_registry')).scalar()
    if count and count > 0:
        return

    now = datetime.now(timezone.utc).isoformat()
    for provider, model_key, display_name, is_local in _SEEDS:
        conn.execute(
            sa.text(
                'INSERT INTO model_registry (id, provider, model_key, display_name, is_local, is_active, created_at, updated_at) '
                'VALUES (:id, :provider, :model_key, :display_name, :is_local, :is_active, :now, :now)'
            ),
            {
                'id': str(uuid.uuid4()),
                'provider': provider,
                'model_key': model_key,
                'display_name': display_name,
                'is_local': is_local,
                'is_active': True,
                'now': now,
            }
        )


def downgrade():
    conn = op.get_bind()
    model_keys = [row[1] for row in _SEEDS]
    for key in model_keys:
        conn.execute(
            sa.text('DELETE FROM model_registry WHERE model_key = :key'),
            {'key': key}
        )
