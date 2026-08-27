import os
import json
from google import genai
from google.genai import types
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(override=True)

# Initialize Gemini Client
# It will automatically pick up GEMINI_API_KEY from environment variables
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key) if api_key else None

def detect_language(query: str) -> str:
    if not client:
        return 'English'
        
    prompt = f"""
    Identify the language of the following text. 
    Return ONLY the English name of the language (e.g., 'Hindi', 'English', 'Tamil', 'Bengali'). 
    Do not return any other text, punctuation, or explanation.
    
    Text: "{query}"
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.0
            )
        )
        lang = response.text.strip()
        if len(lang) > 20 or not lang:
            return 'English'
        return lang
    except Exception:
        return 'English'

class IntentExtraction(BaseModel):
    service_id: str
    confidence: float

def extract_intent(query: str, available_services: list[dict]) -> IntentExtraction:
    if not client:
        raise Exception("GEMINI_API_KEY is not set.")
    
    # available_services should be a list of dicts with 'service_id' and 'service_name'
    services_str = json.dumps(available_services, indent=2)
    
    prompt = f"""
    You are an intent extraction router for an Indian Government Services AI.
    Given the user query, you must map it to one of the following available services.
    
    Available Services:
    {services_str}
    
    User Query: "{query}"
    
    Return a JSON object containing two fields:
    - "service_id": The ID of the best matching service, or "unknown" if none match.
    - "confidence": A float between 0.0 and 1.0 representing how confident you are.
    """
    
    response = client.models.generate_content(
        model='gemini-3.1-flash-lite',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=IntentExtraction,
            temperature=0.0
        ),
    )
    
    result = json.loads(response.text)
    return IntentExtraction(**result)

class ExtractedChange(BaseModel):
    field: str
    old_value: str
    new_value: str
    needs_review: bool

class DiffExtraction(BaseModel):
    changes: list[ExtractedChange]

def extract_draft_update(diff_text: str, service_data: dict) -> list[dict]:
    if not client:
        raise Exception("GEMINI_API_KEY is not set.")
        
    prompt = f"""
    You are an AI assistant for a Government Portal Admin Panel.
    A change was detected in a source document for a service.
    
    Current Service Data (JSON):
    {json.dumps(service_data, indent=2)}
    
    Detected Text Diff:
    {diff_text}
    
    Analyze the diff against the Current Service Data.
    Extract the changes and map them to the corresponding fields (e.g., 'fees', 'required_documents', 'steps', etc.).
    If you are not 100% confident in the exact new value extraction (e.g. text is ambiguous), set "needs_review" to true.
    
    Return a JSON object containing a "changes" array.
    """
    
    response = client.models.generate_content(
        model='gemini-3.1-flash-lite',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=DiffExtraction,
            temperature=0.0
        ),
    )
    
    result = json.loads(response.text)
    return result.get("changes", [])

def generate_grounded_answer(query: str, service_data: dict, language: str) -> str:
    if not client:
        raise Exception("GEMINI_API_KEY is not set.")
        
    prompt = f"""
    You are a helpful AI Government Service Navigator.
    You must answer the user's query STRICTLY using ONLY the information provided below.
    DO NOT hallucinate. DO NOT add any extra steps, documents, or fees that are not present in the provided information.
    If the provided information is insufficient to answer the query, state that you don't have verified information for that specific detail.
    
    Reply in the following language: {language}
    
    Information Provided:
    Service Name: {service_data.get('service_name')}
    Portal: {service_data.get('portal')}
    Steps: {json.dumps(service_data.get('steps'))}
    Required Documents: {json.dumps(service_data.get('required_documents'))}
    Fees: {service_data.get('fees')}
    
    User Query: "{query}"
    """
    
    response = client.models.generate_content(
        model='gemini-3.1-flash-lite',
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.1
        )
    )
    
    return response.text
