"""Kùzu-backed A2A message log = shared memory as a knowledge graph.

Schema:  (Agent)-[:SENT]->(Task)-[:PRODUCED]->(Result)
Each A2A exchange records who ran what and what came out, so the conversation
history *is* a graph you can query later.

``kuzu`` is imported lazily (it's in the ``agent`` extra only).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import structlog

log = structlog.get_logger(__name__)

_SCHEMA: tuple[str, ...] = (
    "CREATE NODE TABLE IF NOT EXISTS Agent(name STRING, PRIMARY KEY(name))",
    "CREATE NODE TABLE IF NOT EXISTS Task(id STRING, prompt STRING, ts STRING, PRIMARY KEY(id))",
    "CREATE NODE TABLE IF NOT EXISTS Result(id STRING, content STRING, ts STRING, PRIMARY KEY(id))",
    "CREATE REL TABLE IF NOT EXISTS SENT(FROM Agent TO Task)",
    "CREATE REL TABLE IF NOT EXISTS PRODUCED(FROM Task TO Result)",
)


class GraphStore:
    def __init__(self, db_path: str) -> None:
        self._db_path = db_path
        self._conn: Any | None = None

    def _ensure(self) -> Any:
        if self._conn is None:
            try:
                import kuzu
            except ImportError as exc:  # pragma: no cover - env guard
                raise RuntimeError(
                    "kuzu not installed. Run `uv sync --extra agent`."
                ) from exc
            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
            db = kuzu.Database(self._db_path)
            self._conn = kuzu.Connection(db)
            for stmt in _SCHEMA:
                self._conn.execute(stmt)
            log.info("kuzu.ready", db_path=self._db_path)
        return self._conn

    def record_exchange(
        self,
        *,
        agent: str,
        task_id: str,
        prompt: str,
        result_id: str,
        content: str,
        ts: str,
    ) -> None:
        """Persist one (Agent)-[:SENT]->(Task)-[:PRODUCED]->(Result) path."""
        conn = self._ensure()
        conn.execute("MERGE (a:Agent {name: $name})", {"name": agent})
        conn.execute(
            "CREATE (t:Task {id: $id, prompt: $prompt, ts: $ts})",
            {"id": task_id, "prompt": prompt, "ts": ts},
        )
        conn.execute(
            "CREATE (r:Result {id: $id, content: $content, ts: $ts})",
            {"id": result_id, "content": content, "ts": ts},
        )
        conn.execute(
            "MATCH (a:Agent {name: $agent}), (t:Task {id: $task}) CREATE (a)-[:SENT]->(t)",
            {"agent": agent, "task": task_id},
        )
        conn.execute(
            "MATCH (t:Task {id: $task}), (r:Result {id: $result}) CREATE (t)-[:PRODUCED]->(r)",
            {"task": task_id, "result": result_id},
        )
        log.info("graph.recorded", agent=agent, task_id=task_id, result_id=result_id)


class NullGraph:
    """No-op graph for agents that must not open the (single-writer) Kùzu DB.

    Kùzu is embedded/single-writer, so only one process owns the shared DB
    (the EXAONE agent, which logs the whole round trip). Peers get this.
    """

    def record_exchange(
        self,
        *,
        agent: str,
        task_id: str,
        prompt: str,
        result_id: str,
        content: str,
        ts: str,
    ) -> None:
        return None
