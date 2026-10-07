import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("parity", Path(__file__).resolve().parents[2] /
    "tools/ai-draft-hardening/parity_check.py")
parity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parity)


def row(pid, score, pvid=None):
    return {"product_id": pid, "product_version_id": pvid or pid + "-v1", "score": score}


def test_business_identity_mismatch_fails():
    assert parity.compare_probe({}, [row("a", 1)], [row("b", 1, "a-v1")])[2] == "FAIL"


def test_nonfinite_score_fails():
    assert parity.compare_probe({}, [row("a", 1)], [row("a", float("nan"))])[2] == "FAIL"


def test_duplicate_identity_fails():
    assert parity.compare_probe({}, [row("a", 1), row("b", .5)],
                                [row("a", 1), row("a", .5)])[2] == "FAIL"


def test_transitive_tie_cannot_hide_non_tie_inversion():
    rows = [row("a", 1), row("b", .9999992), row("c", .9999984)]
    assert parity.compare_probe({}, rows, list(reversed(rows)))[2] == "FAIL"


def test_genuine_tie_permutation_allowed():
    rows = [row("a", 1), row("b", 1)]
    assert parity.compare_probe({}, rows, list(reversed(rows)))[2] == "TIE-OK"


def test_cutoff_tie_cannot_erase_shared_score_failure():
    f = [row("a", 1), row("b", .5)]
    q = [row("a", .9), row("c", .5)]
    fx, qx = f + [row("c", .5)], q + [row("b", .5)]
    fails, _, verdict = parity.compare_probe({}, f, q, extended=(fx, qx))
    assert verdict == "FAIL" and any("score" in fail for fail in fails)


def test_real_boundary_tie_is_explicit():
    f = [row("a", 1), row("b", .5)]
    q = [row("a", 1), row("c", .5)]
    assert parity.compare_probe({}, f, q, extended=(f+[row("c", .5)], q+[row("b", .5)]))[2] == "TIE-BOUNDARY"
