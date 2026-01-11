import { Router } from 'itty-router';

const router = Router();

// ==========================================
// CONFIGURACIÓN
// ==========================================
const MAX_RESULTS = 5; // Tu petición: Limitar resultados para evitar saturación
const YTS_API_URL = "https://yts.mx/api/v2/list_movies.json";
const TPB_API_URL = "https://apibay.org/q.php";

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8"
};

const json = (data) => new Response(JSON.stringify(data), { headers: responseHeaders });

// ==========================================
// LÓGICA DE PROVEEDORES DIRECTOS
// ==========================================

// 1. YTS (Excelente para Películas)
async function fetchYTS(imdbId) {
  try {
    const url = `${YTS_API_URL}?query_term=${imdbId}`;
    console.log(`Consultando YTS: ${url}`);
    
    const res = await fetch(url);
    const data = await res.json();

    if (!data.data || !data.data.movies) return [];

    // Mapeamos los resultados de YTS al formato de Stremio
    return data.data.movies[0].torrents.map(t => ({
      name: "⚡ YTS",
      title: `${data.data.movies[0].title}\n${t.quality} ${t.type} - 📦 ${t.size}`,
      infoHash: t.hash.toLowerCase(),
      fileIdx: 0, // YTS siempre son películas (1 archivo principal)
      seeders: t.seeds
    }));
  } catch (e) {
    console.error("Error YTS:", e);
    return [];
  }
}

// 2. ThePirateBay (Backup para todo)
async function fetchTPB(imdbId, type) {
  try {
    // TPB busca por ID (tt...)
    const url = `${TPB_API_URL}?q=${imdbId}&cat=${type === 'movie' ? 200 : 205}`;
    console.log(`Consultando TPB: ${url}`);

    const res = await fetch(url);
    const data = await res.json();

    if (!data || data.length === 0 || data[0].name === "No results returned") return [];

    return data.map(t => ({
      name: "⚡ TPB",
      title: `${t.name}\nSeeds: ${t.seeders} - Size: ${(t.size / 1073741824).toFixed(2)} GB`,
      infoHash: t.info_hash.toLowerCase(),
      fileIdx: 0, // Asumimos 0, para series es arriesgado pero funcional
      seeders: parseInt(t.seeders)
    }));
  } catch (e) {
    console.error("Error TPB:", e);
    return [];
  }
}

// ==========================================
// RUTAS
// ==========================================

router.get('/manifest.json', () => {
  return json({
    id: "com.nuvio.direct.source",
    version: "4.0.0",
    name: "Direct Source Bridge",
    description: "Usa APIs de YTS y TPB directamente (Sin bloqueos)",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/YTS_logo.svg/1200px-YTS_logo.svg.png",
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
    return json({ streams: [{ name: "⚠️ ERROR", title: "Configura STREMIO_SERVER_URL", url: "#" }] });
  }
  const serverUrl = env.STREMIO_SERVER_URL.replace(/\/$/, "");

  let streams = [];

  // ESTRATEGIA:
  // Si es película -> YTS primero (Mejor calidad/api)
  // Si falla o es serie -> TPB

  if (type === 'movie') {
    const ytsStreams = await fetchYTS(id);
    streams = [...streams, ...ytsStreams];
  }

  // Si no hay suficientes resultados, probamos TPB
  if (streams.length < MAX_RESULTS) {
    const tpbStreams = await fetchTPB(id, type);
    streams = [...streams, ...tpbStreams];
  }

  // Si no hay nada
  if (streams.length === 0) {
    return json({ 
      streams: [{ name: "⚠️ SIN DATOS", title: "No se encontraron torrents en YTS/TPB", url: "#" }] 
    });
  }

  // PROCESAR FINALMENTE (Convertir a HTTPS Link)
  // 1. Ordenar por Seeders (Mejor salud primero)
  // 2. Limitar cantidad (Tu petición)
  const finalStreams = streams
    .sort((a, b) => b.seeders - a.seeders)
    .slice(0, MAX_RESULTS) // <--- AQUÍ LIMITAMOS LOS RESULTADOS
    .map(stream => {
      const directUrl = `${serverUrl}/${stream.infoHash}/${stream.fileIdx}`;
      
      return {
        name: stream.name,
        title: stream.title,
        url: directUrl,
        behaviorHints: {
          notWebReady: false,
          bingeGroup: `src-${stream.infoHash}`, // Agrupación simple
          filename: "video.mp4"
        }
      };
    });

  return json({ streams: finalStreams });
});

router.options('*', () => new Response(null, { headers: responseHeaders }));
router.all('*', () => new Response('Not Found', { status: 404, headers: responseHeaders }));

export default { fetch: router.handle };