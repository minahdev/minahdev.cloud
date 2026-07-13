from abc import ABC, abstractmethod
from admin.adapter.inbound.api.schemas.piper_dunn_coo_schema import DunnCooSchema
from admin.app.dtos.piper_dunn_coo_dto import DunnCooResponse

class DunnCooUseCase(ABC):

    @abstractmethod
    async def introduce_myself(self, schema: DunnCooSchema) -> DunnCooResponse:
        pass
