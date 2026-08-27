from pydantic import BaseModel
from typing import List, Optional

class ServiceEntry(BaseModel):
    service_id: str
    portal: str
    service_name: str
    steps: List[str]
    required_documents: List[str]
    fees: str
    official_link: str
    effective_date: str
    last_verified_date: str
    source_ref: str

class DraftChange(BaseModel):
    field: str
    old_value: str
    new_value: str
    needs_review: bool

class DraftUpdate(BaseModel):
    id: str
    service_id: str
    service_name: str
    portal: str
    changes: List[DraftChange]
    source_snapshot: str
    timestamp: str
