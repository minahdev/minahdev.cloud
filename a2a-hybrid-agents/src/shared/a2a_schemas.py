"""Minimal A2A (Agent2Agent) wire schemas.

A deliberately small, verifiable subset of the A2A concepts so the skeleton
runs today with only FastAPI + Pydantic. Swap for the official `a2a-sdk`
(import name: ``a2a``) types when hardening — see README.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _uuid() -> str:
    return uuid4().hex


class Skill(BaseModel):
    """One capability advertised on an AgentCard."""

    id: str
    name: str
    description: str


class AgentCard(BaseModel):
    """Served at ``/.well-known/agent.json`` — how peers discover an agent."""

    name: str
    description: str
    url: str
    version: str = "0.1.0"
    streaming: bool = True
    skills: list[Skill] = Field(default_factory=list)


class A2AMessage(BaseModel):
    """A single turn. ``parts`` keeps text fragments (A2A allows multi-part)."""

    role: Literal["user", "agent"]
    parts: list[str]
    message_id: str = Field(default_factory=_uuid)

    @classmethod
    def text(cls, role: Literal["user", "agent"], content: str) -> A2AMessage:
        return cls(role=role, parts=[content])

    @property
    def content(self) -> str:
        return "\n".join(self.parts)


class A2ATaskRequest(BaseModel):
    """Delegation envelope: 'run this message, optionally via this skill'."""

    task_id: str = Field(default_factory=_uuid)
    message: A2AMessage
    skill_id: str | None = None


class A2ATaskResult(BaseModel):
    """Delegation reply, plus timing metadata used for the graph log."""

    task_id: str
    status: Literal["completed", "failed"]
    message: A2AMessage
    error: str | None = None
    created_at: str = Field(default_factory=_now)
