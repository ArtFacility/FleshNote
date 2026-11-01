"""Keeps the desktop backend reachable only by the app itself.

The backend listens on localhost with no login, because only FleshNote's main
process talks to it. Binding to localhost alone doesn't stop a web page: with DNS
rebinding, a page on evil.example can make its own hostname resolve to 127.0.0.1
and read answers as if they came from its own site, and a plain cross-site form can
send a POST without any preflight. So a request must name a local Host, and a
browser request must come from a local page. The main process sends no Origin.

Only for the local backend: Labs and self-hosting start from web_main.py, with
their own login and public hostnames, and phone sync has its own server.
"""
from urllib.parse import urlsplit

LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


def _hostname(value: str) -> str | None:
    try:
        return urlsplit(value).hostname
    except ValueError:
        return None


def is_local_request(host: str | None, origin: str | None) -> bool:
    if not host or _hostname(f"//{host}") not in LOOPBACK_HOSTS:
        return False
    return origin is None or _hostname(origin) in LOOPBACK_HOSTS


class LoopbackGuard:
    """ASGI middleware refusing anything that isn't a local request."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            return await self.app(scope, receive, send)
        headers = {k: v for k, v in scope["headers"] if k in (b"host", b"origin")}
        host = headers[b"host"].decode("latin-1") if b"host" in headers else None
        origin = headers[b"origin"].decode("latin-1") if b"origin" in headers else None
        if is_local_request(host, origin):
            return await self.app(scope, receive, send)
        if scope["type"] == "websocket":
            return await send({"type": "websocket.close", "code": 1008})
        body = b"Forbidden"
        await send({"type": "http.response.start", "status": 403, "headers": [
            (b"content-type", b"text/plain"), (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})
