from apps.common.exports import sanitize_excel_value


def test_sanitize_excel_value_prefixes_formula_like_content():
    assert sanitize_excel_value("=2+2") == "'=2+2"
    assert sanitize_excel_value("+cmd") == "'+cmd"
    assert sanitize_excel_value("-10") == "'-10"
    assert sanitize_excel_value("@hidden") == "'@hidden"


def test_sanitize_excel_value_prefixes_leading_whitespace_formula_like_content():
    assert sanitize_excel_value("   =2+2") == "'   =2+2"


def test_sanitize_excel_value_keeps_safe_strings_and_non_strings():
    assert sanitize_excel_value("Ana Pereira") == "Ana Pereira"
    assert sanitize_excel_value(1200) == 1200
