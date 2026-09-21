from ml.retrieval.metrics import (
    precision_at_k,
    recall_at_k,
    reciprocal_rank_at_k,
    target_recall_at_k,
)


def test_metric_fixture_matches_hand_calculation() -> None:
    ranked = ["a", "b", "c", "d"]
    relevant = {"b", "d"}
    assert precision_at_k(ranked, relevant, 2) == 0.5
    assert recall_at_k(ranked, relevant, 2) == 0.5
    assert reciprocal_rank_at_k(ranked, relevant, 4) == 0.5
    assert target_recall_at_k(ranked, "d", 3) == 0.0
    assert target_recall_at_k(ranked, "d", 4) == 1.0


def test_empty_relevance_is_defined_as_zero_recall() -> None:
    assert recall_at_k(["a"], set(), 1) == 0.0
