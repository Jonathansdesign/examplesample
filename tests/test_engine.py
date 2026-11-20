import csv
import io
import json
import math
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "python"))
from engine import SamplingExperiment, calculate_statistic, make_population, population_summary, histogram, dispatch_json


class PopulationTests(unittest.TestCase):
    def test_presets_are_valid_probability_distributions(self):
        for shape in ("normal", "uniform", "skewed", "bimodal"):
            with self.subTest(shape=shape):
                values, probabilities = make_population(shape)
                self.assertEqual(len(values), 40)
                self.assertAlmostEqual(sum(probabilities), 1)
                self.assertTrue(all(p >= 0 for p in probabilities))
                summary = population_summary(values, probabilities)
                self.assertGreater(summary["sd"], 0)
                if shape != "skewed":
                    self.assertAlmostEqual(summary["mean"], 50)
                    self.assertAlmostEqual(summary["median"], 50)
                    self.assertAlmostEqual(summary["skew"], 0)

    def test_drawing_changes_real_sampling_probabilities(self):
        weights = [0] * 40
        weights[9] = 7
        experiment = SamplingExperiment(shape="custom", custom_weights=weights)
        result = experiment.run(100)
        self.assertEqual(set(experiment.latest_sample), {23.75})
        self.assertEqual(set(experiment.results), {23.75})
        self.assertEqual(result["population"]["mean"], 23.75)
        self.assertEqual(result["theoretical_se"], 0)

    def test_relative_heights_not_absolute_heights_set_probabilities(self):
        _, a = make_population("custom", [1, 2] + [0] * 38)
        _, b = make_population("custom", [4, 8] + [0] * 38)
        self.assertEqual(a, b)
        self.assertAlmostEqual(a[1], 2 / 3)

    def test_empty_negative_and_nonfinite_drawings_are_rejected(self):
        for weights in ([0] * 40, [-1] + [1] * 39, [float("nan")] * 40, [float("inf")] * 40, [1] * 39):
            with self.assertRaises(ValueError):
                make_population("custom", weights)


class SimulationTests(unittest.TestCase):
    def test_seed_and_batching_are_reproducible(self):
        first, second = SamplingExperiment(), SamplingExperiment()
        first.run(30)
        second.run(10)
        second.run(20)
        self.assertEqual(first.results, second.results)
        self.assertEqual(first.latest_sample, second.latest_sample)

    def test_comparison_uses_independent_stream_and_its_own_sample_size(self):
        single = SamplingExperiment(seed=7)
        dual = SamplingExperiment(seed=7, comparison_statistic="median", comparison_size=25)
        single.run(40)
        result = dual.run(40)
        self.assertEqual(single.results, dual.results)
        self.assertEqual(result["comparison"]["repetitions"], 40)
        self.assertEqual(len(result["comparison"]["latest_sample"]), 25)
        self.assertNotEqual(dual.latest_sample, dual.comparison_sample[:5])
        self.assertIsNone(result["comparison"]["theoretical_se"])

    def test_standard_error_scales_with_square_root_of_n(self):
        small = SamplingExperiment(sample_size=5).snapshot()
        large = SamplingExperiment(sample_size=20).snapshot()
        self.assertAlmostEqual(small["theoretical_se"] / large["theoretical_se"], 2)

    def test_monte_carlo_mean_and_se_agree_with_theory(self):
        for shape in ("normal", "uniform", "skewed", "bimodal"):
            with self.subTest(shape=shape):
                result = SamplingExperiment(shape=shape, sample_size=25, seed=2026).run(12000)
                se = result["theoretical_se"]
                # Tolerances exceed five standard errors of the Monte Carlo estimates.
                self.assertLess(abs(result["center"] - result["population"]["mean"]), 5 * se / math.sqrt(12000))
                self.assertLess(abs(result["spread"] / se - 1), .04)
                self.assertEqual(sum(result["histogram"]), 12000)

    def test_statistic_definitions_and_correct_variance_axes(self):
        sample = [1, 2, 3]
        expected = {"mean": 2, "median": 2, "sd": math.sqrt(2 / 3), "variance": 2 / 3, "variance_unbiased": 1, "mad": 2 / 3, "range": 2}
        for statistic, value in expected.items():
            with self.subTest(statistic=statistic):
                self.assertAlmostEqual(calculate_statistic(sample, statistic), value)
                experiment = SamplingExperiment(statistic=statistic)
                result = experiment.run(100)
                self.assertEqual(sum(result["histogram"]), 100)
                self.assertTrue(all(0 <= x <= result["maximum"] for x in experiment.results))
                if statistic != "mean":
                    self.assertIsNone(result["theoretical_se"])

    def test_sample_size_repetitions_and_initial_state(self):
        experiment = SamplingExperiment(sample_size=10)
        self.assertIsNone(experiment.snapshot()["center"])
        result = experiment.run(7)
        self.assertEqual(len(result["latest_sample"]), 10)
        self.assertEqual(result["repetitions"], 7)
        self.assertEqual(sum(result["histogram"]), 7)
        self.assertEqual(result["comparison"]["repetitions"], 0)

    def test_histogram_includes_boundaries(self):
        counts = histogram([0, 2.49, 2.5, 100])
        self.assertEqual(counts[0], 2)
        self.assertEqual(counts[1], 1)
        self.assertEqual(counts[-1], 1)

    def test_validation_and_limit(self):
        for config in ({"sample_size": 1}, {"sample_size": 5.5}, {"seed": True}, {"statistic": "bogus"}, {"comparison_size": 101}):
            with self.assertRaises(ValueError):
                SamplingExperiment(**config)
        experiment = SamplingExperiment(sample_size=2)
        for repetitions in (0, -1, 1.5, True, 100001):
            with self.assertRaises(ValueError):
                experiment.run(repetitions)

    def test_export_contains_both_experiments(self):
        experiment = SamplingExperiment(comparison_statistic="mean", comparison_size=25)
        experiment.run(3)
        rows = list(csv.DictReader(io.StringIO(experiment.export_csv())))
        self.assertEqual(len(rows), 6)
        self.assertEqual({row["experiment"] for row in rows}, {"primary", "comparison"})
        self.assertEqual(rows[3]["sample_size"], "25")

    def test_browser_json_boundary(self):
        json.loads(dispatch_json(json.dumps({"action": "reset", "config": {"shape": "uniform"}})))
        result = json.loads(dispatch_json(json.dumps({"action": "run", "repetitions": 5})))
        self.assertEqual(result["repetitions"], 5)


if __name__ == "__main__":
    unittest.main()

