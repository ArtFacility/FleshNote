# FleshNote IDE

An advanced, localized, and feature-rich world-building IDE for writers and game developers. Built with Electron, React, TypeScript, and FastAPI.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

## 🌟 Key Features

- **Intuitive World Building**: Manage entities, characters, and items with a powerful inspector.
- **Localization Support**: Fully translated into **Hungarian (HU)**, **English (EN)**, and **Polish (PL)**.
- **Entity Inspector**: Advanced panel for managing bio, agendas, and deep-linking between entities.
- **Export Flow**: Comprehensive export capabilities for project data (added in v0.5.0).
- **Modern UI**: Sleek, responsive interface built with Tailwind CSS and Tiptap editor.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Project uses npm)
- [Python 3.10+](https://www.python.org/) (For backend services)

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
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

## 🛠️ Recommended Setup

- **IDE**: [VSCode](https://code.visualstudio.com/)
- **Extensions**: 
    - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
    - [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
    - [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## 📄 License

This project is licensed under the **GNU General Public License v3**. See the [LICENSE](LICENSE) file for the full text.

---
Built with ❤️ by [Artfacility](https://www.artfacility.xyz)
