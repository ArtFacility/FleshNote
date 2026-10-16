"""
Starts the backend for the browser build: main.py's app plus the web host routes
(routes/web_host.py), on loopback. Never used by the desktop app (main.py doesn't import it).

On your own server (VPS_DEPLOY.md), behind a login (web_standalone.py), serving the built pages too:

    python web_main.py set-password --config fleshnote-web.yaml   (once, and to change it)
    python web_main.py --config fleshnote-web.yaml

On Seneschal Labs, whose site does the signing in and serves the pages: FLESHNOTE_WEB_ROOT names
the folder that holds the workspace and everything else the browser build keeps on the server.

    FLESHNOTE_WEB_ROOT=/srv/labs/fleshnote/data python web_main.py --port 8100
"""
import argparse
import os
import socket
import sys


def main() -> None:
    parser = argparse.ArgumentParser(description="FleshNote API Server (browser build)")
    parser.add_argument("command", nargs="?", default="serve", choices=["serve", "set-password"])
    parser.add_argument("--config", help="standalone mode: the config file (see VPS_DEPLOY.md)")
    parser.add_argument("--port", type=int, default=int(os.environ.get("FLESHNOTE_PORT", 8100)))
    args, _ = parser.parse_known_args()

    import web_standalone

    if args.command == "set-password":
        if not args.config:
            sys.exit("set-password needs --config <file>")
        try:
            web_standalone.set_password(args.config)
        except web_standalone.ConfigError as e:
            sys.exit(str(e))
        return

    cfg = None
    if args.config:
        try:
            cfg = web_standalone.load_config(args.config)
        except web_standalone.ConfigError as e:
            sys.exit(f"{args.config}: {e}")
        root, port, demo = cfg["data_dir"], cfg["port"], False
        os.makedirs(root, exist_ok=True)
        # sync history needs a stable id for this install (main reads it on import)
        os.environ.setdefault("FLESHNOTE_DEVICE_ID", "web-" + socket.gethostname())
    else:
        root = os.environ.get("FLESHNOTE_WEB_ROOT")
        if not root:
            sys.exit("Give --config <file> (your own server), or set FLESHNOTE_WEB_ROOT (Seneschal Labs).")
        port, demo = args.port, os.environ.get("FLESHNOTE_WEB_DEMO") == "1"

    import uvicorn
    from main import app
    from routes.web_host import make_router

    app.include_router(make_router(root, demo=demo))
    if cfg:
        web_standalone.install(app, cfg)
    uvicorn.run(app, host="127.0.0.1", port=port, proxy_headers=False)


if __name__ == "__main__":
    main()
