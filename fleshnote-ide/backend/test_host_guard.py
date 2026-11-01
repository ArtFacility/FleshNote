"""The desktop backend refuses requests that didn't come from the app itself."""
import asyncio
import os
import sys
import unittest

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from host_guard import LoopbackGuard, is_local_request


def call(guard_type="http", **headers):
    reached = []
    sent = []

    async def app(scope, receive, send):
        reached.append(scope)

    async def send(message):
        sent.append(message)

    scope = {"type": guard_type, "headers": [(k.encode(), v.encode()) for k, v in headers.items()]}
    asyncio.run(LoopbackGuard(app)(scope, None, send))
    return bool(reached), sent


class TestIsLocalRequest(unittest.TestCase):
    def test_the_app_itself(self):
        for host in ("127.0.0.1:8000", "localhost:8000", "127.0.0.1", "[::1]:8000", "LOCALHOST:8000"):
            with self.subTest(host=host):
                self.assertTrue(is_local_request(host, None))

    def test_dns_rebinding_names_a_foreign_host(self):
        for host in ("evil.example", "evil.example:8000", "127.0.0.1.evil.example", "localhost.evil.example:8000"):
            with self.subTest(host=host):
                self.assertFalse(is_local_request(host, None))

    def test_a_request_with_no_host(self):
        self.assertFalse(is_local_request(None, None))
        self.assertFalse(is_local_request("", None))

    def test_a_cross_site_page_on_a_local_host(self):
        for origin in ("https://evil.example", "null", "http://127.0.0.1.evil.example"):
            with self.subTest(origin=origin):
                self.assertFalse(is_local_request("127.0.0.1:8000", origin))

    def test_a_local_page(self):
        self.assertTrue(is_local_request("127.0.0.1:8000", "http://localhost:5173"))


class TestMiddleware(unittest.TestCase):
    def test_passes_the_app(self):
        reached, sent = call(host="127.0.0.1:8000")
        self.assertTrue(reached)
        self.assertEqual(sent, [])

    def test_refuses_with_403(self):
        reached, sent = call(host="evil.example:8000", origin="http://evil.example:8000")
        self.assertFalse(reached)
        self.assertEqual(sent[0]["status"], 403)

    def test_closes_a_foreign_websocket(self):
        reached, sent = call("websocket", host="evil.example")
        self.assertFalse(reached)
        self.assertEqual(sent[0]["type"], "websocket.close")


class TestOnlyOnLocalServer(unittest.TestCase):
    def test_labs_and_self_hosting_keep_their_public_hostnames(self):
        # web_main.py imports main.py, so main.py must add the guard only when run directly.
        with open(os.path.join(backend_dir, "main.py"), encoding="utf-8") as f:
            source = f.read()
        self.assertGreater(source.index("LoopbackGuard"), source.index('if __name__ == "__main__"'))


if __name__ == "__main__":
    unittest.main()
