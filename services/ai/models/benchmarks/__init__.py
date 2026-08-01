from dataclasses import dataclass
from typing import Dict


@dataclass
class BenchmarkRecord:
    model_id: str
    task: str
    score: float
    latency_ms: float


BENCHMARKS: Dict[str, BenchmarkRecord] = {
    "stub:classify": BenchmarkRecord("stub-model", "classify", 0.75, 5.0),
    "stub:extract": BenchmarkRecord("stub-model", "extract", 0.70, 8.0),
}
