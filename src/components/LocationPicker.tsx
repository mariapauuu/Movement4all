import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { LOCATION_PRESETS } from '../shared/sports.ts';
import type { LocationPreset } from '../shared/types.ts';

interface LocationPickerProps {
  lat: number;
  lng: number;
  label?: string;
  readOnly?: boolean;
  heightClass?: string;
  onChange?: (next: {
    lat: number;
    lng: number;
    label?: string;
    municipality?: string;
  }) => void;
}

function createPinIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:9999px;background:#FF5A1F;border:3px solid #151515;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function LocationPicker({
  lat,
  lng,
  label,
  readOnly = false,
  heightClass = 'h-64',
  onChange,
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const initialLat = Number.isFinite(lat) ? lat : 6.2442;
    const initialLng = Number.isFinite(lng) ? lng : -75.5812;

    const map = L.map(el, {
      center: [initialLat, initialLng],
      zoom: readOnly ? 14 : 12,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], {
      draggable: !readOnly,
      icon: createPinIcon(),
    }).addTo(map);

    if (!readOnly) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const nextLat = Number(e.latlng.lat.toFixed(5));
        const nextLng = Number(e.latlng.lng.toFixed(5));
        marker.setLatLng([nextLat, nextLng]);
        onChangeRef.current?.({ lat: nextLat, lng: nextLng });
      });

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        const nextLat = Number(pos.lat.toFixed(5));
        const nextLng = Number(pos.lng.toFixed(5));
        onChangeRef.current?.({ lat: nextLat, lng: nextLng });
      });
    }

    mapRef.current = map;
    markerRef.current = marker;

    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [readOnly]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    marker.setLatLng([lat, lng]);
    map.panTo([lat, lng], { animate: true });
  }, [lat, lng]);

  const handlePresetClick = (preset: LocationPreset) => {
    if (readOnly || !onChange) return;
    onChange({
      lat: preset.lat,
      lng: preset.lng,
      label: preset.label,
      municipality: preset.municipality,
    });
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div>
          <p className="text-xs font-medium text-[#151515]/70 mb-2">
            Puntos sugeridos (haz clic en el mapa o arrastra el marcador para ajustar):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {LOCATION_PRESETS.map((preset) => {
              const active =
                Math.abs(preset.lat - lat) < 0.002 && Math.abs(preset.lng - lng) < 0.002;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`px-2.5 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#151515] text-[#F6F5F1] border-[#151515]'
                      : 'bg-[#F6F5F1] text-[#151515] border-[#E6E4DF] hover:border-[#151515]'
                  }`}
                >
                  {preset.municipality}: {preset.label.split(',')[0]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className={`w-full ${heightClass} border border-[#E6E4DF] bg-[#E6E4DF]/40 overflow-hidden`}
        aria-label={label ? `Mapa de ubicación: ${label}` : 'Mapa interactivo de ubicación'}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#151515]/75">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#FF5A1F]" aria-hidden="true" />
          <span>{label || 'Punto seleccionado en el mapa'}</span>
        </span>
        <span className="font-mono tabular-nums">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </span>
      </div>
    </div>
  );
}
