import 'dart:collection';

/// A bounded Least-Recently-Used (LRU) cache with O(1) lookups, insertions,
/// and evictions backed by [LinkedHashMap].
class LruCache<K, V> {
  final int capacity;
  final LinkedHashMap<K, V> _map = LinkedHashMap<K, V>();

  LruCache({this.capacity = 500})
      : assert(capacity > 0, 'Capacity must be positive');

  /// Current number of elements stored in the cache.
  int get length => _map.length;

  /// Whether the cache is empty.
  bool get isEmpty => _map.isEmpty;

  /// Whether the cache contains any elements.
  bool get isNotEmpty => _map.isNotEmpty;

  /// Retrieves a value by [key], updating its position to most recently used.
  V? get(K key) {
    if (!_map.containsKey(key)) return null;
    final value = _map.remove(key) as V;
    _map[key] = value;
    return value;
  }

  /// Stores a [value] for [key]. If capacity is exceeded, the least-recently
  /// used entry is evicted.
  void put(K key, V value) {
    if (_map.containsKey(key)) {
      _map.remove(key);
    } else if (_map.length >= capacity) {
      final oldestKey = _map.keys.first;
      _map.remove(oldestKey);
    }
    _map[key] = value;
  }

  /// Retrieves [key] if present, or computes and caches it using [ifAbsent].
  V putIfAbsent(K key, V Function() ifAbsent) {
    if (_map.containsKey(key)) {
      final value = _map.remove(key) as V;
      _map[key] = value;
      return value;
    }
    final value = ifAbsent();
    put(key, value);
    return value;
  }

  /// Returns true if [key] exists in the cache without altering LRU order.
  bool containsKey(K key) => _map.containsKey(key);

  /// Clears all entries from the cache.
  void clear() => _map.clear();
}

