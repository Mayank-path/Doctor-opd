import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/errors/api_exception.dart';

void main() {
  group('ApiException Parsing Tests', () {
    test('parses 400 Bad Request with single string message', () {
      final json = {
        'statusCode': 400,
        'message': 'startTime must be after now',
        'error': 'Bad Request',
      };

      final exception = ApiException.fromResponse(400, json);

      expect(exception, isA<BadRequestException>());
      expect(exception.message, 'startTime must be after now');
      expect(exception.statusCode, 400);
    });

    test('parses 400 validation error with array of messages from class-validator', () {
      final json = {
        'statusCode': 400,
        'message': [
          'A valid email address is required',
          'Password cannot be empty',
        ],
        'error': 'Bad Request',
      };

      final exception = ApiException.fromResponse(400, json);

      expect(exception, isA<BadRequestException>());
      expect(exception.message, 'A valid email address is required');
      expect(exception.details.length, 2);
      expect(exception.details[1], 'Password cannot be empty');
    });

    test('parses 401 Unauthorized for invalid credentials', () {
      final json = {
        'statusCode': 401,
        'message': 'Invalid email or password',
        'error': 'Unauthorized',
      };

      final exception = ApiException.fromResponse(401, json);

      expect(exception, isA<UnauthorizedException>());
      expect(exception.message, 'Invalid email or password');
      expect(exception.statusCode, 401);
    });

    test('parses 403 Forbidden for missing clinic membership', () {
      final json = {
        'statusCode': 403,
        'message': 'Access denied: user is not a member of the requested clinic',
        'error': 'Forbidden',
      };

      final exception = ApiException.fromResponse(403, json);

      expect(exception, isA<ForbiddenException>());
      expect(exception.message, contains('Access denied'));
    });

    test('parses 409 Conflict', () {
      final json = {
        'statusCode': 409,
        'message': 'Cannot modify a finalized consultation',
        'error': 'Conflict',
      };

      final exception = ApiException.fromResponse(409, json);

      expect(exception, isA<ConflictException>());
      expect(exception.message, 'Cannot modify a finalized consultation');
    });

    test('parses 429 Rate Limited', () {
      final exception = ApiException.fromResponse(429, {'statusCode': 429});

      expect(exception, isA<RateLimitedException>());
      expect(exception.statusCode, 429);
    });

    test('parses 500 Server Error safely without leaking internals', () {
      final exception = ApiException.fromResponse(500, {
        'statusCode': 500,
        'message': 'Internal database query failure details',
      });

      expect(exception, isA<ServerException>());
      expect(exception.statusCode, 500);
      expect(exception.message, 'Server error encountered. Please try again later.');
    });

    test('creates NetworkException on connection failure', () {
      final exception = ApiException.networkError();

      expect(exception, isA<NetworkException>());
      expect(exception.statusCode, isNull);
      expect(exception.message, contains('Unable to connect'));
    });

    test('creates NetworkException on timeout', () {
      final exception = ApiException.timeout();

      expect(exception, isA<NetworkException>());
      expect(exception.message, contains('timed out'));
    });
  });
}
