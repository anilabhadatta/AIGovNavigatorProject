FROM python:3.10-slim

WORKDIR /app

# No requirements.txt needed, just install direct dependencies
RUN pip install --no-cache-dir fastapi uvicorn pydantic

COPY . .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
