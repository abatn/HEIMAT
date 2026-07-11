FROM python:3.11-slim

WORKDIR /app

# Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Source code
COPY . .

# Expose port
EXPOSE 8000

# Start command
CMD ["uvicorn", "api.ml_service:app", "--host", "0.0.0.0", "--port", "8000"]
