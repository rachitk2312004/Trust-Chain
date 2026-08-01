from typing import Any, Dict


def preprocess_image(data: bytes, *, grayscale: bool = True, denoise: bool = False) -> Dict[str, Any]:
    """Lightweight preprocess stub — returns metadata only, no image mutation."""
    return {
        "bytesIn": len(data),
        "grayscale": grayscale,
        "denoise": denoise,
        "preprocessed": True,
    }
