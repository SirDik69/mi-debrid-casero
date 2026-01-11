import { Router } from 'itty-router';

const router = Router();

// Headers CORS permisivos para depuración
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*", // Permitir todo para test
  "Content-Type": "application/json; charset=utf-8"
};

const json = (data) => new Response(JSON.stringify(data), { headers: corsHeaders });

// 1. MANIFEST (Lo más simple y estándar posible)
router.get('/manifest.json', () => {
  return json({
    id: "com.debug.test",
    version: "0.0.1",
    name: "🔴 DEBUG TESTER",
    description: "Addon de prueba para validar Nuvio",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Test-Logo.svg/783px-Test-Logo.svg.png",
    resources: [
      { name: "stream", types: ["movie", "series"], idPrefixes: ["tt"] },
      { name: "meta", types: ["movie", "series"], idPrefixes: ["tt"] }
    ],
    types: ["movie", "series"],
    catalogs: []
  });
});

// 2. META (Respuesta simulada)
router.get('/meta/:type/:id.json', ({ params }) => {
  return json({
    meta: {
      id: params.id.replace(".json", ""),
      type: params.type,
      name: "TEST MOVIE",
      poster: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_buck_bunny_poster_big.jpg",
      description: "Si ves esto, el endpoint /meta funciona bien."
    }
  });
});

// 3. STREAMS (Aquí está la prueba de fuego)
router.get('/stream/:type/:id.json', (request, env) => {
  
  // Recuperar tu URL de servidor si existe, sino poner una dummy
  const serverUrl = env.STREMIO_SERVER_URL 
    ? env.STREMIO_SERVER_URL.replace(/\/$/, "") 
    : "https://ejemplo-no-configurado.com";

  return json({
    streams: [
      // PRUEBA A: Enlace MP4 directo público (Debe funcionar sí o sí)
      {
        name: "✅ TEST MP4",
        title: "Big Buck Bunny\nPrueba de reproducción directa",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        behaviorHints: { notWebReady: false }
      },
      // PRUEBA B: Simulación de tu enlace (Para ver si Nuvio acepta el formato)
      {
        name: "🔗 TEST PROXY",
        title: "Enlace Simulado a tu Servidor\nVerifica si aparece en lista",
        url: `${serverUrl}/infohash_falso_123/0`,
        behaviorHints: { notWebReady: false }
      }
    ]
  });
});

router.options('*', () => new Response(null, { headers: corsHeaders }));
router.all('*', () => new Response('Not Found', { status: 404, headers: corsHeaders }));

export default { fetch: router.handle };