from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.matrix.database_manager import get_db
from admin.adapter.outbound.repositories.piper_dinesh_dash_repository import DineshDashRepository
from admin.app.ports.output.piper_dinesh_dash_port import DineshDashPort
from admin.app.ports.input.piper_dinesh_dash_use_case import DineshDashUseCase
from admin.app.use_cases.piper_dinesh_dash_interactor import DineshDashInteractor


def get_dinesh_dash_repository(db: AsyncSession = Depends(get_db)) -> DineshDashPort:
    return DineshDashRepository(session=db)


def get_piper_dinesh_dash_use_case(
    repository: DineshDashPort = Depends(get_dinesh_dash_repository),
) -> DineshDashUseCase:
    return DineshDashInteractor(repository=repository)
