import { query } from '../config/database';

interface GtfsStop {
  stop_id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface GtfsRoute {
  route_id: string;
  short_name: string;
  long_name: string;
  route_type: number;
  route_color: string;
}

interface GtfsStopTime {
  trip_id: string;
  stop_id: string;
  arrival_time: string;
  departure_time: string;
  stop_sequence: number;
}

interface ImportStatus {
  tables: Record<string, number>;
  last_import: string | null;
  has_data: boolean;
}

class GtfsService {
  private static instance: GtfsService;

  static getInstance(): GtfsService {
    if (!GtfsService.instance) {
      GtfsService.instance = new GtfsService();
    }
    return GtfsService.instance;
  }

  async getStatus(): Promise<ImportStatus> {
    const tables = ['gtfs_stops', 'gtfs_routes', 'gtfs_trips', 'gtfs_stop_times', 'gtfs_calendar'];
    const counts: Record<string, number> = {};

    for (const table of tables) {
      try {
        const result = await query<{ c: number }>(`SELECT count(*)::int AS c FROM ${table}`);
        counts[table] = result[0]?.c ?? 0;
      } catch {
        counts[table] = -1;
      }
    }

    let lastImport: string | null = null;
    try {
      const status = await query<{ imported_at: string }>(
        'SELECT imported_at FROM gtfs_import_status ORDER BY imported_at DESC LIMIT 1'
      );
      if (status.length > 0) {
        lastImport = status[0].imported_at;
      }
    } catch {
    }

    const hasData = Object.values(counts).some(c => c > 0);

    return { tables: counts, last_import: lastImport, has_data: hasData };
  }

  async getStops(search?: string, limit = 50): Promise<GtfsStop[]> {
    if (search) {
      return query<GtfsStop>(
        `SELECT stop_id, name, latitude, longitude FROM gtfs_stops
         WHERE name ILIKE $1 ORDER BY name LIMIT $2`,
        [`%${search}%`, limit]
      );
    }
    return query<GtfsStop>(
      'SELECT stop_id, name, latitude, longitude FROM gtfs_stops ORDER BY name LIMIT $1',
      [limit]
    );
  }

  async getRoutes(routeType?: number): Promise<GtfsRoute[]> {
    if (routeType !== undefined) {
      return query<GtfsRoute>(
        'SELECT route_id, short_name, long_name, route_type, route_color FROM gtfs_routes WHERE route_type = $1 ORDER BY short_name',
        [routeType]
      );
    }
    return query<GtfsRoute>(
      'SELECT route_id, short_name, long_name, route_type, route_color FROM gtfs_routes ORDER BY short_name'
    );
  }

  async getDepartures(stopId: string, limit = 20): Promise<GtfsStopTime[]> {
    return query<GtfsStopTime>(
      `SELECT st.trip_id, st.stop_id, st.arrival_time, st.departure_time, st.stop_sequence
       FROM gtfs_stop_times st
       WHERE st.stop_id = $1
       ORDER BY st.departure_time LIMIT $2`,
      [stopId, limit]
    );
  }
}

export const gtfsService = GtfsService.getInstance();
