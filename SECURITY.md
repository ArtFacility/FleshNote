# Security Policy

## Supported Versions

Security fixes go into the latest 2.x release, including 2.0 beta builds. 1.x no longer receives updates; FleshNote 2.0 upgrades 1.x projects when you open them.

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| 1.x     | :x:                |

---

## Reporting a Vulnerability

**Please don't report security problems in public GitHub issues.**

1. **Preferred:** GitHub's [private vulnerability reporting](https://github.com/ArtFacility/FleshNote/security/advisories/new) for this repository.
2. **Email:** `artfacility.business@gmail.com`, with the subject `[SECURITY] FleshNote`.

### What to include
- What the problem is and what an attacker could do with it.
- Steps to reproduce, ideally with a proof-of-concept file (for example a crafted `.flnote` or `.flreview`).
- Your operating system (Windows or Linux) and the FleshNote version (shown in the title bar).
- A suggested fix, if you have one.

### What happens next
- **Acknowledgement:** within 72 hours.
- **Assessment:** we reproduce the issue, judge its severity and keep you updated while we work on a fix.
- **Disclosure:** we follow a 90-day coordinated disclosure window, so users can update before details are published. We're happy to credit you in the release notes.

### Hosted services
The FleshNote timestamping service and the review key server (both at `api.fleshnote.org`) are in scope too. Report problems with them the same way. Please don't load-test them, run denial-of-service tests against them, or access data that isn't yours.

---

## What FleshNote protects

FleshNote is an offline desktop app (Electron, React, a local Python/FastAPI backend, SQLite). Its backend listens on `127.0.0.1` only. Writers regularly open files that other people made, so the most important rule is: **a file someone sends you must never be able to do more than show you its content.**

### Project and review files (`.flnote`, `.flreview`)
Both are ZIP-based and treated as untrusted input:
- **Archives are checked before anything is written:** entries that escape the target folder (`../`, absolute paths, drive letters), symlinks and other non-regular files, duplicate entries, unexpected file types, and oversized or overly compressed archives cause the whole archive to be rejected.
- **Chapter file names** are validated, including Windows reserved names (`CON`, `NUL`, …) and trailing dots or spaces.
- **Review files** returned by beta readers carry notes and chapter scores only, never chapter text or database changes. Only known fields are read, every text field has a length cap, and files over 64 MB are refused. Review copies are encrypted, and copies with an expiry date can't be opened after it.

### Sync
- **Between project copies on disk:** incoming change logs are validated against the local database schema, so a crafted project can't inject SQL through table or column names.
- **Phone ↔ desktop over Wi-Fi:** the desktop opens a temporary server on the local network only while a pairing session is open (at most 10 minutes). The QR code carries a session token and a one-time 256-bit key, and every message with project content is encrypted and authenticated with AES-256-GCM. Messages without the key are refused without changing the session. The token, the session status and the timing of requests are not secret, and anyone who can see the QR code while the session is open can join it.

### Writing-process records (Pentimento)
Only SHA-256 hashes of the writing history are sent to the timestamping service, never text. Receipts are signed and can be checked independently.

---

## In scope
- Escaping a project or review file: writing outside the project folder, overwriting other files, or running code when a file is opened, imported or synced.
- Crafted review or sync data that corrupts or injects into the author's database.
- Breaking out of the renderer: from page content to Electron's main process, the backend, or the operating system (for example script injection through character names, chapter text or review notes).
- Reading, altering or taking over a Wi-Fi sync session without the QR code.
- Making the app contact addresses it shouldn't, or leak device identifiers or tokens.
- Problems in the hosted services listed above.

## Out of scope
- Attacks that need administrator access or physical access to an unlocked computer or phone.
- Windows SmartScreen warnings for unsigned installers. FleshNote is an independent open-source project without a code-signing certificate.
- Damage from editing a project's database or files by hand with other tools.
- Someone who can see your screen joining a sync session while its QR code is displayed.
