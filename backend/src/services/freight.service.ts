import { env } from '../config/env';
import { onlyDigits } from '../lib/cnpj';
import { round2 } from '../lib/money';
import type { DeliveryAddress, Freight, FreightZone } from '../types/domain';

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in km multiplied by 1.28 road-winding factor. */
export function estimateRoadDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return round2(R * c * 1.28);
}

function classifyCepZone(cepDigits: string, state?: string): { zone: FreightZone; estimatedKm: number } {
  const uf = (state ?? '').toUpperCase();
  if (cepDigits.length === 8) {
    const prefix2 = Number.parseInt(cepDigits.slice(0, 2), 10);
    // 01..05 = São Paulo capital (urban), 06..09 = Greater SP (metro), 11..19 = SP interior (regional)
    if (prefix2 >= 1 && prefix2 <= 5) return { zone: 'URBAN', estimatedKm: 12 };
    if (prefix2 >= 6 && prefix2 <= 9) return { zone: 'METRO', estimatedKm: 28 };
    if (prefix2 >= 11 && prefix2 <= 19) return { zone: 'REGIONAL', estimatedKm: 85 };
  }
  if (uf === 'SP') return { zone: 'METRO', estimatedKm: 25 };
  if (['RJ', 'MG', 'PR'].includes(uf)) return { zone: 'REGIONAL', estimatedKm: 120 };
  if (cepDigits.length === 0 && !uf) return { zone: 'URBAN', estimatedKm: 12 };
  return { zone: 'EXTENDED', estimatedKm: 180 };
}

function zoneFromDistance(km: number): FreightZone {
  if (km <= 18) return 'URBAN';
  if (km <= 45) return 'METRO';
  if (km <= 120) return 'REGIONAL';
  return 'EXTENDED';
}

export class FreightService {
  calculate(address: Partial<DeliveryAddress> | undefined, _totalUnits: number): Freight {
    // Frete eliminado da conta de valores das diárias (sempre R$ 0,00).
    // Zone e distanceKm são preservados para logística de rota da equipe de entrega.
    if (
      address &&
      typeof address.latitude === 'number' &&
      typeof address.longitude === 'number' &&
      Number.isFinite(address.latitude) &&
      Number.isFinite(address.longitude)
    ) {
      const distanceKm = estimateRoadDistanceKm(
        env.DEPOT_LATITUDE,
        env.DEPOT_LONGITUDE,
        address.latitude,
        address.longitude,
      );
      const zone = zoneFromDistance(distanceKm);
      return { amount: 0, distanceKm, zone };
    }

    const cepDigits = onlyDigits(address?.cep ?? '');
    const { zone, estimatedKm } = classifyCepZone(cepDigits, address?.state);
    return {
      amount: 0,
      distanceKm: cepDigits.length === 8 ? estimatedKm : null,
      zone,
    };
  }
}

export const freightService = new FreightService();
