import fs from 'fs';
import { loadGTFS, RaptorAlgorithmFactory, DepartAfterQuery, JourneyFactory } from 'raptor-journey-planner';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/error';

interface JourneyResult {
  departure: { time: string; stop: string };
  arrival: { time: string; stop: string };
  legs: unknown[];
}

class RaptorService {
  private static instance: RaptorService;
  private raptor: ReturnType<typeof RaptorAlgorithmFactory.create> | null = null;
  private initialized = false;
  private loading = false;

  private constructor() {}

  static getInstance(): RaptorService {
    if (!RaptorService.instance) {
      RaptorService.instance = new RaptorService();
    }
    return RaptorService.instance;
  }

  async initialize(gtfsPath: string): Promise<void> {
    if (this.initialized || this.loading) return;
    
    this.loading = true;
    logger.info('RAPTOR: Loading GTFS data...');
    
    try {
      const stream = fs.createReadStream(gtfsPath);
      const [trips, transfers, interchange] = await loadGTFS(stream);
      this.raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange);
      this.initialized = true;
      logger.info('RAPTOR: Initialized successfully');
    } catch (error: unknown) {
      logger.error(`RAPTOR: Initialization failed: ${errorMessage(error)}`);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async findJourneys(
    from: string,
    to: string,
    departureTime: Date,
  ): Promise<JourneyResult[]> {
    if (!this.initialized || !this.raptor) {
      throw new Error('RAPTOR not initialized');
    }
    
    const query = new DepartAfterQuery(this.raptor, new JourneyFactory());
    const journeys = query.plan(from, to, departureTime, 14 * 60 * 60);
    
    return journeys.slice(0, 3) as unknown as JourneyResult[];
  }

  isReady(): boolean {
    return this.initialized;
  }
}

export default RaptorService.getInstance();
