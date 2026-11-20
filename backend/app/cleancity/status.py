from enum import Enum


class ReportStatus(str, Enum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    ASSIGNED = "ASSIGNED"
    RESOLVED = "RESOLVED"
    DUPLICATE = "DUPLICATE"


ALLOWED_TRANSITIONS = {
    ReportStatus.SUBMITTED: {ReportStatus.UNDER_REVIEW, ReportStatus.REJECTED, ReportStatus.DUPLICATE},
    ReportStatus.UNDER_REVIEW: {ReportStatus.VERIFIED, ReportStatus.REJECTED, ReportStatus.DUPLICATE},
    ReportStatus.VERIFIED: {ReportStatus.ASSIGNED},
    ReportStatus.ASSIGNED: {ReportStatus.RESOLVED},
    ReportStatus.REJECTED: set(),
    ReportStatus.DUPLICATE: set(),
    ReportStatus.RESOLVED: set(),
}


class InvalidTransition(Exception):
    pass


def can_transition(current: ReportStatus, new: ReportStatus) -> bool:
    return new in ALLOWED_TRANSITIONS[current]


def transition(current: ReportStatus, new: ReportStatus) -> ReportStatus:
    if not can_transition(current, new):
        raise InvalidTransition(f"Cannot move {current.value} to {new.value}")
    return new