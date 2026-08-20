from __future__ import annotations

import hashlib
import hmac
import time
from typing import Any


def parse_webhook_signature_header(header: str) -> dict[str, str] | None:
    timestamp = ""
    signature = ""
    for part in header.split(","):
        part = part.strip()
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        if key == "t":
            timestamp = value
        elif key == "v1":
            signature = value
    if not timestamp or not signature:
        return None
    return {"timestamp": timestamp, "signature": signature}


def sign_webhook_payload(secret: str, timestamp: str, body: str) -> str:
    digest = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}.{body}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return digest


def verify_webhook(
    *,
    secret: str,
    body: str | bytes,
    signature_header: str,
    tolerance_seconds: int = 300,
    now_sec: int | None = None,
) -> dict[str, Any]:
    parsed = parse_webhook_signature_header(signature_header)
    if not parsed:
        return {"valid": False, "timestamp": None, "signature": None, "reason": "invalid_header"}

    now = now_sec if now_sec is not None else int(time.time())
    try:
        ts = int(parsed["timestamp"])
    except ValueError:
        return {
            "valid": False,
            "timestamp": parsed["timestamp"],
            "signature": parsed["signature"],
            "reason": "timestamp_out_of_tolerance",
        }

    if abs(now - ts) > tolerance_seconds:
        return {
            "valid": False,
            "timestamp": parsed["timestamp"],
            "signature": parsed["signature"],
            "reason": "timestamp_out_of_tolerance",
        }

    body_text = body.decode("utf-8") if isinstance(body, (bytes, bytearray)) else body
    expected = sign_webhook_payload(secret, parsed["timestamp"], body_text)
    if not hmac.compare_digest(expected, parsed["signature"]):
        return {
            "valid": False,
            "timestamp": parsed["timestamp"],
            "signature": parsed["signature"],
            "reason": "signature_mismatch",
        }

    return {"valid": True, "timestamp": parsed["timestamp"], "signature": parsed["signature"]}


class WebhooksResource:
    verify = staticmethod(verify_webhook)
    sign = staticmethod(sign_webhook_payload)
    parse_signature_header = staticmethod(parse_webhook_signature_header)
