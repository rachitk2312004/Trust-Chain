from __future__ import annotations

from typing import Any, Dict

from embeddings.vectors import chunk_text, deterministic_embedding
from task_queue.types import QueueMessage

from .base import CapabilityExecutor


class EmbeddingExecutor(CapabilityExecutor):
    capability = "embedding"

    def execute(self, message: QueueMessage) -> Dict[str, Any]:
        self._guard()
        text = str(message.payload.get("text") or "")
        chunks = chunk_text(text) if text else []
        vectors = [deterministic_embedding(c) for c in chunks] if chunks else []
        if not vectors and text:
            vectors = [deterministic_embedding(text)]
            chunks = [text]
        return {
            "capability": self.capability,
            "chunks": chunks,
            "embeddings": vectors,
            "count": len(vectors),
            "advisoryOnly": True,
        }
