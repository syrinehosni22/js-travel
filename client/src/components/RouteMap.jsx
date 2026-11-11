import { useEffect, useRef, useState } from 'react';

/**
 * Carte du trajet d'une excursion (Leaflet + OpenStreetMap, sans clé API).
 * - Site : étapes numérotées et tracé, zoom à la molette désactivé pour ne pas gêner le défilement.
 * - Admin (editable) : clic sur la carte = nouvelle étape, repères déplaçables.
 * Leaflet n'est chargé que lorsque la carte s'affiche (n'alourdit pas le reste du site).
 */
export default function RouteMap({ stops = [], path, editable = false, onAdd, onMove, height = 380, label = 'Carte du trajet' }) {
  const box = useRef(null);
  const st = useRef({});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const cb = useRef({ onAdd, onMove });
  cb.current = { onAdd, onMove };

  // Création de la carte (une seule fois)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ default: L }] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
        if (!alive || !box.current) return;
        // Sur mobile, la carte du site ne capte pas le glissement du doigt (la page défile normalement)
        const map = L.map(box.current, { scrollWheelZoom: editable, dragging: editable || !L.Browser.mobile, zoomControl: true, attributionControl: true });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
        }).addTo(map);
        map.setView([34.6, 9.8], 6); // Tunisie
        if (editable) map.on('click', (ev) => cb.current.onAdd?.({ lat: +ev.latlng.lat.toFixed(5), lng: +ev.latlng.lng.toFixed(5) }));
        st.current = { L, map, layer: L.layerGroup().addTo(map), fitted: false };
        setReady(true);
      } catch { if (alive) setFailed(true); }
    })();
    return () => { alive = false; st.current.map?.remove(); st.current = {}; };
  }, [editable]);

  // Dessin des étapes et du tracé à chaque changement
  const key = JSON.stringify([stops.map((x) => [x.lat, x.lng, x.name]), path?.length]);
  useEffect(() => {
    const { L, map, layer } = st.current;
    if (!ready || !L) return;
    layer.clearLayers();
    const pts = stops.filter((x) => Number.isFinite(+x.lat) && Number.isFinite(+x.lng)).map((x) => [+x.lat, +x.lng]);
    const line = path?.length > 1 ? path : pts;
    if (line.length > 1) {
      L.polyline(line, { color: '#0B1529', weight: 7, opacity: 0.25 }).addTo(layer);
      L.polyline(line, { color: '#C9A227', weight: 4, opacity: 0.95, dashArray: path?.length > 1 ? null : '8 8' }).addTo(layer);
    }
    stops.forEach((x, i) => {
      if (!Number.isFinite(+x.lat) || !Number.isFinite(+x.lng)) return;
      const kind = i === 0 ? 'start' : i === stops.length - 1 ? 'end' : 'stop';
      const icon = L.divIcon({ className: '', html: `<span class="map-pin map-pin--${kind}">${i + 1}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] });
      const m = L.marker([+x.lat, +x.lng], { icon, draggable: editable, title: x.name || `Étape ${i + 1}`, keyboard: true }).addTo(layer);
      if (x.name) m.bindTooltip(x.name, { direction: 'top', offset: [0, -14] });
      if (editable) m.on('dragend', () => { const p = m.getLatLng(); cb.current.onMove?.(i, { lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5) }); });
    });
    // Cadrage : au premier affichage (site) ou à chaque ajout hors champ (admin)
    const all = line.length > 1 ? line : pts;
    if (all.length && (!st.current.fitted || !editable)) {
      if (all.length === 1) map.setView(all[0], 11); else map.fitBounds(all, { padding: [30, 30], maxZoom: 13 });
      st.current.fitted = true;
    }
  }, [ready, key, editable]); // eslint-disable-line

  return (
    <div className="route-map" style={{ height }}>
      <div ref={box} className="route-map__canvas" role="region" aria-label={label} />
      {!ready && !failed && <div className="route-map__msg">…</div>}
      {failed && <div className="route-map__msg">La carte n’a pas pu se charger.</div>}
    </div>
  );
}

/** Calcule un tracé routier entre les étapes (service public OSRM). Renvoie [[lat, lng], …] allégé. */
export async function roadPath(stops) {
  const coords = stops.map((x) => `${(+x.lng).toFixed(5)},${(+x.lat).toFixed(5)}`).join(';');
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
  if (!res.ok) throw new Error('route');
  const json = await res.json();
  const line = json.routes?.[0]?.geometry?.coordinates;
  if (!line?.length) throw new Error('route');
  const step = Math.max(1, Math.ceil(line.length / 800));   // 800 points max : léger à enregistrer
  const out = line.filter((_, i) => i % step === 0 || i === line.length - 1).map(([lng, lat]) => [+lat.toFixed(5), +lng.toFixed(5)]);
  return { path: out, km: Math.round((json.routes[0].distance || 0) / 1000), minutes: Math.round((json.routes[0].duration || 0) / 60) };
}

/** Recherche d'un lieu en Tunisie (OpenStreetMap Nominatim) */
export async function searchPlace(q) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=tn&accept-language=fr&q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('search');
  return (await res.json()).map((x) => ({ name: x.display_name.split(',').slice(0, 2).join(',').trim(), full: x.display_name, lat: +(+x.lat).toFixed(5), lng: +(+x.lon).toFixed(5) }));
}
