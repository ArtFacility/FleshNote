#!/bin/bash
# Raw-environment build and test of FleshNote: current pins ("base") against proposed ones ("new").
export DEBIAN_FRONTEND=noninteractive HOME=/root TMPDIR=/var/tmp LANG=C.UTF-8 ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=
say() { echo; echo "=== $(date +%H:%M:%S) $*"; }
say os; . /etc/os-release; echo "$PRETTY_NAME"; 
say apt; apt-get update -qq && apt-get install -y -qq --no-install-recommends python3 python3-venv python3-dev gcc g++ make curl ca-certificates xz-utils git xvfb xauth libnss3 libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libasound2 libcups2 libxss1 libxkbcommon0 libdrm2 libsecret-1-0 fakeroot dpkg-dev libfuse2 rpm binutils procps >/dev/null 2>&1; echo apt-exit=$?
python3 --version
say node; curl -fsSL https://nodejs.org/dist/v24.13.0/node-v24.13.0-linux-x64.tar.xz | tar -xJ -C /opt && export PATH=/opt/node-v24.13.0-linux-x64/bin:$PATH; node --version
cd /opt && mkdir -p pw && cd pw && npm init -y >/dev/null && npm i -s playwright-core && cp /payload/smoke.mjs .
stage() {
  S=$1; say "STAGE $S start"; rm -rf /work/$S; mkdir -p /work/$S; tar -C /work/$S -xf /payload/app.tar; cd /work/$S
  if [ $S = new ]; then cp /payload/new/package.json /payload/new/package-lock.json .; cp /payload/new/req-new.txt backend/requirements_build.txt; fi
  cd backend; python3 -m venv .venv; P=.venv/bin/python
  say "$S pip"; $P -m pip install -q --upgrade pip 2>&1 | tail -1; $P -m pip install -q -r requirements_build.txt 2>&1 | tail -4; echo pip-exit=${PIPESTATUS[0]}; $P -m pip install -q --no-deps huspacy==0.12.1 2>&1 | tail -1; $P -m pip check 2>&1 | head -4; $P -m pip freeze > /payload/freeze-$S.txt; wc -l < /payload/freeze-$S.txt
  say "$S backend tests"; for t in test_*.py; do m=${t%.py}; r=$(timeout 240 $P -m unittest $m 2>&1 | grep -E '^(OK|FAILED|NO TESTS RAN|Ran 0)' | tail -1); echo "$m: ${r:-no-result}"; done | grep -v -E ': (OK|NO TESTS RAN)'; echo tests-done
  say "$S frozen backend"; $P build_backend.py > /payload/frozen-$S.log 2>&1; echo frozen-exit=$?; tail -1 /payload/frozen-$S.log | cut -c1-120; du -sh dist/backend | cut -f1
  (dist/backend/backend --port 8000 > /payload/frozen-run-$S.log 2>&1 & echo $! > /tmp/fb.pid); for i in $(seq 90); do curl -s -o /dev/null http://127.0.0.1:8000/ && break; sleep 1; done
  for w in eng; do curl -s -m 60 -X POST -H 'content-type: application/json' -d '{"word":"happy","lang":"eng"}' http://127.0.0.1:8000/api/synonyms/lookup | cut -c1-200; echo; done
  curl -s -m 30 -X POST http://127.0.0.1:8000/api/synonyms/check-data | cut -c1-120; echo
  # Polish comes from the bundled omw-1.4, so an English-only answer means it wasn't read.
  curl -s -m 60 -X POST -H 'content-type: application/json' -d '{"word":"pies","lang":"pol"}' http://127.0.0.1:8000/api/synonyms/lookup | cut -c1-200; echo
  curl -s -o /dev/null -w 'foreign Host: %{http_code}
' -H 'Host: evil.example' http://127.0.0.1:8000/
  kill $(cat /tmp/fb.pid) 2>/dev/null; sleep 2; pkill -f dist/backend/backend 2>/dev/null; tail -3 /payload/frozen-run-$S.log | cut -c1-160
  cd ..
  say "$S npm ci"; npm ci --no-audit --no-fund 2>&1 | tail -2 | cut -c1-150; echo npmci-exit=${PIPESTATUS[0]}; npm audit 2>/dev/null | tail -4 | head -2
  say "$S npm run build"; npm run build 2>&1 | tail -2 | cut -c1-120; echo build-exit=${PIPESTATUS[0]}
  say "$S package"; npx electron-builder --linux dir 2>&1 | tail -3 | cut -c1-140; echo dir-exit=${PIPESTATUS[0]}; npx electron-builder --linux AppImage deb --publish never 2>&1 | tail -3 | cut -c1-140; echo pkg-exit=${PIPESTATUS[0]}; ls -la dist/*.AppImage dist/*.deb 2>/dev/null | awk '{print $5,$NF}'
  say "$S app smoke"; cd /opt/pw; FLESH=/work/$S/dist/linux-unpacked/fleshnote-ide; timeout 300 xvfb-run -a -s '-screen 0 1440x900x24' node smoke.mjs $FLESH /payload/shot-$S.png 2>&1 | tail -3 | cut -c1-500; echo smoke-exit=${PIPESTATUS[0]}; pkill -f linux-unpacked 2>/dev/null; pkill -f backend-dist 2>/dev/null
  say "$S done"
}
stage base; stage new
cd /work/new; say "new flatpak+snap attempt (a raw machine has no tooling for these)"; timeout 240 npx electron-builder --linux flatpak --publish never 2>&1 | tail -2 | cut -c1-160; echo flatpak-exit=${PIPESTATUS[0]}
say ALL-DONE
