"""soccer schema (stadium, team, schedule, player) + pgvector

Revision ID: 20260713_01
Revises: 20260615_01
Create Date: 2026-07-13

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "20260713_01"
down_revision: Union[str, None] = "20260615_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # pgvector 확장 (player_embedding 전제). 이미 있으면 그대로 통과.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 1) stadium — 부모 테이블 (FK 없음)
    op.create_table(
        "stadium",
        sa.Column("stadium_id", sa.String(length=10), nullable=False),
        sa.Column("statdium_name", sa.String(length=40), nullable=False),  # ERD 원문 오타 유지
        sa.Column("hometeam_id", sa.String(length=10), nullable=True),
        sa.Column("seat_count", sa.Integer(), nullable=True),
        sa.Column("address", sa.String(length=60), nullable=True),
        sa.Column("ddd", sa.String(length=10), nullable=True),
        sa.Column("tel", sa.String(length=10), nullable=True),
        sa.PrimaryKeyConstraint("stadium_id"),
    )

    # 2) team — stadium 참조
    op.create_table(
        "team",
        sa.Column("team_id", sa.String(length=10), nullable=False),
        sa.Column("region_name", sa.String(length=10), nullable=False),
        sa.Column("team_name", sa.String(length=40), nullable=False),
        sa.Column("e_team_name", sa.String(length=50), nullable=True),
        sa.Column("orig_yyyy", sa.String(length=10), nullable=True),
        sa.Column("zip_code1", sa.String(length=10), nullable=True),
        sa.Column("zip_code2", sa.String(length=10), nullable=True),
        sa.Column("address", sa.String(length=80), nullable=True),
        sa.Column("ddd", sa.String(length=10), nullable=True),
        sa.Column("tel", sa.String(length=10), nullable=True),
        sa.Column("fax", sa.String(length=10), nullable=True),
        sa.Column("homepage", sa.String(length=50), nullable=True),
        sa.Column("owner", sa.String(length=10), nullable=True),
        sa.Column("stadium_id", sa.String(length=10), nullable=True),
        sa.PrimaryKeyConstraint("team_id"),
        sa.ForeignKeyConstraint(["stadium_id"], ["stadium.stadium_id"], name="fk_team_stadium"),
    )

    # 3) schedule — stadium 참조, 복합 PK(sche_date + stadium_id)
    op.create_table(
        "schedule",
        sa.Column("sche_date", sa.String(length=10), nullable=False),
        sa.Column("stadium_id", sa.String(length=10), nullable=False),
        sa.Column("gubun", sa.String(length=10), nullable=True),
        sa.Column("hometeam_id", sa.String(length=10), nullable=True),
        sa.Column("awayteam_id", sa.String(length=10), nullable=True),
        sa.Column("home_score", sa.Integer(), nullable=True),
        sa.Column("away_score", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("sche_date", "stadium_id"),
        sa.ForeignKeyConstraint(["stadium_id"], ["stadium.stadium_id"], name="fk_schedule_stadium"),
    )

    # 4) player — team 참조 + pgvector 임베딩
    op.create_table(
        "player",
        sa.Column("player_id", sa.String(length=10), nullable=False),
        sa.Column("player_name", sa.String(length=20), nullable=False),
        sa.Column("e_player_name", sa.String(length=40), nullable=True),
        sa.Column("nickname", sa.String(length=30), nullable=True),
        sa.Column("join_yyyy", sa.String(length=10), nullable=True),
        sa.Column("position", sa.String(length=10), nullable=True),
        sa.Column("back_no", sa.Integer(), nullable=True),
        sa.Column("nation", sa.String(length=20), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("solar", sa.String(length=10), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("weight", sa.Integer(), nullable=True),
        sa.Column("team_id", sa.String(length=10), nullable=True),
        sa.Column("player_embedding", Vector(1536), nullable=True),
        sa.PrimaryKeyConstraint("player_id"),
        sa.ForeignKeyConstraint(["team_id"], ["team.team_id"], name="fk_player_team"),
    )


def downgrade() -> None:
    # 생성 역순으로 드롭 (자식 → 부모)
    op.drop_table("player")
    op.drop_table("schedule")
    op.drop_table("team")
    op.drop_table("stadium")
