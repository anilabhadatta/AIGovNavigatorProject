import json
import chromadb
from chromadb.utils import embedding_functions
from sentence_transformers import SentenceTransformer
import os
import sqlite3
from models import ServiceEntry

CHROMA_DATA_PATH = "chroma_data"
SQLITE_DB_PATH = "navigator.db"

client = chromadb.PersistentClient(path=CHROMA_DATA_PATH)
embedding_model_name = "all-MiniLM-L6-v2"
model = SentenceTransformer(embedding_model_name)
collection_name = "gov_services"

collection = client.get_or_create_collection(
    name=collection_name,
    metadata={"hnsw:space": "cosine"}
)

def format_entry_for_embedding(entry: dict) -> str:
    return f"{entry.get('service_name', '')} {entry.get('portal', '')}. Steps: {' '.join(entry.get('steps', []))}. Documents: {' '.join(entry.get('required_documents', []))}."

def init_db():
    conn = sqlite3.connect(SQLITE_DB_PATH)
    c = conn.cursor()
    # create table for crawled KB
    c.execute('''CREATE TABLE IF NOT EXISTS kb_entries (
                    service_id TEXT PRIMARY KEY,
                    app_id TEXT,
                    service_name TEXT,
                    portal TEXT,
                    content TEXT, 
                    version INTEGER,
                    updated_at TEXT
                 )''')
                 
    c.execute('''CREATE TABLE IF NOT EXISTS drafts (
                    id TEXT PRIMARY KEY,
                    service_id TEXT,
                    app_id TEXT,
                    service_name TEXT,
                    portal TEXT,
                    changes TEXT,
                    source_snapshot TEXT,
                    timestamp TEXT,
                    raw_content TEXT,
                    new_version INTEGER
                 )''')
                 
    # create table for admin users
    c.execute('''CREATE TABLE IF NOT EXISTS admin_users (
                    username TEXT PRIMARY KEY,
                    password TEXT
                 )''')
    conn.commit()
    
    # Seed admin user if empty
    c.execute("SELECT COUNT(*) FROM admin_users")
    if c.fetchone()[0] == 0:
        c.execute("INSERT INTO admin_users (username, password) VALUES ('admin', 'admin')")
        conn.commit()
    
    # Check if empty, maybe load from seed_data.json just to have base state
    c.execute("SELECT COUNT(*) FROM kb_entries")
    if c.fetchone()[0] == 0:
        if os.path.exists("seed_data.json"):
            print("Migrating seed_data.json to SQLite DB...")
            with open("seed_data.json", "r") as f:
                data = json.load(f)
            
            for item in data:
                c.execute('''INSERT INTO kb_entries 
                             (service_id, app_id, service_name, portal, content, version, updated_at) 
                             VALUES (?, ?, ?, ?, ?, ?, ?)''',
                          (item["service_id"], "unknown", item["service_name"], item["portal"], 
                           json.dumps({
                               "steps": item["steps"],
                               "required_documents": item["required_documents"],
                               "fees": item["fees"],
                               "official_link": item["official_link"]
                           }), 1, item["last_verified_date"]))
            conn.commit()
            sync_chromadb()
    
    conn.close()

def sync_chromadb():
    """Syncs SQLite to ChromaDB completely."""
    conn = sqlite3.connect(SQLITE_DB_PATH)
    c = conn.cursor()
    c.execute("SELECT service_id, portal, service_name, content, updated_at FROM kb_entries")
    rows = c.fetchall()
    
    if not rows:
        return
        
    docs = []
    metadatas = []
    ids = []
    embeddings = []

    for r in rows:
        service_id, portal, service_name, content_str, updated_at = r
        content = json.loads(content_str)
        
        # Build entry dict for formatting
        entry = {
            "service_name": service_name,
            "portal": portal,
            "steps": content.get("steps", []),
            "required_documents": content.get("required_documents", [])
        }
        text = format_entry_for_embedding(entry)
        
        docs.append(text)
        metadatas.append({
            "service_id": service_id,
            "portal": portal,
            "service_name": service_name,
            "fees": content.get("fees", ""),
            "official_link": content.get("official_link", ""),
            "last_verified_date": updated_at
        })
        ids.append(service_id)
        embeddings.append(model.encode(text).tolist())

    # We can clear and re-add or just upsert. Upsert is safer.
    collection.upsert(
        documents=docs,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids
    )
    conn.close()

def search_services(query: str, top_k: int = 3):
    query_embedding = model.encode(query).tolist()
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k
    )
    
    if not results["ids"] or not results["ids"][0]:
        return []
        
    matches = []
    for i in range(len(results["ids"][0])):
        service_id = results["ids"][0][i]
        distance = results["distances"][0][i]
        matches.append({
            "service_id": service_id,
            "metadata": results["metadatas"][0][i],
            "distance": distance
        })
    return matches

def get_service_by_id(service_id: str) -> dict:
    conn = sqlite3.connect(SQLITE_DB_PATH)
    c = conn.cursor()
    c.execute("SELECT service_id, portal, service_name, content, updated_at FROM kb_entries WHERE service_id=?", (service_id,))
    row = c.fetchone()
    conn.close()
    
    if row:
        content = json.loads(row[3])
        return {
            "service_id": row[0],
            "portal": row[1],
            "service_name": row[2],
            "steps": content.get("steps", []),
            "required_documents": content.get("required_documents", []),
            "fees": content.get("fees", ""),
            "official_link": content.get("official_link", ""),
            "last_verified_date": row[4],
            "source_ref": "Crawler Auto-Update"
        }
    return None

def get_service_version(service_id: str) -> int:
    conn = sqlite3.connect(SQLITE_DB_PATH)
    c = conn.cursor()
    c.execute("SELECT version FROM kb_entries WHERE service_id=?", (service_id,))
    row = c.fetchone()
    conn.close()
    return row[0] if row else 0

def upsert_service(service_id: str, app_id: str, service_name: str, portal: str, content: dict, version: int, updated_at: str):
    conn = sqlite3.connect(SQLITE_DB_PATH)
    c = conn.cursor()
    c.execute('''INSERT OR REPLACE INTO kb_entries 
                 (service_id, app_id, service_name, portal, content, version, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)''',
              (service_id, app_id, service_name, portal, json.dumps(content), version, updated_at))
    conn.commit()
    conn.close()
    sync_chromadb()

def get_all_services() -> list:
    conn = sqlite3.connect(SQLITE_DB_PATH)
    c = conn.cursor()
    c.execute("SELECT service_id, app_id, service_name, portal, content, version, updated_at FROM kb_entries")
    rows = c.fetchall()
    conn.close()
    
    services = []
    for r in rows:
        services.append({
            "service_id": r[0],
            "app_id": r[1],
            "service_name": r[2],
            "portal": r[3],
            "content": json.loads(r[4]),
            "version": r[5],
            "updated_at": r[6]
        })
    return services

def save_draft(draft: dict):
    conn = sqlite3.connect(SQLITE_DB_PATH)
    c = conn.cursor()
    c.execute('''INSERT OR REPLACE INTO drafts 
                 (id, service_id, app_id, service_name, portal, changes, source_snapshot, timestamp, raw_content, new_version) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
              (draft["id"], draft["service_id"], draft.get("app_id", ""), draft["service_name"], draft["portal"], 
               json.dumps(draft["changes"]), draft["source_snapshot"], draft["timestamp"], 
               json.dumps(draft.get("raw_content", {})), draft.get("new_version", 1)))
    conn.commit()
    conn.close()

def get_all_drafts() -> list:
    conn = sqlite3.connect(SQLITE_DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, service_id, app_id, service_name, portal, changes, source_snapshot, timestamp, raw_content, new_version FROM drafts")
    rows = c.fetchall()
    conn.close()
    
    drafts = []
    for r in rows:
        drafts.append({
            "id": r[0],
            "service_id": r[1],
            "app_id": r[2],
            "service_name": r[3],
            "portal": r[4],
            "changes": json.loads(r[5]),
            "source_snapshot": r[6],
            "timestamp": r[7],
            "raw_content": json.loads(r[8]),
            "new_version": r[9]
        })
    return drafts

def get_draft(draft_id: str) -> dict:
    conn = sqlite3.connect(SQLITE_DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, service_id, app_id, service_name, portal, changes, source_snapshot, timestamp, raw_content, new_version FROM drafts WHERE id=?", (draft_id,))
    row = c.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row[0],
            "service_id": row[1],
            "app_id": row[2],
            "service_name": row[3],
            "portal": row[4],
            "changes": json.loads(row[5]),
            "source_snapshot": row[6],
            "timestamp": row[7],
            "raw_content": json.loads(row[8]),
            "new_version": row[9]
        }
    return None

def delete_draft(draft_id: str):
    conn = sqlite3.connect(SQLITE_DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM drafts WHERE id=?", (draft_id,))
    conn.commit()
    conn.close()

def verify_admin_credentials(username: str, password: str) -> bool:
    conn = sqlite3.connect(SQLITE_DB_PATH)
    c = conn.cursor()
    c.execute("SELECT 1 FROM admin_users WHERE username=? AND password=?", (username, password))
    row = c.fetchone()
    conn.close()
    return row is not None

