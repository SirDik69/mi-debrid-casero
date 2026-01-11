import { Router } from 'itty-router';

const router = Router();

// URL base de Torrentio. Puedes cambiarla si usas una configuración personalizada de Torrentio
// Ejemplo con configuración: "https://torrentio.strem.fun/providers=yts,eztv|quality=720p,1080p"
const TORRENTIO_URL = "https://torrentio.strem.fun";

// Headers CORS para que funcione en Nuvio/Web/Apps
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 1. Ruta del Manifiesto
router.get('/manifest.json', () => {
  return new Response(JSON.stringify({
    id: "com.midomain.httpbridge",
    version: "1.0.1",
    name: "HTTP Bridge (Nuvio)",
    description: "Puente HTTPS para Stremio Server",
    resources: ["stream"],
    types: ["movie", "series"],
    catalogs: [],
    idPrefixes: ["tt"]
  }), { headers: corsHeaders });
});

// 2. Ruta de Streams (La Magia)
router.get('/stream/:type/:id.json', async (request, env) => {
  const { type, id } = request.params;
  
  // Validamos que la variable de entorno exista
  if (!env.STREMIO_SERVER_URL) {
    return new Response(JSON.stringify({ streams: [{ title: "ERROR: Configura STREMIO_SERVER_URL" }] }), { headers: corsHeaders });
  }

  // Limpiamos la URL del servidor por si el usuario puso '/' al final
  const serverUrl = env.STREMIO_SERVER_URL.replace(/\/$/, "");

  try {
    // Consultamos a Torrentio
    const response = await fetch(`${TORRENTIO_URL}/stream/${type}/${id}.json`);
    
    if (!response.ok) {
        return new Response(JSON.stringify({ streams: [] }), { headers: corsHeaders });
    }

    const data = await response.json();

    if (!data.streams || data.streams.length === 0) {
      return new Response(JSON.stringify({ streams: [] }), { headers: corsHeaders });
    }

    // Transformamos los streams
    const newStreams = data.streams.map(stream => {
      // Solo procesamos si hay infoHash (es un torrent)
      if (!stream.infoHash) return null;

      // Título Original + Indicador visual
      const originalTitle = stream.title || stream.name || "Torrent";
      const cleanTitle = originalTitle.split('\n')[0]; // Tomamos la primera línea para que se vea limpio
      
      // Lógica de índice de archivo
      // Si Torrentio no da fileIdx, asumimos 0 (común en películas)
      const fileIdx = stream.fileIdx !== undefined ? stream.fileIdx : 0;

      // Construcción del enlace
      // Formato: https://tu-proxy.workers.dev/{infoHash}/{fileIdx}
      const directUrl = `${serverUrl}/${stream.infoHash}/${fileIdx}`;

      return {
        name: "HTTP Bridge", // Nombre del proveedor en la lista
        title: `${cleanTitle}\n⬇️ HTTPS Direct Stream`, // Descripción detallada
        url: directUrl,
        behaviorHints: {
          notWebReady: false, // ¡Crucial para Nuvio!
          bingeGroup: stream.behaviorHints?.bingeGroup,
          filename: stream.behaviorHints?.filename
        }
      };
    }).filter(Boolean); // Eliminamos nulos

    return new Response(JSON.stringify({ streams: newStreams }), { headers: corsHeaders });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ streams: [] }), { headers: corsHeaders });
  }
});

// Manejo de rutas no encontradas
router.all('*', () => new Response('Not Found', { status: 404, headers: corsHeaders }));

export default {
  fetch: router.handle
};
