# FleshNote on Seneschal Labs

The browser build of the IDE, with its backend on the author's home server, behind Seneschal's login at
https://experiments.artfacility.xyz. This is a personal test setup. To host FleshNote on a server of your own, see
`VPS_DEPLOY.md` at the repo root instead.

| Folder | On the site | Backend port | What it is |
|---|---|---|---|
| `labs/fleshnote` | `/fleshnote/` | 8100 | the author's own workspace |
| `labs/fleshnote-demo` | `/fleshnote-demo/` | 8101 | `demo: true`: the only copy guests can be invited to; wiped when the last invite ends |

## Redeploying (the quick way)

From `fleshnote-ide/`, on a machine that can `ssh homeserver` without a password prompt:

```
npm run deploy:labs          # build the browser version, ship it and the backend to /fleshnote/
npm run deploy:labs:demo     # the same for the demo copy
npm run deploy:labs:all      # both, building once
```

Then reload the page. It takes under a minute when the Python packages haven't changed. The script ends with
`backend answering (version …)` and `Deployed. Reload …` when everything went through.

## What the script does, step by step

`scripts/deploy-labs.mjs`, in order; to do it by hand, follow the same steps.

1. **Build**: `npm run build:web` writes the browser version to `out/web`. (`--no-build` skips this and ships
   the last build.) No type check runs here; run `npm run typecheck` yourself before a deploy you care about.
2. **Stage** a temporary folder: `labs/fleshnote/` (manifest and `run`), the demo's own `experiment.yaml` on top
   for `--id fleshnote-demo`, `out/web` as `web/`, and `backend/` without tests, caches, `.venv`, `docs`,
   `nltk_data` and SQLite scratch files. Writes `version` (from `package.json`) and `backend.hash`.
3. **Copy**: `tar | ssh homeserver`, then `rsync --delete` into `/srv/labs/<id>/`, leaving `data/` (the
   workspace, Python and packages) untouched.
4. **Restart** `seneschal-lab@<id>` with `sudo -n` only when `backend.hash` changed. The sudoers rule for exactly
   that command was added by the one-time setup.
5. **Check**: waits up to a minute for the backend to answer on its port.

The web files need no restart: every answer is sent `no-cache`, so a reload picks them up.

## When something goes wrong

| Exit / message | Meaning | Fix |
|---|---|---|
| `Permission denied` / host key prompt | this machine has no SSH key for `homeserver` | deploy from a machine that has one (yoga), or add this machine's key on the server |
| 3: `data is missing` | the app was never set up on the server | once, with sudo, on the server: `sudo bash ~/labs-setup/setup-lab-app.sh <id>` (from the seneschal repo, `deploy/homeserver/`) |
| 4: `could not be restarted` | the sudoers rule is missing | the same one-time setup, or `sudo systemctl restart seneschal-lab@<id>` by hand |
| 5: `backend not answering yet` | it is still starting; after a change to `backend/requirements.txt`, `./run` reinstalls the packages (a few minutes) | wait, or read the log: `ssh homeserver journalctl -u seneschal-lab@<id> -n 40 --no-pager` |

Other settings: `LABS_HOST` (default `homeserver`) and `LABS_URL` (default the site above).

## Notes for agents

- A deploy is safe to repeat: it never touches `data/`, so the workspace survives.
- Deploy the demo only with what you'd show a guest. It may be in use, and a backend restart drops open requests.
- Never add `demo: true` to `labs/fleshnote/experiment.yaml`: that would let guests into the author's own workspace.
- A new port or a new app id needs the one-time setup above, and the port must be free on the server.
