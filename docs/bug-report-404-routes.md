# 🐛 Bug Report: API-Endpoint-Mapping (404 Routes)

> **Erstellt:** 2026-08-10 | **Status:** Analyse abgeschlossen  
> **Betrifft:** 4 Services geben 404 bei Root-Endpoints zurück

---

## 📋 Zusammenfassung

Bei einem Production-Check gegen `https://heimat-backend.onrender.com` gaben **4 von12 Services** einen **404 "Route not found"** zurück. Analyse zeigt: **Die Services funktionieren korrekt**, aber die **API-Endpoints haben Sub-Pfade** statt Root-Endpoints.

---

## 🔍 Testergebnisse (2026-08-10, 13:44 UTC)

### ✅ Funktionierende Endpoints (korrekte Pfade)

| Service | Endpoint | Status | Daten |
|---------|----------|--------|-------|
| Health | `/health` | ✅ 200 | `status: ok` |
| Wetter | `/api/weather/forecast` | ✅ 200 | 29.6°C Berlin |
| Jobs | `/api/jobs/search` | ✅ 200 | 20 Listings |
| Ärzte | `/api/health/doctors` | ✅ 200 | 33 Ärzte |
| ÖPNV | `/api/mobility/stops` | ✅ 200 | 30 Haltestellen |

### ❌ Falsch getestete Endpoints (404)

| Service | Getesteter Pfad | Status | Korrekter Pfad |
|---------|-----------------|--------|----------------|
| Luftqualität | `/api/air-quality` | ❌ 404 | `/api/air-quality/current` |
| Abfall | `/api/waste` | ❌ 404 | `/api/waste/calendar` |
| E-Laden | `/api/ev-charging` | ❌ 404 | `/api/ev-charging/stations` |
| Parken | `/api/parking` | ❌ 404 | `/api/parking/spots` |

---

## ✅ Verifizierung mit korrekten Endpoints

| Service | Korrekter Endpoint | Status | Daten |
|---------|-------------------|--------|-------|
| **Luftqualität** | `/api/air-quality/current?lat=52.52&lng=13.41` | ✅ 200 | AQI 45 (Mäßig), PM2.5: 9.7 |
| **Abfall** | `/api/waste/calendar?lat=49.45&lng=11.08` | ✅ 200 | Nürnberg, AbfallNavi |
| **E-Laden** | `/api/ev-charging/stations?lat=52.52&lng=13.41&radius_km=5` | ✅ 200 | 17 Ladestationen |
| **Parken** | `/api/parking/spots?lat=52.52&lng=13.41&radius_km=5` | ✅ 200 | 9 Parkplätze |

---

## 🔧 Ursache

Die Routes sind **korrekt implementiert**, haben aber **keine Root-Endpoints**:

```typescript
// airQuality.ts
airQualityRouter.get('/current', ...);  // ✅ /api/air-quality/current
airQualityRouter.get('/forecast', ...); // ✅ /api/air-quality/forecast
airQualityRouter.get('/status', ...);   // ✅ /api/air-quality/status
// KEIN airQualityRouter.get('/', ...);  // ❌ /api/air-quality gibt 404

// waste.ts
wasteRouter.get('/calendar', ...);      // ✅ /api/waste/calendar
wasteRouter.get('/status', ...);        // ✅ /api/waste/status
// KEIN wasteRouter.get('/', ...);       // ❌ /api/waste gibt 404

// evCharging.ts
evChargingRouter.get('/stations', ...); // ✅ /api/ev-charging/stations
// KEIN evChargingRouter.get('/', ...);  // ❌ /api/ev-charging gibt 404

// parking.ts
parkingRouter.get('/spots', ...);       // ✅ /api/parking/spots
// KEIN parkingRouter.get('/', ...);     // ❌ /api/parking gibt 404
```

---

## 📊 Vollständige API-Referenz

### Luftqualität (`/api/air-quality`)
| Endpoint | Methode | Parameter | Beschreibung |
|----------|---------|-----------|--------------|
| `/current` | GET | `lat`, `lng` | Aktuelle Luftqualität |
| `/forecast` | GET | `lat`, `lng` | 24h-Vorhersage |
| `/status` | GET | — | Service-Status |

### Abfall (`/api/waste`)
| Endpoint | Methode | Parameter | Beschreibung |
|----------|---------|-----------|--------------|
| `/calendar` | GET | `lat`, `lng`, `weeks?`, `street?`, `houseNr?`, `scheduleId?` | Abfuhrtermine |
| `/status` | GET | — | Service-Status |

### E-Laden (`/api/ev-charging`)
| Endpoint | Methode | Parameter | Beschreibung |
|----------|---------|-----------|--------------|
| `/stations` | GET | `lat`, `lng`, `radius_km?` | Ladestationen |

### Parken (`/api/parking`)
| Endpoint | Methode | Parameter | Beschreibung |
|----------|---------|-----------|--------------|
| `/spots` | GET | `lat`, `lng`, `radius_km?` | Parkplätze |

---

## 💡 Empfehlung

**Option A: Root-Endpoints hinzufügen (empfohlen)**
```typescript
// airQuality.ts — Root-Endpoint für Kompatibilität
airQualityRouter.get('/', asyncHandler(async (req, res) => {
  // Redirect zu /current oder Documentation
  res.json({
    status: 'ok',
    service: 'air-quality',
    endpoints: ['/current', '/forecast', '/status'],
    usage: 'GET /api/air-quality/current?lat=52.52&lng=13.41',
  });
}));
```

**Option B: Dokumentation aktualisieren**
- README.md mit korrekten Endpoints aktualisieren
- Swagger/OpenAPI korrekt konfigurieren
- Flutter-API-Client mit richtigen Pfaden

---

## 🎯 Fazit

**Kein Bug im eigentlichen Sinne** — die Services funktionieren einwandfrei. Das Problem ist eine **Dokumentationslücke**: Die API-Endpunkte haben Sub-Pfade (`/current`, `/calendar`, `/stations`, `/spots`), aber die Dokumentation und das Testing haben nur die Root-Pfade getestet.

**Empfehlung:** Option A (Root-Endpoints hinzufügen) für bessere API-Kompatibilität und Developer Experience.
