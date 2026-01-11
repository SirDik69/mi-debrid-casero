import { Router } from 'itty-router';

const router = Router();

// CONFIGURACIÓN
// 1. Usamos una configuración de Torrentio robusta (varios proveedores)
const TORRENTIO_BASE = "https://torrentio.strem.fun";

// 2. El Proxy Mágico (Soluciona bloqueos de IP y CORS)
const PROXY_URL = "https://corsproxy.io/?";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// --- RUTA 1: MANIFEST ---
router.get('/manifest.json', () => {
  return new Response(JSON.stringify({
    id: "com.midomain.httpbridge",
    version: "1.0.3", // Subimos versión para forzar actualización
    name: "HTTP Bridge (Nuvio)",
    description: "Puente HTTPS para Stremio Server via Proxy",
    resources: ["stream"],
    types: ["movie", "series"],
    catalogs: [],
    idPrefixes: ["tt"]
  }), { headers: corsHeaders });
});

// --- RUTA 2: STREAM ---
router.get('/stream/:type/:id.json', async (request, env) => {
  let { type, id } = request.params;
  id = decodeURIComponent(id); // Decodificar por si acaso

  // Verificación de variable de entorno
  if (!env.STREMIO_SERVER_URL) {
    return new Response(JSON.stringify({ 
      streams: [{ title: "⚠️ CONFIGURAR STREMIO_SERVER_URL", url: "" }] 
    }), { headers: corsHeaders });
  }

  const serverUrl = env.STREMIO_SERVER_URL.replace(/\/$/, "");

  try {
    // CONSTRUCCIÓN DE LA URL CON PROXY
    // La lógica es: Proxy + (URL Encodeada de Torrentio)
    const torrentioTarget = `${TORRENTIO_BASE}/stream/${type}/${id}.json`;
    const finalUrl = `${PROXY_URL}${encodeURIComponent(torrentioTarget)}`;

    console.log(`Intentando fetch a: ${finalUrl}`);

    const response = await fetch(finalUrl, {
      headers: {
        // A veces el proxy requiere que parezcamos un navegador
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      console.log(`Error del Proxy/Torrentio: ${response.status}`);
      // Fallback silencioso (retorna vacío)
      return new Response(JSON.stringify({ streams: [] }), { headers: corsHeaders });
    }

    const data = await response.json();

    if (!data.streams || data.streams.length === 0) {
      console.log("Torrentio no devolvió resultados.");
      return new Response(JSON.stringify({ streams: [] }), { headers: corsHeaders });
    }

    // TRANSFORMACIÓN DE DATOS
    const newStreams = data.streams.map((stream, index) => {
      if (!stream.infoHash) return null;

      const originalTitle = stream.title || stream.name || "Torrent";
      const cleanTitle = originalTitle.split('\n')[0]; 
      
      // Lógica de archivo (File Index)
      let fileIdx = 0;
      if (stream.fileIdx !== undefined) {
        fileIdx = stream.fileIdx;
      } else if (type === 'series') {
        // A veces en series Torrentio no manda fileIdx en el objeto principal, 
        // pero para este experimento asumimos 0 si falla, o podrías implementar lógica extra.
        fileIdx = 0; 
      }

      // Tu URL mágica
      const directUrl = `${serverUrl}/${stream.infoHash}/${fileIdx}`;

      return {
        name: `HTTP-S [${index + 1}]`,
        title: `${cleanTitle}\n⬇️ ${stream.behaviorHints?.filename || 'Stream'}`,
        url: directUrl,
        behaviorHints: {
          notWebReady: false, 
          bingeGroup: stream.behaviorHints?.bingeGroup,
          filename: stream.behaviorHints?.filename
        }
      };
    }).filter(Boolean);

    return new Response(JSON.stringify({ streams: newStreams }), { headers: corsHeaders });

  } catch (error) {
    console.error("Error crítico:", error);
    return new Response(JSON.stringify({ streams: [] }), { headers: corsHeaders });
  }
});

// Manejo de 404
router.all('*', () => new Response('Not Found', { status: 404, headers: corsHeaders }));

export default {
  fetch: router.handle
};
