import json
import subprocess
import sys
import tempfile
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font
from PIL import Image


with tempfile.TemporaryDirectory() as directory:
    base = Path(directory)
    template = base / "template.xlsx"
    output = base / "output.xlsx"
    picture = base / "machine.png"
    request = base / "request.json"
    workbook = Workbook()
    report = workbook.active
    report.title = "Company Layout"
    report.merge_cells("A1:B1")
    report["A1"] = "Company Report"
    report["B2"].font = Font(bold=True, color="FF0000")
    workbook.create_sheet("Photo Layout")
    workbook.save(template)
    Image.new("RGB", (20, 20), (0, 80, 200)).save(picture)
    request.write_text(json.dumps({
        "templatePath": str(template), "outputPath": str(output),
        "fieldMappings": [{"canonicalField": "machine_name", "label": "Machine", "target": "B2"}],
        "fields": [{"fieldKey": "machine_name", "normalizedValue": "CNC-01"}], "processRows": [],
        "images": [{"contentType": "image/png", "localPath": str(picture), "resolvedCaptureDatetime": "2026-11-14T09:45:00", "imageCategory": "inspection", "timestampSource": "user_confirmed"}],
    }), encoding="utf-8")
    subprocess.run([sys.executable, str(Path(__file__).with_name("industrial-5s-template-render.py")), str(request)], check=True)
    result = load_workbook(output)
    assert result.sheetnames == ["Inspection Report", "Machinery Images"]
    assert result["Inspection Report"]["B2"].value == "CNC-01"
    assert result["Inspection Report"]["B2"].font.bold
    assert "A1:B1" in {str(item) for item in result["Inspection Report"].merged_cells.ranges}
    assert len(result["Machinery Images"]._images) == 1
