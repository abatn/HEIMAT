import axios from 'axios';
import { ParkingService } from '../services/parkingService';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ParkingService Unit Tests', () => {
  let service: ParkingService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ParkingService();
  });

  describe('getNearbySpots', () => {
    const mockOverpassResponse = {
      data: {
        elements: [
          {
            id: 12345,
            type: 'node' as const,
            lat: 52.521,
            lon: 13.406,
            tags: {
              name: 'Parkhaus Mitte',
              'amenity': 'parking',
              parking: 'multi-storey',
              access: 'public',
              fee: 'yes',
              capacity: '150',
              surface: 'concrete',
              lit: 'yes',
            },
          },
          {
            id: 12346,
            type: 'way' as const,
            center: { lat: 52.522, lon: 13.407 },
            tags: {
              name: 'Straßenparken',
              'amenity': 'parking',
              parking: 'surface',
              access: 'public',
              fee: 'no',
              surface: 'asphalt',
            },
          },
        ],
      },
    };

    it('should return mapped parking spots from Overpass', async () => {
      mockedAxios.post.mockResolvedValue(mockOverpassResponse);

      const spots = await service.getNearbySpots(52.52, 13.41, 2);

      expect(spots).toHaveLength(2);
      expect(spots[0]).toMatchObject({
        id: 'node/12345',
        osm_type: 'node',
        name: 'Parkhaus Mitte',
        parking_type: 'multi-storey',
        access: 'public',
        fee: 'yes',
        capacity: 150,
        surface: 'concrete',
        lit: 'yes',
        latitude: 52.521,
        longitude: 13.406,
        attribution: 'OpenStreetMap',
      });
      expect(spots[1]).toMatchObject({
        id: 'way/12346',
        osm_type: 'way',
        name: 'Straßenparken',
        parking_type: 'surface',
        fee: 'no',
        latitude: 52.522,
        longitude: 13.407,
      });
    });

    it('should skip elements without name', async () => {
      const responseNoName = {
        data: {
          elements: [
            {
              id: 99999,
              type: 'node' as const,
              lat: 52.52,
              lon: 13.41,
              tags: { 'amenity': 'parking' }, // no name
            },
          ],
        },
      };
      mockedAxios.post.mockResolvedValue(responseNoName);

      const spots = await service.getNearbySpots(52.52, 13.41, 2);
      expect(spots).toHaveLength(0);
    });

    it('should skip elements without coordinates', async () => {
      const responseNoCoords = {
        data: {
          elements: [
            {
              id: 88888,
              type: 'way' as const,
              tags: { name: 'Test', 'amenity': 'parking' },
              // no lat, no center
            },
          ],
        },
      };
      mockedAxios.post.mockResolvedValue(responseNoCoords);

      const spots = await service.getNearbySpots(52.52, 13.41, 2);
      expect(spots).toHaveLength(0);
    });

    it('should deduplicate spots by name+coordinates', async () => {
      const responseDuplicate = {
        data: {
          elements: [
            {
              id: 11111,
              type: 'node' as const,
              lat: 52.521,
              lon: 13.406,
              tags: { name: 'Parkhaus', 'amenity': 'parking' },
            },
            {
              id: 22222,
              type: 'way' as const,
              center: { lat: 52.521, lon: 13.406 },
              tags: { name: 'Parkhaus', 'amenity': 'parking' },
            },
          ],
        },
      };
      mockedAxios.post.mockResolvedValue(responseDuplicate);

      const spots = await service.getNearbySpots(52.52, 13.41, 2);
      expect(spots).toHaveLength(1);
    });

    it('should use fallback name from addr:street', async () => {
      const responseFallback = {
        data: {
          elements: [
            {
              id: 77777,
              type: 'node' as const,
              lat: 52.52,
              lon: 13.41,
              tags: {
                'amenity': 'parking',
                'addr:street': 'Friedrichstraße',
                'addr:housenumber': '42',
              },
            },
          ],
        },
      };
      mockedAxios.post.mockResolvedValue(responseFallback);

      const spots = await service.getNearbySpots(52.52, 13.41, 2);
      expect(spots).toHaveLength(1);
      expect(spots[0].name).toBe('Friedrichstraße 42');
    });

    it('should try multiple mirrors on failure', async () => {
      // Mirror 1 fails twice (2 retries), Mirror 2 succeeds on first try
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Mirror 1 down'))
        .mockRejectedValueOnce(new Error('Mirror 1 down retry'))
        .mockResolvedValueOnce(mockOverpassResponse);

      const spots = await service.getNearbySpots(52.52, 13.41, 2);
      expect(spots).toHaveLength(2);
      // At least 3 calls (2 retries + 1 success), possibly more with additional mirrors
      expect(mockedAxios.post.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should throw AppError when all mirrors fail', async () => {
      // Mock ALL mirrors to reject — use a catch-all mock
      mockedAxios.post.mockRejectedValue(new Error('All mirrors down'));

      await expect(service.getNearbySpots(52.52, 13.41, 2))
        .rejects.toThrow('Parkplatz-Dienst nicht verfuegbar');
    });

    it('should limit results to 50', async () => {
      const manyElements = Array.from({ length: 60 }, (_, i) => ({
        id: i,
        type: 'node' as const,
        lat: 52.52 + i * 0.001,
        lon: 13.41 + i * 0.001,
        tags: { name: `Parking ${i}`, 'amenity': 'parking' },
      }));
      mockedAxios.post.mockResolvedValue({ data: { elements: manyElements } });

      const spots = await service.getNearbySpots(52.52, 13.41, 5);
      expect(spots).toHaveLength(50);
    });

    it('should use cached results on second call', async () => {
      mockedAxios.post.mockResolvedValue(mockOverpassResponse);

      await service.getNearbySpots(52.52, 13.41, 2);
      await service.getNearbySpots(52.52, 13.41, 2);

      // Only one Overpass call, second from cache
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should respect capacity parsing', async () => {
      const responseCapacity = {
        data: {
          elements: [
            {
              id: 55555,
              type: 'node' as const,
              lat: 52.52,
              lon: 13.41,
              tags: {
                name: 'Großes Parkhaus',
                'amenity': 'parking',
                capacity: '500',
              },
            },
            {
              id: 55556,
              type: 'node' as const,
              lat: 52.53,
              lon: 13.42,
              tags: {
                name: 'Kleines Parkhaus',
                'amenity': 'parking',
                capacity: 'ungültig', // invalid capacity
              },
            },
          ],
        },
      };
      mockedAxios.post.mockResolvedValue(responseCapacity);

      const spots = await service.getNearbySpots(52.52, 13.41, 2);
      expect(spots[0].capacity).toBe(500);
      expect(spots[1].capacity).toBeUndefined();
    });
  });
});
