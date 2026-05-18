from datetime import date


def format_pt_date(value: date) -> str:
    return value.strftime("%d/%m/%Y")
