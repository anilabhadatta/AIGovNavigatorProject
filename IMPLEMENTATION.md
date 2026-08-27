# Architecture & Implementation Notes

This document provides a technical deep-dive for AI agents and developers interacting with this repository.

## 1. Core Architecture Pattern
This project implements a **Dual-Database RAG System** combined with an **Automated Knowledge Maintenance Pipeline**.

- **Relational DB (SQLite - `navigator.db`)**: Acts as the absolute Source of Truth. Stores structured JSON data, integer versions, and handles transactional state logic (Pending Drafts vs. Active Services).
- **Vector DB (ChromaDB - `chroma_data/`)**: Acts purely as the Semantic Search Index for the LLM. It is strictly a downstream replica of SQLite.

## 2. The Crawler Pipeline (`scan-updates`)
The application is designed to simulate a decentralized government ecosystem where independent departments update their own portals.

1. **Service Discovery**: The crawler queries the master API (`dummy-gov-webapp/api/master`) to discover active departments (e.g., Parivahan, UIDAI).
2. **Data Ingestion**: It calls the context-specific endpoints (`/api/app/{app_id}/kb`) to retrieve the current Knowledge Base (KB) and version number.
3. **Change Detection (Diffing)**: 
   - It cross-references the remote `version` with the local SQLite `version`.
   - If the remote version is higher, it formats both the local state and remote state into standard text blocks and uses Python's `difflib.ndiff` to extract only the changed lines (`-` and `+`).
4. **LLM Extraction**:
   - The raw diff text is sent to `gemini-2.5-flash` (`extract_draft_update` in `llm.py`).
   - The LLM maps unstructured diffs into structured `DraftChange` Pydantic objects.
   - It flags ambiguous extractions with `needs_review: true`.
5. **State Persistance**: 
   - The generated draft, along with the raw remote content and new version number, is saved to the `drafts` table in SQLite.

## 3. The Approval Lifecycle
When an admin views `AdminPanel.tsx` and clicks "Approve":
1. `backend/main.py:approve_draft` is called.
2. The draft is retrieved from SQLite.
3. `db.py:upsert_service` executes an `INSERT OR REPLACE` to update the active `kb_entries` table with the new JSON content and new version number.
4. `db.py:sync_chromadb` fires automatically:
   - It formats the new JSON entry into a dense text string.
   - Passes it to `sentence-transformers (all-MiniLM-L6-v2)` to generate embeddings.
   - Upserts the new embedding and metadata into ChromaDB.
5. The draft is deleted from the `drafts` table.

## 4. Grounded Citizen Chat (RAG)
1. **Language Detection & Intent Extraction**: User input is sent to Gemini to identify the language and extract a specific `service_id` (matching the user's intent to one of our predefined services).
2. **Fallback Search**: If intent extraction fails to find a specific `service_id`, ChromaDB performs a cosine similarity search on the embedded user query.
3. **Grounded Generation**: The exact matching `ServiceEntry` is fetched from SQLite (or ChromaDB metadata) and injected into the system prompt. The LLM is given strict instructions to **never hallucinate** and only answer based on the injected context.
4. **Source Attribution**: The UI automatically parses the generated markdown and extracts the `source_ref` and `last_verified_date` to display trust indicators to the citizen.

## 5. Technology Stack constraints
- **No External Scraping**: Simulated via `dummy-gov-webapp` to guarantee stable execution during hackathon judging.
- **Zero-cost local embeddings**: Uses `sentence-transformers` locally to save API costs.
- **Frontend**: Vite + React + TailwindCSS (vanilla, no unnecessary libraries outside of standard UI utilities).
- **Backend**: FastAPI for async handling, standard Python libraries (`difflib`, `sqlite3`).

## 6. Extending the System
- **Adding new apps**: Add them to `dummy-gov-webapp/main.py`'s SQLite initialization. The crawler will automatically discover them.
- **Adding Auth**: The `AdminPanel` currently lacks authentication. A JWT middleware should be injected in `main.py` for production.
