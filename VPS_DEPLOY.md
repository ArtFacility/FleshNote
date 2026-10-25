# Running FleshNote on your own server

FleshNote is a desktop app, but it can also run in a browser, served from a server you own: open
your book from any computer, sign in, and write. This guide sets that up on a VPS, for people
comfortable with a Linux shell. It is the free, self-hosted option; it is not the FleshNote
cloud service, and nothing in it talks to Artfacility's servers.

**What you get:** the FleshNote IDE in a browser at your own address (e.g.
`https://write.example.com/`), behind a sign-in page, with your projects stored on the server.

**What to know first**

- **One account per server.** The instance has one name and password. Everyone who signs in
  shares the same projects, and whoever signs in can use everything the FleshNote service can
  reach on the server. For a second writer, run a second instance (another port, another
  config, another data folder). Never give the sign-in to someone you wouldn't give the server to.
- **HTTPS is required.** The guide uses [Caddy](https://caddyserver.com/), which gets and renews
  the certificate by itself. FleshNote refuses a non-HTTPS address (except `localhost`).
- **Memory:** 2 GB of RAM at least. The language tools (spaCy) take 1 to 1.5 GB when loaded.
- **Some desktop features work differently in a browser:**
  - Open dialogs upload a copy of what you pick; exports download to your computer.
  - "Choose workspace" doesn't apply: the server's workspace is the only one.
  - Printing to PDF uses the browser's print dialog ("Save as PDF"). The page preview of the
    print layout is desktop-only, and so is saving a Pentimento showcase image.
  - Updates come from `git pull` on the server (below), not the app's updater.
- **Back up** the data folder (`/var/lib/fleshnote-web`). It holds all your projects.

The commands are for Debian or Ubuntu, run as a user with `sudo`. Replace `write.example.com`
with your address.

## 1. Point your address at the server

Create a DNS `A` record (and `AAAA` for IPv6) for `write.example.com` with your server's IP, and
open ports 80 and 443 in its firewall (Caddy needs both for the certificate).

## 2. Install what it needs

```bash
sudo apt update
sudo apt install -y git curl python3-venv debian-keyring debian-archive-keyring apt-transport-https
# Node.js 22 (only to build the pages)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
# Caddy, from its own repository (https://caddyserver.com/docs/install#debian-ubuntu-raspbian)
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

## 3. Get FleshNote and build the pages

```bash
sudo git clone https://github.com/ArtFacility/FleshNote.git /opt/fleshnote
cd /opt/fleshnote/fleshnote-ide
sudo npm ci --ignore-scripts      # --ignore-scripts: no Electron download, the server doesn't need it
sudo npm run build:web            # writes out/web
```

## 4. The Python backend

FleshNote needs Python 3.13 (one of its language packages doesn't support 3.14 yet). `uv`
fetches it into `/opt/fleshnote`, where the service can read it:

```bash
sudo python3 -m venv /opt/fleshnote/uv && sudo /opt/fleshnote/uv/bin/pip install -q uv
cd /opt/fleshnote/fleshnote-ide/backend
sudo UV_PYTHON_INSTALL_DIR=/opt/fleshnote/python /opt/fleshnote/uv/bin/uv venv --python 3.13 .venv
sudo /opt/fleshnote/uv/bin/uv pip install --python .venv/bin/python -r requirements.txt
```

## 5. A user, the config and your password

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin fleshnote
sudo install -d -m 750 -o root -g fleshnote /etc/fleshnote-web
sudo install -m 640 -o root -g fleshnote /opt/fleshnote/fleshnote-ide/deploy/selfhost/fleshnote-web.example.yaml /etc/fleshnote-web/fleshnote-web.yaml
sudo nano /etc/fleshnote-web/fleshnote-web.yaml     # set public_url to your address
sudo /opt/fleshnote/fleshnote-ide/backend/.venv/bin/python /opt/fleshnote/fleshnote-ide/backend/web_main.py \
     set-password --config /etc/fleshnote-web/fleshnote-web.yaml
```

`set-password` asks for a name and a password (10 characters or more) and stores only the
password's hash. Run it again whenever you want a new password; it signs every browser out.

## 6. Start it

```bash
sudo cp /opt/fleshnote/fleshnote-ide/deploy/selfhost/fleshnote-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fleshnote-web
journalctl -u fleshnote-web -f        # wait for "Uvicorn running on http://127.0.0.1:8100"
```

The service runs sandboxed (see the comments in the unit): its own user, the code read-only,
only `/var/lib/fleshnote-web` writable, no home folders, no access to the server's private
network.

## 7. HTTPS with Caddy

Put the block from `deploy/selfhost/Caddyfile.example` into `/etc/caddy/Caddyfile` with your
address, then `sudo systemctl reload caddy`. To run FleshNote under a path of an existing site
instead (`https://example.com/fleshnote/`), use the second block and set `public_url` to match.

Open your address: you get the sign-in page, and after it the project list.

Using nginx instead of Caddy? Pass everything to `127.0.0.1:8100`, keep the `Host` header, set
`X-Forwarded-For` (the sign-in throttle tells visitors apart by it), and raise
`client_max_body_size` (imports can be large).

## Updating

```bash
cd /opt/fleshnote && sudo git pull
cd fleshnote-ide && sudo npm ci --ignore-scripts && sudo npm run build:web
sudo /opt/fleshnote/uv/bin/uv pip install --python backend/.venv/bin/python -r backend/requirements.txt
sudo systemctl restart fleshnote-web
```

## Signing in and out

- Five wrong passwords from one address make that address wait a quarter of an hour (thirty
  from anywhere make everyone wait). The service log shows the attempts.
- `https://write.example.com/logout` signs that browser out. A sign-in lasts `session_days`.
- Forgot the password? Run `set-password` again (step 5) and restart the service.

## Troubleshooting

- **The service doesn't start:** `journalctl -u fleshnote-web -n 50`. A config problem is named
  in the first lines (e.g. `public_url must be https://`, `web_dir … has no index.html`).
- **502 from Caddy:** the service isn't running, or `port` in the config and the Caddyfile differ.
- **Signed out right after signing in:** `public_url` doesn't match the address in the browser
  (the sign-in cookie is tied to it).
