# Start Dummy Gov Webapp on port 8001
Start-Process powershell -ArgumentList "-NoExit -Command `"cd dummy-gov-webapp; .\venv\Scripts\python.exe -m uvicorn main:app --port 8001 --reload`""

# Start Backend using the venv explicitly
Start-Process powershell -ArgumentList "-NoExit -Command `"cd ai-gov-navigator\backend; .\venv\Scripts\python.exe -m uvicorn main:app --reload`""

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit -Command `"cd ai-gov-navigator\frontend; npm run dev`""

Write-Host "Starting AI Government Service Navigator (Phase 5: Crawler Edition)..."
Write-Host "Dummy Gov Master API is available at http://localhost:8001/api/master"
Write-Host "Backend API is available at http://localhost:8000"
Write-Host "Frontend is available at http://localhost:5173"
