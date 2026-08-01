import hashlib
import struct
from typing import Any, Dict, List, Tuple


def deterministic_embedding(text: str, dim: int = 16) -> List[float]:
    """Hash-based deterministic float vector in [-1, 1]."""
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    floats: List[float] = []
    for i in range(dim):
        chunk = digest[i * 2 : i * 2 + 4] if i * 2 + 4 <= len(digest) else digest[:4]
        padded = chunk.ljust(4, b"\x00")
        val = struct.unpack(">I", padded)[0]
        floats.append((val / 2**32) * 2 - 1)
    return floats


def chunk_text(text: str, chunk_size: int = 512, overlap: int = 64) -> List[str]:
    if chunk_size <= overlap:
        raise ValueError("chunk_size must exceed overlap")
    if not text:
        return []
    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = end - overlap
    return chunks


def _cosine(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(x * x for x in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def search_vectors(
    query: str,
    corpus: List[str],
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    q_vec = deterministic_embedding(query)
    scored: List[Tuple[float, int, str]] = []
    for idx, doc in enumerate(corpus):
        score = _cosine(q_vec, deterministic_embedding(doc))
        scored.append((score, idx, doc))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        {"index": idx, "text": doc, "score": round(score, 4)}
        for score, idx, doc in scored[:top_k]
    ]
