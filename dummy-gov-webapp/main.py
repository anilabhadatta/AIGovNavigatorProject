from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import uvicorn
import sqlite3
import json
import os

app = FastAPI(title="Dummy Government Portal API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "dummy_gov.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS apps (
                    app_id TEXT PRIMARY KEY,
                    app_name TEXT
                 )''')
    c.execute('''CREATE TABLE IF NOT EXISTS knowledgebase (
                    service_id TEXT PRIMARY KEY,
                    app_id TEXT,
                    service_name TEXT,
                    content TEXT,
                    version INTEGER,
                    updated_at TEXT,
                    FOREIGN KEY(app_id) REFERENCES apps(app_id)
                 )''')
    conn.commit()
    
    # Seed data if empty
    c.execute("SELECT COUNT(*) FROM apps")
    if c.fetchone()[0] == 0:
        apps = [
            ("parivahan", "Parivahan Sewa"),
            ("uidai", "UIDAI Aadhaar Services"),
            ("passport", "Passport Seva")
        ]
        c.executemany("INSERT INTO apps (app_id, app_name) VALUES (?, ?)", apps)
        
        # We store stringified JSON as 'content' for the KB entry
        # to represent the source text the crawler will fetch.
        kbs = [
            ("dl_new_01", "parivahan", "New Driving License Application", 
             json.dumps({
                 "steps": ["Visit Sarathi website.", "Fill out details.", "Upload address/age proof, medical certificate.", "Pay 500 fees.", "Book slot."],
                 "required_documents": ["Address Proof", "Age Proof", "Learner's License", "Form 1 Medical"],
                 "fees": "INR 500",
                 "official_link": "https://sarathi.parivahan.gov.in"
             }), 2, "2023-11-01T10:00:00Z"),
             ("aadhaar_update_01", "uidai", "Aadhaar Address Update", 
             json.dumps({
                 "steps": ["Login to myAadhaar.", "Select Address Update.", "Upload PoA.", "Pay Rs 50."],
                 "required_documents": ["Proof of Address (PoA)"],
                 "fees": "INR 50",
                 "official_link": "https://uidai.gov.in"
             }), 1, "2023-01-01T10:00:00Z"),
             ("passport_new_01", "passport", "Fresh Passport Application", 
             json.dumps({
                 "steps": ["Register on Passport Seva.", "Fill details.", "Pay & Schedule.", "Visit PSK."],
                 "required_documents": ["Address Proof", "DOB Proof", "Non-ECR Proof"],
                 "fees": "INR 1500 (36 pages) or INR 2000 (60 pages)",
                 "official_link": "https://portal2.passportindia.gov.in/"
             }), 1, "2023-10-01T10:00:00Z"),
             ("voter_new_01", "voter_id", "New Voter ID Registration (Form 6)", 
             json.dumps({
                 "steps": ["Visit Voters' Services Portal.", "Select Form 6.", "Upload documents.", "Track status."],
                 "required_documents": ["Passport photograph", "Age Proof", "Address Proof"],
                 "fees": "Free",
                 "official_link": "https://voters.eci.gov.in/"
             }), 1, "2023-10-01T10:00:00Z")
        ]
        c.executemany("INSERT INTO knowledgebase (service_id, app_id, service_name, content, version, updated_at) VALUES (?, ?, ?, ?, ?, ?)", kbs)
        
        # Insert more apps if not exists
        c.execute("INSERT OR IGNORE INTO apps (app_id, app_name) VALUES ('voter_id', 'Voters Services Portal')")
        conn.commit()
    conn.close()

@app.on_event("startup")
def startup():
    init_db()

@app.get("/api/master")
def get_master_api_list():
    """Returns the list of apps and their specific KB API endpoints."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT app_id, app_name FROM apps")
    apps = [{"app_id": row[0], "app_name": row[1], "kb_api_url": f"http://localhost:8001/api/app/{row[0]}/kb"} for row in c.fetchall()]
    conn.close()
    return {"apps": apps}

@app.get("/api/app/{app_id}/kb")
def get_app_kb(app_id: str):
    """Returns the knowledgebase for a specific application context."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT service_id, service_name, content, version, updated_at FROM knowledgebase WHERE app_id=?", (app_id,))
    rows = c.fetchall()
    conn.close()
    
    if not rows:
        raise HTTPException(status_code=404, detail="No knowledgebase found for this app.")
        
    kb_entries = []
    for r in rows:
        kb_entries.append({
            "service_id": r[0],
            "service_name": r[1],
            "content": json.loads(r[2]),
            "version": r[3],
            "updated_at": r[4]
        })
    return {"app_id": app_id, "knowledgebase": kb_entries}

class UpdateKBRequest(BaseModel):
    service_id: str
    service_name: str
    content: dict

@app.post("/api/admin/app/{app_id}/kb")
def admin_update_kb(app_id: str, req: UpdateKBRequest):
    """Admin endpoint for the dummy portal to modify their own KB (Simulates real gov updates)."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    import datetime
    now = datetime.datetime.utcnow().isoformat() + "Z"
    
    # Check if exists
    c.execute("SELECT version FROM knowledgebase WHERE service_id=?", (req.service_id,))
    row = c.fetchone()
    if row:
        new_ver = row[0] + 1
        c.execute("UPDATE knowledgebase SET service_name=?, content=?, version=?, updated_at=? WHERE service_id=?", 
                  (req.service_name, json.dumps(req.content), new_ver, now, req.service_id))
    else:
        c.execute("INSERT INTO knowledgebase (service_id, app_id, service_name, content, version, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                  (req.service_id, app_id, req.service_name, json.dumps(req.content), 1, now))
                  
    conn.commit()
    conn.close()
    return {"message": "Knowledgebase updated successfully.", "version": new_ver if row else 1}

@app.get("/", response_class=HTMLResponse)
def get_admin_ui():
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Government Portal Admin</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            body { font-family: 'Inter', sans-serif; background-color: #f0fdf4; }
            .glass { background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); }
        </style>
    </head>
    <body class="p-8 text-gray-800">
        <div class="max-w-6xl mx-auto">
            <header class="mb-8 flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-green-800 tracking-tight">National e-Governance Admin</h1>
                    <p class="text-gray-600 mt-1">Manage Source-of-Truth Knowledge Base for all Portals</p>
                </div>
                <div class="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-semibold border border-green-200">
                    Master API: <span class="font-mono font-normal">/api/master</span>
                </div>
            </header>

            <div id="apps-container" class="grid grid-cols-1 md:grid-cols-2 gap-6"></div>
        </div>

        <script>
            async function fetchApps() {
                const res = await fetch('/api/master');
                const data = await res.json();
                
                for (const app of data.apps) {
                    const kbRes = await fetch(app.kb_api_url);
                    const kbData = await kbRes.json();
                    renderApp(app, kbData.knowledgebase);
                }
            }

            function renderApp(app, kbEntries) {
                const container = document.getElementById('apps-container');
                
                let kbHtml = '';
                kbEntries.forEach(kb => {
                    kbHtml += `
                        <div class="border border-gray-100 rounded-lg p-4 bg-gray-50 mb-4">
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="font-bold text-md text-gray-800">${kb.service_name}</h3>
                                <span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">v${kb.version}</span>
                            </div>
                            <textarea id="json-${kb.service_id}" class="w-full h-32 p-2 text-xs font-mono border rounded-md focus:outline-none focus:ring-1 focus:ring-green-500">${JSON.stringify(kb.content, null, 2)}</textarea>
                            <button onclick="updateKB('${app.app_id}', '${kb.service_id}', '${kb.service_name}')" class="mt-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2 px-4 rounded transition-colors">
                                Publish Update
                            </button>
                        </div>
                    `;
                });

                const appCard = `
                    <div class="glass rounded-xl shadow-sm p-6">
                        <div class="flex items-center gap-2 mb-4 border-b pb-4">
                            <div class="w-8 h-8 rounded-full bg-green-800 text-white flex items-center justify-center font-bold">${app.app_name.charAt(0)}</div>
                            <h2 class="text-xl font-bold text-gray-800">${app.app_name}</h2>
                        </div>
                        <div class="space-y-2">
                            ${kbHtml}
                        </div>
                    </div>
                `;
                container.innerHTML += appCard;
            }

            async function updateKB(appId, serviceId, serviceName) {
                const contentStr = document.getElementById(`json-${serviceId}`).value;
                try {
                    const contentJson = JSON.parse(contentStr);
                    const res = await fetch(`/api/admin/app/${appId}/kb`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            service_id: serviceId,
                            service_name: serviceName,
                            content: contentJson
                        })
                    });
                    const data = await res.json();
                    alert(data.message + " New version: v" + data.version);
                    location.reload();
                } catch (e) {
                    alert('Invalid JSON! Please check your formatting.');
                }
            }

            fetchApps();
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
