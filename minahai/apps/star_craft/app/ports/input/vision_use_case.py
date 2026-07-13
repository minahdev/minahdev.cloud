from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from star_craft.app.dtos.vision_dto import VisionIntroduceResponse, VisionUploadResponse

if TYPE_CHECKING:
    from star_craft.adapter.inbound.api.schemas.vision_schema import VisionSchema
    from star_craft.app.dtos.vision_dto import VisionImageCommand


class VisionUseCase(ABC):

    @abstractmethod
    async def introduce_myself(self, schema: VisionSchema) -> VisionIntroduceResponse:
        pass

    @abstractmethod
    async def upload_image(self, command: VisionImageCommand) -> VisionUploadResponse:
        pass
