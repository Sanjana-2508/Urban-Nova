"""Checks for citizen photo uploads (FR-07).

Rules:
- The client's filename is never used or trusted.
- The file type is decided from the file's first bytes (JPEG or PNG only),
  and must agree with the content type the client declared.
- Files must be non-empty and no larger than the size limit.
- Stored files get a random name generated here, never a client-provided one.
"""

import uuid

ALLOWED_CONTENT_TYPES = {"image/jpeg": ".jpg", "image/png": ".png"}
DEFAULT_MAX_BYTES = 5 * 1024 * 1024  # 5 MB - proposed, to be agreed with the team

JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


class UploadError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def detect_image_type(data: bytes) -> str | None:
    """Return '.jpg' or '.png' based on the file's first bytes, else None."""
    if data.startswith(JPEG_MAGIC):
        return ".jpg"
    if data.startswith(PNG_MAGIC):
        return ".png"
    return None


def validate_image(data: bytes, content_type: str, max_bytes: int = DEFAULT_MAX_BYTES) -> str:
    """Validate an uploaded photo. Returns the safe extension ('.jpg' or '.png')."""
    if len(data) == 0:
        raise UploadError("EMPTY_FILE", "The uploaded file is empty")
    if len(data) > max_bytes:
        raise UploadError("FILE_TOO_LARGE", f"File is larger than {max_bytes} bytes")

    declared = content_type.split(";")[0].strip().lower()
    if declared not in ALLOWED_CONTENT_TYPES:
        raise UploadError("UNSUPPORTED_TYPE", "Only JPEG and PNG images are allowed")

    detected = detect_image_type(data)
    if detected is None:
        raise UploadError("UNSUPPORTED_TYPE", "File content is not a JPEG or PNG image")
    if detected != ALLOWED_CONTENT_TYPES[declared]:
        raise UploadError("TYPE_MISMATCH", "File content does not match its declared type")
    return detected


def make_storage_key(extension: str) -> str:
    """Random storage name, e.g. '3f2a...c1.jpg'. Never derived from user input."""
    if extension not in {".jpg", ".png"}:
        raise ValueError("extension must be .jpg or .png")
    return f"{uuid.uuid4().hex}{extension}"
