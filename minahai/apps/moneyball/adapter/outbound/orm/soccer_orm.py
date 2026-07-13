"""축구 DB ORM 모델 (SQLAlchemy 2.0 Declarative Mapping).

ERD 4개 테이블: stadium · team · schedule · player.
player.player_embedding 은 pgvector 로 임베딩(1536차원)을 저장한다.

주의: `stadium.statdium_name` 은 ERD 원문의 오타를 그대로 따른다.
"""

from __future__ import annotations

from datetime import date

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy import Date as SADate
from sqlalchemy.orm import Mapped, mapped_column

from core.matrix.database_manager import Base


class Stadium(Base):
    __tablename__ = "stadium"

    stadium_id: Mapped[str] = mapped_column(String(10), primary_key=True)
    statdium_name: Mapped[str] = mapped_column(String(40), nullable=False)  # ERD 원문 오타 유지
    hometeam_id: Mapped[str | None] = mapped_column(String(10), nullable=True)
    seat_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    address: Mapped[str | None] = mapped_column(String(60), nullable=True)
    ddd: Mapped[str | None] = mapped_column(String(10), nullable=True)
    tel: Mapped[str | None] = mapped_column(String(10), nullable=True)


class Team(Base):
    __tablename__ = "team"

    team_id: Mapped[str] = mapped_column(String(10), primary_key=True)
    region_name: Mapped[str] = mapped_column(String(10), nullable=False)
    team_name: Mapped[str] = mapped_column(String(40), nullable=False)
    e_team_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    orig_yyyy: Mapped[str | None] = mapped_column(String(10), nullable=True)
    zip_code1: Mapped[str | None] = mapped_column(String(10), nullable=True)
    zip_code2: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address: Mapped[str | None] = mapped_column(String(80), nullable=True)
    ddd: Mapped[str | None] = mapped_column(String(10), nullable=True)
    tel: Mapped[str | None] = mapped_column(String(10), nullable=True)
    fax: Mapped[str | None] = mapped_column(String(10), nullable=True)
    homepage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    owner: Mapped[str | None] = mapped_column(String(10), nullable=True)
    stadium_id: Mapped[str | None] = mapped_column(
        String(10), ForeignKey("stadium.stadium_id"), nullable=True
    )


class Schedule(Base):
    __tablename__ = "schedule"

    sche_date: Mapped[str] = mapped_column(String(10), primary_key=True)
    stadium_id: Mapped[str] = mapped_column(
        String(10), ForeignKey("stadium.stadium_id"), primary_key=True
    )
    gubun: Mapped[str | None] = mapped_column(String(10), nullable=True)
    hometeam_id: Mapped[str | None] = mapped_column(String(10), nullable=True)
    awayteam_id: Mapped[str | None] = mapped_column(String(10), nullable=True)
    home_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_score: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Player(Base):
    __tablename__ = "player"

    player_id: Mapped[str] = mapped_column(String(10), primary_key=True)
    player_name: Mapped[str] = mapped_column(String(20), nullable=False)
    e_player_name: Mapped[str | None] = mapped_column(String(40), nullable=True)
    nickname: Mapped[str | None] = mapped_column(String(30), nullable=True)
    join_yyyy: Mapped[str | None] = mapped_column(String(10), nullable=True)
    position: Mapped[str | None] = mapped_column(String(10), nullable=True)
    back_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    nation: Mapped[str | None] = mapped_column(String(20), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(SADate, nullable=True)
    solar: Mapped[str | None] = mapped_column(String(10), nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
    team_id: Mapped[str | None] = mapped_column(
        String(10), ForeignKey("team.team_id"), nullable=True
    )
    player_embedding: Mapped[list[float] | None] = mapped_column(Vector(1536), nullable=True)
