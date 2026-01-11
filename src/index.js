import { Router } from 'itty-router';

const router = Router();

// ==========================================
// 1. CONFIGURACIÓN DE PROVEEDORES
// ==========================================
const PROVIDERS = [
  { name: "TorrentsDB", url: "https://torrentsdb.com/stream" },
  { name: "Comet", url: "https://cometfortheweebs.midnightignite.me/eyJtYXhSZXN1bHRzUGVyUmVzb2x1dGlvbiI6MywibWF4U2l6ZSI6MCwiY2FjaGVkT25seSI6ZmFsc2UsInNvcnRDYWNoZWRVbmNhY2hlZFRvZ2V0aGVyIjpmYWxzZSwicmVtb3ZlVHJhc2giOnRydWUsInJlc3VsdEZvcm1hdCI6WyJhbGwiXSwiZGVicmlkU2VydmljZSI6InRvcnJlbnQiLCJkZWJyaWRBcGlLZXkiOiIiLCJkZWJyaWRTdHJlYW1Qcm94eVBhc3N3b3JkIjoiIiwibGFuZ3VhZ2VzIjp7ImV4Y2x1ZGUiOltdLCJwcmVmZXJyZWQiOltdfSwicmVzb2x1dGlvbnMiOnsicjcyMHAiOmZhbHNlLCJyNDgwcCI6ZmFsc2UsInIzNjBwIjpmYWxzZSwidW5rbm93biI6ZmFsc2V9LCJvcHRpb25zIjp7InJlbW92ZV9yYW5rc191bmRlciI6LTEwMDAwMDAwMDAwLCJhbGxvd19lbmdsaXNoX2luX2xhbmd1YWdlcyI6ZmFsc2UsInJlbW92ZV91bmtub3duX2xhbmd1YWdlcyI6ZmFsc2V9fQ==/stream" },
  { name: "ThePirateBay+", url: "https://thepiratebay-plus.strem.fun/stream" }
];

// Headers "Chrome 2026" (Blindados)
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin"
};

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8"
};

const json = (data) => new Response(JSON.stringify(data), { headers: responseHeaders });

// ==========================================
// 2. UTILS: FILTRO SANITARIO
// ==========================================
function isIntruder(streamTitle, requestType) {
  if (!streamTitle) return false;
  const title = streamTitle.toUpperCase();
  
  // Si buscamos PELÍCULA, eliminamos resultados de SERIES
  if (requestType === 'movie') {
    // Regex para detectar S01E01, Season 1, etc.
    const seriesPatterns = [/S\d\dE\d\d/, /SEASON \d/, /EPISODE \d/, /COMPLETE SERIES/, /S\d\d/];
    if (seriesPatterns.some(pattern => pattern.test(title))) return true;
  }

  // Opcional: Filtro de pornografía básico por si acaso se cuela algo
  if (title.includes("XXX") || title.includes("PORN")) return true;

  return false;
}

// ==========================================
// 3. RUTAS
// ==========================================

router.get('/manifest.json', () => {
  return json({
    id: "com.nuvio.ultimate.bridge",
    version: "4.5.0", // Bump version
    name: "Ultimate HTTP Bridge",
    description: "Bypass Cloudflare + Sanitized Streams",
    logo: "https://dl.strem.io/addon-logo.png",
    resources: [
      { name: "stream", types: ["movie", "series"], idPrefixes: ["tt"] },
      { name: "meta", types: ["movie", "series"], idPrefixes: ["tt"] }
    ],
    types: ["movie", "series"],
    catalogs: []
  });
});

router.get('/meta/:type/:id.json', ({ params }) => {
  return json({
    meta: { id: params.id.replace(".json", ""), type: params.type, name: "Meta" }
  });
});

router.get('/stream/:type/:id.json', async (request, env) => {
  let { type, id } = request.params;
  id = decodeURIComponent(id).replace(".json", "");

  if (!env.STREMIO_SERVER_URL) {
    return json({ streams: [{ name: "⚠️ ERROR", title: "Falta STREMIO_SERVER_URL", url: "#" }] });
  }
  const serverUrl = env.STREMIO_SERVER_URL.replace(/\/$/, "");

  let allStreams = [];
  let uniqueHashes = new Set(); // Para evitar duplicados

  // BUSCAMOS EN TODOS LOS PROVEEDORES
  // (Ahora no paramos en el primero, acumulamos para tener mejores opciones)
  for (const provider of PROVIDERS) {
    try {
      const response = await fetch(`${provider.url}/${type}/${id}.json`, {
        headers: BROWSER_HEADERS,
        cf: { cacheTtl: 120 }
      });

      if (!response.ok) continue;
      
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) continue;

      const data = await response.json();

      if (data.streams && data.streams.length > 0) {
        // PROCESAMOS Y FILTRAMOS CADA STREAM
        data.streams.forEach(stream => {
          // 1. Validación básica
          if (!stream.infoHash) return;
          
          // 2. Deduplicación (Si ya tenemos este archivo, lo saltamos)
          if (uniqueHashes.has(stream.infoHash)) return;

          // 3. FILTRO SANITARIO (Aquí matamos al Grinch)
          const fullTitle = stream.title || stream.name || "";
          if (isIntruder(fullTitle, type)) return; // Si es un intruso, adiós.

          // 4. Transformación a HTTP
          const fileIdx = stream.fileIdx !== undefined ? stream.fileIdx : 0;
          const directUrl = `${serverUrl}/${stream.infoHash}/${fileIdx}`;
          
          // Limpieza visual del título
          const titleParts = fullTitle.split("\n");
          const cleanTitle = titleParts[0]; 
          const details = titleParts[1] || `S:${stream.seeders || '?'} • ${provider.name}`;

          uniqueHashes.add(stream.infoHash);
          
          allStreams.push({
            name: `⚡ ${provider.name}`,
            title: `${cleanTitle}\n${details}`,
            url: directUrl,
            behaviorHints: {
              notWebReady: false, 
              bingeGroup: stream.behaviorHints?.bingeGroup,
              filename: stream.behaviorHints?.filename
            }
          });
        });
      }
    } catch (e) {
      // Ignoramos errores silenciosamente para seguir buscando
    }
    
    // Si ya tenemos suficientes resultados (ej. 15), paramos para no tardar mucho
    if (allStreams.length >= 15) break; 
  }

  if (allStreams.length === 0) {
    return json({ streams: [{ name: "⚠️ VACÍO", title: "No se encontraron resultados válidos", url: "#" }] });
  }

  // Ordenamos por Seeders (si es posible extraerlo) o mantenemos orden de llegada
  return json({ streams: allStreams });
});

router.options('*', () => new Response(null, { headers: responseHeaders }));
router.all('*', () => new Response('Not Found', { status: 404, headers: responseHeaders }));

export default { fetch: router.handle };