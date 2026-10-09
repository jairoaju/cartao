const CACHE_NAME = 'cartao-gastos-v11';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// Instalação do Service Worker e armazenamento do cache inicial
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// Ativação e limpeza imediata de caches antigos obsoletos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estratégia de Fetch: Tenta buscar a versão mais recente na rede; se offline, recorre ao cache
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Se obteve sucesso na rede, atualiza o cache dinamicamente se necessário
                return response;
            })
            .catch(() => {
                // Se estiver offline, retorna o arquivo correspondente do cache
                return caches.match(event.request);
            })
    );
});