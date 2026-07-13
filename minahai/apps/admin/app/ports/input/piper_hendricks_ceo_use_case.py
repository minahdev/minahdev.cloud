from abc import ABC, abstractmethod
from admin.adapter.inbound.api.schemas.piper_hendricks_ceo_schema import HendricksCeoSchema
from admin.app.dtos.piper_hendricks_ceo_dto import HendricksCeoResponse

class HendricksCeoUseCase(ABC):

    @abstractmethod
    async def introduce_myself(self, schema: HendricksCeoSchema) -> HendricksCeoResponse:
        pass
