"""Artifact lineage for workers.

Document → Artifact → Embedding → Inference → Review

Produces advisory lineage nodes (AI-ARTIFACT-*) for later Postgres persistence.
Workers never mutate verification or blockchain state.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional
import time
import uuid


ARTIFACT_KINDS = ("document", "artifact", "embedding", "inference", "review")


def new_artifact_code() -> str:
    return f"AI-ARTIFACT-{uuid.uuid4().hex[:8].upper()}"


@dataclass
class LineageNode:
    public_code: str
    kind: str
    parent_public_code: Optional[str] = None
    task_public_code: Optional[str] = None
    document_id: Optional[str] = None
    content_hash: Optional[str] = None
    meta: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class LineageManager:
    def __init__(self) -> None:
        self._nodes: List[LineageNode] = []

    def reset(self) -> None:
        self._nodes.clear()

    def nodes(self) -> List[Dict[str, Any]]:
        return [n.to_dict() for n in self._nodes]

    def append(
        self,
        kind: str,
        *,
        parent_public_code: Optional[str] = None,
        task_public_code: Optional[str] = None,
        document_id: Optional[str] = None,
        content_hash: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> LineageNode:
        if kind not in ARTIFACT_KINDS:
            raise ValueError(f"Unknown artifact kind '{kind}'. Allowed: {ARTIFACT_KINDS}")
        node = LineageNode(
            public_code=new_artifact_code(),
            kind=kind,
            parent_public_code=parent_public_code,
            task_public_code=task_public_code,
            document_id=document_id,
            content_hash=content_hash,
            meta=dict(meta or {}),
        )
        self._nodes.append(node)
        return node

    def build_chain(
        self,
        *,
        document_id: Optional[str],
        task_public_code: str,
        capability: str,
        result_meta: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Build Document → Artifact → Embedding → Inference → Review for a task."""
        self.reset()
        doc = self.append(
            "document",
            document_id=document_id,
            task_public_code=task_public_code,
            meta={"capability": capability},
        )
        artifact = self.append(
            "artifact",
            parent_public_code=doc.public_code,
            document_id=document_id,
            task_public_code=task_public_code,
            meta={"stage": "raw_output"},
        )
        embedding = self.append(
            "embedding",
            parent_public_code=artifact.public_code,
            document_id=document_id,
            task_public_code=task_public_code,
            meta={"stage": "embedding" if capability == "embedding" else "skipped"},
        )
        inference = self.append(
            "inference",
            parent_public_code=embedding.public_code,
            document_id=document_id,
            task_public_code=task_public_code,
            meta={"capability": capability, **(result_meta or {})},
        )
        self.append(
            "review",
            parent_public_code=inference.public_code,
            document_id=document_id,
            task_public_code=task_public_code,
            meta={"reviewState": "pending_review", "advisoryOnly": True},
        )
        return self.nodes()
