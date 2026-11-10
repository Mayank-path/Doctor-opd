import 'dictionary/medical_dictionary_repository.dart';
import 'engine/spelling_engine.dart';
import 'presentation/spelling_text_editing_controller.dart';

/// Central service managing offline clinical spell-checking and dictionary resources.
class SpellCheckService {
  static final SpellCheckService _instance = SpellCheckService._internal();
  static SpellCheckService get instance => _instance;

  final MedicalDictionaryRepository _repository;
  late final SpellingEngine _engine;
  bool _isInitialized = false;

  SpellCheckService._internal()
      : _repository = MedicalDictionaryRepository() {
    _engine = SpellingEngine(dictionaryRepository: _repository);
  }

  /// Testing constructor for injecting custom repositories or engines.
  SpellCheckService.withRepository(MedicalDictionaryRepository repository)
      : _repository = repository {
    _engine = SpellingEngine(dictionaryRepository: _repository);
    _isInitialized = repository.isInitialized;
  }

  bool get isInitialized => _isInitialized;
  MedicalDictionaryRepository get repository => _repository;
  SpellingEngine get engine => _engine;

  /// Loads bundled dictionary assets asynchronously.
  Future<void> initialize() async {
    if (_isInitialized) return;
    await _repository.initialize();
    _engine.clearCache();
    _isInitialized = true;
  }

  /// Factory helper for creating a [SpellingTextEditingController] backed by the engine.
  SpellingTextEditingController createController({String? text}) {
    return SpellingTextEditingController(
      text: text,
      spellingEngine: _engine,
    );
  }
}

