from __future__ import annotations

from admin.adapter.inbound.api.schemas.piper_dinesh_dash_schema import DineshDashSchema
from admin.app.dtos.piper_dinesh_dash_dto import DineshDashQuery, DineshDashResponse
from admin.app.ports.input.piper_dinesh_dash_use_case import DineshDashUseCase
from admin.app.ports.output.piper_dinesh_dash_port import DineshDashPort


class DineshDashInteractor(DineshDashUseCase):

    def __init__(self, repository: DineshDashPort) -> None:
        self._repository = repository

    async def introduce_myself(self, schema: DineshDashSchema) -> DineshDashResponse:
        return await self._repository.introduce_myself(DineshDashQuery(
            id=schema.id,
            name=schema.name,
        ))
