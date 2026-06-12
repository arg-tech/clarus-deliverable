#!/usr/bin/env python3
"""
End-to-end evaluation of the sentiment analysis service.

Sends requests to the running sentiment-service API and compares
predicted sentiment labels against expected labels in the test dataset.

Usage:
    uv run python evaluate_sentiment.py                    # All languages
    uv run python evaluate_sentiment.py --language pt      # Single language
    uv run python evaluate_sentiment.py --samples 50       # Limit samples
"""

import argparse
import json
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import httpx
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

console = Console()

DATASETS_DIR = Path(__file__).parent / "datasets" / "ml"
REPORTS_DIR = Path(__file__).parent / "reports" / "ml"
SENTIMENT_URL = "http://localhost:7026/analyse"

AVAILABLE_LANGUAGES = ["en", "pt", "cs", "el", "fi"]
SENTIMENT_LABELS = ["NEGATIVE", "NEUTRAL", "POSITIVE"]


def collapse_label(label: str) -> str:
    normalized = label.upper().replace("_", " ").strip()
    if normalized == "VERY NEGATIVE":
        return "NEGATIVE"
    if normalized == "VERY POSITIVE":
        return "POSITIVE"
    return normalized


def load_dataset(language: str) -> list[dict]:
    dataset_path = DATASETS_DIR / f"sentiment_{language}.json"
    if not dataset_path.exists():
        console.print(f"[yellow]Dataset not found: {dataset_path}[/yellow]")
        return []
    data = json.loads(dataset_path.read_text())
    return data["samples"]


def call_service(text: str, language: str) -> tuple[str, float]:
    """Call sentiment service and return the dominant sentiment for the text.

    The service splits text into sentences and returns per-sentence results.
    For single-sentence test samples we take the first result.
    """
    response = httpx.post(
        SENTIMENT_URL,
        json={"text": text, "language": language},
        timeout=60.0,
    )
    response.raise_for_status()

    results = response.json()
    if not results:
        return "NO_RESULT", 0.0

    # Take the first (and typically only) sentence result
    return collapse_label(results[0]["sentiment"]), results[0]["confidence"]


def evaluate_language(language: str, samples: int | None = None) -> dict:
    dataset = load_dataset(language)
    if not dataset:
        return {}

    if samples:
        dataset = dataset[:samples]

    correct = 0
    total = len(dataset)
    errors = 0
    no_results = 0

    per_class_correct = defaultdict(int)
    per_class_total = defaultdict(int)
    confusion = defaultdict(lambda: defaultdict(int))

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task(
            f"Evaluating {language.upper()} ({total} samples)...",
            total=None,
        )

        start = time.time()
        for sample in dataset:
            text = sample["text"]
            expected = collapse_label(sample["expected_sentiment"])
            per_class_total[expected] += 1

            try:
                predicted, confidence = call_service(text, language)
            except Exception as e:
                console.print(f"[red]Error calling service: {e}[/red]")
                errors += 1
                continue

            if predicted == "NO_RESULT":
                no_results += 1
                confusion[expected]["NO_RESULT"] += 1
                continue

            if predicted == expected:
                correct += 1
                per_class_correct[expected] += 1

            confusion[expected][predicted] += 1

        elapsed = time.time() - start

    evaluated = total - errors
    accuracy = correct / evaluated if evaluated > 0 else 0

    return {
        "language": language,
        "total": total,
        "evaluated": evaluated,
        "correct": correct,
        "accuracy": accuracy,
        "errors": errors,
        "no_results": no_results,
        "per_class_correct": dict(per_class_correct),
        "per_class_total": dict(per_class_total),
        "confusion": {k: dict(v) for k, v in confusion.items()},
        "processing_time": elapsed,
    }


def display_results(results: list[dict]) -> None:
    for r in results:
        lang_table = Table(title=f"Sentiment Evaluation — {r['language'].upper()}")
        lang_table.add_column("Metric", style="cyan")
        lang_table.add_column("Value", style="green")

        lang_table.add_row(
            "Accuracy", f"{r['accuracy']:.2%} ({r['correct']}/{r['evaluated']})"
        )
        lang_table.add_row("Errors", str(r["errors"]))
        lang_table.add_row("No results (below threshold)", str(r["no_results"]))
        lang_table.add_row("Processing time", f"{r['processing_time']:.1f}s")
        console.print(lang_table)
        console.print()

        # Per-class accuracy
        class_table = Table(title=f"Per-Class Accuracy — {r['language'].upper()}")
        class_table.add_column("Sentiment", style="cyan")
        class_table.add_column("Accuracy", style="yellow")
        class_table.add_column("Correct / Total", style="yellow")

        for label in SENTIMENT_LABELS:
            total = r["per_class_total"].get(label, 0)
            correct = r["per_class_correct"].get(label, 0)
            acc = correct / total if total > 0 else 0
            class_table.add_row(label, f"{acc:.2%}", f"{correct}/{total}")

        console.print(class_table)
        console.print()

        # Confusion matrix
        cm_table = Table(title=f"Confusion Matrix — {r['language'].upper()}")
        cm_table.add_column("Actual \\ Predicted", style="cyan")
        for label in SENTIMENT_LABELS:
            cm_table.add_column(label[:8], style="yellow")

        for actual in SENTIMENT_LABELS:
            row = []
            for predicted in SENTIMENT_LABELS:
                count = r["confusion"].get(actual, {}).get(predicted, 0)
                row.append(str(count) if count > 0 else "·")
            cm_table.add_row(actual, *row)

        console.print(cm_table)
        console.print()


def save_results(results: list[dict], output_name: str) -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    json_data = {
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "service": "sentiment (end-to-end)",
        "languages": {},
    }

    for r in results:
        json_data["languages"][r["language"]] = {
            "total_samples": r["total"],
            "evaluated": r["evaluated"],
            "accuracy": r["accuracy"],
            "errors": r["errors"],
            "no_results": r["no_results"],
            "per_class_metrics": {
                label: {
                    "accuracy": r["per_class_correct"].get(label, 0)
                    / r["per_class_total"].get(label, 1),
                    "correct": r["per_class_correct"].get(label, 0),
                    "total": r["per_class_total"].get(label, 0),
                }
                for label in SENTIMENT_LABELS
                if r["per_class_total"].get(label, 0) > 0
            },
            "confusion_matrix": r["confusion"],
            "processing_time": r["processing_time"],
        }

    json_path = REPORTS_DIR / f"sentiment_{output_name}.json"
    json_path.write_text(json.dumps(json_data, indent=2))
    console.print(f"[blue]Results saved to {json_path}[/blue]")


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate sentiment analysis service (end-to-end)"
    )
    parser.add_argument(
        "--language",
        type=str,
        default=None,
        help=f"Language code ({', '.join(AVAILABLE_LANGUAGES)}) or omit for all",
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=None,
        help="Number of samples per language (default: all)",
    )
    args = parser.parse_args()

    languages = [args.language] if args.language else AVAILABLE_LANGUAGES

    console.print("[bold]Sentiment Service Evaluation (End-to-End)[/bold]")
    console.print(f"Languages: {[l.upper() for l in languages]}")
    console.print(f"Service: {SENTIMENT_URL}")
    if args.samples:
        console.print(f"Sample limit: {args.samples}")
    console.print()

    # Check service availability
    try:
        httpx.post(
            SENTIMENT_URL,
            json={"text": "test", "language": "en"},
            timeout=5.0,
        )
    except Exception:
        console.print(
            f"[red]Error: Cannot connect to sentiment service at {SENTIMENT_URL}[/red]"
        )
        console.print(
            "[red]Make sure to run: docker compose up -d sentiment-service[/red]"
        )
        return

    results: list[dict] = []
    for language in languages:
        metrics = evaluate_language(language, args.samples)
        if metrics:
            results.append(metrics)

    if not results:
        console.print("[yellow]No results collected.[/yellow]")
        return

    display_results(results)
    output_name = args.language if args.language else "summary"
    save_results(results, output_name)

    console.print("[bold green]Evaluation complete![/bold green]")


if __name__ == "__main__":
    main()
