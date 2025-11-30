
import logging
from typing import List, Dict, Set, Tuple, Optional
from html.parser import HTMLParser
from models import BiasIndicatorResult, CharacterPositions

logger = logging.getLogger(__name__)

class FormattingHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.plain_text: str = ""
        self.format_ranges: Dict[str, List[Tuple[int, int, str]]] = {
            "bold": [],
            "italic": [],
            "underlined": []
        }
        self.active_formats: Set[str] = set()
        self.tag_mapping: Dict[str, str] = {
            "strong": "bold",
            "em": "italic", 
            "u": "underlined"
        }
        self.format_starts: Dict[str, int] = {}
        self.in_paragraph: bool = False
    
    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        format_type = self.tag_mapping.get(tag)
        if format_type:
            self.active_formats.add(format_type)
            self.format_starts[format_type] = len(self.plain_text)
        elif tag == "br":
            self.plain_text += '\n'
    
    def handle_endtag(self, tag: str) -> None:
        format_type = self.tag_mapping.get(tag)
        if format_type and format_type in self.active_formats:
            start = self.format_starts.get(format_type)
            end = len(self.plain_text)
            if start is not None and end > start:
                self.format_ranges[format_type].append((start, end, self.plain_text[start:end]))
            self.active_formats.remove(format_type)
        elif tag == "p":
            self.plain_text += '\n\n'
    
    def handle_data(self, data: str) -> None:
        self.plain_text += data

def analyse(richText: str) -> List[BiasIndicatorResult]:
    results: List[BiasIndicatorResult] = []
    
    parser = FormattingHTMLParser()
    parser.feed(richText)
    
    for format_type, ranges in parser.format_ranges.items():
        for start, end, text in ranges:
            if not text:
                continue
                
            results.append(
                BiasIndicatorResult(
                    bias_indicator_key="italicsBoldface",
                    detected_phrase=text.lower(),
                    character_positions=CharacterPositions(start=start, end=end)
                )
            )
    
    return results
