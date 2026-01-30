#!/usr/bin/env python3
"""
LLM evaluation script for bias detection services.

Evaluates the LLM caller service against generated datasets and
calculates precision, recall, and weighted accuracy metrics.

Usage:
    uv run python evaluate_llm.py --indicator contextual_framing --language en
    uv run python evaluate_llm.py --indicator all --language en --samples 25
    uv run python evaluate_llm.py --indicator all --language all --concurrency 5
    uv run python evaluate_llm.py --indicator all --language all --model local
"""

import argparse
import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
from rich.console import Console
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    BarColumn,
    TaskProgressColumn,
)
from rich.table import Table

from models import (
    Dataset,
    Sample,
    IndicatorType,
    LanguageCode,
    EvaluationResult,
    IndicatorMetrics,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

console = Console()

DATASETS_DIR = Path(__file__).parent / "datasets" / "llm"
REPORTS_DIR = Path(__file__).parent / "reports" / "llm"
LLM_SERVICE_URL = "http://localhost:7028"

INDICATOR_ENDPOINTS = {
    "contextual_framing": "/analyze_contextual_framing",
    "double_entendres": "/analyze_double_entendres",
    "oversimplified_comparison": "/analyze_oversimplified_comparison",
    "referential_ambiguity": "/analyze_referential_ambiguity",
    "subordinate_clauses": "/analyze_subordinate_clauses",
    "tag_questions": "/analyze_tag_questions",
}


def normalize(phrase: str) -> str:
    return phrase.lower().strip()


def calculate_sample_metrics(
    detected: list[str], expected: list[str]
) -> tuple[int, int, int]:
    detected_normalized = {normalize(p) for p in detected}
    expected_normalized = {normalize(p) for p in expected}

    tp = len(detected_normalized & expected_normalized)
    fp = len(detected_normalized - expected_normalized)
    fn = len(expected_normalized - detected_normalized)

    return tp, fp, fn


def load_dataset(indicator: str, language: str) -> Optional[Dataset]:
    dataset_path = DATASETS_DIR / f"{indicator}_{language}.json"

    if not dataset_path.exists():
        console.print(f"[yellow]Dataset not found: {dataset_path}[/yellow]")
        return None

    try:
        data = json.loads(dataset_path.read_text())
        samples = [Sample(**s) for s in data["samples"]]
        return Dataset(
            indicator=IndicatorType(data["indicator"]),
            language=LanguageCode(data["language"]),
            samples=samples,
        )
    except Exception as e:
        console.print(f"[red]Error loading dataset: {e}[/red]")
        return None


async def evaluate_sample(
    client: httpx.AsyncClient,
    indicator: str,
    language: str,
    sample: Sample,
    sample_index: int,
    model: str = "remote",
    max_retries: int = 3,
) -> Optional[EvaluationResult]:
    endpoint = INDICATOR_ENDPOINTS.get(indicator)
    if not endpoint:
        logger.error(f"Unknown indicator: {indicator}")
        return None

    url = f"{LLM_SERVICE_URL}{endpoint}"
    payload = {"text": sample.text, "language": language, "model_to_use": model}

    for attempt in range(max_retries):
        try:
            response = await client.post(url, json=payload, timeout=60.0)
            response.raise_for_status()
            data = response.json()

            detected = [
                item["detected_phrase"] for item in data.get("bias_indicators", [])
            ]

            tp, fp, fn = calculate_sample_metrics(detected, sample.expected)

            return EvaluationResult(
                sample_index=sample_index,
                text=sample.text,
                expected=sample.expected,
                detected=detected,
                true_positives=tp,
                false_positives=fp,
                false_negatives=fn,
            )

        except httpx.TimeoutException:
            logger.warning(f"Sample {sample_index}: Timeout (attempt {attempt + 1})")
            if attempt < max_retries - 1:
                await asyncio.sleep(2**attempt)
        except httpx.HTTPStatusError as e:
            logger.error(f"Sample {sample_index}: HTTP error {e.response.status_code}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2**attempt)
        except Exception as e:
            logger.error(f"Sample {sample_index}: Error: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2**attempt)

    return None


async def evaluate_samples_concurrent(
    client: httpx.AsyncClient,
    indicator: str,
    language: str,
    samples: list[Sample],
    model: str = "remote",
    concurrency: int = 5,
) -> tuple[list[EvaluationResult], int]:
    semaphore = asyncio.Semaphore(concurrency)
    results: list[Optional[EvaluationResult]] = []
    errors = 0

    async def evaluate_with_semaphore(
        i: int, sample: Sample
    ) -> Optional[EvaluationResult]:
        async with semaphore:
            return await evaluate_sample(client, indicator, language, sample, i, model)

    tasks = [evaluate_with_semaphore(i, s) for i, s in enumerate(samples)]
    results = await asyncio.gather(*tasks)

    valid_results = []
    for result in results:
        if result:
            valid_results.append(result)
        else:
            errors += 1

    return valid_results, errors


async def evaluate_indicator(
    indicator: str,
    language: str,
    model: str = "remote",
    limit: Optional[int] = None,
    concurrency: int = 5,
) -> Optional[IndicatorMetrics]:
    dataset = load_dataset(indicator, language)
    if not dataset:
        return None

    samples = dataset.samples[:limit] if limit else dataset.samples

    async with httpx.AsyncClient() as client:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            progress.add_task(
                f"Evaluating {indicator}_{language} [{model}] ({len(samples)} samples, {concurrency} concurrent)...",
                total=None,
            )

            results, errors = await evaluate_samples_concurrent(
                client, indicator, language, samples, model, concurrency
            )

    total_tp = sum(r.true_positives for r in results)
    total_fp = sum(r.false_positives for r in results)
    total_fn = sum(r.false_negatives for r in results)

    precision = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
    recall = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
    weighted_accuracy = (precision + recall) / 2

    metrics = IndicatorMetrics(
        indicator=indicator,
        language=language,
        model=model,
        total_samples=len(samples),
        total_tp=total_tp,
        total_fp=total_fp,
        total_fn=total_fn,
        precision=precision,
        recall=recall,
        weighted_accuracy=weighted_accuracy,
        errors=errors,
    )

    table = Table(title=f"{indicator} ({language}) [{model}]")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")

    table.add_row("Samples", str(len(samples)))
    table.add_row("True Positives", str(total_tp))
    table.add_row("False Positives", str(total_fp))
    table.add_row("False Negatives", str(total_fn))
    table.add_row("Precision", f"{precision:.4f}")
    table.add_row("Recall", f"{recall:.4f}")
    table.add_row("Weighted Accuracy", f"{weighted_accuracy:.4f}")
    table.add_row("Errors", str(errors))

    console.print(table)
    console.print()

    return metrics


def generate_report(
    metrics_list: list[IndicatorMetrics], language: str, model: str
) -> str:
    model_name = "Gemini (remote)" if model == "remote" else "Qwen3-4B (local)"
    report = f"""# LLM Evaluation Results - {language.upper()}

**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
**Language:** {language}
**Model:** {model_name}
**Total Indicators:** {len(metrics_list)}

## Summary

| Indicator | Precision | Recall | Weighted Acc | TP | FP | FN | Errors |
|-----------|-----------|--------|--------------|----|----|-----|--------|
"""

    for m in metrics_list:
        report += f"| {m.indicator} | {m.precision:.4f} | {m.recall:.4f} | {m.weighted_accuracy:.4f} | {m.total_tp} | {m.total_fp} | {m.total_fn} | {m.errors} |\n"

    if metrics_list:
        macro_precision = sum(m.precision for m in metrics_list) / len(metrics_list)
        macro_recall = sum(m.recall for m in metrics_list) / len(metrics_list)
        macro_weighted_acc = sum(m.weighted_accuracy for m in metrics_list) / len(
            metrics_list
        )

        total_tp = sum(m.total_tp for m in metrics_list)
        total_fp = sum(m.total_fp for m in metrics_list)
        total_fn = sum(m.total_fn for m in metrics_list)

        micro_precision = (
            total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
        )
        micro_recall = (
            total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
        )
        micro_weighted_acc = (micro_precision + micro_recall) / 2

        report += f"""
## Aggregated Metrics

### Macro Averages
- **Precision:** {macro_precision:.4f}
- **Recall:** {macro_recall:.4f}
- **Weighted Accuracy:** {macro_weighted_acc:.4f}

### Micro Averages
- **Precision:** {micro_precision:.4f}
- **Recall:** {micro_recall:.4f}
- **Weighted Accuracy:** {micro_weighted_acc:.4f}

## Per-Indicator Details

"""

    for m in metrics_list:
        report += f"""### {m.indicator}
- Samples evaluated: {m.total_samples}
- True Positives: {m.total_tp}
- False Positives: {m.total_fp}
- False Negatives: {m.total_fn}
- Precision: {m.precision:.4f}
- Recall: {m.recall:.4f}
- Weighted Accuracy: {m.weighted_accuracy:.4f}
- API Errors: {m.errors}

"""

    return report


def save_results(metrics_list: list[IndicatorMetrics], language: str, model: str):
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    json_path = REPORTS_DIR / f"{language}_{model}.json"
    json_data = [m.model_dump() for m in metrics_list]
    json_path.write_text(json.dumps(json_data, indent=2))
    console.print(f"[blue]JSON results saved to {json_path}[/blue]")

    report = generate_report(metrics_list, language, model)
    md_path = REPORTS_DIR / f"{language}_{model}.md"
    md_path.write_text(report)
    console.print(f"[blue]Report saved to {md_path}[/blue]")


async def main():
    parser = argparse.ArgumentParser(description="Evaluate LLM bias detection service")
    parser.add_argument(
        "--indicator",
        type=str,
        required=True,
        help="Indicator type or 'all' for all indicators",
    )
    parser.add_argument(
        "--language",
        type=str,
        required=True,
        help="Language code (en, cs, el, pt) or 'all' for all languages",
    )
    parser.add_argument(
        "--model",
        type=str,
        choices=["local", "remote"],
        default="remote",
        help="LLM model to use: 'local' (Qwen3-4B) or 'remote' (Gemini)",
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=None,
        help="Number of samples to use per indicator (default: all)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=5,
        help="Number of concurrent evaluation requests (default: 5)",
    )

    args = parser.parse_args()

    if args.indicator == "all":
        indicators = [i.value for i in IndicatorType]
    else:
        indicators = [args.indicator]

    if args.language == "all":
        languages = [l.value for l in LanguageCode]
    else:
        languages = [args.language]

    model_name = "Gemini (remote)" if args.model == "remote" else "Qwen3-4B (local)"
    console.print(f"[bold]LLM Evaluation[/bold]")
    console.print(f"Model: {model_name}")
    console.print(f"Indicators: {indicators}")
    console.print(f"Languages: {languages}")
    console.print(f"Concurrency: {args.concurrency}")
    if args.samples:
        console.print(f"Sample limit: {args.samples}")
    console.print()

    # Check service availability
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{LLM_SERVICE_URL}/docs", timeout=5.0)
            if response.status_code != 200:
                console.print(
                    "[yellow]Warning: LLM service may not be fully available[/yellow]"
                )
    except Exception as e:
        console.print(
            f"[red]Error: Cannot connect to LLM service at {LLM_SERVICE_URL}[/red]"
        )
        console.print(
            f"[red]Make sure to run: docker compose up -d llm-caller-service[/red]"
        )
        return

    for language in languages:
        all_metrics: list[IndicatorMetrics] = []

        for indicator in indicators:
            try:
                metrics = await evaluate_indicator(
                    indicator=indicator,
                    language=language,
                    model=args.model,
                    limit=args.samples,
                    concurrency=args.concurrency,
                )
                if metrics:
                    all_metrics.append(metrics)
                    # Save incrementally after each indicator to preserve progress
                    save_results(all_metrics, language, args.model)
                    console.print(
                        f"[green]Progress saved ({len(all_metrics)}/{len(indicators)} indicators)[/green]"
                    )
            except Exception as e:
                console.print(
                    f"[red]Error evaluating {indicator}_{language}: {e}[/red]"
                )
                logger.exception(f"Error evaluating {indicator}_{language}")

    console.print()
    console.print("[bold green]Evaluation complete![/bold green]")


if __name__ == "__main__":
    asyncio.run(main())
