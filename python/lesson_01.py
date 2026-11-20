"""Lesson 1: the two lists behind a sampling-distribution simulator.

Run: python python/lesson_01.py
Only Python's standard library is needed. No React knowledge required.
"""

import random
import statistics


def simulate_means(population, sample_size, repetitions, seed=42):
    """Return ONE mean per independent sample, not all the raw observations."""
    rng = random.Random(seed)
    sample_means = []
    for _ in range(repetitions):
        # One list of sample_size observations. Sampling is with replacement.
        sample = rng.choices(population, k=sample_size)
        sample_means.append(statistics.mean(sample))
    return sample_means


if __name__ == "__main__":
    # Think of a fair six-sided die. Its population mean is 3.5.
    population = [1, 2, 3, 4, 5, 6]
    mu = statistics.mean(population)
    sigma = statistics.pstdev(population)
    for n in (5, 50):
        results = simulate_means(population, sample_size=n, repetitions=10_000)
        print(f"n={n:2}: center={statistics.mean(results):.3f}, "
              f"observed SE={statistics.stdev(results):.3f}, "
              f"theoretical SE={sigma / n**0.5:.3f}")
    print(f"Population mean = {mu}")
    print("\nExperiment: change repetitions while keeping n fixed.")
    print("Which changes the true sampling distribution: n, repetitions, or both?")

# Next experiments:
# 1. Put an extreme value into population. Compare the mean and median.
# 2. Return both the latest sample and the list of means. What do their lengths mean?
# 3. In engine.py, read make_population(): unequal weights replace this uniform die.
# 4. Trace one call to SamplingExperiment.run(1) from sample to stored statistic.
