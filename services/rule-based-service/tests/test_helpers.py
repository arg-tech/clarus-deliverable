from src.helpers import find_phrases_in_text

def test_normal_case():
    """Test finding phrases in text with normal case."""
    text = "This is a test text with some phrases."
    phrases = ["test", "some"]
    result = find_phrases_in_text(text, phrases)
    assert set([m['phrase'] for m in result]) == {"test", "some"}


def test_case_insensitive():
    """Test case insensitive matching."""
    text = "This is a TEST text."
    phrases = ["test"]
    result = find_phrases_in_text(text, phrases)
    assert [m['phrase'] for m in result] == ["test"]


def test_no_matches():
    """Test when no phrases are found."""
    text = "Nothing here."
    phrases = ["missing"]
    result = find_phrases_in_text(text, phrases)
    assert result == []


def test_multiple_matches_same_phrase():
    """Test multiple occurrences of the same phrase."""
    text = "test test test"
    phrases = ["test"]
    result = find_phrases_in_text(text, phrases)
    assert [m['phrase'] for m in result] == ["test", "test", "test"]


def test_empty_text():
    """Test with empty text."""
    text = ""
    phrases = ["test"]
    result = find_phrases_in_text(text, phrases)
    assert result == []


def test_empty_phrases():
    """Test with empty phrases list."""
    text = "test"
    phrases = []
    result = find_phrases_in_text(text, phrases)
    assert result == []


def test_phrase_not_whole_word():
    """Test that partial word matches are not found."""
    text = "testing"
    phrases = ["test"]
    result = find_phrases_in_text(text, phrases)
    assert result == []


def test_mixed_case_phrases():
    """Test with mixed case in phrases list."""
    text = "This is a TEST text."
    phrases = ["TEST", "is"]
    result = find_phrases_in_text(text, phrases)
    assert set([m['phrase'] for m in result]) == {"test", "is"}  # result is lowercase


def test_duplicates_in_phrases():
    """Test handling of duplicate phrases in input list."""
    text = "test"
    phrases = ["test", "test"]
    result = find_phrases_in_text(text, phrases)
    assert [m['phrase'] for m in result] == ["test"]


def test_multi_word_phrase():
    """Test finding multi-word phrases."""
    text = "This is a hello world example."
    phrases = ["hello world"]
    result = find_phrases_in_text(text, phrases)
    assert "hello world" in [m['phrase'] for m in result]


def test_subword_not_found():
    """Test that subwords are not found."""
    text = "atestb"
    phrases = ["test"]
    result = find_phrases_in_text(text, phrases)
    assert result == []


def test_phrase_with_punctuation():
    """Test phrases with punctuation in text."""
    text = "This is test, and testing."
    phrases = ["test"]
    result = find_phrases_in_text(text, phrases)
    assert "test" in [m['phrase'] for m in result]


def test_regex_optional_suffixes():
    """Test regex patterns with optional suffixes like in event_labeling."""
    text = "There was a riot, riots occurred, and they are rioting."
    patterns = ["riot(s|ed|ing)?"]
    result = find_phrases_in_text(text, patterns)
    assert set([m['phrase'] for m in result]) == {"riot", "riots", "rioting"}


def test_regex_alternatives():
    """Test regex patterns with alternatives."""
    text = "The clash was intense, clashes happened, they clashed, clashing sounds."
    patterns = ["clash(es|ed|ing)?"]
    result = find_phrases_in_text(text, patterns)
    assert set([m['phrase'] for m in result]) == {"clash", "clashes", "clashed", "clashing"}


def test_regex_complex_patterns():
    """Test more complex regex patterns from event_labeling."""
    text = "People protested, there were protests, protesting loudly, demonstration occurred."
    patterns = ["protest(s|ed|ing)?", "demonstrat(e|es|ed|ing|ion|ions)?"]
    result = find_phrases_in_text(text, patterns)
    assert set([m['phrase'] for m in result]) == {"protested", "protests", "protesting", "demonstration"}


def test_regex_with_hyphen_space():
    """Test regex patterns with optional hyphen or space."""
    text = "Stand-off situation, stand off now, stand-offs everywhere."
    patterns = ["stand[- ]?off(s)?"]
    result = find_phrases_in_text(text, patterns)
    assert set([m['phrase'] for m in result]) == {"stand-off", "stand off", "stand-offs"}


def test_regex_case_insensitive_with_patterns():
    """Test case insensitivity with regex patterns."""
    text = "RIOT in the streets, Riots everywhere."
    patterns = ["riot(s|ed|ing)?"]
    result = find_phrases_in_text(text, patterns)
    assert set([m['phrase'] for m in result]) == {"riot", "riots"}


def test_regex_slam_pattern():
    """Test regex pattern for slam variations with alternation."""
    text = "They slam the door, slammed it shut, and are slamming things around. He slams constantly."
    patterns = ["slam(s|med|ming)?|slammed"]
    result = find_phrases_in_text(text, patterns)
    assert set([m['phrase'] for m in result]) == {"slam", "slammed", "slamming", "slams"}


def test_regex_slam_pattern_no_subword():
    """Test that slam pattern doesn't match within other words."""
    text = "Islam is a religion, islamophobia is wrong, and slamdunk is a sport."
    patterns = ["slam(s|med|ming)?|slammed"]
    result = find_phrases_in_text(text, patterns)
    assert result == []


def test_multi_word_phrase_word_boundaries():
    """Test that multi-word phrases respect word boundaries."""
    text = "The senior citizen lives here. A seniorish citizen might agree. Not a seniorcitizen though."
    phrases = ["senior citizen"]
    result = find_phrases_in_text(text, phrases)
    # Should only match the exact phrase "senior citizen", not partial matches
    assert len([m['phrase'] for m in result]) == 1
    assert [m['phrase'] for m in result] == ["senior citizen"]


def test_multi_word_phrase_plural():
    """Test that multi-word phrases match plural forms correctly."""
    text = "The senior citizens are here. Senior citizen groups meet weekly."
    phrases = ["senior citizens"]
    result = find_phrases_in_text(text, phrases)
    # Should only match "senior citizens" (plural), not "senior citizen"
    assert len([m['phrase'] for m in result]) == 1
    assert [m['phrase'] for m in result] == ["senior citizens"]


def test_regex_with_optional_space_and_alternation():
    """Test pattern with optional space and alternation like 'hunt(s|ed|ing)? down|hunted down'."""
    text = "They hunt down criminals, hunted down the suspect, and are hunting down leads. He hunts down evidence."
    patterns = ["hunt(s|ed|ing)? down|hunted down"]
    result = find_phrases_in_text(text, patterns)
    assert set([m['phrase'] for m in result]) == {"hunt down", "hunted down", "hunting down", "hunts down"}


def test_multi_word_with_optional_plural():
    """Test multi-word phrases with optional plural like 'war zone(s)?'."""
    text = "The war zone is dangerous. Multiple war zones exist. Not a warzone though."
    patterns = ["war zone(s)?"]
    result = find_phrases_in_text(text, patterns)
    assert set([m['phrase'] for m in result]) == {"war zone", "war zones"}


def test_multi_word_optional_middle():
    """Test pattern with optional 's' in middle like 'storm(s)? of controversy'."""
    text = "A storm of controversy erupted. Multiple storms of controversy arose."
    patterns = ["storm(s)? of controversy"]
    result = find_phrases_in_text(text, patterns)
    assert set([m['phrase'] for m in result]) == {"storm of controversy", "storms of controversy"}


def test_multi_word_no_subword_match():
    """Test that multi-word phrases don't match when concatenated."""
    text = "The warzone is active. A perfect-storm situation. Seismicshift detected."
    patterns = ["war zone(s)?", "perfect storm(s)?", "seismic shift(s)?"]
    result = find_phrases_in_text(text, patterns)
    # None should match because they're concatenated without proper word boundaries
    assert result == []


