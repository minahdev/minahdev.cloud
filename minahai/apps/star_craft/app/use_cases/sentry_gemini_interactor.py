



from __future__ import annotations

import logging

from minahai.core.matrix.secret_manager import Keymaker

logger = logging.getLogger(__name__)


class SentryGeminiInteractor:
    """질문을 받아 Gemini(GEMINI_API_KEY)로 답변을 생성하는 use case.

    - 연결·모델 폴백·키/할당량 오류 처리는 Keymaker(SSOT)에 위임한다.
    - 생성한 답변 텍스트를 반환하면, 상위 라우터가 화면(프론트)으로 내보낸다.
    """

    def __init__(self, keymaker: Keymaker) -> None:
        self._keymaker = keymaker

    def answer(self, question: str) -> str:
        text = (question or "").strip()
        if not text:
            raise ValueError("질문이 비어 있습니다.")

        logger.info("[sentry_gemini] 질문 수신 -> Gemini 위임 | q=%s", text[:60])
        reply, model_used = self._keymaker.send_chat(history=[], user_text=text)
        logger.info(
            "[sentry_gemini] 답변 생성 완료 | model=%s | 길이=%d자", model_used, len(reply)
        )
        return reply
