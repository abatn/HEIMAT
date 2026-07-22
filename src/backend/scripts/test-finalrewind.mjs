// Probe finalrewind.org EFA mirror subdomains for reachability from the backend host.
// Background: Render Free-Tier blocks most direct Verkehrsverbund EFA domains (ENOTFOUND),
// but finalrewind.org is reachable and operates an EFA mirror under subdomains of
// finalrewind.org. This script tests candidate subdomains against the EFA STOPFINDER endpoint.
//
// Endpoint tested per candidate:
//   https://{sub}.finalrewind.org/XML_STOPFINDER_REQUEST?type_sf=stop&name_sf=Hauptbahnhof&limit=1
//
// Run: export PATH="/tmp/node-v18.20.4-linux-x64/bin:$PATH" && node scripts/test-finalrewind.mjs

const candidates = [
  "vrrf", "vvvf", "vgn", "vvmv", "vkvvf", "vbvf", "vlsf", "vmgf",
  "vnbf", "vogf", "vrnf", "vmvf", "vvof", "vwbf", "vwlf", "vzmf",
  "vavvf", "vinsf", "vogvf", "vrsf", "vmsf", "vvvvf", "vvgn", "vvvv",
  "vbnf", "vgsf", "vbbf", "vmvf", "vrnf", "vhrf", "vogf", "vogvf",
];

const urlFor = (sub) =>
  `https://${sub}.finalrewind.org/XML_STOPFINDER_REQUEST?type_sf=stop&name_sf=Hauptbahnhof&limit=1`;

async function probe(sub) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(urlFor(sub), {
      signal: ctrl.signal,
      redirect: "manual",
      headers: { "User-Agent": "HEIMAT-backend-probe/1.0" },
    });
    clearTimeout(t);
    return res.status;
  } catch (e) {
    clearTimeout(t);
    return e.name === "AbortError" ? "TIMEOUT" : (e.cause?.code || e.message || "ERR");
  }
}

const results = [];
for (const sub of candidates) {
  const status = await probe(sub);
  results.push({ sub, status });
  console.log(`${String(status).padEnd(8)} ${sub}.finalrewind.org`);
}

const ok = results.filter((r) => r.status === 200);
console.log(`\n=== ${ok.length}/${candidates.length} candidate subdomains returned HTTP 200 ===`);
for (const r of ok) console.log(`200  ${r.sub}.finalrewind.org`);

if (ok.length === 0) {
  console.log("\nNOTE: No per-verbund mirror subdomain resolved. The only reachable");
  console.log("finalrewind EFA mirror is vrrf.finalrewind.org (VRR). For other verbunds,");
  console.log("use the unified proxy dbf.finalrewind.org (e.g. ?efa=VGN). See finalrewind-mirrors.md");
}
