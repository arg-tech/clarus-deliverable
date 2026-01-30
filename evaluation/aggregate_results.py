#!/usr/bin/env python3
"""
Unified results aggregation script for all evaluation types.

Aggregates evaluation results for:
- LLM services (indicator-based phrase detection)
- Rule-based services (language-based lexicon matching)
- ML services (classification models)

Usage:
    uv run python aggregate_results.py --type llm
    uv run python aggregate_results.py --type rules
    uv run python aggregate_results.py --type ml
    uv run python aggregate_results.py --type all  # Aggregate all types
"""

import argparse
import json
from datetime import datetime
from pathlib import Path

from rich.console import Console
from rich.table import Table

from models import IndicatorMetrics

console = Console()

REPORTS_DIR = Path(__file__).parent / "reports"


# ============================================================================
# LLM Aggregation
# ============================================================================


def load_llm_results(language: str, model: str) -> list[IndicatorMetrics]:
    results_path = REPORTS_DIR / "llm" / f"{language}_{model}.json"
    if not results_path.exists():
        return []

    try:
        data = json.loads(results_path.read_text())
        return [IndicatorMetrics(**m) for m in data]
    except Exception as e:
        console.print(f"[red]Error loading {results_path}: {e}[/red]")
        return []


def discover_llm_results() -> dict[str, dict[str, list[IndicatorMetrics]]]:
    results: dict[str, dict[str, list[IndicatorMetrics]]] = {}
    llm_dir = REPORTS_DIR / "llm"

    if not llm_dir.exists():
        return results

    for path in llm_dir.glob("*.json"):
        parts = path.stem.rsplit("_", 1)
        if len(parts) != 2:
            continue
        lang, model = parts

        if lang == "summary" or model not in {"local", "remote"}:
            continue

        if model not in results:
            results[model] = {}

        metrics = load_llm_results(lang, model)
        if metrics:
            results[model][lang] = metrics

    return results


def calculate_llm_aggregates(metrics_list: list[IndicatorMetrics]) -> dict:
    if not metrics_list:
        return {}

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

    return {
        "macro_precision": macro_precision,
        "macro_recall": macro_recall,
        "macro_weighted_accuracy": macro_weighted_acc,
        "micro_precision": micro_precision,
        "micro_recall": micro_recall,
        "micro_weighted_accuracy": micro_weighted_acc,
        "total_tp": total_tp,
        "total_fp": total_fp,
        "total_fn": total_fn,
        "total_samples": sum(m.total_samples for m in metrics_list),
        "total_errors": sum(m.errors for m in metrics_list),
    }


def generate_llm_summary(
    all_results: dict[str, list[IndicatorMetrics]],
    model: str | None = None,
) -> str:
    model_name = None
    if model == "remote":
        model_name = "Gemini (remote)"
    elif model == "local":
        model_name = "Qwen3-4B (local)"

    title = (
        f"# LLM Evaluation Summary - {model_name}"
        if model_name
        else "# LLM Evaluation Summary"
    )
    model_line = f"**Model:** {model_name}\n" if model_name else ""

    report = f"""{title}

**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
{model_line}
## Overview

This report aggregates evaluation results across all bias indicators and languages.

"""

    # Overall metrics section
    all_metrics = []
    for lang_metrics in all_results.values():
        all_metrics.extend(lang_metrics)

    if all_metrics:
        overall = calculate_llm_aggregates(all_metrics)
        report += f"""## Overall Performance

| Metric | Macro Avg | Micro Avg |
|--------|-----------|-----------|
| Precision | {overall["macro_precision"]:.4f} | {overall["micro_precision"]:.4f} |
| Recall | {overall["macro_recall"]:.4f} | {overall["micro_recall"]:.4f} |
| Weighted Accuracy | {overall["macro_weighted_accuracy"]:.4f} | {overall["micro_weighted_accuracy"]:.4f} |

**Total Samples:** {overall["total_samples"]}
**Total Errors:** {overall["total_errors"]}

"""

    # By language section
    report += """## By Language

| Language | Precision | Recall | Weighted Acc | Samples | Errors |
|----------|-----------|--------|--------------|---------|--------|
"""

    for lang, metrics in all_results.items():
        if metrics:
            agg = calculate_llm_aggregates(metrics)
            report += f"| {lang.upper()} | {agg['micro_precision']:.4f} | {agg['micro_recall']:.4f} | {agg['micro_weighted_accuracy']:.4f} | {agg['total_samples']} | {agg['total_errors']} |\n"

    report += "\n"
    return report


def aggregate_llm():
    console.print("[bold]Aggregating LLM Evaluation Results[/bold]\n")

    llm_dir = REPORTS_DIR / "llm"
    llm_dir.mkdir(parents=True, exist_ok=True)

    all_model_results = discover_llm_results()

    if not all_model_results:
        console.print("[yellow]No LLM evaluation results found.[/yellow]")
        return

    for model, lang_results in sorted(all_model_results.items()):
        model_name = "Gemini (remote)" if model == "remote" else "Qwen3-4B (local)"
        table = Table(title=f"LLM Results - {model_name}")
        table.add_column("Language", style="cyan")
        table.add_column("Indicators", style="green")
        table.add_column("Precision", style="yellow")
        table.add_column("Recall", style="yellow")
        table.add_column("W. Accuracy", style="yellow")

        for lang, metrics in sorted(lang_results.items()):
            if metrics:
                agg = calculate_llm_aggregates(metrics)
                table.add_row(
                    lang.upper(),
                    str(len(metrics)),
                    f"{agg['micro_precision']:.4f}",
                    f"{agg['micro_recall']:.4f}",
                    f"{agg['micro_weighted_accuracy']:.4f}",
                )

        console.print(table)
        console.print()

        report = generate_llm_summary(lang_results, model)
        summary_path = llm_dir / f"summary_{model}.md"
        summary_path.write_text(report)
        console.print(f"[green]Summary saved to {summary_path}[/green]\n")

    console.print("[bold green]LLM aggregation complete![/bold green]\n")


# ============================================================================
# Rule-Based Aggregation
# ============================================================================


def discover_rule_based_results() -> dict[str, dict]:
    results = {}
    rules_dir = REPORTS_DIR / "rule-based"

    if not rules_dir.exists():
        return results

    for path in rules_dir.glob("*.json"):
        if path.stem == "summary":
            continue

        try:
            data = json.loads(path.read_text())
            # Handle both single language and summary formats
            if "languages" in data:
                for lang, metrics in data["languages"].items():
                    results[lang] = metrics
            else:
                # Assume single language file
                results[path.stem] = data
        except Exception as e:
            console.print(f"[red]Error loading {path}: {e}[/red]")

    return results


def calculate_rule_based_aggregates(results: dict[str, dict]) -> dict:
    if not results:
        return {}

    total_tp = sum(r.get("tp", 0) for r in results.values())
    total_fp = sum(r.get("fp", 0) for r in results.values())
    total_fn = sum(r.get("fn", 0) for r in results.values())
    total_samples = sum(r.get("samples", 0) for r in results.values())
    total_errors = sum(r.get("errors", 0) for r in results.values())

    micro_precision = (
        total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
    )
    micro_recall = (
        total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
    )
    micro_weighted_acc = (micro_precision + micro_recall) / 2

    macro_precision = sum(r.get("precision", 0) for r in results.values()) / len(
        results
    )
    macro_recall = sum(r.get("recall", 0) for r in results.values()) / len(results)
    macro_weighted_acc = sum(r.get("weighted_accuracy", 0) for r in results.values()) / len(
        results
    )

    return {
        "macro_precision": macro_precision,
        "macro_recall": macro_recall,
        "macro_weighted_accuracy": macro_weighted_acc,
        "micro_precision": micro_precision,
        "micro_recall": micro_recall,
        "micro_weighted_accuracy": micro_weighted_acc,
        "total_tp": total_tp,
        "total_fp": total_fp,
        "total_fn": total_fn,
        "total_samples": total_samples,
        "total_errors": total_errors,
    }


def generate_rule_based_summary(results: dict[str, dict]) -> str:
    report = f"""# Rule-Based Service Evaluation Summary

**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## Overview

This report aggregates evaluation results across all supported languages.

"""

    if results:
        overall = calculate_rule_based_aggregates(results)
        report += f"""## Overall Performance

| Metric | Macro Avg | Micro Avg |
|--------|-----------|-----------|
| Precision | {overall["macro_precision"]:.4f} | {overall["micro_precision"]:.4f} |
| Recall | {overall["macro_recall"]:.4f} | {overall["micro_recall"]:.4f} |
| Weighted Accuracy | {overall["macro_weighted_accuracy"]:.4f} | {overall["micro_weighted_accuracy"]:.4f} |

**Total Samples:** {overall["total_samples"]}
**Total TP:** {overall["total_tp"]}
**Total FP:** {overall["total_fp"]}
**Total FN:** {overall["total_fn"]}
**Total Errors:** {overall["total_errors"]}

"""

    # By language section
    report += """## By Language

| Language | Samples | TP | FP | FN | Precision | Recall | W. Accuracy | Errors |
|----------|---------|----|----|-------|-----------|--------|-------------|--------|
"""

    for lang, metrics in sorted(results.items()):
        report += f"| {lang.upper()} | {metrics.get('samples', 0)} | {metrics.get('tp', 0)} | {metrics.get('fp', 0)} | {metrics.get('fn', 0)} | {metrics.get('precision', 0):.4f} | {metrics.get('recall', 0):.4f} | {metrics.get('weighted_accuracy', 0):.4f} | {metrics.get('errors', 0)} |\n"

    report += "\n"
    return report


def aggregate_rule_based():
    console.print("[bold]Aggregating Rule-Based Evaluation Results[/bold]\n")

    rules_dir = REPORTS_DIR / "rule-based"
    rules_dir.mkdir(parents=True, exist_ok=True)

    results = discover_rule_based_results()

    if not results:
        console.print("[yellow]No rule-based evaluation results found.[/yellow]")
        return

    table = Table(title="Rule-Based Service Results")
    table.add_column("Language", style="cyan")
    table.add_column("Samples", style="green")
    table.add_column("Precision", style="yellow")
    table.add_column("Recall", style="yellow")
    table.add_column("W. Accuracy", style="yellow")

    for lang, metrics in sorted(results.items()):
        table.add_row(
            lang.upper(),
            str(metrics.get("samples", 0)),
            f"{metrics.get('precision', 0):.4f}",
            f"{metrics.get('recall', 0):.4f}",
            f"{metrics.get('weighted_accuracy', 0):.4f}",
        )

    console.print(table)
    console.print()

    report = generate_rule_based_summary(results)
    summary_path = rules_dir / "summary.md"
    summary_path.write_text(report)
    console.print(f"[green]Summary saved to {summary_path}[/green]")

    # Save JSON summary
    aggregates = calculate_rule_based_aggregates(results)
    summary_data = {"generated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "languages": results, "aggregates": aggregates}
    json_path = rules_dir / "summary.json"
    json_path.write_text(json.dumps(summary_data, indent=2))
    console.print(f"[green]JSON summary saved to {json_path}[/green]\n")

    console.print("[bold green]Rule-based aggregation complete![/bold green]\n")


# ============================================================================
# ML Aggregation
# ============================================================================


def discover_ml_results() -> dict[str, dict]:
    results = {}
    ml_dir = REPORTS_DIR / "ml"

    if not ml_dir.exists():
        return results

    for path in ml_dir.glob("*_results.json"):
        try:
            data = json.loads(path.read_text())
            service = data.get("service", path.stem.replace("_results", ""))
            results[service] = data
        except Exception as e:
            console.print(f"[red]Error loading {path}: {e}[/red]")

    return results


def calculate_ml_aggregates(results: dict[str, dict]) -> dict:
    if not results:
        return {}

    total_samples = sum(r.get("total_samples", 0) for r in results.values())

    # Calculate weighted average accuracy
    weighted_accuracy = sum(
        r.get("accuracy", 0) * r.get("total_samples", 0) for r in results.values()
    ) / total_samples if total_samples > 0 else 0.0

    # Calculate macro average (simple average)
    macro_accuracy = sum(r.get("accuracy", 0) for r in results.values()) / len(
        results
    )

    total_time = sum(r.get("processing_time", 0) for r in results.values())

    return {
        "macro_accuracy": macro_accuracy,
        "weighted_accuracy": weighted_accuracy,
        "total_samples": total_samples,
        "total_processing_time": total_time,
        "services_evaluated": len(results),
    }


def calculate_service_metrics(metrics: dict) -> tuple[float | None, float | None, float]:
    """Calculate precision, recall, and weighted accuracy for a service."""

    if "classification_report" in metrics:
        # Binary classifiers - calculate weighted average by support
        report = metrics["classification_report"]
        classes = [k for k in report.keys() if isinstance(report[k], dict)]

        if not classes:
            return None, None, metrics.get("accuracy", 0.0)

        total_support = sum(report[c]["support"] for c in classes)

        if total_support == 0:
            return None, None, metrics.get("accuracy", 0.0)

        weighted_precision = sum(
            report[c]["precision"] * report[c]["support"] for c in classes
        ) / total_support

        weighted_recall = sum(
            report[c]["recall"] * report[c]["support"] for c in classes
        ) / total_support

        weighted_accuracy = (weighted_precision + weighted_recall) / 2

        return weighted_precision, weighted_recall, weighted_accuracy

    elif "per_class_metrics" in metrics:
        # Sentiment - use overall accuracy, no precision/recall available
        return None, None, metrics.get("accuracy", 0.0)

    else:
        # Fallback to accuracy only
        return None, None, metrics.get("accuracy", 0.0)


def generate_ml_summary(results: dict[str, dict]) -> str:
    report = f"""# ML Services Evaluation Summary

**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## Overview

This report aggregates evaluation results across all ML classification services.

"""

    # Main results table
    report += """## Results Summary

| Bias Indicator | Precision | Recall | Weighted Accuracy |
|----------------|-----------|--------|-------------------|
"""

    for service, metrics in sorted(results.items()):
        service_name = service.replace("_", " ").title()
        precision, recall, weighted_acc = calculate_service_metrics(metrics)

        precision_str = f"{precision:.2f}" if precision is not None else "N/A"
        recall_str = f"{recall:.2f}" if recall is not None else "N/A"

        report += f"| {service_name} | {precision_str} | {recall_str} | {weighted_acc:.2f} |\n"

    report += "\n"

    if results:
        overall = calculate_ml_aggregates(results)
        report += f"""## Overall Statistics

| Metric | Value |
|--------|-------|
| Macro Average Accuracy | {overall["macro_accuracy"]:.4f} |
| Weighted Average Accuracy | {overall["weighted_accuracy"]:.4f} |
| Total Samples Evaluated | {overall["total_samples"]} |
| Total Processing Time | {overall["total_processing_time"]:.1f}s |
| Services Evaluated | {overall["services_evaluated"]} |

"""

    # By service section
    report += """## By Service

| Service | Samples | Accuracy | Processing Time |
|---------|---------|----------|-----------------|
"""

    for service, metrics in sorted(results.items()):
        service_name = service.replace("_", " ").title()
        report += f"| {service_name} | {metrics.get('total_samples', 0)} | {metrics.get('accuracy', 0):.4f} | {metrics.get('processing_time', 0):.1f}s |\n"

    report += "\n"

    # Detailed metrics per service
    report += """## Detailed Metrics

"""

    for service, metrics in sorted(results.items()):
        service_name = service.replace("_", " ").title()
        report += f"### {service_name}\n\n"

        if "classification_report" in metrics:
            report += "| Class | Precision | Recall | F1-Score | Support |\n"
            report += "|-------|-----------|--------|----------|--------|\n"

            for class_name, class_metrics in metrics["classification_report"].items():
                report += f"| {class_name} | {class_metrics.get('precision', 0):.4f} | {class_metrics.get('recall', 0):.4f} | {class_metrics.get('f1-score', 0):.4f} | {class_metrics.get('support', 0)} |\n"
            report += "\n"

        elif "per_class_metrics" in metrics:
            # Sentiment-style metrics
            report += "| Class | Accuracy | Correct | Total |\n"
            report += "|-------|----------|---------|-------|\n"

            for class_name, class_metrics in metrics["per_class_metrics"].items():
                report += f"| {class_name} | {class_metrics.get('accuracy', 0):.4f} | {class_metrics.get('correct', 0)} | {class_metrics.get('total', 0)} |\n"
            report += "\n"

    return report


def aggregate_ml():
    console.print("[bold]Aggregating ML Evaluation Results[/bold]\n")

    ml_dir = REPORTS_DIR / "ml"
    ml_dir.mkdir(parents=True, exist_ok=True)

    results = discover_ml_results()

    if not results:
        console.print("[yellow]No ML evaluation results found.[/yellow]")
        return

    table = Table(title="ML Services Results")
    table.add_column("Bias Indicator", style="cyan")
    table.add_column("Precision", style="yellow")
    table.add_column("Recall", style="yellow")
    table.add_column("Weighted Accuracy", style="green")

    for service, metrics in sorted(results.items()):
        service_name = service.replace("_", " ").title()
        precision, recall, weighted_acc = calculate_service_metrics(metrics)

        precision_str = f"{precision:.2f}" if precision is not None else "N/A"
        recall_str = f"{recall:.2f}" if recall is not None else "N/A"

        table.add_row(
            service_name,
            precision_str,
            recall_str,
            f"{weighted_acc:.2f}",
        )

    console.print(table)
    console.print()

    report = generate_ml_summary(results)
    summary_path = ml_dir / "summary.md"
    summary_path.write_text(report)
    console.print(f"[green]Summary saved to {summary_path}[/green]")

    # Save JSON summary
    aggregates = calculate_ml_aggregates(results)
    summary_data = {
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "services": results,
        "aggregates": aggregates,
    }
    json_path = ml_dir / "summary.json"
    json_path.write_text(json.dumps(summary_data, indent=2))
    console.print(f"[green]JSON summary saved to {json_path}[/green]\n")

    console.print("[bold green]ML aggregation complete![/bold green]\n")


# ============================================================================
# Main
# ============================================================================


def main():
    parser = argparse.ArgumentParser(
        description="Aggregate evaluation results for Clarus services"
    )
    parser.add_argument(
        "--type",
        type=str,
        choices=["llm", "rules", "ml", "all"],
        default="all",
        help="Type of evaluation to aggregate (default: all)",
    )
    args = parser.parse_args()

    console.print("\n[bold cyan]Clarus Evaluation Results Aggregation[/bold cyan]\n")

    if args.type in ["llm", "all"]:
        aggregate_llm()

    if args.type in ["rules", "all"]:
        aggregate_rule_based()

    if args.type in ["ml", "all"]:
        aggregate_ml()

    console.print("[bold green]All aggregations complete![/bold green]\n")


if __name__ == "__main__":
    main()
