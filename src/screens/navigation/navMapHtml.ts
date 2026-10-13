import { colors } from "@/theme";

/**
 * The map page for turn-by-turn navigation: Leaflet + OpenStreetMap tiles in a WebView, like the
 * live map, but built once and updated through small functions the app calls with
 * `injectJavaScript` (setPosition, setRoute, setDestination, setOthers, recenter), so the page is
 * never reloaded while the worker moves. The page tells the app when the worker drags the map away
 * from their position ("unfollow") and when it has loaded ("ready").
 */
export const NAV_MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: ${colors.panelDarker}; }
    .leaflet-control-attribution { font-size: 9px; }
    .num { width: 24px; height: 24px; border-radius: 50%; color: #fff; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4);
      display: flex; align-items: center; justify-content: center; font: 600 11px/1 sans-serif; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var me = null, casing = null, line = null, dest = null, others = [];
    var follow = true, zoomed = false, lastPos = null;

    function post(o) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }

    function meIcon(h) {
      return L.divIcon({
        className: '',
        html: '<div style="width:38px;height:38px;transform:rotate(' + (h || 0) + 'deg)"><svg viewBox="0 0 24 24" width="38" height="38">' +
          '<circle cx="12" cy="12" r="11" fill="rgba(239,108,0,.18)"/>' +
          '<path d="M12 3 L18.5 19 L12 15.5 L5.5 19 Z" fill="${colors.primary}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div>',
        iconSize: [38, 38], iconAnchor: [19, 19]
      });
    }
    function numIcon(n, color) {
      return L.divIcon({ className: '', html: '<div class="num" style="background:' + color + '">' + n + '</div>', iconSize: [24, 24], iconAnchor: [12, 12] });
    }

    window.setPosition = function (lat, lng, heading) {
      lastPos = [lat, lng];
      if (!me) { me = L.marker(lastPos, { icon: meIcon(heading), zIndexOffset: 1000, interactive: false }).addTo(map); }
      else { me.setLatLng(lastPos); if (heading !== null && heading !== undefined) me.setIcon(meIcon(heading)); }
      if (follow) {
        if (!zoomed) { map.setView(lastPos, 17, { animate: false }); zoomed = true; }
        else { map.panTo(lastPos, { animate: true, duration: 0.6 }); }
      }
    };
    window.setRoute = function (coords, fit) {
      if (casing) { map.removeLayer(casing); casing = null; }
      if (line) { map.removeLayer(line); line = null; }
      if (!coords || coords.length < 2) return;
      casing = L.polyline(coords, { color: '#ffffff', weight: 9, opacity: 0.9 }).addTo(map);
      line = L.polyline(coords, { color: '${colors.primary}', weight: 5, opacity: 0.95 }).addTo(map);
      if (fit && !zoomed) { map.fitBounds(line.getBounds(), { padding: [60, 60] }); }
    };
    window.setDestination = function (lat, lng, n) {
      if (dest) { map.removeLayer(dest); dest = null; }
      if (lat === null || lat === undefined) return;
      dest = L.marker([lat, lng], { icon: numIcon(n, '${colors.primaryDark}'), zIndexOffset: 900, interactive: false }).addTo(map);
    };
    window.setOthers = function (list) {
      others.forEach(function (m) { map.removeLayer(m); });
      others = (list || []).map(function (p) {
        return L.marker([p.lat, p.lng], { icon: numIcon(p.n, '#8a8a8a'), interactive: false }).addTo(map);
      });
    };
    window.recenter = function () {
      follow = true;
      if (lastPos) map.setView(lastPos, Math.max(map.getZoom(), 16), { animate: true });
      post({ type: 'follow' });
    };
    map.on('dragstart', function () { if (follow) { follow = false; post({ type: 'unfollow' }); } });
    post({ type: 'ready' });
  </script>
</body>
</html>`;
