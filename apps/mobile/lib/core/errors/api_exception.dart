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

  factory ApiException.networkError([String? customMessage]) {
    return NetworkException(
      message: customMessage ??
          'Unable to connect to the clinic server. Please check your network connection.',
    );
  }

  factory ApiException.timeout() {
    return NetworkException(
      message: 'Connection timed out. The clinic server is taking too long to respond.',
    );
  }

  @override
  String toString() => message;
}

class BadRequestException extends ApiException {
  const BadRequestException({
    required super.message,
    super.details = const [],
  }) : super(statusCode: 400, error: 'Bad Request');
}

class UnauthorizedException extends ApiException {
  const UnauthorizedException({
    super.message = 'Authentication required or invalid credentials',
  }) : super(statusCode: 401, error: 'Unauthorized');
}

class ForbiddenException extends ApiException {
  const ForbiddenException({
    super.message = 'You do not have permission to access this clinic resource',
  }) : super(statusCode: 403, error: 'Forbidden');
}

class NotFoundException extends ApiException {
  const NotFoundException({
    super.message = 'The requested clinic resource was not found',
  }) : super(statusCode: 404, error: 'Not Found');
}

class ConflictException extends ApiException {
  const ConflictException({
    super.message = 'Conflict with the current state of the resource',
  }) : super(statusCode: 409, error: 'Conflict');
}

class UnprocessableEntityException extends ApiException {
  const UnprocessableEntityException({
    required super.message,
    super.details = const [],
  }) : super(statusCode: 422, error: 'Unprocessable Entity');
}

class RateLimitedException extends ApiException {
  const RateLimitedException({
    super.message = 'Rate limit exceeded. Please wait before retrying.',
  }) : super(statusCode: 429, error: 'Too Many Requests');
}

class ServerException extends ApiException {
  const ServerException({
    super.message = 'Internal server error occurred',
    super.statusCode = 500,
  }) : super(error: 'Internal Server Error');
}

class NetworkException extends ApiException {
  const NetworkException({required super.message}) : super(statusCode: null);
}
