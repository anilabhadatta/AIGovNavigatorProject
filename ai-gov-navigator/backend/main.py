from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from db import init_db, search_services, get_service_by_id
import llm
import json
import difflib
import os
import uuid
import datetime
import requests
import logging

# Configure central logging to project root
log_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "app.log"))
logging.basicConfig(
    filename=log_file_path,
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("backend")

from models import DraftUpdate, DraftChange
from db import init_db, search_services, get_service_by_id, upsert_service, get_service_version, get_all_services, save_draft, get_all_drafts, get_draft, delete_draft
app = FastAPI(title="AI Government Service Navigator")

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing Backend Database...")
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix="/aigov")

class SearchRequest(BaseModel):
    query: str
    top_k: int = 3

class SearchResponse(BaseModel):
    service_id: str
    service_name: str
    portal: str
    distance: float
    official_link: str

class ChatRequest(BaseModel):
    query: str

class ChatSource(BaseModel):
    link: str
    lastVerified: str
    ref: str

class ChatResponse(BaseModel):
    answer: str
    language: str
    sources: List[ChatSource]

@app.on_event("startup")
async def startup_event():
    print("Initializing Database...")
    init_db()

@router.get("/")
def read_root():
    return {"message": "Welcome to AI Government Service Navigator API"}

@router.post("/api/v1/search", response_model=List[SearchResponse])
def search(request: SearchRequest):
    results = search_services(request.query, request.top_k)
    response = []
    for r in results:
        meta = r["metadata"]
        response.append(SearchResponse(
            service_id=r["service_id"],
            service_name=meta.get("service_name", ""),
            portal=meta.get("portal", ""),
            distance=r["distance"],
            official_link=meta.get("official_link", "")
        ))
    return response

@router.get("/api/v1/service/{service_id}")
def get_service(service_id: str):
    service = get_service_by_id(service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service

@router.post("/api/v1/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    # 1. Detect Language
    language = llm.detect_language(request.query)
    
    # 2. Vector Retrieval (to get the list of possible services based on vector sim)
    results = search_services(request.query, top_k=5)
    
    if not results:
        return ChatResponse(
            answer="I don't have verified information on this specific service.",
            language=language,
            sources=[]
        )
    
    # Format available services for intent extraction
    available_services = [{"service_id": r["service_id"], "service_name": r["metadata"].get("service_name")} for r in results]
    
    try:
        # 3. LLM Call #1: Intent Extraction
        intent = llm.extract_intent(request.query, available_services)
        
        target_service_id = intent.service_id
        
        # If low confidence or unknown, just use the top vector result as fallback if distance is good, or return fallback
        if intent.confidence < 0.5 or target_service_id == "unknown":
            # Guardrail: Refuse to answer if confidence is low
            return ChatResponse(
                answer="I'm sorry, but I couldn't confidently determine which service you are asking about from our verified knowledge base.",
                language=language,
                sources=[]
            )
            
        # 4. Fetch the full entry
        service_data = get_service_by_id(target_service_id)
        if not service_data:
            return ChatResponse(
                answer="Service details could not be found.",
                language=language,
                sources=[]
            )
            
        # 5. LLM Call #2: Grounded Generation
        answer = llm.generate_grounded_answer(request.query, service_data, language)
        
        return ChatResponse(
            answer=answer,
            language=language,
            sources=[ChatSource(
                link=service_data.get("official_link", ""),
                lastVerified=service_data.get("last_verified_date", ""),
                ref=service_data.get("source_ref", "")
            )]
        )
        
    except Exception as e:
        logger.error(f"Error in LLM pipeline: {e}")
        raise HTTPException(status_code=500, detail="Error generating response. Please make sure GEMINI_API_KEY is set in .env")

# --- Phase 3 & 4: Admin endpoints ---

@router.get("/api/v1/admin/drafts", response_model=List[DraftUpdate])
def get_drafts():
    return get_all_drafts()

@router.get("/api/v1/admin/services")
def get_services():
    return get_all_services()

class ConnectApiRequest(BaseModel):
    master_api_url: str

@router.post("/api/v1/admin/scan-updates")
def scan_updates(req: ConnectApiRequest):
    """Crawler: Fetches KB from the dummy Gov Portal API, compares version, and auto-drafts updates."""
    
    url = req.master_api_url.strip() if req.master_api_url else "http://dummy-gov-webapp:8001/dummygov/api/master"
    
    # Auto-fix for relative paths passed from frontend
    if url.startswith("/"):
        url = f"http://dummy-gov-webapp:8001{url}"
        
    # Auto-fix for docker networking
    if "localhost:" in url or "127.0.0.1:" in url or "0.0.0.0:" in url:
        url = url.replace("localhost:", "dummy-gov-webapp:")
        url = url.replace("127.0.0.1:", "dummy-gov-webapp:")
        url = url.replace("0.0.0.0:", "dummy-gov-webapp:")

    try:
        master_res = requests.get(url)
        master_data = master_res.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not connect to parent API: {e}")
        
    apps = master_data.get("apps", [])
    new_drafts_generated = 0
    
    for app_info in apps:
        kb_url = app_info.get("kb_api_url")
        app_name = app_info.get("app_name")
        app_id = app_info.get("app_id")
        
        # Ensure kb_url uses internal Docker DNS instead of the external custom domain
        if kb_url and "dummygov/" in kb_url:
            path_suffix = kb_url.split("dummygov/")[1]
            kb_url = f"http://dummy-gov-webapp:8001/dummygov/{path_suffix}"
            
        try:
            kb_res = requests.get(kb_url)
            kb_data = kb_res.json()
        except Exception as e:
            logger.error(f"Failed to fetch KB from {kb_url}: {e}")
            continue
            
        kb_entries = kb_data.get("knowledgebase", [])
        
        for entry in kb_entries:
            service_id = entry.get("service_id")
            fetched_version = entry.get("version", 1)
            fetched_content = entry.get("content", {})
            service_name = entry.get("service_name")
            updated_at = entry.get("updated_at")
            
            local_version = get_service_version(service_id)
            
            # If the remote version is newer, we found a change!
            if fetched_version > local_version:
                # Get local content if exists to diff
                local_service = get_service_by_id(service_id)
                
                if local_service:
                    # Construct diff
                    old_text = json.dumps({
                        "steps": local_service.get("steps"),
                        "required_documents": local_service.get("required_documents"),
                        "fees": local_service.get("fees")
                    }, indent=2)
                else:
                    old_text = "{}"
                    
                new_text = json.dumps({
                    "steps": fetched_content.get("steps"),
                    "required_documents": fetched_content.get("required_documents"),
                    "fees": fetched_content.get("fees")
                }, indent=2)
                
                diff = list(difflib.ndiff(old_text.splitlines(), new_text.splitlines()))
                diff_text = "\\n".join([line for line in diff if line.startswith('- ') or line.startswith('+ ')])
                
                # Use LLM to extract drafted changes from Diff
                changes = llm.extract_draft_update(diff_text, fetched_content)
                
                if changes:
                    new_draft = {
                        "id": f"draft_{uuid.uuid4().hex[:8]}",
                        "service_id": service_id,
                        "service_name": service_name,
                        "portal": app_name,
                        "changes": changes,
                        "source_snapshot": f"Crawled Version {fetched_version} from {app_name}",
                        "timestamp": updated_at,
                        "raw_content": fetched_content, # We store the new content in the draft so we can save it on approve
                        "new_version": fetched_version,
                        "app_id": app_id
                    }
                    save_draft(new_draft)
                    new_drafts_generated += 1
    
    return {"message": f"Scan complete. Found {new_drafts_generated} updates.", "count": new_drafts_generated}

@router.post("/api/v1/admin/drafts/{draft_id}/approve")
def approve_draft(draft_id: str):
    draft = get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
        
    # Apply changes to SQLite DB and ChromaDB
    upsert_service(
        service_id=draft["service_id"],
        app_id=draft.get("app_id", "unknown"),
        service_name=draft["service_name"],
        portal=draft["portal"],
        content=draft.get("raw_content", {}),
        version=draft.get("new_version", 1),
        updated_at=draft["timestamp"]
    )
    
    # Remove from pending drafts
    delete_draft(draft_id)
    
    return {"message": "Draft approved and knowledge base updated."}

@router.post("/api/v1/admin/drafts/{draft_id}/reject")
def reject_draft(draft_id: str):
    draft = get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
        
    delete_draft(draft_id)
    return {"message": "Draft rejected."}

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
