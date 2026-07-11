from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
import joblib
import os

app = FastAPI(title="HEIMAT ML Service", version="1.0.0")

class PredictionRequest(BaseModel):
    features: list[float]

class PredictionResponse(BaseModel):
    prediction: float
    confidence: float
    model: str

class DelayPredictionRequest(BaseModel):
    line: str
    hour: int
    day_of_week: int
    weather: str = "clear"

class BudgetCategoryRequest(BaseModel):
    description: str
    amount: float

class BudgetCategoryResponse(BaseModel):
    category: str
    confidence: float

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ml-service"}

@app.post("/predict/delay", response_model=PredictionResponse)
async def predict_delay(request: DelayPredictionRequest):
    # Mock: In Produktion würde hier ein trainiertes Modell geladen werden
    # Für jetzt geben wir eine simulierte Vorhersage zurück
    
    # Einfache Logik basierend auf Hour und Day
    base_delay = 5  # Minuten
    if request.hour >= 7 and request.hour <= 9:
        base_delay += 10  # Rush Hour
    if request.hour >= 16 and request.hour <= 18:
        base_delay += 8  # Abend-Rush
    if request.day_of_week >= 5:  # Wochenende
        base_delay -= 3
    
    return PredictionResponse(
        prediction=float(base_delay),
        confidence=0.75,
        model="delay_predictor_v1"
    )

@app.post("/predict/budget-category", response_model=BudgetCategoryResponse)
async def predict_budget_category(request: BudgetCategoryRequest):
    # Mock: Einfache Kategorisierung basierend auf Stichwörtern
    description_lower = request.description.lower()
    
    if any(word in description_lower for word in ["restaurant", "essen", "café", "bäcker"]):
        category = "Essen & Trinken"
    elif any(word in description_lower for word in ["bahn", "bus", "tanken", "auto"]):
        category = "Mobilität"
    elif any(word in description_lower for word in ["arzt", "apotheke", "krankenhaus"]):
        category = "Gesundheit"
    elif any(word in description_lower for word in ["miete", "strom", "internet"]):
        category = "Fixkosten"
    elif any(word in description_lower for word in ["kleidung", "schuhe", "geschäft"]):
        category = "Einkäufe"
    else:
        category = "Sonstiges"
    
    return BudgetCategoryResponse(
        category=category,
        confidence=0.80
    )

@app.get("/models")
async def list_models():
    return {
        "models": [
            {"name": "delay_predictor_v1", "type": "regression", "status": "active"},
            {"name": "budget_classifier_v1", "type": "classification", "status": "active"},
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
