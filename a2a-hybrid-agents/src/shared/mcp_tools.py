"""Common MCP tool signatures.

MCP (Model Context Protocol) exposes each agent's tools/context. Here we keep
just the tool *contracts* (name + typed I/O) so both the agent side (which
mounts them) and the orchestrator (an MCP client) agree on shapes. Wire these
into the official ``mcp`` SDK server when hardening — see README.
"""

from __future__ import annotations

from pydantic import BaseModel


class ToolSpec(BaseModel):
    """Discovery record listed at an agent's ``/mcp/tools`` endpoint."""

    name: str
    description: str


class GenerateInput(BaseModel):
    prompt: str
    model: str | None = None


class GenerateOutput(BaseModel):
    text: str


# The single tool every LLM agent exposes over MCP.
GENERATE = ToolSpec(
    name="generate",
    description="Run a prompt through the agent's local LLM and return the text.",
)

TOOLS: list[ToolSpec] = [GENERATE]
