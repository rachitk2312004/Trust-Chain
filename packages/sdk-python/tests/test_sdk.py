from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread

import pytest

from trustchain import TrustChain, TrustChainAuthError, TrustChainClient, paginate_offset, verify_webhook
from trustchain.webhooks import sign_webhook_payload


class _Handler(BaseHTTPRequestHandler):
    hits = 0
    mode = "health"

    def log_message(self, format, *args):  # noqa: A003
        return

    def do_GET(self):  # noqa: N802
        type(self).hits += 1
        if self.mode == "auth_fail":
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": {"code": "UNAUTHORIZED", "message": "bad"}}).encode())
            return
        if self.mode == "retry":
            if type(self).hits < 3:
                self.send_response(503)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": {"code": "UNAVAILABLE", "message": "busy"}}).encode())
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"document": {"id": "doc_1"}}).encode())
            return

        auth = self.headers.get("Authorization")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(
            json.dumps(
                {
                    "ok": True,
                    "version": "v1",
                    "organizationId": "00000000-0000-0000-0000-000000000001",
                    "authType": "api_key",
                    "authorization": auth,
                }
            ).encode()
        )


@pytest.fixture()
def server():
    httpd = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    host, port = httpd.server_address
    yield f"http://{host}:{port}"
    httpd.shutdown()


def test_authentication_requires_key():
    with pytest.raises(Exception):
        TrustChain("")


def test_authentication_header(server):
    _Handler.hits = 0
    _Handler.mode = "health"
    sdk = TrustChain("tc_live_python", base_url=server, max_retries=0)
    data = sdk.health()
    assert data["ok"] is True
    assert data["authorization"] == "Bearer tc_live_python"


def test_authentication_401(server):
    _Handler.hits = 0
    _Handler.mode = "auth_fail"
    client = TrustChainClient("tc_live_bad", base_url=server, max_retries=0)
    with pytest.raises(TrustChainAuthError):
        client.health()


def test_retries(server):
    _Handler.hits = 0
    _Handler.mode = "retry"
    client = TrustChainClient("tc_live_x", base_url=server, max_retries=3, retry_delay_ms=10)
    result = client.request("GET", "/documents/1")
    assert result["document"]["id"] == "doc_1"
    assert _Handler.hits >= 3


def test_webhook_verification():
    secret = "whsec_test"
    body = '{"type":"document.created"}'
    import time

    ts = str(int(time.time()))
    sig = sign_webhook_payload(secret, ts, body)
    header = f"t={ts},v1={sig}"
    assert verify_webhook(secret=secret, body=body, signature_header=header)["valid"] is True
    assert (
        verify_webhook(secret=secret, body=body, signature_header=header, now_sec=int(ts) + 400)[
            "valid"
        ]
        is False
    )


def test_pagination():
    pages = [
        {"items": [1, 2], "total": 3, "limit": 2, "offset": 0},
        {"items": [3], "total": 3, "limit": 2, "offset": 2},
    ]
    call = {"n": 0}

    def fetch(offset, limit):
        page = pages[call["n"]]
        call["n"] += 1
        assert offset == page["offset"]
        assert limit == 2
        return page

    assert list(paginate_offset(fetch, page_size=2)) == [1, 2, 3]


def test_generated_client_shape():
    sdk = TrustChain("tc_live_x", base_url="http://127.0.0.1:9")
    assert sdk.documents is not None
    assert sdk.certificates is not None
    assert sdk.signatures is not None
    assert callable(sdk.webhooks.verify)
