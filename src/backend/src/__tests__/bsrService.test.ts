// ---------------------------------------------------------------------------  
// bsrService.test.ts — Tests for BSR (Berliner Stadtreinigung) adapter
//
// Test-Strategy:
//   - Constructor DI: new BsrService(mockHttp)
//   - Realistische Mock-Daten für Berlin Adressen
//   - KEIN jest.mock('axios') (per AGENTS.md Mock-Policy)
// ---------------------------------------------------------------------------

import type { AxiosInstance } from 'axios';
import { BsrService } from '../services/bsrService';

// Test fixtures
const BERLIN_ADDRESS = {
  AddrKey: 'abc123def456ghi789jkl012',
  PLZ: '10115',
  Strasse: 'Unter den Linden',
  Hausnr: '1',
};

const BSR_ICS_DATA = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BSR//Abfallkalender 1.0//DE
BEGIN:VEVENT
SUMMARY:Restmüll
DTSTART:20260815T060000
DTEND:20260815T070000
CATEGORIES:HM
END:VEVENT
BEGIN:VEVENT
SUMMARY:Biogut
DTSTART:20260817T060000
DTEND:20260817T070000
CATEGORIES:BI
END:VEVENT
END:VCALENDAR`;

const BSR_REST_DATA = [
  {
    AddrKey: 'abc123def456ghi789jkl012',
    DateFrom: '2026-08-15T06:00:00',
    DateTo: '2026-08-15T07:00:00',
    category: 'HM',
  },
  {
    AddrKey: 'abc123def456ghi789jkl012',
    DateFrom: '2026-08-17T06:00:00',
    DateTo: '2026-08-17T07:00:00',
    category: 'BI',
  },
];

// Mock HTTP
let mockHttp: jest.Mocked<AxiosInstance>;
let service: BsrService;

beforeEach(() => {
  mockHttp = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<AxiosInstance>;
  service = new BsrService(mockHttp);
});

describe('BSR Service — Schedule ID Lookup', () => {
  it('should find schedule_id from BSR website', async () => {
    mockHttp.get.mockResolvedValueOnce({ data: '<html>schedule_id/abc123def456ghi789jkl012</html>' });

    const result = await service.findScheduleId('Unter den Linden', '1');
    
    expect(result).not.toBeNull();
    expect(result).toBe('abc123def456ghi789jkl012');
  });

  it('should return null if schedule_id not found', async () => {
    mockHttp.get.mockResolvedValueOnce({ data: '<html>No schedule_id here</html>' });

    const result = await service.findScheduleId('Nicht existierende Str', '999');
    
    expect(result).toBeNull();
  });

  it('should handle API errors gracefully', async () => {
    mockHttp.get.mockRejectedValueOnce(new Error('Network error'));

    const result = await service.findScheduleId('Unter den Linden', '1');
    
    expect(result).toBeNull();
  });
});

describe('BSR Service — iCal Calendar', () => {
  it('should fetch calendar via iCal feed', async () => {
    mockHttp.get.mockResolvedValueOnce({ data: BSR_ICS_DATA });

    const events = await service.fetchCalendarViaIcal('abc123def456ghi789jkl012', 2026, 8);
    
    expect(events).toHaveLength(2);
    expect(events[0].summary).toBe('Restmüll');
    expect(events[1].summary).toBe('Biogut');
  });

  it('should return empty array on iCal fetch failure', async () => {
    mockHttp.get.mockRejectedValueOnce(new Error('Timeout'));

    const events = await service.fetchCalendarViaIcal('abc123def456ghi789jkl012', 2026, 8);
    
    expect(events).toHaveLength(0);
  });
});

describe('BSR Service — REST Calendar', () => {
  it('should fetch calendar via REST API', async () => {
    mockHttp.get.mockResolvedValueOnce({ data: BSR_REST_DATA });

    const events = await service.fetchCalendarViaRest('abc123def456ghi789jkl012', 2026, 8);
    
    expect(events).toHaveLength(2);
    expect(events[0].summary).toBe('Hausmüll');
    expect(events[1].summary).toBe('Biogut');
  });

  it('should return empty array on REST fetch failure', async () => {
    mockHttp.get.mockRejectedValueOnce(new Error('Timeout'));

    const events = await service.fetchCalendarViaRest('abc123def456ghi789jkl012', 2026, 8);
    
    expect(events).toHaveLength(0);
  });

  it('should handle non-array response gracefully', async () => {
    mockHttp.get.mockResolvedValueOnce({ data: { error: 'invalid' } });

    const events = await service.fetchCalendarViaRest('abc123def456ghi789jkl012', 2026, 8);
    
    expect(events).toHaveLength(0);
  });
});

describe('BSR Service — Full Flow', () => {
  it('should fetch complete calendar with schedule_id', async () => {
    // Mock iCal fetch (first attempt)
    mockHttp.get.mockResolvedValueOnce({ data: BSR_ICS_DATA });

    const result = await service.fetchCalendar('abc123def456ghi789jkl012', 4);
    
    expect(result.addrKey).toBe('abc123def456ghi789jkl012');
    expect(result.events).toHaveLength(2);
    expect(result.source).toContain('BSR');
  });

  it('should throw error if schedule_id is invalid', async () => {
    await expect(
      service.fetchCalendar('short', 4)
    ).rejects.toThrow('Ungültige BSR schedule_id');
  });

  it('should try next month if current month empty', async () => {
    // Mock iCal fetch for current month (empty)
    mockHttp.get.mockResolvedValueOnce({ data: 'BEGIN:VCALENDAR\nEND:VCALENDAR' });
    // Mock iCal fetch for next month (with data)
    mockHttp.get.mockResolvedValueOnce({ data: BSR_ICS_DATA });

    const result = await service.fetchCalendar('abc123def456ghi789jkl012', 4);
    
    expect(result.events).toHaveLength(2);
  });
});
