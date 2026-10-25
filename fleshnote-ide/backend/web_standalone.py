"""
Standalone mode of the browser build: FleshNote on your own server (VPS_DEPLOY.md), with
nothing in front of it but a reverse proxy for HTTPS. `web_main.py --config <file>` serves the
built pages (npm run build:web) and the backend on one loopback port, behind a login.

One account per instance. The backend trusts the project paths the page sends it, so whoever
is signed in can use everything this process can reach: run it as a user of its own (the
systemd unit in deploy/selfhost does). For a second person, run a second instance.

The config file (YAML; deploy/selfhost/fleshnote-web.example.yaml):

    public_url:     where people open it, e.g. https://write.example.com/ (a path works too)
    port:           the loopback port the proxy passes to (default 8100)
    data_dir:       projects, uploads, exports (the browser build's one workspace)
    web_dir:        the built pages
    username, password_hash, session_secret:  written by `web_main.py set-password`
    session_days:   how long a sign-in lasts (default 30)

The password is stored as a PBKDF2 hash. The session cookie is signed with a key derived from
the secret and the password hash, so setting a new password signs every browser out.
"""
import base64
import getpass
import hashlib
import hmac
import os
import re
import secrets
import time
from collections import defaultdict, deque
from html import escape
from urllib.parse import urljoin, urlparse

import yaml
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

COOKIE = "fleshnote_session"
ITERATIONS = 600_000
IP_FAILURES, ALL_FAILURES, FAIL_WINDOW = 5, 30, 15 * 60  # failed sign-ins before a wait, per window (s)
CONFIG_KEYS = ("public_url", "port", "data_dir", "web_dir", "username", "password_hash", "session_secret", "session_days")


class ConfigError(Exception):
    pass


def load_config(path: str) -> dict:
    """The config file, checked; ConfigError names what is wrong."""
    try:
        with open(path, encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
    except OSError as e:
        raise ConfigError(f"cannot read {path}: {e}")
    if not isinstance(cfg, dict):
        raise ConfigError(f"{path} is not a YAML mapping")
    url = urlparse(str(cfg.get("public_url") or ""))
    if url.scheme not in ("https", "http") or not url.netloc:
        raise ConfigError("public_url must be the address people open, e.g. https://write.example.com/")
    if url.scheme == "http" and url.hostname not in ("localhost", "127.0.0.1"):
        raise ConfigError("public_url must be https:// (a password must not cross the internet in the clear)")
    if not str(cfg["public_url"]).endswith("/"):
        cfg["public_url"] = str(cfg["public_url"]) + "/"
    for key in ("data_dir", "web_dir"):
        if not cfg.get(key):
            raise ConfigError(f"{key} is not set")
        cfg[key] = os.path.abspath(os.path.expanduser(str(cfg[key])))
    if not os.path.isfile(os.path.join(cfg["web_dir"], "index.html")):
        raise ConfigError(f"web_dir {cfg['web_dir']} has no index.html (npm run build:web makes it)")
    for key in ("username", "password_hash", "session_secret"):
        if not cfg.get(key):
            raise ConfigError(f"{key} is not set: run  python web_main.py set-password --config {path}")
    cfg["port"] = int(cfg.get("port") or 8100)
    cfg["session_days"] = int(cfg.get("session_days") or 30)
    return cfg


# ── Passwords ────────────────────────────────────────────────────────────────

def hash_password(password: str, iterations: int = ITERATIONS) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2-sha256${iterations}${base64.b64encode(salt).decode()}${base64.b64encode(key).decode()}"


def check_password(stored: str, password: str) -> bool:
    try:
        scheme, iters, salt, want = stored.split("$")
        if scheme != "pbkdf2-sha256":
            return False
        got = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt), int(iters))
        return hmac.compare_digest(got, base64.b64decode(want))
    except (ValueError, TypeError):
        return False


def set_password(path: str, ask=input, ask_secret=getpass.getpass, out=print) -> None:
    """Asks for the account's name and password and writes them (hashed) into the config file,
    with a session secret if it has none; every other line, comments included, stays. A new file
    is made readable by its owner only; an existing one keeps its permissions (the guide gives
    the service's group read access)."""
    text = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
    current = (yaml.safe_load(text) or {}) if text else {}
    name = ask(f"Name [{current.get('username') or ''}]: ").strip() or current.get("username") or ""
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", name):
        raise ConfigError("a name of letters, digits, dots, dashes or underscores")
    password = ask_secret("Password (10 characters or more): ")
    if len(password) < 10:
        raise ConfigError("the password needs 10 characters or more")
    if ask_secret("Password again: ") != password:
        raise ConfigError("the two passwords differ")
    values = {"username": name, "password_hash": hash_password(password)}
    if not current.get("session_secret"):
        values["session_secret"] = secrets.token_hex(32)
    for key, value in values.items():
        line = f"{key}: {yaml.safe_dump(value, default_style=None).strip().splitlines()[0]}"
        if re.search(rf"^{key}:.*$", text, flags=re.M):
            text = re.sub(rf"^{key}:.*$", lambda _m: line, text, count=1, flags=re.M)
        else:
            text = text + ("" if text.endswith("\n") or not text else "\n") + line + "\n"
    existed = os.path.exists(path)
    with open(path, "w", encoding="utf-8") as f:  # an existing file keeps its owner and mode
        f.write(text)
    if not existed:
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
    out("Saved. Restart the service; browsers signed in before have to sign in again.")


# ── The gate ─────────────────────────────────────────────────────────────────

class Gate:
    def __init__(self, cfg: dict, now=time.time, iterations_check=check_password):
        self.cfg = cfg
        self.now = now
        self.check = iterations_check
        url = urlparse(cfg["public_url"])
        self.origin = f"{url.scheme}://{url.netloc}"
        self.base = url.path or "/"
        self.secure = url.scheme == "https"
        # the password hash is part of the key: a new password ends every session
        self.key = hmac.new(cfg["session_secret"].encode(), cfg["password_hash"].encode(), hashlib.sha256).digest()
        self.failures = defaultdict(deque)
        self.all_failures = deque()

    def sign(self, expires: int) -> str:
        msg = f"{self.cfg['username']}|{expires}"
        mac = hmac.new(self.key, msg.encode(), hashlib.sha256).digest()
        return msg + "|" + base64.urlsafe_b64encode(mac).decode().rstrip("=")

    def signed_in(self, request: Request) -> bool:
        value = request.cookies.get(COOKIE, "")
        parts = value.split("|")
        if len(parts) != 3 or not parts[1].isdigit() or int(parts[1]) < self.now():
            return False
        return hmac.compare_digest(self.sign(int(parts[1])), value)

    def client(self, request: Request) -> str:
        host = request.client.host if request.client else ""
        forwarded = request.headers.get("x-forwarded-for", "")
        # behind the proxy on the same machine, the real address is the one it appended last
        if host in ("127.0.0.1", "::1") and forwarded:
            return forwarded.split(",")[-1].strip()
        return host

    def blocked(self, ip: str) -> bool:
        cut = self.now() - FAIL_WINDOW
        for q in (self.failures[ip], self.all_failures):
            while q and q[0] < cut:
                q.popleft()
        return len(self.failures[ip]) >= IP_FAILURES or len(self.all_failures) >= ALL_FAILURES

    def fail(self, ip: str) -> None:
        self.failures[ip].append(self.now())
        self.all_failures.append(self.now())

    async def __call__(self, request: Request, call_next):
        path = request.url.path
        unsafe = request.method not in ("GET", "HEAD", "OPTIONS")
        # Only this site's own pages may change anything (a form or a script elsewhere can't).
        if unsafe and request.headers.get("origin") != self.origin:
            return JSONResponse({"detail": "Cross-site request refused"}, status_code=403)
        if path == "/login":
            response = await self.login(request)
        elif path == "/logout":
            response = RedirectResponse(urljoin(self.cfg["public_url"], "login"), status_code=303)
            response.delete_cookie(COOKIE, path=self.base)
        elif self.signed_in(request):
            if path in ("/", "/index.html"):
                # main.py answers / itself (the desktop app's health check); here it is the page
                response = FileResponse(os.path.join(self.cfg["web_dir"], "index.html"), headers={"Cache-Control": "no-cache"})
            else:
                response = await call_next(request)
        elif path.startswith("/api/"):
            response = JSONResponse({"detail": "Not signed in"}, status_code=401)
        else:
            response = RedirectResponse(urljoin(self.cfg["public_url"], "login"), status_code=303)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Content-Security-Policy"] = "frame-ancestors 'none'"
        return response

    async def login(self, request: Request) -> Response:
        if request.method != "POST":
            return login_page(200)
        ip = self.client(request)
        if self.blocked(ip):
            return login_page(429, "Too many tries. Wait a quarter of an hour, then try again.")
        form = await request.form()
        name, password = str(form.get("username", "")), str(form.get("password", ""))
        ok = hmac.compare_digest(name.encode(), self.cfg["username"].encode())
        ok = await run_in_threadpool(self.check, self.cfg["password_hash"], password) and ok
        if not ok:
            self.fail(ip)
            return login_page(401, "That name and password don't match.", name)
        self.failures.pop(ip, None)
        expires = int(self.now()) + self.cfg["session_days"] * 86400
        response = RedirectResponse(self.cfg["public_url"], status_code=303)
        response.set_cookie(COOKIE, self.sign(expires), max_age=self.cfg["session_days"] * 86400, path=self.base,
                            secure=self.secure, httponly=True, samesite="lax")
        return response


def login_page(status: int, message: str = "", name: str = "") -> HTMLResponse:
    err = f'<p class="err">{escape(message)}</p>' if message else ""
    return HTMLResponse(status_code=status, headers={"Cache-Control": "no-store"}, content=f"""<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FleshNote</title>
<style>
body{{background:#0d0d0f;color:#a8a29e;font:16px Georgia,serif;margin:0;padding:64px 16px}}
main{{max-width:340px;margin:0 auto}}
h1{{font:600 13px ui-monospace,monospace;letter-spacing:3px;color:#e8a33d;text-align:center;margin:0 0 28px}}
label{{display:block;font:12px ui-monospace,monospace;color:#78716c;margin:14px 0 4px}}
input{{box-sizing:border-box;width:100%;padding:10px;background:#16161a;color:#e7e5e4;border:1px solid #2c2c31;font:16px Georgia,serif}}
input:focus{{outline:1px solid #e8a33d}}
button{{margin-top:22px;width:100%;padding:11px;background:#e8a33d;color:#0d0d0f;border:0;font:600 12px ui-monospace,monospace;letter-spacing:2px;cursor:pointer}}
.err{{color:#f87171;text-align:center}}
</style>
<main><h1>FLESHNOTE</h1>{err}
<form method="post" action="login">
<label for="u">Name</label><input id="u" name="username" value="{escape(name)}" autocomplete="username" required autofocus>
<label for="p">Password</label><input id="p" name="password" type="password" autocomplete="current-password" required>
<button>SIGN IN</button></form></main>""")


def install(app: FastAPI, cfg: dict, gate: Gate | None = None) -> Gate:
    """Puts the login in front of everything the app serves, and the built pages behind it."""
    gate = gate or Gate(cfg)
    app.middleware("http")(gate)
    app.mount("/", StaticFiles(directory=cfg["web_dir"], html=True), name="web")
    return gate
