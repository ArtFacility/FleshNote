import http.client
import os
import shutil
import socket
import sys
import tempfile
import threading
import time
import unittest
from urllib.parse import urlencode

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import uvicorn
import yaml
from fastapi import FastAPI

import web_standalone
from routes.web_host import make_router


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class TestStandaloneGate(unittest.TestCase):
    """The login in front of the self-hosted browser build, through a real server."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="fn_standalone_")
        web = os.path.join(cls.tmp, "web")
        os.makedirs(os.path.join(web, "assets"))
        with open(os.path.join(web, "index.html"), "w") as f:
            f.write("<title>FleshNote</title>the app")
        with open(os.path.join(web, "assets", "app.js"), "w") as f:
            f.write("console.log(1)")
        cls.port = free_port()
        cls.clock = [time.time()]
        cls.cfg = {
            "public_url": "https://write.example.com/",
            "port": cls.port,
            "data_dir": os.path.join(cls.tmp, "data"),
            "web_dir": web,
            "username": "anna",
            "password_hash": web_standalone.hash_password("a long password", iterations=1000),
            "session_secret": "s" * 64,
            "session_days": 30,
        }
        app = FastAPI()

        @app.get("/")
        def health():  # main.py has this route too (the desktop app's health check)
            return {"status": "FleshNote Backend is alive"}

        app.include_router(make_router(cls.cfg["data_dir"]))
        cls.gate = web_standalone.install(app, cls.cfg, web_standalone.Gate(cls.cfg, now=lambda: cls.clock[0]))
        cls.server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=cls.port, log_level="warning"))
        threading.Thread(target=cls.server.run, daemon=True).start()
        for _ in range(100):
            if cls.server.started:
                break
            time.sleep(0.05)

    @classmethod
    def tearDownClass(cls):
        cls.server.should_exit = True
        time.sleep(0.2)
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def setUp(self):
        self.gate.failures.clear()
        self.gate.all_failures.clear()

    def req(self, method, path, form=None, cookie=None, origin="https://write.example.com", headers=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        h = dict(headers or {})
        body = None
        if form is not None:
            body = urlencode(form)
            h["Content-Type"] = "application/x-www-form-urlencoded"
        if origin:
            h["Origin"] = origin
        if cookie:
            h["Cookie"] = cookie
        c.request(method, path, body=body, headers=h)
        r = c.getresponse()
        data = r.read().decode("utf8", "replace")
        c.close()
        return r, data

    def login(self, password="a long password", **kw):
        r, _ = self.req("POST", "/login", form={"username": "anna", "password": password}, **kw)
        cookie = next((v.split(";")[0] for k, v in r.getheaders() if k.lower() == "set-cookie" and v.startswith("fleshnote_session=")), None)
        return r, cookie

    def test_nothing_without_signing_in(self):
        for path in ("/", "/index.html", "/assets/app.js"):
            r, _ = self.req("GET", path, origin=None)
            self.assertEqual((r.status, r.getheader("Location")), (303, "https://write.example.com/login"), path)
        r, _ = self.req("POST", "/api/web/info", form={})
        self.assertEqual(r.status, 401)
        r, body = self.req("GET", "/login", origin=None)
        self.assertEqual(r.status, 200)
        self.assertIn("SIGN IN", body)

    def test_signing_in(self):
        r, cookie = self.login()
        self.assertEqual((r.status, r.getheader("Location")), (303, "https://write.example.com/"))
        set_cookie = r.getheader("Set-Cookie")
        for attr in ("HttpOnly", "Secure", "SameSite=lax", "Path=/"):
            self.assertIn(attr.lower(), set_cookie.lower())
        r, body = self.req("GET", "/", cookie=cookie, origin=None)
        self.assertEqual((r.status, body), (200, "<title>FleshNote</title>the app"))
        self.assertEqual(r.getheader("Cache-Control"), "no-cache")
        r, body = self.req("POST", "/api/web/info", form={}, cookie=cookie)
        self.assertEqual(r.status, 200)  # the backend itself answered
        self.assertIn('"workspace"', body)
        r, body = self.req("GET", "/assets/app.js", cookie=cookie, origin=None)
        self.assertEqual(body, "console.log(1)")
        # A tampered or foreign cookie is no sign-in.
        user, exp, sig = cookie.split("=", 1)[1].split("|")
        for bad in (f"fleshnote_session=anna|{int(exp) + 999}|{sig}", f"fleshnote_session=bob|{exp}|{sig}", "fleshnote_session=x"):
            r, _ = self.req("GET", "/", cookie=bad, origin=None)
            self.assertEqual(r.status, 303, bad)

    def test_changes_need_this_sites_origin(self):
        _, cookie = self.login()
        for origin in (None, "https://evil.example.com"):
            r, _ = self.req("POST", "/api/web/config", form={}, cookie=cookie, origin=origin)
            self.assertEqual(r.status, 403, origin)
            r, _ = self.req("POST", "/login", form={"username": "anna", "password": "a long password"}, origin=origin)
            self.assertEqual(r.status, 403, origin)

    def test_wrong_passwords_wait(self):
        for _ in range(web_standalone.IP_FAILURES):
            r, cookie = self.login("wrong")
            self.assertEqual((r.status, cookie), (401, None))
        r, cookie = self.login()
        self.assertEqual((r.status, cookie), (429, None))
        # another address (behind the proxy) is not held up by the first one's failures
        r, cookie = self.login(headers={"X-Forwarded-For": "203.0.113.9"})
        self.assertEqual(r.status, 303)
        self.clock[0] += web_standalone.FAIL_WINDOW + 1
        r, cookie = self.login()
        self.assertEqual(r.status, 303)

    def test_sessions_end(self):
        _, cookie = self.login()
        self.clock[0] += 31 * 86400
        r, _ = self.req("GET", "/", cookie=cookie, origin=None)
        self.assertEqual(r.status, 303)
        self.clock[0] -= 31 * 86400
        r, _ = self.req("GET", "/logout", cookie=cookie, origin=None)
        self.assertEqual(r.status, 303)
        self.assertIn('fleshnote_session=""', r.getheader("Set-Cookie"))
        # a new password signs every browser out
        other = web_standalone.Gate({**self.cfg, "password_hash": web_standalone.hash_password("x" * 12, 1000)})
        self.assertNotEqual(other.sign(10**10), self.gate.sign(10**10))


class TestConfig(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="fn_standalone_cfg_")
        self.web = os.path.join(self.tmp, "web")
        os.makedirs(self.web)
        open(os.path.join(self.web, "index.html"), "w").close()
        self.path = os.path.join(self.tmp, "fleshnote-web.yaml")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def write(self, **kw):
        cfg = {"public_url": "https://write.example.com", "data_dir": os.path.join(self.tmp, "data"), "web_dir": self.web}
        cfg.update(kw)
        with open(self.path, "w") as f:
            f.write("# my server\n" + yaml.safe_dump(cfg))

    def test_set_password_then_load(self):
        self.write()
        with self.assertRaises(web_standalone.ConfigError):
            web_standalone.load_config(self.path)  # no account yet
        answers = iter(["anna"])
        secrets_ = iter(["a long password", "a long password"])
        web_standalone.set_password(self.path, ask=lambda _: next(answers), ask_secret=lambda _: next(secrets_), out=lambda _: None)
        text = open(self.path).read()
        self.assertIn("# my server", text)
        self.assertNotIn("a long password", text)
        cfg = web_standalone.load_config(self.path)
        self.assertEqual((cfg["username"], cfg["port"], cfg["public_url"]), ("anna", 8100, "https://write.example.com/"))
        self.assertTrue(web_standalone.check_password(cfg["password_hash"], "a long password"))
        secret = cfg["session_secret"]
        # a second run changes the password and keeps the secret
        answers, secrets_ = iter([""]), iter(["another password", "another password"])
        web_standalone.set_password(self.path, ask=lambda _: next(answers), ask_secret=lambda _: next(secrets_), out=lambda _: None)
        cfg2 = web_standalone.load_config(self.path)
        self.assertEqual((cfg2["username"], cfg2["session_secret"]), ("anna", secret))
        self.assertTrue(web_standalone.check_password(cfg2["password_hash"], "another password"))

    def test_bad_configs(self):
        for kw in ({"public_url": "http://write.example.com/"}, {"public_url": "write.example.com"},
                   {"web_dir": os.path.join(self.tmp, "nowhere")}, {"data_dir": ""}):
            self.write(username="a", password_hash="x", session_secret="y", **kw)
            with self.assertRaises(web_standalone.ConfigError, msg=str(kw)):
                web_standalone.load_config(self.path)
        self.write(public_url="http://localhost:8100/", username="a", password_hash="x", session_secret="y")
        web_standalone.load_config(self.path)  # plain http only for trying it on your own machine

    def test_short_or_mismatched_passwords(self):
        self.write()
        for pw, again in (("short", "short"), ("a long password", "a long passwort")):
            answers, secrets_ = iter(["anna"]), iter([pw, again])
            with self.assertRaises(web_standalone.ConfigError):
                web_standalone.set_password(self.path, ask=lambda _: next(answers), ask_secret=lambda _: next(secrets_), out=lambda _: None)


if __name__ == "__main__":
    unittest.main()
