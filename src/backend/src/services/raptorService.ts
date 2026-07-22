import fs from 'fs';
import { loadGTFS, RaptorAlgorithmFactory, DepartAfterQuery, JourneyFactory } from 'raptor-journey-planner';
import { logger } from '../utils/logger';

class RaptorService {
  private static instance: RaptorService;
  private raptor: any = null;
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
    } catch (error: any) {
      logger.error('RAPTOR: Initialization failed', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async findJourneys(
    from: string,
    to: string,
    departureTime: Date,
    maxTransfers: number = 5
  ): Promise<any[]> {
    if (!this.initialized) {
      throw new Error('RAPTOR not initialized');
    }
    
    const query = new DepartAfterQuery(this.raptor, new JourneyFactory());
    const journeys = query.plan(from, to, departureTime, 14 * 60 * 60);
    
    return journeys.slice(0, 3);
  }

  isReady(): boolean {
    return this.initialized;
  }
}

export default RaptorService.getInstance();
