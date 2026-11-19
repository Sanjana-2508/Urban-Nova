import pytest

from app.cleancity.uploads import (
    UploadError,
    make_storage_key,
    validate_image,
)

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 100
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 100


def test_valid_jpeg_and_png():
    assert validate_image(JPEG, "image/jpeg") == ".jpg"
    assert validate_image(PNG, "image/png") == ".png"


def test_content_type_with_parameters_is_accepted():
    assert validate_image(JPEG, "Image/JPEG; charset=binary") == ".jpg"


def test_empty_file_rejected():
    with pytest.raises(UploadError) as e:
        validate_image(b"", "image/jpeg")
    assert e.value.code == "EMPTY_FILE"


def test_too_large_rejected():
    with pytest.raises(UploadError) as e:
        validate_image(JPEG, "image/jpeg", max_bytes=50)
    assert e.value.code == "FILE_TOO_LARGE"


def test_unsupported_declared_type_rejected():
    with pytest.raises(UploadError) as e:
        validate_image(b"GIF89a" + b"0" * 50, "image/gif")
    assert e.value.code == "UNSUPPORTED_TYPE"


def test_fake_image_rejected_even_if_declared_jpeg():
    with pytest.raises(UploadError) as e:
        validate_image(b"<script>alert(1)</script>", "image/jpeg")
    assert e.value.code == "UNSUPPORTED_TYPE"


def test_declared_type_must_match_content():
    with pytest.raises(UploadError) as e:
        validate_image(PNG, "image/jpeg")
    assert e.value.code == "TYPE_MISMATCH"


def test_storage_key_is_random_and_safe():
    a, b = make_storage_key(".jpg"), make_storage_key(".jpg")
    assert a != b
    assert a.endswith(".jpg")
    assert len(a) == 32 + len(".jpg")
    assert "/" not in a and "\\" not in a


def test_storage_key_rejects_other_extensions():
    with pytest.raises(ValueError):
        make_storage_key(".exe")
