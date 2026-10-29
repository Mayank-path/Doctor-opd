import 'dart:convert';

/// Centralized API Exception definitions
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final String? error;
  final List<String> details;

  const ApiException({
    required this.message,
    this.statusCode,
    this.error,
    this.details = const [],
  });

  /// Factory to parse NestJS standard JSON error responses:
  /// `{ "statusCode": 400, "message": "...", "error": "Bad Request" }`
  /// or validation array:
  /// `{ "statusCode": 400, "message": ["email is required", "..."], "error": "Bad Request" }`
  factory ApiException.fromResponse(int? statusCode, dynamic responseData) {
    String message = 'An unexpected error occurred';
    String? error;
    List<String> details = [];

    if (responseData is List<int>) {
      try {
        final decoded = utf8.decode(responseData);
        final parsed = jsonDecode(decoded);
        if (parsed is Map<String, dynamic>) {
          responseData = parsed;
        } else {
          responseData = decoded;
        }
      } catch (_) {
        // Not a JSON error string
      }
    }

    if (responseData is Map<String, dynamic>) {
      error = responseData['error']?.toString();
      final rawMessage = responseData['message'];

      if (rawMessage is List) {
        details = rawMessage.map((e) => e.toString()).toList();
        message = details.isNotEmpty ? details.first : 'Validation error';
      } else if (rawMessage != null) {
        message = rawMessage.toString();
      }
    } else if (responseData is String && responseData.isNotEmpty) {
      message = responseData;
    }

    switch (statusCode) {
      case 400:
        return BadRequestException(message: message, details: details);
      case 401:
        return UnauthorizedException(message: message);
      case 403:
        return ForbiddenException(message: message);
      case 404:
        return NotFoundException(message: message);
      case 409:
        return ConflictException(message: message);
      case 422:
        return UnprocessableEntityException(
          message: message,
          details: details,
        );
      case 429:
        return RateLimitedException(
          message: 'Too many requests. Please try again in a few moments.',
        );
      case 500:
      case 502:
      case 503:
      case 504:
        return ServerException(
          message: 'Server error encountered. Please try again later.',
          statusCode: statusCode,
        );
      default:
        return ApiException(
          message: message,
          statusCode: statusCode,
          error: error,
          details: details,
        );
    }
  }

  /// Convenience factory for timeout exceptions
  factory ApiException.timeout([String? message]) {
    return NetworkException(
      message: message ?? 'Request timed out. Please check your connection.',
    );
  }

  /// Convenience factory for network/connectivity exceptions
  factory ApiException.networkError([String? message]) {
    return NetworkException(
      message: message ?? 'Unable to connect to the server. Check your network.',
    );
  }

  @override
  String toString() {
    if (details.isNotEmpty) {
      return '$message (${details.join(', ')})';
    }
    return message;
  }
}

/// 400 Bad Request — Validation or client request format failure
class BadRequestException extends ApiException {
  const BadRequestException({
    required super.message,
    super.details,
  }) : super(statusCode: 400, error: 'Bad Request');
}

/// 401 Unauthorized — Missing, expired, or invalid JWT
class UnauthorizedException extends ApiException {
  const UnauthorizedException({
    required super.message,
  }) : super(statusCode: 401, error: 'Unauthorized');
}

/// 403 Forbidden — Valid JWT, but unauthorized for target clinic or role
class ForbiddenException extends ApiException {
  const ForbiddenException({
    required super.message,
  }) : super(statusCode: 403, error: 'Forbidden');
}

/// 404 Not Found — Resource does not exist within active clinic
class NotFoundException extends ApiException {
  const NotFoundException({
    required super.message,
  }) : super(statusCode: 404, error: 'Not Found');
}

/// 409 Conflict — Business rule violation (e.g. duplicate token, immutable consultation)
class ConflictException extends ApiException {
  const ConflictException({
    required super.message,
  }) : super(statusCode: 409, error: 'Conflict');
}

/// 422 Unprocessable Entity — Syntactically correct but semantically invalid
class UnprocessableEntityException extends ApiException {
  const UnprocessableEntityException({
    required super.message,
    super.details,
  }) : super(statusCode: 422, error: 'Unprocessable Entity');
}

/// 429 Too Many Requests — Throttling limit exceeded
class RateLimitedException extends ApiException {
  const RateLimitedException({
    required super.message,
  }) : super(statusCode: 429, error: 'Too Many Requests');
}

/// 500/502/503/504 Server-side error
class ServerException extends ApiException {
  const ServerException({
    required super.message,
    super.statusCode = 500,
  }) : super(error: 'Internal Server Error');
}

/// Network connectivity, socket, or timeout failure
class NetworkException extends ApiException {
  const NetworkException({
    required super.message,
  });
}
