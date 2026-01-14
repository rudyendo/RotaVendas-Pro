
export interface Client {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  whatsapp: string;
  phone?: string;
  info?: string;
  lat?: number;
  lng?: number;
}

export interface RouteStop extends Client {
  stopOrder: number;
  distanceFromPrev?: number;
}

export interface OptimizationResult {
  orderedClients: RouteStop[];
  totalDistanceEstimate: number;
}

export enum AppStep {
  DATABASE = 'DATABASE',
  PLANNER = 'PLANNER',
  ROUTE = 'ROUTE'
}
