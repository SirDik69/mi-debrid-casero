import { Router } from 'itty-router';

const router = Router();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8"
};

const json = (data) => new Response(JSON.stringify(data), { headers: corsHeaders });

// ==========================================
// CONFIGURACIÓN DE RUTAS Y PROXIES
// ==========================================

// 1. URL de Torrentio Original (Suele bloquear Workers)
const PROVIDERS = "providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,magnetdl,torrentgalaxy|quality=720p,1080p,4k";
const TORRENTIO_URL = `https://torrentio.strem.fun/${PROVIDERS}`;

// 2. URL de KnightCrawler (Alternativa a Torrentio que NO bloquea, usamos como backup o principal)
const KNIGHTCRAWLER_URL = "https://knightcrawler.elfhosted.com/yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,magnetdl,torrentgalaxy,scenerules,mediafusion";

// 3. EL PROXY MÁGICO (Esto soluciona el 403)
// Usamos corsproxy.io para que Torrentio no sepa que somos un Worker
const PROXY_GATEWAY = "https://corsproxy.io/?";

router.get('/manifest.json', () => {
  return json({
    id: "com.nuvio.tunnel.v3",
    version: "1.3.0",
    name: "HTTP Bridge (Tunnel)",
    description: "Stremio Server Bridge via Proxy Tunneling",
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
    return json({ streams: [{ name: "⚠️ ERROR", title: "Configura STREMIO_SERVER_URL", url: "#" }] });
  }

  const serverUrl = env.STREMIO_SERVER_URL.replace(/\/$/, "");

  // Función interna para procesar la lista de streams
  const processStreams = (streams, sourceName) => {
    return streams.map(stream => {
      if (!stream.infoHash) return null;
      const fileIdx = stream.fileIdx !== undefined ? stream.fileIdx : 0;
      const directUrl = `${serverUrl}/${stream.infoHash}/${fileIdx}`;
      
      const titleLines = (stream.title || "").split("\n");
      const mainTitle = titleLines[0];

      return {
        name: `⚡ HTTP [${sourceName}]`,
        title: `${mainTitle}\n${titleLines[1] || ''}`, 
        url: directUrl,
        behaviorHints: {
          notWebReady: false,
          bingeGroup: stream.behaviorHints?.bingeGroup,
          filename: stream.behaviorHints?.filename
        }
      };
    }).filter(Boolean);
  };

  try {
    // ESTRATEGIA 1: Usar KnightCrawler DIRECTO (Más rápido, no bloquea)
    // Es lo más estable hoy en día para scripts.
    console.log("Intentando Strategy 1: KnightCrawler Directo...");
    const kcUrl = `${KNIGHTCRAWLER_URL}/stream/${type}/${id}.json`;
    
    let response = await fetch(kcUrl);
    
    if (response.ok) {
      const data = await response.json();
      if (data.streams && data.streams.length > 0) {
        return json({ streams: processStreams(data.streams, "KC") });
      }
    }

    // ESTRATEGIA 2: Si falla KC, usamos Torrentio CON PROXY
    // Envolvemos la URL de Torrentio dentro del Proxy
    console.log("Intentando Strategy 2: Torrentio via Proxy...");
    const targetTorrentio = `${TORRENTIO_URL}/stream/${type}/${id}.json`;
    
    // AQUÍ ESTÁ EL TRUCO: Pasamos la URL encodeada al proxy
    const proxyUrl = `${PROXY_GATEWAY}${encodeURIComponent(targetTorrentio)}`;
    
    response = await fetch(proxyUrl);

    if (response.ok) {
      const data = await response.json();
      if (data.streams && data.streams.length > 0) {
        return json({ streams: processStreams(data.streams, "TR") });
      }
    }

    return json({ streams: [{ name: "⚠️ VACÍO", title: "No se encontraron resultados en ninguna fuente", url: "#" }] });

  } catch (error) {
    return json({ streams: [{ name: "☠️ ERROR", title: error.message, url: "#" }] });
  }
});

router.options('*', () => new Response(null, { headers: corsHeaders }));
router.all('*', () => new Response('Not Found', { status: 404, headers: corsHeaders }));

export default { fetch: router.handle };