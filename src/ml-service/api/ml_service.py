from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
import joblib
import os
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="HEIMAT ML Service", version="1.0.0")

MODELS_DIR = Path(os.getenv("MODELS_DIR", "/app/models"))
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

delay_model = None
budget_vectorizer = None
budget_classifier = None

def load_models():
    global delay_model, budget_vectorizer, budget_classifier
    
    delay_path = MODELS_DIR / "delay_predictor_v1.pkl"
    if delay_path.exists():
        try:
            delay_model = joblib.load(delay_path)
            logger.info(f"Loaded delay model from {delay_path}")
        except Exception as e:
            logger.warning(f"Failed to load delay model: {e}")
    
    vec_path = MODELS_DIR / "budget_vectorizer_v1.pkl"
    clf_path = MODELS_DIR / "budget_classifier_v1.pkl"
    if vec_path.exists() and clf_path.exists():
        try:
            budget_vectorizer = joblib.load(vec_path)
            budget_classifier = joblib.load(clf_path)
            logger.info(f"Loaded budget classifier from {vec_path}")
        except Exception as e:
            logger.warning(f"Failed to load budget classifier: {e}")

@app.on_event("startup")
async def startup():
    load_models()

# ---------------------------------------------------------------------------
# Request/Response Models
# ---------------------------------------------------------------------------

class PredictionResponse(BaseModel):
    prediction: float
    confidence: float
    model: str

class DelayPredictionRequest(BaseModel):
    line: str
    hour: int
    day_of_week: int
    weather: str = "clear"
    temperature: float = 15.0
    is_holiday: bool = False

class BudgetCategoryRequest(BaseModel):
    description: str
    amount: float

class BudgetCategoryResponse(BaseModel):
    category: str
    confidence: float

class TrainDelayRequest(BaseModel):
    X: list[list[float]]
    y: list[float]

class TrainBudgetRequest(BaseModel):
    descriptions: list[str]
    categories: list[str]

# ---------------------------------------------------------------------------
# Delay Predictor
# ---------------------------------------------------------------------------

# Statistical features: hour-based delay patterns (German public transport)
HOUR_DELAY_BASELINE = {
    0: 3, 1: 2, 2: 2, 3: 2, 4: 3, 5: 4,
    6: 5, 7: 12, 8: 14, 9: 10, 10: 6, 11: 5,
    12: 5, 13: 5, 14: 6, 15: 8, 16: 12, 17: 14,
    18: 10, 19: 7, 20: 5, 21: 4, 22: 3, 23: 3,
}

DAY_MULTIPLIER = {
    0: 0.6,  # Sunday
    1: 1.2,  # Monday
    2: 1.0,  # Tuesday
    3: 1.0,  # Wednesday
    4: 1.1,  # Thursday
    5: 1.3,  # Friday
    6: 0.7,  # Saturday
}

WEATHER_MULTIPLIER = {
    "clear": 1.0,
    "cloudy": 1.05,
    "rain": 1.15,
    "heavy_rain": 1.3,
    "snow": 1.4,
    "fog": 1.2,
    "ice": 1.5,
}

@app.post("/predict/delay", response_model=PredictionResponse)
async def predict_delay(request: DelayPredictionRequest):
    if delay_model is not None:
        try:
            features = [[
                request.hour,
                request.day_of_week,
                1.0 if request.weather == "clear" else 0.0,
                1.0 if request.weather == "rain" else 0.0,
                1.0 if request.weather == "snow" else 0.0,
                request.temperature,
                1.0 if request.is_holiday else 0.0,
            ]]
            prediction = float(delay_model.predict(features)[0])
            confidence = 0.85
            return PredictionResponse(
                prediction=max(0, prediction),
                confidence=confidence,
                model="delay_predictor_v1_trained"
            )
        except Exception as e:
            logger.warning(f"Trained model prediction failed, using statistical: {e}")
    
    # Statistical fallback: based on German transit delay patterns
    base = HOUR_DELAY_BASELINE.get(request.hour, 5)
    day_mult = DAY_MULTIPLIER.get(request.day_of_week, 1.0)
    weather_mult = WEATHER_MULTIPLIER.get(request.weather, 1.0)
    
    prediction = base * day_mult * weather_mult
    
    if request.is_holiday:
        prediction *= 0.5
    
    confidence = 0.65
    
    return PredictionResponse(
        prediction=round(prediction, 1),
        confidence=confidence,
        model="delay_predictor_v1_statistical"
    )

@app.post("/train/delay")
async def train_delay_model(request: TrainDelayRequest):
    global delay_model
    
    if len(request.X) < 10:
        raise HTTPException(status_code=400, detail="Need at least 10 samples")
    
    try:
        import lightgbm as lgb
        
        X = np.array(request.X)
        y = np.array(request.y)
        
        train_data = lgb.Dataset(X, label=y)
        params = {
            'objective': 'regression',
            'metric': 'rmse',
            'boosting_type': 'gbdt',
            'num_leaves': 31,
            'learning_rate': 0.05,
            'feature_fraction': 0.9,
            'verbose': -1,
        }
        
        model = lgb.train(params, train_data, num_boost_round=100)
        
        model_path = MODELS_DIR / "delay_predictor_v1.pkl"
        joblib.dump(model, model_path)
        delay_model = model
        
        logger.info(f"Trained delay model with {len(request.X)} samples, saved to {model_path}")
        return {"status": "ok", "samples": len(request.X), "model_path": str(model_path)}
    except ImportError:
        raise HTTPException(status_code=500, detail="lightgbm not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# Budget Classifier
# ---------------------------------------------------------------------------

BUDGET_KEYWORDS = {
    "Essen & Trinken": [
        "restaurant", "essen", "café", "bäcker", "imbiss", "lieferdienst",
        "pizza", "sushi", "döner", "supermarkt", "lebensmittel", "rewe", "aldi",
        "lidl", "edeka", "netto", "penny",
    ],
    "Mobilität": [
        "bahn", "bus", "u-bahn", "s-bahn", "tanken", "auto", "benzin",
        "diesel", "mietwagen", "taxi", "uber", "fahrrad", "ebike",
        "db", "bvg", "mvv", "ticket", "fahrkarte",
    ],
    "Gesundheit": [
        "arzt", "apotheke", "krankenhaus", "praxis", "zahnarzt",
        "augenarzt", "medikament", "rezept", "therapeut", "psycho",
    ],
    "Fixkosten": [
        "miete", "strom", "internet", "telefon", "versicherung",
        "GEZ", "rundfunkbeitrag", "haushalt", "wohnung",
    ],
    "Einkäufe": [
        "kleidung", "schuhe", "geschäft", "mode", "h&m", "zara",
        "container", "möbel", "ikea", "elektronik", "amazon",
    ],
    "Freizeit": [
        "kino", "theater", "konzert", "sport", "fitness",
        "studio", "hobby", "spiel", "urlaub", "reise",
    ],
    "Bildung": [
        "buch", "kurs", "seminar", "uni", "hochschule",
        "schule", "lernen", "fernstudium",
    ],
}

def classify_budget_statistical(description: str, amount: float) -> tuple[str, float]:
    desc_lower = description.lower()
    best_category = "Sonstiges"
    best_score = 0.0
    
    for category, keywords in BUDGET_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in desc_lower)
        if score > best_score:
            best_score = score
            best_category = category
    
    if best_score == 0:
        # Amount-based fallback
        if amount > 500:
            best_category = "Fixkosten"
        elif amount > 100:
            best_category = "Einkäufe"
        else:
            best_category = "Sonstiges"
        confidence = 0.4
    else:
        confidence = min(0.5 + best_score * 0.15, 0.9)
    
    return best_category, confidence

@app.post("/predict/budget-category", response_model=BudgetCategoryResponse)
async def predict_budget_category(request: BudgetCategoryRequest):
    if budget_vectorizer is not None and budget_classifier is not None:
        try:
            X = budget_vectorizer.transform([request.description])
            category = budget_classifier.predict(X)[0]
            confidence = float(max(budget_classifier.predict_proba(X)[0]))
            return BudgetCategoryResponse(category=category, confidence=confidence)
        except Exception as e:
            logger.warning(f"Trained classifier failed, using statistical: {e}")
    
    category, confidence = classify_budget_statistical(request.description, request.amount)
    return BudgetCategoryResponse(category=category, confidence=confidence)

@app.post("/train/budget")
async def train_budget_classifier(request: TrainBudgetRequest):
    global budget_vectorizer, budget_classifier
    
    if len(request.descriptions) < 20:
        raise HTTPException(status_code=400, detail="Need at least 20 samples")
    
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.naive_bayes import MultinomialNB
        from sklearn.model_selection import cross_val_score
        
        vectorizer = TfidfVectorizer(max_features=1000, ngram_range=(1, 2))
        X = vectorizer.fit_transform(request.descriptions)
        y = np.array(request.categories)
        
        clf = MultinomialNB()
        scores = cross_val_score(clf, X, y, cv=min(5, len(set(y))), scoring='accuracy')
        
        clf.fit(X, y)
        
        vec_path = MODELS_DIR / "budget_vectorizer_v1.pkl"
        clf_path = MODELS_DIR / "budget_classifier_v1.pkl"
        joblib.dump(vectorizer, vec_path)
        joblib.dump(clf, clf_path)
        
        budget_vectorizer = vectorizer
        budget_classifier = clf
        
        accuracy = float(scores.mean())
        logger.info(f"Trained budget classifier: accuracy={accuracy:.2%}")
        return {
            "status": "ok",
            "samples": len(request.descriptions),
            "accuracy": accuracy,
            "model_path": str(clf_path),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "ml-service",
        "models_loaded": {
            "delay": delay_model is not None,
            "budget": budget_classifier is not None,
        },
    }

@app.get("/models")
async def list_models():
    models = []
    if delay_model is not None:
        models.append({"name": "delay_predictor_v1", "type": "regression", "status": "active"})
    else:
        models.append({"name": "delay_predictor_v1", "type": "regression", "status": "statistical_fallback"})
    
    if budget_classifier is not None:
        models.append({"name": "budget_classifier_v1", "type": "classification", "status": "active"})
    else:
        models.append({"name": "budget_classifier_v1", "type": "classification", "status": "keyword_fallback"})
    
    return {"models": models}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
