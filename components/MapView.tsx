
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Client } from '../types';

interface MapViewProps {
  clients: Client[];
  selectedClients: string[];
  onToggleClient: (id: string) => void;
  center?: [number, number];
}

// Default center set to Natal, Rio Grande do Norte
const NATAL_RN: [number, number] = [-5.79448, -35.211];

const MapView: React.FC<MapViewProps> = ({ clients, selectedClients, onToggleClient, center = NATAL_RN }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current).setView(center, 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clear old markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    const bounds = L.latLngBounds([]);

    clients.forEach((client) => {
      // Prioritize coordinates from the AI, fallback to simulated jitter around default center if missing
      const lat = client.lat || (center[0] + (Math.random() - 0.5) * 0.02);
      const lng = client.lng || (center[1] + (Math.random() - 0.5) * 0.02);

      const isSelected = selectedClients.includes(client.id);
      
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="flex items-center justify-center w-8 h-8 rounded-full border-2 ${isSelected ? 'bg-blue-600 border-white text-white' : 'bg-white border-blue-600 text-blue-600'} shadow-lg transform hover:scale-110 transition-transform duration-200">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });

      const marker = L.marker([lat, lng], { icon })
        .addTo(mapRef.current!)
        .bindPopup(`
          <div class="p-2 min-w-[150px]">
            <h3 class="font-bold text-sm text-slate-800">${client.name}</h3>
            <p class="text-xs text-slate-500 leading-tight mb-1">${client.address}</p>
            <p class="text-[10px] font-semibold text-blue-600 mb-2">${client.neighborhood}, ${client.city}</p>
            <button class="w-full bg-blue-600 text-white text-[10px] font-bold py-1.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              ${isSelected ? 'Desmarcar' : 'Selecionar para Rota'}
            </button>
          </div>
        `, { closeButton: false });

      marker.on('click', () => {
        onToggleClient(client.id);
      });

      markersRef.current.set(client.id, marker);
      bounds.extend([lat, lng]);
    });

    if (clients.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    } else {
      mapRef.current.setView(center, 12);
    }
  }, [clients, selectedClients, onToggleClient, center]);

  return <div ref={mapContainerRef} className="h-full w-full bg-slate-200" />;
};

export default MapView;
