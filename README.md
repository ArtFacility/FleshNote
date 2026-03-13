# FleshNote IDE

An advanced, localized, and feature-rich writing tool for writers, and world builders who actually wish to finish their story this century. Built with Electron, React, TypeScript, and FastAPI.

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

## 🌟 Key Features

- **Advanced Manuscript Editor**: Distraction-free writing with `@` entity mentions, smart `#TODO` tracking, and real-time word count velocity.
- **Deep World Building**: A robust **Entity Inspector** to manage character bios, agendas (surface & hidden), and geographic hierarchies.
- **Plot Planner & Timeline**: A zoomable, multi-layer canvas for mapping story arcs, beats, and complex narrative threads.
- **Twist & Foreshadowing Tracker**: Heuristic tools to manage major reveals, ensuring clues are paced effectively across your manuscript.
- **Stats Dashboard & Analytics**: Visualized "Story Health" diagnostics, writing habit analysis, and entity appearance auditing.
- **World History Timeline**: Dedicated chronological tracker for events, from centuries-old lore to the immediate sequence of story events.
- **Non-Linear Relationships**: Track evolving character dynamics through time, including one-sided feelings and chapter-specific historical states.
- **Custom Calendar Engine**: Beyond Earth — define unique months, seasons, and epoch systems tailored to your fictional world.
- **Bulk Entity Management**: Powerful tools to merge duplicates, manage aliases, and perform mass-cleanup of your lore database.
- **Gamified Progression**: An intrinsic **Achievements System** with badges for consistency, volume, and narrative complexity.
- **Professional Export Suite**: Industry-standard manuscript exports to PDF, DOCX, and EPUB with book-ready formatting presets.
- **Full Localization**: Seamlessly switch between **English**, **Polish**, **Hungarian**, and **Arabic (RTL)**.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Project uses npm)
- [Python 3.13](https://www.python.org/) (For backend services)

### Installation

1. Clone the repository and navigate into the `fleshnote-ide` subfolder:
   ```bash
   cd fleshnote-ide
   ```
2. Install the frontend dependencies:
   ```bash
   npm install
   ```
3. Setup the Python backend environment:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements_build.txt
   cd ..
   ```

### Development

Run the application in development mode:
```bash
npm run dev
```

## 📦 Building for Production

You can build the production installer using the provided platform-specific scripts or npm commands.

### Using Build Scripts (Recommended)

**Windows** (PowerShell/CMD):
```bash
./build.bat
```

**Linux/macOS** (Terminal):
```bash
chmod +x build.sh
./build.sh linux  # or ./build.sh mac
```

### Manual Build Commands

**Windows**
```bash
npm run build:win
```

**macOS**
```bash
npm run build:mac
```

**Linux**
```bash
npm run build:linux
```

**Linux (Flatpak)**

> **Note:** To build Flatpak correctly, you must ensure `flatpak` and `flatpak-builder` are installed on your system. 
> Since the bundler operates at the user-level, you also **must** have the Flathub remote added for your local user environment, or the build will fail:
> ```bash
> flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
> ```

```bash
npm run build:flatpak
```

## 🛠️ Recommended Setup

- **IDE**: [VSCode](https://code.visualstudio.com/)
- **Extensions**: 
    - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
    - [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
    - [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## 📄 License

This project is licensed under the **Mozilla Public License 2.0**. See the [LICENSE](LICENSE) file for the full text.

---
Built with ❤️ by [Artfacility](https://www.artfacility.xyz)
