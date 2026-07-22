from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from core.matrix.database_manager import Base


class ScheduleCoachMember(Base):
    """코치↔회원 담당 매칭 — 회원이 코치의 일회용 코드/링크로 입장하면 연결된다.

    member_user_id는 유일 → 회원은 한 번에 한 코치에 소속. 다른 코치 코드로
    다시 입장하면 그 코치로 재연결(upsert).
    """

    __tablename__ = "schedule_coach_members"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        name="id",
    )
    member_user_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    coach_user_id: Mapped[str] = mapped_column(String(64), index=True)
    linked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
