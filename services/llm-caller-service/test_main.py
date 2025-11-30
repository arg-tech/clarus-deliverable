import pytest
from main import extract_json_from_response

def test_extract_json_from_response_markdown():
    """Test extracting JSON from a response with markdown code blocks."""
    # Test with JSON in markdown code blocks
    markdown_response = """
    Here's the analysis result:

    ```json
    ["This is satirical.", "Another satirical sentence."]
    ```

    I hope this helps!
    """
    
    expected = ["This is satirical.", "Another satirical sentence."]
    result = extract_json_from_response(markdown_response)
    assert result == expected

def test_extract_json_from_response_direct():
    """Test extracting JSON directly from a response."""
    # Test with direct JSON (no markdown)
    direct_json = '["Direct JSON", "No markdown"]'
    
    expected = ["Direct JSON", "No markdown"]
    result = extract_json_from_response(direct_json)
    assert result == expected

def test_extract_json_from_response_invalid():
    """Test extracting JSON from invalid responses."""
    # Test with invalid JSON in markdown
    invalid_markdown = """
    ```json
    ["Incomplete JSON
    ```
    """
    result = extract_json_from_response(invalid_markdown)
    assert result == []
    
    # Test with no JSON at all
    no_json = "This is just plain text with no JSON."
    result = extract_json_from_response(no_json)
    assert result == []

def test_extract_json_from_response_complex():
    """Test extracting more complex JSON structures."""
    # Test with nested JSON in markdown
    complex_json = """
    Here's a more complex example:
    ```json
    {
        "satirical": ["First satirical", "Second satirical"],
        "non_satirical": ["Normal sentence"],
        "metadata": {
            "confidence": 0.95,
            "model": "test-model"
        }
    }
    ```
    """
    
    expected = { # type: ignore
        "satirical": ["First satirical", "Second satirical"],
        "non_satirical": ["Normal sentence"],
        "metadata": {
            "confidence": 0.95,
            "model": "test-model"
        }
    }
    
    result = extract_json_from_response(complex_json)
    assert result == expected

def test_extract_json_from_response_with_preceding_text():
    """Test extracting JSON from a response with text before the JSON array."""
    response_with_preceding_text = """but it's not a satirical sentence. The rest are. Therefore, the answer is the list of sentences from "Oh, great." onwards.

[
  "Oh, great. Another Monday. Just what I needed.",
  "My coffee tastes like disappointment, but that's okay.",
  "The sun is shining, actually.",
  "Birds are singing.",
  "Everyone's emails are piling up.",
  "Fantastic.",
  "I really love when my computer decides to update itself mid-project.",
  "And yes, I did remember to water the plants this morning. Big win."
]"""
    
    expected = [
        "Oh, great. Another Monday. Just what I needed.",
        "My coffee tastes like disappointment, but that's okay.",
        "The sun is shining, actually.",
        "Birds are singing.",
        "Everyone's emails are piling up.",
        "Fantastic.",
        "I really love when my computer decides to update itself mid-project.",
        "And yes, I did remember to water the plants this morning. Big win."
    ]
    
    result = extract_json_from_response(response_with_preceding_text)
    assert result == expected

if __name__ == "__main__":
    import sys
    sys.exit(pytest.main(["-v", "test_main.py"]))
