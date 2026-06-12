# /// script
# dependencies = [
#   "pandas",
# ]
# ///

import pandas as pd
import re
import json

# /// script
# dependencies = [
#   "pandas",
# ]
# ///

import pandas as pd
import re
import json

df = pd.read_csv("./Lexicon v2.csv", sep=";")

# Languages to generate lexicons for
LANGUAGES = ["en", "cs", "fi", "el", "pt"]

def escape_regex_special_chars(text):
    """Escape only regex special characters, but keep spaces, commas, hyphens as-is"""
    # Only escape actual regex metacharacters: . ^ $ * + ? { } [ ] \ | ( )
    # Keep normal text characters like spaces, commas, hyphens
    special_chars = r'.^$*+?{}[]\|()'
    result = []
    for char in text:
        if char in special_chars:
            result.append('\\' + char)
        else:
            result.append(char)
    return ''.join(result)

def make_word_regex(term):
    term = str(term)
    # extract abbreviation in parentheses
    abbr = None
    m = re.search(r'\(([^)]+)\)', term)
    if m:
        abbr = m.group(1).strip()
        term_clean = re.sub(r'\s*\([^)]+\)', '', term).strip()
    else:
        term_clean = term.strip()
    # split on comma, slash, or en dash
    parts = re.split(r'\s*[,\/–]\s*', term_clean)
    # Escape regex special characters in each part
    base = escape_regex_special_chars(parts[0].strip())
    regex = base
    if len(parts) > 1:
        second = escape_regex_special_chars(parts[1].strip())
        # plural check - compare unescaped versions
        if parts[1].strip().lower() == parts[0].strip().lower() + 's':
            # add (s)
            if parts[0].strip().endswith('s'):
                regex = base  # already plural-ish
            else:
                regex = f"{base}(s)?"
        else:
            regex = "|".join([escape_regex_special_chars(p.strip()) for p in parts])
    if abbr:
        regex = f"{regex}|{escape_regex_special_chars(abbr)}"
    return regex

# Generate lexicon for each language
for lang in LANGUAGES:
    entries = []
    for _, row in df.iterrows():
        term = row.get(f"word_{lang}")
        definition = row.get("definition_en")  # Always use English definition
        usage = row.get(f"usage_{lang}")
        if pd.isna(term) or pd.isna(definition):
            continue
        word_regex = make_word_regex(term)
        # Convert NaN to empty string for usage_example
        usage_str = "" if pd.isna(usage) else str(usage).strip()
        entries.append({
            "word_regex": word_regex,
            "usage_example": usage_str,
            "definition": str(definition).strip()
        })
    
    # Save to JSON
    out_path = f"./lexicon_terms_{lang}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
    
    print(f"Generated {out_path} with {len(entries)} entries")


