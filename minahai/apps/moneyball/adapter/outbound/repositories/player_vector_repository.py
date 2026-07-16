from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from moneyball.adapter.outbound.orm.soccer_orm import Player
from moneyball.app.ports.output.player_search_port import PlayerSearchPort


def _player_context(p: Player) -> str:
    """검색된 선수 한 명을 컨텍스트 문장으로 (임베딩에 쓴 형식과 동일)."""
    parts = [f"선수 {p.player_name}"]
    if p.nickname:
        parts.append(f"별명 {p.nickname}")
    if p.position:
        parts.append(f"포지션 {p.position}")
    if p.back_no is not None:
        parts.append(f"등번호 {p.back_no}")
    if p.nation:
        parts.append(f"국적 {p.nation}")
    if p.height:
        parts.append(f"키 {p.height}cm")
    if p.weight:
        parts.append(f"몸무게 {p.weight}kg")
    if p.team_id:
        parts.append(f"소속팀 {p.team_id}")
    return ", ".join(parts)


class PlayerVectorRepository(PlayerSearchPort):
    """player_embedding(pgvector) 코사인 유사도 검색."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def search_similar(
        self, embedding: list[float], top_k: int
    ) -> list[tuple[str, float]]:
        distance = Player.player_embedding.cosine_distance(embedding)
        stmt = (
            select(Player, distance.label("distance"))
            .where(Player.player_embedding.is_not(None))
            .order_by(distance)
            .limit(top_k)
        )
        rows = (await self._session.execute(stmt)).all()
        return [(_player_context(p), float(d)) for p, d in rows]
