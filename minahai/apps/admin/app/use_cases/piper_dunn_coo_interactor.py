from __future__ import annotations

from admin.adapter.inbound.api.schemas.piper_dunn_coo_schema import DunnCooSchema
from admin.app.dtos.piper_dunn_coo_dto import DunnCooQuery, DunnCooResponse
from admin.app.ports.input.piper_dunn_coo_use_case import DunnCooUseCase
from admin.app.ports.output.piper_dunn_coo_port import DunnCooPort


class DunnCooInteractor(DunnCooUseCase):

    def __init__(self, repository: DunnCooPort) -> None:
        self._repository = repository

    async def introduce_myself(self, schema: DunnCooSchema) -> DunnCooResponse:
        return await self._repository.introduce_myself(DunnCooQuery(
            id=schema.id,
            name=schema.name,
        ))
