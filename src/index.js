import { Router } from 'itty-router';

const router = Router();

// ==========================================
// 1. TUS PROVEEDORES PERSONALIZADOS
// ==========================================
const PROVIDERS = [
  {
    name: "TorrentsDB",
    url: "https://torrentsdb.com/eyJxdWFsaXR5ZmlsdGVyIjpbIjcyMHAiLCI0ODBwIiwib3RoZXIiLCJzY3IiLCJjYW0iLCJ1bmtub3duIl0sImxpbWl0IjoiMTAifQ==/stream"
  },
  {
    name: "Comet", 
    url: "https://comet.stremio.ru/eyJtYXhSZXN1bHRzUGVyUmVzb2x1dGlvbiI6MTAsIm1heFNpemUiOjAsImNhY2hlZE9ubHkiOmZhbHNlLCJzb3J0Q2FjaGVkVW5jYWNoZWRUb2dldGhlciI6ZmFsc2UsInJlbW92ZVRyYXNoIjp0cnVlLCJyZXN1bHRGb3JtYXQiOlsidGl0bGUiLCJ2aWRlb19pbmZvIiwicXVhbGl0eV9pbmZvIiwicmVsZWFzZV9ncm91cCIsInNlZWRlcnMiLCJzaXplIiwidHJhY2tlciIsImxhbmd1YWdlcyJdLCJkZWJyaWRTZXJ2aWNlIjoidG9ycmVudCIsImRlYnJpZEFwaUtleSI6IiIsImRlYnJpZFN0cmVhbVByb3h5UGFzc3dvcmQiOiIiLCJsYW5ndWFnZXMiOnsiZXhjbHVkZSI6W10sInByZWZlcnJlZCI6W119LCJyZXNvbHV0aW9ucyI6eyJyNzIwcCI6ZmFsc2UsInI0ODBwIjpmYWxzZSwicjM2MHAiOmZhbHNlLCJ1bmtub3duIjpmYWxzZX0sIm9wdGlvbnMiOnsicmVtb3ZlX3JhbmtzX3VuZGVyIjotMTAwMDAwMDAwMDAsImFsbG93X2VuZ2xpc2hfaW5fbGFuZ3VhZ2VzIjpmYWxzZSwicmVtb3ZlX3Vua25vd25fbGFuZ3VhZ2VzIjpmYWxzZX19/stream"
  },
  {
    name: "MediaFusion", 
    url: "https://mediafusionfortheweebs.midnightignite.me/D-bnynm9kKEjRv75F-la-LIHO9o6ibRtdI0u_D0Y9mhwIPJxqbp_OAH30QqxsFoIQ_qF-_g47cflaiSLgV894b9P4M0t248YyqcXaBFMgJKZ2puo66JJQzdajIbA6KsAL8cb9AkqtS-eNTTTYbdV_Ql-7Lxf1gHkzPPv7CjXLg7sVe3lrv_JlL2-pMr4Wn63GzXfDjuAhWwBSVtiBe1NN2bmcMBBOkE5evSKxAyBz8AylLOmstkcXfwVhoKPSpEuQJ/stream"
  },
  {
    name: "AIOStreams",
    url: "https://aiostreamsfortheweebs.midnightignite.me/stremio/0479360b-f14a-4dff-b7b5-32d70809a4e7/eyJpdiI6IlR0RU1ubWU5NjNJSnFpOVhHVUpzdlE9PSIsImVuY3J5cHRlZCI6IlcwdGd6aEFZNFl1amJzVmhZVFdJRnc9PSIsInR5cGUiOiJhaW9FbmNyeXB0In0/stream"
  }
];

// Headers
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Cache-Control": "no-cache"
};

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8"
};

const json = (data) => new Response(JSON.stringify(data), { headers: responseHeaders });

// ==========================================
// 2. PARSER INTELIGENTE (BEAUTIFIER)
// ==========================================
function parseStreamDetails(rawTitle, rawName, sizeBytes, seeds, providerName) {
  const text = (rawTitle + " " + rawName).toUpperCase();
  
  // 1. Detectar Resolución
  let quality = "HD";
  if (text.includes("4K") || text.includes("2160P")) quality = "4K [UHD]";
  else if (text.includes("1080P")) quality = "1080p [FHD]";
  
  // 2. Detectar Fuente/Tecnología
  let source = "";
  if (text.includes("BLURAY") || text.includes("BLU-RAY")) source = "💿 BluRay";
  else if (text.includes("WEB-DL") || text.includes("WEB")) source = "☁️ WEB-DL";
  else if (text.includes("HDR") || text.includes("DV") || text.includes("DOLBY")) source = "🌈 HDR/DV";
  else if (text.includes("HDRIP") || text.includes("BRRIP")) source = "💿 Rip";
  
  // 3. Detectar Audio/Extras
  let audio = "";
  if (text.includes("DUAL") || text.includes("MULTI")) audio = "🗣️ Dual/Multi";
  
  // 4. Formatear Tamaño
  let sizeStr = "? GB";
  if (sizeBytes) {
    sizeStr = (sizeBytes / 1073741824).toFixed(2) + " GB";
  } else {
    // Intentar rescatar del texto si no viene numérico
    const match = text.match(/(\d+(\.\d+)?)\s?GB/);
    if (match) sizeStr = match[0];
  }

  // 5. Formatear Seeds
  const seedsStr = seeds ? `🌱 ${seeds}` : "";

  // 6. Limpiar Filename (El texto largo)
  // Quitamos basura común para dejar el nombre del archivo más limpio
  let filename = rawTitle
    .replace(/\[TORRENT\]/gi, "")
    .replace(/MediaFusion/gi, "")
    .replace(/Comet/gi, "")
    .replace(/unknown/gi, "")
    .trim();

  // CONSTRUCCIÓN VISUAL (Como tu captura)
  // Línea 1: Detalles técnicos con iconos
  const line1 = [`📦 ${sizeStr}`, seedsStr, source].filter(Boolean).join("  ");
  // Línea 2: Audio y Provider
  const line2 = [audio, `🏷️ ${providerName}`].filter(Boolean).join("  ");
  
  return {
    shortName: `⚡ ${quality}`, // Esto saldrá en negrita arriba (ej: ⚡ 1080p [FHD])
    description: `${line1}\n${line2}\n📄 ${filename}` // Esto es el cuerpo
  };
}

// Filtro Anti-Intrusos
function isIntruder(streamTitle, requestType) {
  if (!streamTitle) return false;
  const title = streamTitle.toUpperCase();
  if (requestType === 'movie') {
    const seriesPatterns = [/S\d\dE\d\d/, /SEASON \d/, /EPISODE \d/, /COMPLETE SERIES/, /S\d\d/];
    if (seriesPatterns.some(pattern => pattern.test(title))) return true;
  }
  return false;
}

// ==========================================
// 3. RUTAS
// ==========================================
router.get('/manifest.json', () => {
  return json({
    id: "com.nuvio.visual.bridge",
    version: "7.0.0",
    name: "Ultimate Bridge (Visual Pro)",
    description: "Cloudflare Bypass + High Quality UI",
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
  return json({ meta: { id: params.id.replace(".json", ""), type: params.type, name: "Meta" } });
});

router.get('/stream/:type/:id.json', async (request, env) => {
  let { type, id } = request.params;
  id = decodeURIComponent(id).replace(".json", "");

  if (!env.STREMIO_SERVER_URL) {
    return json({ streams: [{ name: "⚠️ ERROR", title: "Falta STREMIO_SERVER_URL", url: "#" }] });
  }
  const serverUrl = env.STREMIO_SERVER_URL.replace(/\/$/, "");

  let allStreams = [];
  let uniqueHashes = new Set();

  const fetchPromises = PROVIDERS.map(async (provider) => {
    try {
      const response = await fetch(`${provider.url}/${type}/${id}.json`, {
        headers: BROWSER_HEADERS,
        cf: { cacheTtl: 60 }
      });

      if (!response.ok) return [];
      const data = await response.json().catch(() => null);
      if (!data || !data.streams) return [];
      return data.streams.map(s => ({ ...s, providerName: provider.name }));
    } catch (e) { return []; }
  });

  const results = await Promise.all(fetchPromises);

  results.flat().forEach(stream => {
    if (!stream.infoHash) return;
    if (uniqueHashes.has(stream.infoHash)) return;

    // 1. Filtro
    const rawTitle = stream.title || stream.name || stream.behaviorHints?.filename || "";
    if (isIntruder(rawTitle, type)) return;

    // 2. URL
    const fileIdx = stream.fileIdx !== undefined ? stream.fileIdx : 0;
    const directUrl = `${serverUrl}/${stream.infoHash}/${fileIdx}`;
    
    // 3. EMBELLECIMIENTO (VISUAL PRO)
    const rawName = stream.name || "";
    // Priorizamos el tamaño que viene en behaviorHints, si no, null
    const sizeBytes = stream.behaviorHints?.videoSize || null;
    
    const visual = parseStreamDetails(rawTitle, rawName, sizeBytes, stream.seeders, stream.providerName);

    uniqueHashes.add(stream.infoHash);

    allStreams.push({
      name: visual.shortName, // Ej: ⚡ 1080p [FHD]
      title: visual.description, // Bloque de detalles con iconos
      url: directUrl,
      behaviorHints: {
        notWebReady: false,
        bingeGroup: stream.behaviorHints?.bingeGroup,
        filename: stream.behaviorHints?.filename
      }
    });
  });

  if (allStreams.length === 0) {
    return json({ streams: [{ name: "⚠️ VACÍO", title: "Sin resultados", url: "#" }] });
  }

  // Ordenar por calidad (4K primero)
  allStreams.sort((a, b) => {
    const is4kewA = a.name.includes("4K");
    const is4kewB = b.name.includes("4K");
    return is4kewB - is4kewA;
  });

  return json({ streams: allStreams });
});

router.options('*', () => new Response(null, { headers: responseHeaders }));
router.all('*', () => new Response('Not Found', { status: 404, headers: responseHeaders }));

export default { fetch: router.handle };