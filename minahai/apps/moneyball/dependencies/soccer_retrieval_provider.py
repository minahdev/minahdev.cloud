from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.matrix.database_manager import get_db

from moneyball.adapter.outbound.embedding.ollama_embedding_adapter import OllamaEmbeddingAdapter
from moneyball.adapter.outbound.repositories.player_vector_repository import PlayerVectorRepository
from moneyball.app.ports.input.soccer_retrieval_use_case import SoccerRetrievalUseCase
from moneyball.app.use_cases.soccer_retrieval_interactor import SoccerRetrievalInteractor


def get_soccer_retrieval_use_case(
    db: AsyncSession = Depends(get_db),
) -> SoccerRetrievalUseCase:
    return SoccerRetrievalInteractor(
        embedder=OllamaEmbeddingAdapter(),
        search=PlayerVectorRepository(session=db),
    )
