# Clean-room build test

Builds and starts FleshNote on a machine with nothing installed, twice: with the versions in the repo ("base") and with
proposed ones ("new"). It catches the problems a first-time contributor hits and that a used dev environment hides.

- `run.sh`: runs as root inside a fresh Debian 13. Installs the tools, then per version set: `pip install`, backend tests,
  frozen backend with a synonym lookup, `npm ci`, `npm run build`, AppImage and deb, and a start of the packaged app.
- `smoke.mjs`: starts the packaged app under Xvfb and checks the window, the versions and `printToPDF`.

It expects a `/payload` folder holding `run.sh`, `smoke.mjs`, `app.tar` (a tar of `fleshnote-ide/` without `node_modules`,
`out`, `dist`, `docs`, `.claude`, `backend/.venv`, `backend/dist`, `backend/build`, `backend/nltk_data`) and `new/` with the
proposed `package.json`, `package-lock.json` and `req-new.txt`. Results go to stdout and `/payload`.

Running it on a Linux machine with `systemd-nspawn`, from an unpacked Debian root filesystem in `root/`:

    sudo systemd-nspawn -q --register=no --resolv-conf=off -D root --bind="$PWD/payload:/payload" --as-pid2 /payload/run.sh
