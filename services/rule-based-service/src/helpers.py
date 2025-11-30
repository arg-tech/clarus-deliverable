from typing import List, Dict, Set, Any, Tuple
import re

def load_phrases_from_json_data(data: Any) -> Set[str]:
    phrases: Set[str] = set()
    stack = [data]
    
    while stack:
        item = stack.pop()
        if isinstance(item, str):
            phrases.add(item)
        elif isinstance(item, list):
            stack.extend(item)
        elif isinstance(item, dict):
            stack.extend(item.values())
    
    return phrases


def find_phrases_in_text(text: str, patterns: List[str]) -> List[Dict[str, Any]]:
    matches: List[Dict[str, Any]] = []
    seen_positions: Set[Tuple[int, int]] = set()
    
    for pattern in patterns:
        # If pattern contains alternation (|), wrap in non-capturing group
        if '|' in pattern:
            regex_pattern = r'\b(?:' + pattern + r')\b'
        else:
            regex_pattern = r'\b' + pattern + r'\b'
            
        for match in re.finditer(regex_pattern, text, re.IGNORECASE):
            start = match.start()
            end = match.end()
            position_key = (start, end)
            
            # Avoid duplicates at the same position
            if position_key not in seen_positions:
                seen_positions.add(position_key)
                matches.append({
                    'phrase': match.group().lower(),
                    'start': start,
                    'end': end
                })
    
    return matches


def enhanced_find_phrases_in_text(text: str, patterns: List[str]) -> List[Dict[str, Any]]:
    # this version treats patterns as full regex that can contain special characters as well as \b word boundaries
    # it prioritizes longer matches (e.g., if there are two patterns "a b" and "a b c", the longer one should be matched)
    # it removes overlapping matches (e.g., if there are two patterns "a b" and "b", the longer one should be matched)
    matches = []
    
    # Sort patterns by length (longest first) to prioritize longer matches
    sorted_patterns = sorted(patterns, key=lambda x: len(x), reverse=True)
    for pattern_str in sorted_patterns:
        try:
            compiled_pattern = re.compile(pattern_str, re.IGNORECASE)
        except re.error as e:
            print(f"Warning: Failed to compile pattern '{pattern_str}': {e}")
            continue
        
        for match in compiled_pattern.finditer(text):
            matches.append({
                "phrase": match.group().lower(),
                "start": match.start(),
                "end": match.end(),
                "pattern": pattern_str,
            })
    
    # Remove overlapping matches (prioritize longer matches)
    # See morphodita/main.py for more details
    matches.sort(key=lambda x: (x['start'], -len(x['phrase'])))
    filtered_matches = []
    
    for match in matches:
        overlaps = False
        for accepted in filtered_matches:
            if not (match['end'] < accepted['start'] or match['start'] > accepted['end']):
                overlaps = True
                break
        
        if not overlaps:
            filtered_matches.append(match)
    
    # Return in the same format as find_phrases_in_text
    return [{"phrase": match["phrase"], "start": match["start"], "end": match["end"]} for match in filtered_matches]
