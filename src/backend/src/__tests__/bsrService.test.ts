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

describe('BSR Service — Address Lookup', () => {
  it('should find address by PLZ, street, and house number', async () => {
    mockHttp.get.mockResolvedValueOnce({ data: [BERLIN_ADDRESS] });

    const result = await service.findAddress('10115', 'Unter den Linden', '1');
    
    expect(result).not.toBeNull();
    expect(result?.AddrKey).toBe('abc123def456ghi789jkl012');
    expect(result?.PLZ).toBe('10115');
    expect(result?.Strasse).toBe('Unter den Linden');
  });

  it('should return null if address not found', async () => {
    mockHttp.get.mockResolvedValueOnce({ data: [] });

    const result = await service.findAddress('10115', 'Nicht existierende Str', '999');
    
    expect(result).toBeNull();
  });

  it('should handle API errors gracefully', async () => {
    mockHttp.get.mockRejectedValueOnce(new Error('Network error'));

    const result = await service.findAddress('10115', 'Unter den Linden', '1');
    
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
  it('should fetch complete calendar for Berlin address', async () => {
    // Mock address lookup
    mockHttp.get.mockResolvedValueOnce({ data: [BERLIN_ADDRESS] });
    // Mock iCal fetch (first attempt)
    mockHttp.get.mockResolvedValueOnce({ data: BSR_ICS_DATA });

    const result = await service.fetchCalendar('10115', 'Unter den Linden', '1', 4);
    
    expect(result.addrKey).toBe('abc123def456ghi789jkl012');
    expect(result.street).toBe('Unter den Linden');
    expect(result.houseNr).toBe('1');
    expect(result.events).toHaveLength(2);
    expect(result.source).toContain('BSR');
  });

  it('should throw error if address not found', async () => {
    mockHttp.get.mockResolvedValueOnce({ data: [] });

    await expect(
      service.fetchCalendar('10115', 'Nicht existierende Str', '999', 4)
    ).rejects.toThrow('nicht bei BSR gefunden');
  });

  it('should try REST fallback if iCal returns empty', async () => {
    // Mock address lookup
    mockHttp.get.mockResolvedValueOnce({ data: [BERLIN_ADDRESS] });
    // Mock iCal fetch (empty)
    mockHttp.get.mockResolvedValueOnce({ data: 'BEGIN:VCALENDAR\nEND:VCALENDAR' });
    // Mock REST fetch
    mockHttp.get.mockResolvedValueOnce({ data: BSR_REST_DATA });

    const result = await service.fetchCalendar('10115', 'Unter den Linden', '1', 4);
    
    expect(result.events).toHaveLength(2);
  });

  it('should try next month if current month empty', async () => {
    // Mock address lookup
    mockHttp.get.mockResolvedValueOnce({ data: [BERLIN_ADDRESS] });
    // Mock iCal fetch for current month (empty)
    mockHttp.get.mockResolvedValueOnce({ data: 'BEGIN:VCALENDAR\nEND:VCALENDAR' });
    // Mock REST fetch for current month (empty)
    mockHttp.get.mockResolvedValueOnce({ data: [] });
    // Mock iCal fetch for next month (with data)
    mockHttp.get.mockResolvedValueOnce({ data: BSR_ICS_DATA });

    const result = await service.fetchCalendar('10115', 'Unter den Linden', '1', 4);
    
    expect(result.events).toHaveLength(2);
  });
});
