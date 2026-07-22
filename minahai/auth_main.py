"""인증 전용 엔트리포인트 — auth.minahdev.cloud (별도 컨테이너).

`main.py`(비즈니스, api.minahdev.cloud)와 같은 코드베이스·다른 프로세스.
개인키(JWT_PRIVATE_KEY)는 이 컨테이너에만 존재한다.
"""

import sys
from pathlib import Path

# main.py와 동일: backend/·backend/apps/를 import 가능하게.
_BACKEND_DIR = Path(__file__).resolve().parent
_APPS_DIR = _BACKEND_DIR / "apps"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))
if _APPS_DIR.exists() and str(_APPS_DIR) not in sys.path:
    sys.path.insert(0, str(_APPS_DIR))

from fastapi import FastAPI

from auth.router import router as auth_router

app = FastAPI(
    title="Minahdev Auth",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,  # 실서비스: 문서 비노출
)
app.include_router(auth_router, prefix="/auth")


@app.get("/healthz")
async def healthz():
    return {"ok": True}
