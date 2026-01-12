import { Router } from 'itty-router';

const router = Router();

// ==========================================
// 1. TUS PROVEEDORES (URLs CONFIGURADAS)
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
    // Nota: Si AIOStreams devuelve pocos resultados, aumenta el timeout en su web de configuración
    url: "https://aiostreamsfortheweebs.midnightignite.me/stremio/0479360b-f14a-4dff-b7b5-32d70809a4e7/eyJpdiI6IlR0RU1ubWU5NjNJSnFpOVhHVUpzdlE9PSIsImVuY3J5cHRlZCI6IlcwdGd6aEFZNFl1amJzVmhZVFdJRnc9PSIsInR5cGUiOiJhaW9FbmNyeXB0In0/stream"
  }
];

// Headers Blindados (Chrome 2026)
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
// 2. EL EMBELLECEDOR (CLEANER)
// ==========================================
function cleanStreamInfo(stream, providerName) {
  let rawTitle = stream.title || stream.name || "";
  let rawDesc = "";
  
  // Si el título tiene saltos de línea, separamos
  if (rawTitle.includes("\n")) {
    const parts = rawTitle.split("\n");
    rawTitle = parts[0];
    rawDesc = parts.slice(1).join(" ");
  }

  // LIMPIEZA ESPECÍFICA POR PROVEEDOR
  
  if (providerName === "Comet") {
    // Eliminar "[TORRENT]", "Comet" y "unknown"
    rawTitle = rawTitle
      .replace(/\[TORRENT\]/gi, "")
      .replace(/Comet/gi, "")
      .replace(/unknown/gi, "")
      .trim();
    // Si queda vacío, intentamos rescatar info del nombre del archivo
    if (!rawTitle || rawTitle.length < 3) {
        rawTitle = stream.behaviorHints?.filename || "Stream";
    }
  }

  if (providerName === "MediaFusion") {
    // Eliminar emojis, "MediaFusion", "P2P"
    rawTitle = rawTitle
      .replace(/MediaFusion/gi, "")
      .replace(/P2P/gi, "")
      .replace(/📂|⏳|⚡|🚀/g, "") // Emojis basura
      .trim();
  }

  if (providerName === "AIOStreams") {
    // A veces AIO pone "AddonName | Title"
    if (rawTitle.includes("|")) {
        rawTitle = rawTitle.split("|")[1].trim();
    }
  }

  // LIMPIEZA GENERAL (Para todos)
  // Quitar el nombre de la película del inicio si se repite mucho (opcional, pero estético)
  // Aquí nos enfocamos en resaltar la CALIDAD
  
  // Construimos la línea de detalles
  const seeds = stream.seeders !== undefined ? `👤 ${stream.seeders}` : "";
  const size = stream.behaviorHints?.videoSize 
      ? `💾 ${(stream.behaviorHints.videoSize / 1073741824).toFixed(2)} GB` 
      : (rawDesc.match(/\d+(\.\d+)?\s?GB/) || [""])[0]; // Intento de extraer GB del texto

  // Título final limpio
  const finalTitle = rawTitle || "Stream";
  const finalDetails = [size, seeds, providerName].filter(Boolean).join(" • ");

  return `${finalTitle}\n${finalDetails}`;
}

// Filtro Anti-Grinch (Intrusos)
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
    id: "com.nuvio.beautified.bridge",
    version: "6.0.0",
    name: "Ultimate HTTP Bridge (Clean)",
    description: "Bypass Cloudflare + Parallel + Clean UI",
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

  // EJECUCIÓN PARALELA
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
    } catch (e) {
      return [];
    }
  });

  const results = await Promise.all(fetchPromises);

  results.flat().forEach(stream => {
    if (!stream.infoHash) return;
    if (uniqueHashes.has(stream.infoHash)) return;

    // 1. Filtro Anti-Intrusos (Series en Películas)
    const fullOriginalTitle = stream.title || stream.name || "";
    if (isIntruder(fullOriginalTitle, type)) return;

    // 2. Construcción URL
    const fileIdx = stream.fileIdx !== undefined ? stream.fileIdx : 0;
    const directUrl = `${serverUrl}/${stream.infoHash}/${fileIdx}`;
    
    // 3. EMBELLECIMIENTO DEL TÍTULO
    const prettyTitle = cleanStreamInfo(stream, stream.providerName);

    uniqueHashes.add(stream.infoHash);

    allStreams.push({
      name: `⚡ ${stream.providerName}`, 
      title: prettyTitle, // Título limpio
      url: directUrl,
      behaviorHints: {
        notWebReady: false,
        bingeGroup: stream.behaviorHints?.bingeGroup,
        filename: stream.behaviorHints?.filename
      }
    });
  });

  if (allStreams.length === 0) {
    return json({ streams: [{ name: "⚠️ VACÍO", title: "No se encontraron enlaces válidos", url: "#" }] });
  }

  // Ordenar: Priorizamos 4K/1080p detectando texto en el título
  allStreams.sort((a, b) => {
    const qA = (a.title.includes("4k") || a.title.includes("2160p")) ? 2 : (a.title.includes("1080p") ? 1 : 0);
    const qB = (b.title.includes("4k") || b.title.includes("2160p")) ? 2 : (b.title.includes("1080p") ? 1 : 0);
    return qB - qA; // Mayor calidad primero
  });

  return json({ streams: allStreams });
});

router.options('*', () => new Response(null, { headers: responseHeaders }));
router.all('*', () => new Response('Not Found', { status: 404, headers: responseHeaders }));

export default { fetch: router.handle };