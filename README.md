# FleshNote IDE

An advanced, localized, and feature-rich writing tool for writers, and world builders who actually wish to finish their story this century. Built with Electron, React, TypeScript, and FastAPI.

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

## 🌟 Key Features

- **Advanced Manuscript Editor**: Distraction-free writing with strict focus sprints (like Hemingway or Kamikaze), `@` entity mentions, `#TODO` tracking, and real-time word count velocity.
- **NLP-Driven Extraction**: Import your chaotic notes and use local NLP analysis (spaCy) to automatically detect characters, locations, and lore items — complete with lightning-fast alias management and split-pane triage.
- **Deep World Building & Epistemic UI**: A robust **Entity Inspector** to manage character bios, agendas (surface & hidden), and geographic hierarchies. Filter truth vs. narrative deception by tracking exactly _who knows what_.
- **Annotation & Footnote Engine**: Attach contextual quick-notes or research directly to your markdown text. Annotations elegantly export as numbered footnotes to DOCX, HTML, PDF, and EPUB.
- **Plot Planner & Timeline**: A zoomable, multi-layer canvas for mapping story arcs, beats, and complex narrative threads.
- **Twist & Foreshadow Tracker**: Heuristic tools to manage major reveals, ensuring narrative clues are paced effectively across your manuscript.
- **Non-Linear Relationships**: Track evolving character dynamics through time, including one-sided feelings and chapter-specific historical states.
- **Custom Calendar Engine & Dual Timeline**: Go beyond Earth — define unique months, seasons, and epochs. Monitor your story's progression across both the natural reading order and strict in-universe chronologies.
- **Stats Dashboard**: Visualized "Story Health" diagnostics, writing habit analysis, and entity appearance auditing.
- **Gamified Progression**: Keep up your writing momentum through an intrinsic **Achievements System** rewarding consistency and volume.
- **Professional Export Suite**: Industry-standard manuscript exports to PDF, DOCX, and EPUB with book-ready formatting presets, selective chapter inclusion, and a gorgeous live WYSIWYG book preview.
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
