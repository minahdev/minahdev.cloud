from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from admin.app.ports.input.piper_dunn_coo_use_case import DunnCooUseCase
from admin.dependencies.piper_dunn_coo_provider import get_piper_dunn_coo_use_case
from admin.app.dtos.piper_dunn_coo_dto import DunnCooResponse
from admin.adapter.inbound.api.schemas.piper_dunn_coo_schema import DunnCooSchema

logger = logging.getLogger(__name__)

piper_dunn_coo_router = APIRouter(prefix="/dunn", tags=["dunn"])


@piper_dunn_coo_router.get("/myself", response_model=DunnCooResponse)
async def introduce_myself(
    dunn: DunnCooUseCase = Depends(get_piper_dunn_coo_use_case)) -> DunnCooResponse:

    return await dunn.introduce_myself(
        DunnCooSchema(
            id=4,
            name="Jared Dunn",
        )
    )
