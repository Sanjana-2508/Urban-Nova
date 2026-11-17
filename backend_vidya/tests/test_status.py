import pytest
from app.cleancity.status import ReportStatus, InvalidTransition, can_transition, transition


def test_valid_path_to_resolved():
    s = ReportStatus.SUBMITTED
    for nxt in [ReportStatus.UNDER_REVIEW, ReportStatus.VERIFIED,
                ReportStatus.ASSIGNED, ReportStatus.RESOLVED]:
        s = transition(s, nxt)
    assert s == ReportStatus.RESOLVED


def test_cannot_skip_review():
    assert not can_transition(ReportStatus.SUBMITTED, ReportStatus.RESOLVED)
    with pytest.raises(InvalidTransition):
        transition(ReportStatus.SUBMITTED, ReportStatus.ASSIGNED)


@pytest.mark.parametrize("final", [ReportStatus.REJECTED, ReportStatus.DUPLICATE, ReportStatus.RESOLVED])
def test_final_states_cannot_change(final):
    for target in ReportStatus:
        assert not can_transition(final, target)