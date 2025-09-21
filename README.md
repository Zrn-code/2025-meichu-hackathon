# 2025 Meichu Hackathon

This project is developed for the 2025 Meichu Hackathon, featuring a multi-component system that includes a backend server, voice generation service, Chrome extension, and Windows desktop application for YouTube video monitoring and interaction.

## How It Works

The system operates as an integrated YouTube monitoring and interaction platform:

1. **YouTube Monitoring**: The Chrome extension monitors YouTube video playback and sends real-time status updates to the backend server
2. **Data Processing**: The backend server processes video information, chat interactions, and coordinates between different services
3. **Voice Generation**: When triggered, the voice generation server creates audio files based on processed data
4. **Desktop Interface**: The Windows application provides a comprehensive UI for users to interact with the system and view processed information

## Project Structure

```text
backend-server/           # Python Flask server handling APIs and core logic
chrome-extension/         # Chrome extension for YouTube page monitoring
lemonade-server/          # Additional service components
voice-generation-server/  # Voice synthesis service for audio generation
windows-app/              # Electron-based Windows desktop application
```

## Components Overview

### backend-server

- Python Flask application managing API endpoints, data processing, and business logic
- Integrates chat handling, YouTube monitoring, and voice generation coordination
- Key files: `main.py`, `server.py`, `requirements.txt`

### chrome-extension

- Chrome extension that monitors YouTube page status and communicates with the local server
- Provides browser-side interaction and real-time video monitoring
- Key files: `background.js`, `content.js`, `manifest.json`, `popup.html`

### voice-generation-server

- Standalone Flask service for voice synthesis and audio file generation
- Generates audio files based on processed video and chat data
- Key files: `app.py`, `requirements.txt`

### windows-app

- Electron-based desktop application with modern frontend technologies (React, Vite)
- Provides comprehensive UI for system interaction and data visualization
- Key files: `src/`, `package.json`, `index.html`

## Getting Started

To run the complete system, you'll need to start multiple services in the following order:

### 1. Backend Server

Navigate to the backend server directory and start the main service:

```bash
cd backend-server
pip install -r requirements.txt
python server.py
```

### 2. Voice Generation Server

In a separate terminal, start the voice generation service:

```bash
cd voice-generation-server
pip install -r requirements.txt
python app.py
```

### 3. Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `chrome-extension` folder
4. The extension will appear in your browser toolbar

### 4. Windows Application

Start the Electron desktop application:

```bash
cd windows-app
npm install
npm start
```

## System Workflow

1. **YouTube Monitoring**: Open a YouTube video with the Chrome extension installed
2. **Data Collection**: The extension monitors video playback and sends data to the backend server
3. **Processing**: The backend processes video information and chat interactions
4. **Voice Generation**: Audio files are generated based on the processed data
5. **UI Display**: The Windows application displays real-time information and generated content

## Prerequisites

- Python 3.10+
- Node.js 16+
- Chrome Browser
- Windows OS (for the desktop application)

## Contributing

1. Fork this repository and create a new branch
2. Make your changes and commit them with clear messages
3. Submit a Pull Request with detailed description of your changes
4. Follow the coding standards of each sub-project

## Contact

For questions or issues, please contact the project maintainers or create an issue in the repository.

---

> This project is developed and maintained by the 2025 Meichu Hackathon Team.
