import { Router } from 'itty-router';

const router = Router();

// ==========================================
// CONFIGURACIÓN DE PROVEEDORES (NUEVOS)
// ==========================================
const PROVIDERS = [
  {
    name: "Comet", // Nuevo y muy rápido (suele funcionar donde Torrentio falla)
    url: "https://comet.elfhosted.com/stream"
  },
  {
    name: "MediaFusion", // Excelente para Anime y películas
    url: "https://mediafusion.elfhosted.com/stream"
  },
  {
    name: "Torrentio (Lite)", // Versión ligera, a veces salta el bloqueo
    url: "https://torrentio.strem.fun/lite/stream"
  }
];

// Disfraz de Googlebot (Abre muchas puertas 403)
const GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8"
};

const json = (data) => new Response(JSON.stringify(data), { headers: responseHeaders });

router.get('/manifest.json', () => {
  return json({
    id: "com.nuvio.universal.bridge.v3",
    version: "3.0.0",
    name: "Universal Bridge (Comet+MF)",
    description: "Bypass usando Comet y MediaFusion",
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
    meta: { id: params.id.replace(".json", ""), type: params.type, name: "Metadata" }
  });
});

router.get('/stream/:type/:id.json', async (request, env) => {
  let { type, id } = request.params;
  id = decodeURIComponent(id).replace(".json", "");

  if (!env.STREMIO_SERVER_URL) {
    return json({ streams: [{ name: "⚠️ ERROR", title: "Configura STREMIO_SERVER_URL", url: "#" }] });
  }
  const serverUrl = env.STREMIO_SERVER_URL.replace(/\/$/, "");

  let validStreams = [];
  let debugLog = [];

  for (const provider of PROVIDERS) {
    try {
      console.log(`Probando ${provider.name}...`);
      const targetUrl = `${provider.url}/${type}/${id}.json`;
      
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent": GOOGLEBOT_UA, // Nos disfrazamos de Google
          "Accept": "application/json",
          "Cache-Control": "no-cache"
        }
      });

      if (!response.ok) {
        debugLog.push(`${provider.name}: Http${response.status}`);
        continue;
      }

      // Verificamos que sea JSON antes de parsear para evitar el error "<"
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        debugLog.push(`${provider.name}: Recibido HTML/Texto (Bloqueado)`);
        continue;
      }

      const data = await response.json();

      if (data.streams && data.streams.length > 0) {
        validStreams = data.streams.map(stream => {
          if (!stream.infoHash) return null;

          const fileIdx = stream.fileIdx !== undefined ? stream.fileIdx : 0;
          const directUrl = `${serverUrl}/${stream.infoHash}/${fileIdx}`;
          
          const parts = (stream.title || "").split("\n");
          const cleanTitle = parts[0] || "Video";
          const details = parts[1] || `Seeds: ${stream.seeders || '?'}`;

          return {
            name: `⚡ ${provider.name}`, 
            title: `${cleanTitle}\n${details}`,
            url: directUrl,
            behaviorHints: {
              notWebReady: false,
              bingeGroup: stream.behaviorHints?.bingeGroup,
              filename: stream.behaviorHints?.filename
            }
          };
        }).filter(Boolean);

        if (validStreams.length > 0) break; // Encontramos tesoro, salimos
      } else {
        debugLog.push(`${provider.name}: 0 Streams`);
      }
    } catch (e) {
      debugLog.push(`${provider.name}: Error ${e.message}`);
    }
  }

  if (validStreams.length === 0) {
    return json({ 
      streams: [{ 
        name: "⚠️ FALLO", 
        title: `Debug: ${debugLog.join(" | ")}`, 
        url: "#" 
      }] 
    });
  }

  return json({ streams: validStreams });
});

router.options('*', () => new Response(null, { headers: responseHeaders }));
router.all('*', () => new Response('Not Found', { status: 404, headers: responseHeaders }));

export default { fetch: router.handle };