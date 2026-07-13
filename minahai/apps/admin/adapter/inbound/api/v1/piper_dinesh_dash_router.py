from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from admin.app.ports.input.piper_dinesh_dash_use_case import DineshDashUseCase
from admin.dependencies.piper_dinesh_dash_provider import get_piper_dinesh_dash_use_case
from admin.app.dtos.piper_dinesh_dash_dto import DineshDashResponse
from admin.adapter.inbound.api.schemas.piper_dinesh_dash_schema import DineshDashSchema

logger = logging.getLogger(__name__)

piper_dinesh_dash_router = APIRouter(prefix="/dinesh", tags=["dinesh"])


@piper_dinesh_dash_router.get("/myself", response_model=DineshDashResponse)
async def introduce_myself(
    dinesh: DineshDashUseCase = Depends(get_piper_dinesh_dash_use_case)) -> DineshDashResponse:

    return await dinesh.introduce_myself(
        DineshDashSchema(
            id=3,
            name="Dinesh Chugtai",
        )
    )
