"""Deterministic, safe renderer for an approved PRISM 5S company XLSX template."""
import copy
import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.drawing.image import Image
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

CELL = re.compile(r"^[A-Z]{1,3}[1-9][0-9]*$")
SAFE_IMAGE = {"image/jpeg", "image/png"}


def value(field):
    return field.get("correctedValue", field.get("normalizedValue", field.get("rawText", "")))


def assign(cell, raw):
    if cell.data_type == "f":
        raise ValueError(f"Mapped target {cell.coordinate} contains a formula and cannot be overwritten")
    if isinstance(raw, str) and raw[:1] in ("=", "+", "-", "@"):
        raw = "'" + raw
    cell.value = raw


def process_rows(sheet, mapping, rows):
    start = mapping["target"]
    if not CELL.match(start):
        raise ValueError("Repeatable process-row target must be a cell address")
    match = re.match(r"([A-Z]+)([0-9]+)", start)
    column, row_number = match.group(1), int(match.group(2))
    first_column = 0
    for char in column:
        first_column = first_column * 26 + ord(char) - 64
    fields = ["sequenceNumber", "stageNumber", "processElement", "startTime", "endTime", "stopwatchReading", "spindleRpm", "feed", "depthOfCut", "materialStock", "numberOfPasses", "nvaActivity", "cuttingToolReference", "remarks"]
    for row_offset, item in enumerate(rows):
        destination = row_number + row_offset
        if row_offset:
            sheet.row_dimensions[destination].height = sheet.row_dimensions[row_number].height
        for offset, field_name in enumerate(fields):
            source = sheet.cell(row_number, first_column + offset)
            target = sheet.cell(destination, first_column + offset)
            if row_offset:
                target._style = copy.copy(source._style)
                target.number_format = source.number_format
                target.alignment = copy.copy(source.alignment)
                target.border = copy.copy(source.border)
                target.fill = copy.copy(source.fill)
                target.font = copy.copy(source.font)
            assign(target, item.get(field_name, ""))


def image_sheet(workbook, request):
    if len(workbook.worksheets) > 2:
        raise ValueError("Imported templates with more than two worksheets are not supported for the mandatory two-sheet export")
    if len(workbook.worksheets) == 1:
        sheet = workbook.create_sheet("Machinery Images")
    else:
        sheet = workbook.worksheets[1]
        if sheet.title != "Machinery Images":
            raise ValueError("The optional second template worksheet must be named Machinery Images; unrelated worksheet content cannot be overwritten")
        sheet.title = "Machinery Images"
        sheet.delete_rows(1, sheet.max_row)
        sheet._images = []
    sheet.title = "Machinery Images"
    sheet["A1"] = "Machinery Image Timeline"
    sheet["A1"].font = Font(bold=True, color="FFFFFF")
    sheet["A1"].fill = PatternFill("solid", fgColor="0F62FE")
    for col, text in enumerate(["Sequence", "Capture time", "Category", "Timestamp source", "Embedded photograph"], 1):
        cell = sheet.cell(3, col, text)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="0F62FE")
    sheet.column_dimensions["A"].width = 12
    sheet.column_dimensions["B"].width = 24
    sheet.column_dimensions["C"].width = 22
    sheet.column_dimensions["D"].width = 20
    sheet.column_dimensions["E"].width = 72
    for index, item in enumerate(request.get("images", [])):
        row = 5 + index * 3
        sheet.row_dimensions[row].height = 170
        sheet.cell(row, 1, index + 1)
        sheet.cell(row, 2, item.get("resolvedCaptureDatetime") or "Timestamp unresolved")
        sheet.cell(row, 3, item.get("imageCategory") or "unclassified")
        sheet.cell(row, 4, item.get("timestampSource") or "unresolved")
        content_type = item.get("contentType")
        path = item.get("localPath")
        if content_type not in SAFE_IMAGE or not path:
            sheet.cell(row, 5, "Image could not be embedded: unsupported format")
            continue
        picture = Image(path)
        picture.width = 500
        picture.height = min(160, max(80, int(picture.height * 500 / max(1, picture.width))))
        sheet.add_image(picture, f"E{row}")


def main():
    request = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    workbook = load_workbook(request["templatePath"], data_only=False, keep_vba=False, keep_links=False)
    if not workbook.worksheets:
        raise ValueError("Imported workbook has no worksheets")
    report = workbook.worksheets[0]
    original_report_title = report.title
    report.title = "Inspection Report"
    extracted = {field.get("fieldKey"): value(field) for field in request.get("fields", [])}
    for mapping in request.get("fieldMappings", []):
        worksheet = mapping.get("worksheet")
        if worksheet and worksheet != original_report_title and worksheet != "Inspection Report":
            raise ValueError(f"Mapping for {mapping.get('canonicalField')} targets unsupported worksheet {worksheet}")
        if mapping.get("repeatable") == "process_rows":
            process_rows(report, mapping, request.get("processRows", []))
        elif mapping.get("canonicalField") in extracted:
            target = mapping.get("target", "")
            if not CELL.match(target):
                raise ValueError(f"Invalid template target {target}")
            assign(report[target], extracted[mapping["canonicalField"]])
    image_sheet(workbook, request)
    workbook.active = 0
    workbook.save(request["outputPath"])


if __name__ == "__main__":
    main()
