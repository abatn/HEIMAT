import 'package:flutter_test/flutter_test.dart';
import 'package:heimat_app/features/air_quality/air_quality_dto.dart';

void main() {
  group('CurrentAirQualityDto', () {
    test('parses full JSON correctly', () {
      final json = {
        'europeanAqi': 25.0,
        'pm10': 15.2,
        'pm25': 8.5,
        'nitrogenDioxide': 12.3,
        'ozone': 85.2,
        'carbonMonoxide': 0.3,
        'sulphurDioxide': 2.1,
        'aqiLevel': 'Gut',
        'aqiColor': '#3ea83e',
      };
      final dto = CurrentAirQualityDto.fromJson(json);
      expect(dto.europeanAqi, 25.0);
      expect(dto.pm10, 15.2);
      expect(dto.pm25, 8.5);
      expect(dto.nitrogenDioxide, 12.3);
      expect(dto.ozone, 85.2);
      expect(dto.carbonMonoxide, 0.3);
      expect(dto.sulphurDioxide, 2.1);
      expect(dto.aqiLevel, 'Gut');
      expect(dto.aqiColor, '#3ea83e');
    });

    test('handles null values gracefully', () {
      final json = <String, dynamic>{
        'aqiLevel': 'Unbekannt',
        'aqiColor': '#888',
      };
      final dto = CurrentAirQualityDto.fromJson(json);
      expect(dto.europeanAqi, isNull);
      expect(dto.pm10, isNull);
      expect(dto.pm25, isNull);
      expect(dto.nitrogenDioxide, isNull);
      expect(dto.ozone, isNull);
      expect(dto.carbonMonoxide, isNull);
      expect(dto.sulphurDioxide, isNull);
      expect(dto.aqiLevel, 'Unbekannt');
      expect(dto.aqiColor, '#888');
    });

    test('handles integer values (not double) from JSON', () {
      final json = {
        'europeanAqi': 42,
        'pm10': 20,
        'pm25': 12,
        'nitrogenDioxide': 15,
        'ozone': 90,
        'carbonMonoxide': 1,
        'sulphurDioxide': 3,
        'aqiLevel': 'Mäßig',
        'aqiColor': '#a8a83e',
      };
      final dto = CurrentAirQualityDto.fromJson(json);
      expect(dto.europeanAqi, 42.0);
      expect(dto.pm10, 20.0);
      expect(dto.aqiLevel, 'Mäßig');
    });
  });

  group('HourlyAirQualityDto', () {
    test('parses hourly entry correctly', () {
      final json = {
        'time': '2026-07-27T14:00',
        'europeanAqi': 30.0,
        'pm10': 18.0,
        'pm25': 10.0,
        'nitrogenDioxide': 14.0,
        'ozone': 80.0,
      };
      final dto = HourlyAirQualityDto.fromJson(json);
      expect(dto.time, '2026-07-27T14:00');
      expect(dto.europeanAqi, 30.0);
      expect(dto.pm10, 18.0);
      expect(dto.pm25, 10.0);
      expect(dto.nitrogenDioxide, 14.0);
      expect(dto.ozone, 80.0);
    });

    test('handles null hourly values', () {
      final json = {'time': '2026-07-27T15:00'};
      final dto = HourlyAirQualityDto.fromJson(json);
      expect(dto.europeanAqi, isNull);
      expect(dto.pm10, isNull);
    });
  });

  group('AirQualityForecastResponse', () {
    test('parses full forecast response correctly', () {
      final json = {
        'status': 'ok',
        'current': {
          'europeanAqi': 25.0,
          'pm10': 15.2,
          'pm25': 8.5,
          'nitrogenDioxide': 12.3,
          'ozone': 85.2,
          'carbonMonoxide': 0.3,
          'sulphurDioxide': 2.1,
          'aqiLevel': 'Gut',
          'aqiColor': '#3ea83e',
        },
        'hourly': [
          {
            'time': '2026-07-27T14:00',
            'europeanAqi': 30.0,
            'pm10': 18.0,
            'pm25': 10.0,
            'nitrogenDioxide': 14.0,
            'ozone': 80.0,
          },
          {
            'time': '2026-07-27T15:00',
            'europeanAqi': 28.0,
            'pm10': 16.0,
            'pm25': 9.0,
            'nitrogenDioxide': 13.0,
            'ozone': 82.0,
          },
        ],
        'location': {
          'lat': 52.52,
          'lng': 13.41,
          'name': 'Berlin',
        },
        'source':
            'Copernicus Atmosphere Monitoring Service (CAMS) via Open-Meteo',
      };
      final resp = AirQualityForecastResponse.fromJson(json);
      expect(resp.status, 'ok');
      expect(resp.current.europeanAqi, 25.0);
      expect(resp.hourly.length, 2);
      expect(resp.hourly[0].europeanAqi, 30.0);
      expect(resp.location.name, 'Berlin');
      expect(resp.source, contains('Copernicus'));
    });

    test('handles empty hourly list', () {
      final json = {
        'status': 'ok',
        'current': {
          'aqiLevel': 'Gut',
          'aqiColor': '#3ea83e',
        },
        'hourly': [],
        'location': {
          'lat': 52.52,
          'lng': 13.41,
          'name': 'Berlin',
        },
        'source': 'test',
      };
      final resp = AirQualityForecastResponse.fromJson(json);
      expect(resp.hourly, isEmpty);
    });

    test('handles missing optional fields', () {
      final json = {
        'status': 'error',
        'current': {'aqiLevel': 'Unbekannt', 'aqiColor': '#888'},
        'location': {'lat': 0.0, 'lng': 0.0, 'name': ''},
      };
      final resp = AirQualityForecastResponse.fromJson(json);
      expect(resp.status, 'error');
      expect(resp.hourly, isEmpty);
      expect(resp.source, '');
    });
  });

  group('AirQualityLocationDto', () {
    test('parses location correctly', () {
      final json = {'lat': 52.52, 'lng': 13.41, 'name': 'Berlin'};
      final loc = AirQualityLocationDto.fromJson(json);
      expect(loc.lat, 52.52);
      expect(loc.lng, 13.41);
      expect(loc.name, 'Berlin');
    });

    test('handles integer lat/lng', () {
      final json = {'lat': 48, 'lng': 11, 'name': 'München'};
      final loc = AirQualityLocationDto.fromJson(json);
      expect(loc.lat, 48.0);
      expect(loc.lng, 11.0);
    });
  });
}
