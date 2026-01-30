#!/usr/bin/env python3
"""
Rule-based service evaluation script.

Evaluates the rule-based service across all languages and produces
summary reports with precision, recall, and weighted accuracy.

Usage:
    uv run python evaluate_rule_based.py                    # All languages
    uv run python evaluate_rule_based.py --language cs      # Single language
    uv run python evaluate_rule_based.py --samples 50       # Limit samples
"""

import argparse
import json
from datetime import datetime
from pathlib import Path

import httpx
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

console = Console()

DATASETS_DIR = Path(__file__).parent / "datasets" / "rule-based"
REPORTS_DIR = Path(__file__).parent / "reports" / "rule-based"
RULE_BASED_URL = "http://localhost:7022/analyse"

AVAILABLE_LANGUAGES = ["en", "cs", "fi", "el", "pt"]

API_KEY_MAP = {
    "absoluteTerms": "absolute_terms",
    "chargedSemanticFields": "charged_semantic_fields",
    "concessiveConnectives": "concessive_connectives",
    "dysphemisms": "dysphemisms",
    "ellipses": "ellipses",
    "emotionallyChargedAdjectives": "emotionally_charged_adjectives",
    "euphemisms": "euphemisms",
    "eventLabeling": "event_labeling",
    "exclamationQuestionMarks": "exclamation_question_marks",
    "framingByTime": "framing_by_time",
    "historicallyDerogatoryTerms": "historically_derogatory_terms",
    "intensifyingAdverbs": "intensifying_adverbs",
    "italicsBoldface": "italics_boldface",
    "mitigators": "mitigators",
    "overgeneralizations": "overgeneralizations",
    "oversimplifiedGroupLabels": "oversimplified_group_labels",
    "capitalisation": "capitalisation",
}


def load_dataset(language: str) -> list[dict]:
    dataset_path = DATASETS_DIR / f"{language}.json"
    if not dataset_path.exists():
        console.print(f"[yellow]Dataset not found: {dataset_path}[/yellow]")
        return []
    with open(dataset_path, "r", encoding="utf-8") as f:
        return json.load(f)


def call_service(text: str, language: str) -> set[tuple[str, str]]:
    response = httpx.post(
        RULE_BASED_URL,
        json={"text": text, "language": language},
        timeout=30.0,
    )
    response.raise_for_status()

    pairs = set()
    for item in response.json():
        api_key = item["bias_indicator_key"]
        indicator = API_KEY_MAP.get(api_key, api_key)
        pairs.add((indicator, item["detected_phrase"]))

    return pairs


def evaluate_language(language: str, samples: int | None = None) -> dict:
    """Evaluate rule-based service for a single language."""
    dataset = load_dataset(language)
    if not dataset:
        return {}

    if samples:
        dataset = dataset[:samples]

    total_tp = 0
    total_fp = 0
    total_fn = 0
    errors = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        progress.add_task(
            f"Evaluating {language.upper()} ({len(dataset)} samples)...",
            total=None,
        )

        for sample in dataset:
            text = sample["text"]

            expected_pairs = set()
            for ind in sample.get("indicators", []):
                expected_pairs.add((ind["indicator"], ind["word"]))

            try:
                detected_pairs = call_service(text, language)
            except Exception as e:
                console.print(f"[red]Error calling service: {e}[/red]")
                errors += 1
                continue

            tp = len(expected_pairs & detected_pairs)
            fp = len(detected_pairs - expected_pairs)
            fn = len(expected_pairs - detected_pairs)

            total_tp += tp
            total_fp += fp
            total_fn += fn

    precision = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
    recall = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
    weighted_accuracy = (precision + recall) / 2

    return {
        "language": language,
        "samples": len(dataset),
        "tp": total_tp,
        "fp": total_fp,
        "fn": total_fn,
        "precision": precision,
        "recall": recall,
        "weighted_accuracy": weighted_accuracy,
        "errors": errors,
    }


def calculate_aggregates(results: list[dict]) -> dict:
    if not results:
        return {}

    macro_precision = sum(r["precision"] for r in results) / len(results)
    macro_recall = sum(r["recall"] for r in results) / len(results)
    macro_weighted_accuracy = (macro_precision + macro_recall) / 2

    total_tp = sum(r["tp"] for r in results)
    total_fp = sum(r["fp"] for r in results)
    total_fn = sum(r["fn"] for r in results)

    micro_precision = (
        total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
    )
    micro_recall = (
        total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
    )
    micro_weighted_accuracy = (micro_precision + micro_recall) / 2

    return {
        "macro_precision": macro_precision,
        "macro_recall": macro_recall,
        "macro_weighted_accuracy": macro_weighted_accuracy,
        "micro_precision": micro_precision,
        "micro_recall": micro_recall,
        "micro_weighted_accuracy": micro_weighted_accuracy,
        "total_tp": total_tp,
        "total_fp": total_fp,
        "total_fn": total_fn,
        "total_samples": sum(r["samples"] for r in results),
        "total_errors": sum(r["errors"] for r in results),
    }


def generate_markdown_report(results: list[dict], aggregates: dict) -> str:
    report = f"""# Rule-Based Service Evaluation Summary

**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
**Service:** Rule-Based Bias Detection

## Overall Performance

| Metric | Macro Avg | Micro Avg |
|--------|-----------|-----------|
| Precision | {aggregates["macro_precision"]:.4f} | {aggregates["micro_precision"]:.4f} |
| Recall | {aggregates["macro_recall"]:.4f} | {aggregates["micro_recall"]:.4f} |
| Weighted Accuracy | {aggregates["macro_weighted_accuracy"]:.4f} | {aggregates["micro_weighted_accuracy"]:.4f} |

**Total Samples:** {aggregates["total_samples"]}
**Total Errors:** {aggregates["total_errors"]}

## By Language

| Language | Precision | Recall | Weighted Acc | Samples | Errors |
|----------|-----------|--------|--------------|---------|--------|
"""

    sorted_results = sorted(results, key=lambda r: r["weighted_accuracy"], reverse=True)
    for r in sorted_results:
        report += f"| {r['language'].upper()} | {r['precision']:.4f} | {r['recall']:.4f} | {r['weighted_accuracy']:.4f} | {r['samples']} | {r['errors']} |\n"

    report += "\n## Observations\n\n"

    if sorted_results:
        best = sorted_results[0]
        worst = sorted_results[-1]
        report += f"- **Best performing language:** {best['language'].upper()} with {best['weighted_accuracy']:.4f} weighted accuracy\n"
        report += f"- **Most challenging language:** {worst['language'].upper()} with {worst['weighted_accuracy']:.4f} weighted accuracy\n"

        high_fp = [r for r in sorted_results if r["fp"] > r["tp"]]
        if high_fp:
            report += (
                "\n**Languages with more false positives than true positives:**\n\n"
            )
            for r in high_fp:
                report += f"- {r['language'].upper()}: {r['fp']} FP vs {r['tp']} TP\n"

    return report


def save_results(results: list[dict], aggregates: dict, output_name: str) -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    json_data = {
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "languages": {r["language"]: r for r in results},
        "aggregates": aggregates,
    }
    json_path = REPORTS_DIR / f"{output_name}.json"
    json_path.write_text(json.dumps(json_data, indent=2))
    console.print(f"[blue]JSON results saved to {json_path}[/blue]")

    report = generate_markdown_report(results, aggregates)
    md_path = REPORTS_DIR / f"{output_name}.md"
    md_path.write_text(report)
    console.print(f"[blue]Report saved to {md_path}[/blue]")


def display_results(results: list[dict], aggregates: dict) -> None:
    overall_table = Table(title="Overall Performance")
    overall_table.add_column("Metric", style="cyan")
    overall_table.add_column("Macro Avg", style="green")
    overall_table.add_column("Micro Avg", style="green")

    overall_table.add_row(
        "Precision",
        f"{aggregates['macro_precision']:.4f}",
        f"{aggregates['micro_precision']:.4f}",
    )
    overall_table.add_row(
        "Recall",
        f"{aggregates['macro_recall']:.4f}",
        f"{aggregates['micro_recall']:.4f}",
    )
    overall_table.add_row(
        "Weighted Accuracy",
        f"{aggregates['macro_weighted_accuracy']:.4f}",
        f"{aggregates['micro_weighted_accuracy']:.4f}",
    )

    console.print(overall_table)
    console.print()

    lang_table = Table(title="By Language")
    lang_table.add_column("Language", style="cyan")
    lang_table.add_column("Precision", style="yellow")
    lang_table.add_column("Recall", style="yellow")
    lang_table.add_column("Weighted Acc", style="yellow")
    lang_table.add_column("TP", style="green")
    lang_table.add_column("FP", style="red")
    lang_table.add_column("FN", style="red")
    lang_table.add_column("Samples")
    lang_table.add_column("Errors", style="red")

    sorted_results = sorted(results, key=lambda r: r["weighted_accuracy"], reverse=True)
    for r in sorted_results:
        lang_table.add_row(
            r["language"].upper(),
            f"{r['precision']:.4f}",
            f"{r['recall']:.4f}",
            f"{r['weighted_accuracy']:.4f}",
            str(r["tp"]),
            str(r["fp"]),
            str(r["fn"]),
            str(r["samples"]),
            str(r["errors"]),
        )

    console.print(lang_table)
    console.print()


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate rule-based bias detection service"
    )
    parser.add_argument(
        "--language",
        type=str,
        default=None,
        help="Language code (en, cs, fi, el, pt) or omit for all",
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=None,
        help="Number of samples per language (default: all)",
    )
    args = parser.parse_args()

    languages = [args.language] if args.language else AVAILABLE_LANGUAGES

    console.print("[bold]Rule-Based Service Evaluation[/bold]")
    console.print(f"Languages: {[l.upper() for l in languages]}")
    if args.samples:
        console.print(f"Sample limit: {args.samples}")
    console.print()

    # Check service availability
    try:
        httpx.post(
            RULE_BASED_URL,
            json={"text": "test", "language": "en"},
            timeout=5.0,
        )
    except Exception:
        console.print(
            f"[red]Error: Cannot connect to rule-based service at {RULE_BASED_URL}[/red]"
        )
        console.print(
            "[red]Make sure to run: docker compose up -d rule-based-service[/red]"
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

    aggregates = calculate_aggregates(results)
    display_results(results, aggregates)
    output_name = args.language if args.language else "summary"
    save_results(results, aggregates, output_name)

    console.print("[bold green]Evaluation complete![/bold green]")


if __name__ == "__main__":
    main()
