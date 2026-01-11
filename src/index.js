import { Router } from 'itty-router';

const router = Router();

// Headers para RESPONDER a Nuvio (CORS permisivo)
const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8"
};

const json = (data) => new Response(JSON.stringify(data), { headers: responseHeaders });

// CONFIGURACIÓN DE TORRENTIO
// Nota: Usamos %7C en lugar de | para asegurar compatibilidad con fetch
const TORRENTIO_CONFIG = "providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,magnetdl,torrentgalaxy%7Cquality=720p,1080p,4k";
const TORRENTIO_URL = "https://torrentio.strem.fun";

// Headers para PEDIR a Torrentio (Disfraz de Stremio Web)
const torrentioRequestHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Origin": "https://web.stremio.com", // Hacemos creer que somos Stremio Web
  "Referer": "https://web.stremio.com/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "cross-site"
};

router.get('/manifest.json', () => {
  return json({
    id: "com.nuvio.httpbridge.v2",
    version: "1.2.0",
    name: "HTTP Bridge (Stealth)",
    description: "Bypasses torrent restrictions via HTTPS",
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
    meta: {
      id: params.id.replace(".json", ""),
      type: params.type,
      name: "Meta Placeholder"
    }
  });
});

router.get('/stream/:type/:id.json', async (request, env) => {
  let { type, id } = request.params;
  id = decodeURIComponent(id).replace(".json", "");

  if (!env.STREMIO_SERVER_URL) {
    return json({ streams: [{ name: "⚠️ ERROR", title: "Configura STREMIO_SERVER_URL", url: "#" }] });
  }

  const serverUrl = env.STREMIO_SERVER_URL.replace(/\/$/, "");

  try {
    // Construimos la URL final apuntando a la configuración
    const targetUrl = `${TORRENTIO_URL}/${TORRENTIO_CONFIG}/stream/${type}/${id}.json`;
    console.log(`Intentando conectar a: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: torrentioRequestHeaders
    });

    if (!response.ok) {
      // Si falla, intentamos una segunda estrategia sin configuración (Vanilla Torrentio)
      // A veces la config personalizada es la que detona el bloqueo 403
      console.log("Fallo con config, intentando vanilla...");
      const vanillaUrl = `${TORRENTIO_URL}/stream/${type}/${id}.json`;
      const responseRetry = await fetch(vanillaUrl, { headers: torrentioRequestHeaders });
      
      if (!responseRetry.ok) {
        return json({ 
           streams: [{ name: "⚠️ BLOCKED", title: `Torrentio Bloqueado: ${responseRetry.status} (Intenta más tarde)`, url: "#" }] 
        });
      }
      // Si el reintento funciona, usamos esa data
      var data = await responseRetry.json();
    } else {
      var data = await response.json();
    }

    if (!data.streams || !data.streams.length) {
      return json({ streams: [{ name: "⚠️ VACÍO", title: "No se encontraron torrents", url: "#" }] });
    }

    const newStreams = data.streams.map(stream => {
      if (!stream.infoHash) return null;
      const fileIdx = stream.fileIdx !== undefined ? stream.fileIdx : 0;
      const directUrl = `${serverUrl}/${stream.infoHash}/${fileIdx}`;
      
      const titleLines = (stream.title || "").split("\n");
      const mainTitle = titleLines[0];

      return {
        name: "⚡ HTTP",
        title: `${mainTitle}\n${titleLines[1] || ''}`, 
        url: directUrl,
        behaviorHints: {
          notWebReady: false,
          bingeGroup: stream.behaviorHints?.bingeGroup,
          filename: stream.behaviorHints?.filename
        }
      };
    }).filter(Boolean);

    return json({ streams: newStreams });

  } catch (error) {
    return json({ streams: [{ name: "☠️ ERROR", title: error.message, url: "#" }] });
  }
});

router.options('*', () => new Response(null, { headers: responseHeaders }));
router.all('*', () => new Response('Not Found', { status: 404, headers: responseHeaders }));

export default { fetch: router.handle };