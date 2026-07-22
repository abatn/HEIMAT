# finalrewind.org EFA-Mirror (Render-kompatibel)

**Stand:** 2026-07-17
**Kontext:** Render Free-Tier blockiert die meisten direkten Verkehrsverbund-EFA-Domains
(ENOTFOUND). `finalrewind.org` ist von Render aus erreichbar und betreibt EFA-Mirrors.

## Ergebnis der Subdomain-Tests

Es existiert **kein generisches `*.finalrewind.org`-Subdomain-Schema** für einzelne
Verkehrsverbünde. Von allen getesteten Kandidaten (siehe `src/backend/scripts/test-finalrewind.mjs`)
liefert **nur eine einzige Subdomain HTTP 200**:

| Subdomain                 | Verbund                                  | HTTP-Status | EFA-XML |
|---------------------------|-------------------------------------------|-------------|---------|
| `vrrf.finalrewind.org`    | VRR – Verkehrsverbund Rhein-Ruhr          | 200         | ja      |

Alle weiteren Kandidaten (`vvvf`, `vgn`, `vvmv`, `vkvvf`, `vbvf`, `vlsf`, `vmgf`,
`vnbf`, `vogf`, `vrnf`, `vmvf`, `vvof`, `vwbf`, `vwlf`, `vzmf`, `vavvf`, `vinsf`,
`vogvf`, `vrsf`, `vmsf`, `vvvvf`, `vvgn`, `vvvv`, `vbnf`, `vgsf`, `vbbf`, `vhrf`,
sowie Varianten wie `{shortname}f` / `{shortname}` für VVS, VGN, VRN, VVO, MVV, KVV,
DING, BSVG, NVBW, VAG, VMV, LinzAG, VRR2, VRR3, AVV, BEG, bwegt, NWL, RVV, VMT, VOS,
VBN, VHB, VBL, SVV, VOR) liefern **ENOTFOUND** (keine DNS-Auflösung).

## Empfohlene Lösung für alle Verbünde: dbf.finalrewind.org

Neben dem VRR-Subdomain-Mirror betreibt finalrewind unter `dbf.finalrewind.org`
einen **vereinheitlichten Proxy**, der praktisch alle EFA-Backends über den
Query-Parameter `efa=<SHORTNAME>` anspricht (selbe Apex-Domain → von Render erreichbar):

```
https://dbf.finalrewind.org/<Haltestelle>.json?efa=<SHORTNAME>&limit=1
```

Getestete Shortnames (aus `Travel::Routing::DE::EFA::get_efa_urls`, v2.24):

| Shortname | Verbund                                      | Proxy-Status |
|-----------|----------------------------------------------|--------------|
| VRR       | Verkehrsverbund Rhein-Ruhr                   | 200          |
| VGN       | Verkehrsverbund Großraum Nürnberg            | 200          |
| VRN       | Verkehrsverbund Rhein-Neckar                 | 200          |
| VVO       | Verkehrsverbund Oberelbe (Dresden)           | 200          |
| KVV       | Karlsruher Verkehrsverbund                   | 200          |
| DING      | Donau-Iller Nahverkehrsverbund               | 200          |
| BSVG      | Braunschweiger Verkehrs-GmbH                 | 200          |
| NVBW      | Nahverkehrsgesellschaft Baden-Württemberg    | 200          |
| LinzAG    | Linz AG (AT)                                 | 200          |
| VVS       | Verkehrs- und Tarifverbund Stuttgart         | 500*         |
| MVV       | Münchener Verkehrs- und Tarifverbund         | 500*         |
| VAG       | Freiburger Verkehrs AG                       | 500*         |
| VMV       | Verkehrsgesellschaft Mecklenburg-Vorpommern  | 500*         |

\* 500 = finalrewind erreicht das jeweilige Verbund-Backend aktuell nicht (Backend-Offline
oder geänderte EFA-URL); nicht Render-spezifisch. `vrrf.finalrewind.org` bleibt der
stabilste, direkt erreichbare Mirror.

## Fazit

- **Funktionsfähiger finalrewind EFA-Mirror (eigene Subdomain):** nur `vrrf` (VRR).
- **Für andere Verbünde:** `dbf.finalrewind.org?efa=<SHORTNAME>` verwenden (gleiche
  erreichbare Apex-Domain, kein eigener Subdomain-Mirror vorhanden).

## Quellen

- EFA-Service-Liste: https://github.com/derf/Travel-Routing-DE-VRR (v2.24, `get_efa_urls`)
- VRR-Mirror: https://vrrf.finalrewind.org
- Unified Proxy: https://dbf.finalrewind.org
- Test-Skript: `src/backend/scripts/test-finalrewind.mjs`
