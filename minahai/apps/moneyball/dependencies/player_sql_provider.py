from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.matrix.database_manager import get_db

from moneyball.adapter.outbound.repositories.player_sql_repository import PlayerSqlRepository
from moneyball.app.ports.input.player_sql_use_case import PlayerSqlUseCase


def get_player_sql_use_case(
    db: AsyncSession = Depends(get_db),
) -> PlayerSqlUseCase:
    return PlayerSqlRepository(session=db)
