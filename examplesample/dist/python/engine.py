"""examplesample's statistics engine: pure Python, independent of React.

Values live at the centers of 40 bins on [0, 100]. A population is a list of
values and a list of weights. Draws are independent and with replacement.
The browser runs this exact file through Pyodide in a background worker.
"""

import bisect
import csv
import io
import json
import math
import random
import statistics

POPULATIONS = ("normal", "uniform", "skewed", "bimodal", "custom")
STATISTICS = ("mean", "median", "sd", "variance", "variance_unbiased", "mad", "range")
MAX_REPETITIONS = 100_000
BIN_COUNT = 40


def make_population(shape, custom_weights=None):
    """Turn the bars you draw into a probability distribution.

    A bar twice as tall gives its value twice the chance of being selected.
    Normalizing divides each weight by the total so probabilities sum to 1.
    """
    if shape not in POPULATIONS:
        raise ValueError("Choose a supported population shape.")
    values = [1.25 + 2.5 * i for i in range(BIN_COUNT)]
    if shape == "custom":
        if not isinstance(custom_weights, list) or len(custom_weights) != BIN_COUNT:
            raise ValueError("A custom population needs exactly 40 bar heights.")
        if any(isinstance(w, bool) or not isinstance(w, (int, float)) or not math.isfinite(w) or w < 0 or w > 1000 for w in custom_weights):
            raise ValueError("Bar heights must be finite numbers between 0 and 1000.")
        weights = custom_weights
    elif shape == "normal":
        weights = [math.exp(-0.5 * ((x - 50) / 15) ** 2) for x in values]
    elif shape == "uniform":
        weights = [1.0] * BIN_COUNT
    elif shape == "skewed":
        weights = [math.exp(-x / 18) for x in values]
    else:
        weights = [math.exp(-0.5 * ((x - 25) / 7) ** 2)
                   + math.exp(-0.5 * ((x - 75) / 7) ** 2) for x in values]
    # Presets use the same whole relative-weight blocks shown in the editor.
    if shape != "custom":
        peak = max(weights)
        weights = [round(weight / peak * 15) for weight in weights]
    total = sum(weights)
    if total <= 0:
        raise ValueError("Give at least one population bar a positive height.")
    return values, [weight / total for weight in weights]


def population_summary(values, probabilities):
    """Exact weighted moments of the finite parent population."""
    mu = sum(x * p for x, p in zip(values, probabilities))
    variance = sum(p * (x - mu) ** 2 for x, p in zip(values, probabilities))
    sd = math.sqrt(variance)
    cumulative = 0
    median = values[-1]
    for i, (value, probability) in enumerate(zip(values, probabilities)):
        cumulative += probability
        if cumulative >= 0.5 - 1e-12:
            if math.isclose(cumulative, 0.5, abs_tol=1e-12):
                next_value = next((values[j] for j in range(i + 1, len(values)) if probabilities[j] > 0), value)
                median = (value + next_value) / 2
            else:
                median = value
            break
    return {"mean": mu, "median": median, "sd": sd,
            "skew": sum(p * ((x - mu) / sd) ** 3 for x, p in zip(values, probabilities)) if sd else 0,
            "kurtosis": sum(p * ((x - mu) / sd) ** 4 for x, p in zip(values, probabilities)) - 3 if sd else 0}


def describe(values):
    """Descriptive moments use divisor N; spread estimates use sample SD below."""
    if not values:
        return {key: None for key in ("mean", "median", "sd", "skew", "kurtosis", "range")}
    result = population_summary(sorted(set(values)), [values.count(x) / len(values) for x in sorted(set(values))])
    result["range"] = max(values) - min(values)
    return result


def calculate_statistic(sample, statistic):
    if statistic == "mean":
        return statistics.mean(sample)
    if statistic == "median":
        return statistics.median(sample)
    if statistic == "sd":
        return statistics.pstdev(sample)
    if statistic == "variance":
        return statistics.pvariance(sample)
    if statistic == "variance_unbiased":
        return statistics.variance(sample)
    if statistic == "mad":
        center = statistics.mean(sample)
        return statistics.mean(abs(x - center) for x in sample)
    if statistic == "range":
        return max(sample) - min(sample)
    raise ValueError("Unsupported sample statistic.")


def statistic_maximum(statistic, sample_size):
    # Popoviciu's inequality bounds variance on [0,100] by 2500.
    if statistic == "variance":
        return 2500
    if statistic == "variance_unbiased":
        return 2500 * sample_size / (sample_size - 1)
    return 100


def histogram(values, bins=40, maximum=100):
    counts = [0] * bins
    for value in values:
        counts[min(bins - 1, max(0, int(value / maximum * bins)))] += 1
    return counts


class SamplingExperiment:
    """One editable parent population, two independently sampled experiments."""

    def __init__(self, shape="normal", sample_size=5, statistic="mean", seed=42,
                 custom_weights=None, comparison_statistic="none", comparison_size=25):
        for size in (sample_size, comparison_size):
            if isinstance(size, bool) or not isinstance(size, int) or not 2 <= size <= 100:
                raise ValueError("Sample size must be an integer from 2 to 100.")
        if statistic not in STATISTICS or comparison_statistic not in (*STATISTICS, "none"):
            raise ValueError("Choose a supported statistic.")
        if isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= 999_999:
            raise ValueError("Seed must be an integer from 0 to 999999.")
        self.shape, self.sample_size, self.statistic, self.seed = shape, sample_size, statistic, seed
        self.comparison_statistic, self.comparison_size = comparison_statistic, comparison_size
        self.rng = random.Random(seed)
        # Separate streams preserve the first experiment when comparison is toggled.
        self.comparison_rng = random.Random(seed + 1)
        self.values, self.probabilities = make_population(shape, custom_weights)
        self.population = population_summary(self.values, self.probabilities)
        self.cumulative = []
        cumulative = 0
        for probability in self.probabilities:
            cumulative += probability
            self.cumulative.append(cumulative)
        self.results, self.comparison_results = [], []
        self.latest_sample, self.comparison_sample = [], []

    def draw_sample(self, size, rng):
        # choices() samples WITH replacement. Repeated values are expected.
        return rng.choices(self.values, cum_weights=self.cumulative, k=size)

    def run(self, repetitions=1):
        if isinstance(repetitions, bool) or not isinstance(repetitions, int) or repetitions < 1:
            raise ValueError("Repetitions must be a positive integer.")
        if len(self.results) + repetitions > MAX_REPETITIONS:
            raise ValueError("The limit is 100,000 repetitions. Clear the samples to continue.")
        for _ in range(repetitions):
            self.latest_sample = self.draw_sample(self.sample_size, self.rng)
            self.results.append(calculate_statistic(self.latest_sample, self.statistic))
            if self.comparison_statistic != "none":
                self.comparison_sample = self.draw_sample(self.comparison_size, self.comparison_rng)
                self.comparison_results.append(calculate_statistic(self.comparison_sample, self.comparison_statistic))
        return self.snapshot()

    def distribution_summary(self, results, statistic, size):
        count = len(results)
        maximum = statistic_maximum(statistic, size)
        return {
            "statistic": statistic, "sample_size": size,
            "repetitions": count, "histogram": histogram(results, bins=50, maximum=maximum),
            "maximum": maximum,
            "latest_statistic": results[-1] if count else None,
            "center": statistics.mean(results) if count else None,
            "spread": statistics.stdev(results) if count > 1 else None,
            "theoretical_se": self.population["sd"] / math.sqrt(size) if statistic == "mean" else None,
        }

    def snapshot(self):
        return {
            **self.distribution_summary(self.results, self.statistic, self.sample_size),
            "shape": self.shape, "seed": self.seed,
            "population": {**self.population, "values": self.values, "probabilities": self.probabilities},
            "latest_sample": self.latest_sample, "sample_summary": describe(self.latest_sample),
            "comparison": {**self.distribution_summary(self.comparison_results, self.comparison_statistic, self.comparison_size),
                           "latest_sample": self.comparison_sample, "sample_summary": describe(self.comparison_sample)},
            "remaining": MAX_REPETITIONS - len(self.results),
        }

    def export_csv(self):
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(["experiment", "repetition", "statistic", "value", "sample_size", "population", "seed"])
        for name, results, statistic, size in [
            ("primary", self.results, self.statistic, self.sample_size),
            ("comparison", self.comparison_results, self.comparison_statistic, self.comparison_size),
        ]:
            for i, value in enumerate(results, start=1):
                writer.writerow([name, i, statistic, format(value, ".12g"), size, self.shape, self.seed])
        return output.getvalue()


_experiment = None


def dispatch_json(message):
    """JSON is the boundary between the React interface and Python engine."""
    global _experiment
    request = json.loads(message)
    action = request.get("action")
    if action == "reset":
        _experiment = SamplingExperiment(**request.get("config", {}))
        result = _experiment.snapshot()
    elif _experiment is None:
        raise ValueError("Initialize an experiment first.")
    elif action == "run":
        result = _experiment.run(request.get("repetitions", 1))
    elif action == "export":
        result = {"csv": _experiment.export_csv()}
    else:
        raise ValueError("Unknown simulation action.")
    return json.dumps(result)

