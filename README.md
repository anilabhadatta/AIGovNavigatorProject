# AI Government Service Navigator

A multilingual AI-powered government service navigator built for hackathons, providing citizens with grounded, sourced guidance for Indian government services. It includes a complete lifecycle for automated knowledge base updates via a mock government portal ecosystem.

## Features
- **Citizen Chat Interface**: Multilingual, grounded RAG chatbot powered by Google Gemini and ChromaDB vector search. Refuses hallucinations and strictly cites sources.
- **Automated Web Crawler**: Background job that simulates scraping decentralized government department APIs to detect policy changes.
- **LLM Diff Extraction**: Automatically computes text diffs between crawled versions and local versions, using Gemini 2.5 Flash to extract structured schema updates.
- **Admin Review Panel**: React UI to review, approve, or reject auto-drafted updates before syncing them to the central Vector Database.
- **Dummy Gov Webapp**: A simulated federated ecosystem of government portals (Parivahan, UIDAI, Passport Seva) to demonstrate the automated update pipeline.

## Project Structure
```text
AIGovNavigatorProject/
├── ai-gov-navigator/
│   ├── backend/
│   │   ├── main.py        # FastAPI server, Crawler, Admin Endpoints, Citizen Chat
│   │   ├── db.py          # SQLite (Relational KB & Drafts) + ChromaDB (Vector Index)
│   │   ├── llm.py         # Google Gemini orchestrator for RAG and Diff extraction
│   │   ├── models.py      # Pydantic schemas
│   │   └── Dockerfile     # Backend Docker image config
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── CitizenPortal.tsx  # End-user chat UI
│   │   │   │   └── AdminPanel.tsx     # Review pending drafts & active KB
│   │   └── Dockerfile     # Frontend Docker image config
│   └── run_demo.ps1       # Local powershell execution script
├── dummy-gov-webapp/
│   ├── main.py            # Simulated master API and context-specific KBs
│   └── Dockerfile         # Dummy gov app Docker config
└── docker-compose.yml     # Orchestration for all 3 services
```

## Quick Start (Docker)
The easiest way to run the entire federated system is using Docker Compose.

1. Create an environment file in the backend:
   ```bash
   echo "GEMINI_API_KEY=your_google_api_key_here" > ai-gov-navigator/backend/.env
   ```
2. Start the cluster:
   ```bash
   docker compose up --build
   ```
3. Access the interfaces:
   - **Citizen Chat:** `http://localhost:5173/`
   - **Admin Panel:** `http://localhost:5173/admin`
   - **Dummy Gov Editor:** `http://localhost:8001/`

*Note: If running in Docker, inside the Admin Panel, change the Gov Parent API URL to `http://dummy-gov-webapp:8001/api/master` so the internal Docker DNS resolves correctly.*

## Quick Start (Local PowerShell / Windows)
If you prefer running natively without Docker:

1. Add your `GEMINI_API_KEY` to `ai-gov-navigator/backend/.env`.
2. Open PowerShell and run the demo script:
   ```powershell
   cd ai-gov-navigator
   .\run_demo.ps1
   ```
3. This script automatically starts:
   - Dummy Gov Portal (`localhost:8001`)
   - AI Backend (`localhost:8000`)
   - React Frontend (`localhost:5173`)
