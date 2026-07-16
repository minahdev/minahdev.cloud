from __future__ import annotations

from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str


class CoachChatSchema(BaseModel):
    """프론트 계약: { messages: [{role, content}, ...] }"""

    messages: list[ChatMessage]


class CoachChatResponse(BaseModel):
    """프론트 계약: { text: "..." }"""

    text: str
