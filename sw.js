/* ポケットコーチ — オフライン動作用サービスワーカー
   方針：
     ・HTML（画面本体）はネットワーク優先。新しい版を上げたら次回起動時に自動で反映される
     ・つながらないときはキャッシュから起動するので、圏外でもアプリが開く
     ・アイコンなどはキャッシュ優先
   スコアや飛距離のデータはこのファイルとは無関係で、端末のブラウザ内に保存されます。 */

var CACHE = 'fairway-notebook-v1';
var ASSETS = [
  './',
  './index_2.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(ASSETS.map(function(u){
        return c.add(new Request(u, {cache: 'reload'})).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function isHtml(req){
  if(req.mode === 'navigate') return true;
  var a = req.headers.get('accept') || '';
  if(a.indexOf('text/html') > -1) return true;
  return /\.html($|\?)/.test(req.url);
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  if(new URL(req.url).origin !== self.location.origin) return;

  if(isHtml(req)){
    // ネットワーク優先（新しい版をすぐ反映）／失敗したらキャッシュ
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(hit){
          return hit || caches.match('./index_2.html');
        });
      })
    );
    return;
  }

  // それ以外はキャッシュ優先
  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && res.status === 200 && res.type === 'basic'){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
