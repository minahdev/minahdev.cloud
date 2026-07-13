from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from admin.app.ports.input.piper_bighetti_hr_use_case import BighettiHrUseCase
from admin.dependencies.piper_bighetti_hr_provider import get_piper_bighetti_hr_use_case
from admin.app.dtos.piper_bighetti_hr_dto import BighettiHrResponse
from admin.adapter.inbound.api.schemas.piper_bighetti_hr_schema import BighettiHrSchema

logger = logging.getLogger(__name__)

piper_bighetti_hr_router = APIRouter(prefix="/bighetti", tags=["bighetti"])


@piper_bighetti_hr_router.get("/myself", response_model=BighettiHrResponse)
async def introduce_myself(
    bighetti: BighettiHrUseCase = Depends(get_piper_bighetti_hr_use_case)) -> BighettiHrResponse:

    return await bighetti.introduce_myself(
        BighettiHrSchema(
            id=2,
            name="Nelson Bighetti",
        )
    )
