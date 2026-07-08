import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET


NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def col_to_index(cell_ref):
    match = re.match(r"([A-Z]+)", cell_ref or "")
    if not match:
        return 0
    index = 0
    for ch in match.group(1):
        index = index * 26 + (ord(ch) - ord("A") + 1)
    return index - 1


def entry_text(zf, name):
    with zf.open(name) as fh:
        return fh.read()


def shared_strings(zf):
    try:
        root = ET.fromstring(entry_text(zf, "xl/sharedStrings.xml"))
    except KeyError:
        return []

    values = []
    for si in root.findall("main:si", NS):
        parts = [node.text or "" for node in si.findall(".//main:t", NS)]
        values.append("".join(parts))
    return values


def cell_value(cell, shared):
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//main:t", NS))

    value = cell.find("main:v", NS)
    if value is None:
        return ""

    text = value.text or ""
    if cell_type == "s":
        try:
            return shared[int(text)]
        except (ValueError, IndexError):
            return text
    return text


def sheet_preview(zf, target, shared, max_rows=8, max_cols=14):
    entry = "xl/" + target.lstrip("/")
    root = ET.fromstring(entry_text(zf, entry))
    dimension = root.find("main:dimension", NS)
    dimension_ref = dimension.attrib.get("ref") if dimension is not None else ""
    rows = []

    for row in root.findall(".//main:sheetData/main:row", NS)[:max_rows]:
        values = [""] * max_cols
        for cell in row.findall("main:c", NS):
            idx = col_to_index(cell.attrib.get("r", ""))
            if 0 <= idx < max_cols:
                values[idx] = cell_value(cell, shared)
        while values and values[-1] == "":
            values.pop()
        rows.append(values)

    return dimension_ref, rows


def main(path, max_rows=8, max_cols=14):
    with zipfile.ZipFile(path) as zf:
        workbook = ET.fromstring(entry_text(zf, "xl/workbook.xml"))
        rels = ET.fromstring(entry_text(zf, "xl/_rels/workbook.xml.rels"))
        rel_by_id = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels.findall("pkgrel:Relationship", NS)
        }
        shared = shared_strings(zf)

        sheets = []
        for sheet in workbook.findall(".//main:sheets/main:sheet", NS):
            name = sheet.attrib.get("name", "")
            rel_id = sheet.attrib.get(f"{{{NS['rel']}}}id", "")
            target = rel_by_id.get(rel_id, "")
            dimension, preview_rows = sheet_preview(zf, target, shared, max_rows, max_cols)
            sheets.append(
                {
                    "name": name,
                    "dimension": dimension,
                    "previewRows": preview_rows,
                }
            )

    print(json.dumps({"sheets": sheets}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    rows = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    cols = int(sys.argv[3]) if len(sys.argv) > 3 else 14
    main(sys.argv[1], rows, cols)
