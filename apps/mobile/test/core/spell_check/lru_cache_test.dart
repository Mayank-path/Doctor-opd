import 'package:flutter_test/flutter_test.dart';
import 'package:doctor_opd_mobile/core/spell_check/engine/lru_cache.dart';

void main() {
  group('LruCache Unit Tests', () {
    test('inserts and retrieves items correctly', () {
      final cache = LruCache<String, int>(capacity: 3);
      cache.put('a', 1);
      cache.put('b', 2);

      expect(cache.length, equals(2));
      expect(cache.get('a'), equals(1));
      expect(cache.get('b'), equals(2));
      expect(cache.get('c'), isNull);
    });

    test('updates value for existing key without increasing size', () {
      final cache = LruCache<String, String>(capacity: 3);
      cache.put('key', 'first');
      cache.put('key', 'second');

      expect(cache.length, equals(1));
      expect(cache.get('key'), equals('second'));
    });

    test('evicts least recently used item when capacity is exceeded', () {
      final cache = LruCache<String, int>(capacity: 3);
      cache.put('a', 1);
      cache.put('b', 2);
      cache.put('c', 3);

      expect(cache.length, equals(3));

      // Access 'a' so 'b' becomes least recently used
      cache.get('a');

      // Add 'd', which should evict 'b'
      cache.put('d', 4);

      expect(cache.length, equals(3));
      expect(cache.containsKey('b'), isFalse);
      expect(cache.get('b'), isNull);
      expect(cache.get('a'), equals(1));
      expect(cache.get('c'), equals(3));
      expect(cache.get('d'), equals(4));
    });

    test('updates access order on putIfAbsent hit', () {
      final cache = LruCache<String, String>(capacity: 2);
      cache.put('x', '1');
      cache.put('y', '2');

      // Access 'x' via putIfAbsent
      final val = cache.putIfAbsent('x', () => 'computed_x');
      expect(val, equals('1'));

      // Add 'z', should evict 'y' (not 'x')
      cache.put('z', '3');

      expect(cache.containsKey('y'), isFalse);
      expect(cache.containsKey('x'), isTrue);
      expect(cache.containsKey('z'), isTrue);
    });

    test('respects configured maximum capacity strictly', () {
      const cap = 500;
      final cache = LruCache<int, int>(capacity: cap);

      for (var i = 0; i < 1500; i++) {
        cache.put(i, i * 10);
      }

      expect(cache.length, equals(cap));
      // First 1000 items must have been evicted
      for (var i = 0; i < 1000; i++) {
        expect(cache.containsKey(i), isFalse);
      }
      // Last 500 items must remain
      for (var i = 1000; i < 1500; i++) {
        expect(cache.get(i), equals(i * 10));
      }
    });

    test('clears all cached entries on clear()', () {
      final cache = LruCache<String, bool>(capacity: 10);
      cache.put('w1', true);
      cache.put('w2', false);

      expect(cache.isNotEmpty, isTrue);
      cache.clear();
      expect(cache.isEmpty, isTrue);
      expect(cache.length, equals(0));
      expect(cache.get('w1'), isNull);
    });

    test('simulates prolonged consultation sessions with bounded memory', () {
      final cache = LruCache<String, List<String>>(capacity: 500);

      // Simulate 5,000 spelling lookup operations over a long day of consultations
      for (var i = 0; i < 5000; i++) {
        final word = 'typo_$i';
        cache.putIfAbsent(word, () => ['correction_$i']);
      }

      expect(cache.length, equals(500));
      expect(cache.length, lessThanOrEqualTo(500));
      // Most recent entries are retained
      expect(cache.get('typo_4999'), equals(['correction_4999']));
      // Old entries from earlier consultations are safely evicted
      expect(cache.get('typo_0'), isNull);
      expect(cache.get('typo_100'), isNull);
    });
  });
}

