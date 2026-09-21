#!/usr/bin/env python3
"""Apply formal academic layout and robust table/footer settings to the handbook."""

from pathlib import Path
import sys

from docx import Document
from docx.enum.section import WD_SECTION_START
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Mm, Pt, RGBColor


FONT = "Times New Roman"
INK = "162436"
BLUE = "1F4E78"
PALE_BLUE = "EEF4F8"
GRID = "B7C9D6"


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=70, left=90, bottom=70, right=90) -> None:
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin_name, value in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        node = tc_mar.find(qn(f"w:{margin_name}"))
        if node is None:
            node = OxmlElement(f"w:{margin_name}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table, color=GRID, size="5") -> None:
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = f"w:{edge}"
        node = borders.find(qn(tag))
        if node is None:
            node = OxmlElement(tag)
            borders.append(node)
        node.set(qn("w:val"), "single")
        node.set(qn("w:sz"), size)
        node.set(qn("w:space"), "0")
        node.set(qn("w:color"), color)


def repeat_table_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = tr_pr.find(qn("w:tblHeader"))
    if tbl_header is None:
        tbl_header = OxmlElement("w:tblHeader")
        tr_pr.append(tbl_header)
    tbl_header.set(qn("w:val"), "true")


def style_run(run, *, size=10, bold=None, color=INK, font=FONT) -> None:
    run.font.name = font
    run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.rFonts
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    for attr in ("ascii", "hAnsi", "eastAsia", "cs"):
        rfonts.set(qn(f"w:{attr}"), font)


def add_page_number(paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.first_line_indent = Mm(0)
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, separate, text, end])
    style_run(run, size=10, color="666666")


def enable_update_fields(doc) -> None:
    settings = doc.settings._element
    node = settings.find(qn("w:updateFields"))
    if node is None:
        node = OxmlElement("w:updateFields")
        settings.append(node)
    node.set(qn("w:val"), "true")


def style_paragraph_runs(paragraph, size=12, color=INK) -> None:
    for run in paragraph.runs:
        # Preserve monospace code font where Pandoc explicitly supplied one.
        font = "Consolas" if paragraph.style and paragraph.style.name == "Source Code" else FONT
        style_run(run, size=size, color=color, font=font)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: postprocess_docx.py DOCUMENT.docx")
    path = Path(sys.argv[1]).resolve()
    doc = Document(path)

    for section in doc.sections:
        section.start_type = WD_SECTION_START.NEW_PAGE
        section.page_width = Mm(210)
        section.page_height = Mm(297)
        section.top_margin = Mm(25)
        section.bottom_margin = Mm(25)
        section.left_margin = Mm(30)
        section.right_margin = Mm(20)
        section.header_distance = Mm(12)
        section.footer_distance = Mm(12)
        section.different_first_page_header_footer = True
        footer = section.footer
        footer.is_linked_to_previous = False
        for p in list(footer.paragraphs):
            p._element.getparent().remove(p._element)
        add_page_number(footer.add_paragraph())

    enable_update_fields(doc)

    # Apply robust paragraph pagination and typography after conversion.
    first_heading_seen = False
    for p in doc.paragraphs:
        style_name = p.style.name if p.style else ""
        text = p.text.strip()
        fmt = p.paragraph_format
        fmt.widow_control = True

        if style_name == "Title":
            fmt.alignment = WD_ALIGN_PARAGRAPH.CENTER
            fmt.space_before = Pt(78)
            fmt.space_after = Pt(16)
            fmt.first_line_indent = Mm(0)
            style_paragraph_runs(p, 20, BLUE)
        elif style_name == "Subtitle":
            fmt.alignment = WD_ALIGN_PARAGRAPH.CENTER
            fmt.space_after = Pt(28)
            fmt.first_line_indent = Mm(0)
            style_paragraph_runs(p, 14, INK)
        elif style_name in ("Author", "Date"):
            fmt.alignment = WD_ALIGN_PARAGRAPH.CENTER
            fmt.first_line_indent = Mm(0)
            fmt.space_after = Pt(7)
            style_paragraph_runs(p, 12, INK)
        elif style_name.startswith("Heading"):
            # LibreOffice can badly stretch a large following table when the
            # heading is forced to stay with it. Top-level chapters already
            # have an explicit page break, so keep-with-next is unnecessary.
            fmt.keep_with_next = style_name != "Heading 1"
            fmt.keep_together = True
            fmt.first_line_indent = Mm(0)
            if style_name == "Heading 1":
                # Every top-level chapter is a self-contained reference section.
                fmt.page_break_before = True
                first_heading_seen = True
                style_paragraph_runs(p, 16, BLUE)
            elif style_name == "Heading 2":
                style_paragraph_runs(p, 14, INK)
            else:
                style_paragraph_runs(p, 12.5 if style_name == "Heading 3" else 12, INK)
        elif style_name.startswith("TOC") or text.casefold() in ("mục lục", "contents"):
            fmt.first_line_indent = Mm(0)
            if style_name == "TOC Heading" or text.casefold() in ("mục lục", "contents"):
                fmt.page_break_before = True
                fmt.alignment = WD_ALIGN_PARAGRAPH.CENTER
                style_paragraph_runs(p, 16, BLUE)
            else:
                style_paragraph_runs(p, 10.5 if style_name == "TOC 1" else 10, INK)
        elif style_name == "Source Code":
            fmt.first_line_indent = Mm(0)
            fmt.left_indent = Mm(4)
            fmt.right_indent = Mm(4)
            fmt.line_spacing = 1.0
            fmt.space_before = Pt(3)
            fmt.space_after = Pt(5)
            style_paragraph_runs(p, 8.5, INK)
            p_pr = p._p.get_or_add_pPr()
            shd = p_pr.find(qn("w:shd"))
            if shd is None:
                shd = OxmlElement("w:shd")
                p_pr.append(shd)
            shd.set(qn("w:fill"), "F4F6F8")
        elif p._p.xpath(".//w:drawing"):
            fmt.alignment = WD_ALIGN_PARAGRAPH.CENTER
            fmt.first_line_indent = Mm(0)
            fmt.space_before = Pt(5)
            fmt.space_after = Pt(4)
        elif style_name in ("Caption", "Image Caption"):
            fmt.alignment = WD_ALIGN_PARAGRAPH.CENTER
            fmt.first_line_indent = Mm(0)
            fmt.keep_with_next = True
            style_paragraph_runs(p, 10, INK)
        elif text:
            style_paragraph_runs(p, 12, INK)

    for table in doc.tables:
        table.style = "Table"
        table.autofit = True
        set_table_borders(table)
        if table.rows:
            repeat_table_header(table.rows[0])
        for row_index, row in enumerate(table.rows):
            for cell in row.cells:
                cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
                set_cell_margins(cell)
                set_cell_shading(cell, BLUE if row_index == 0 else (PALE_BLUE if row_index % 2 else "FFFFFF"))
                for paragraph in cell.paragraphs:
                    paragraph.paragraph_format.first_line_indent = Mm(0)
                    paragraph.paragraph_format.space_before = Pt(0)
                    paragraph.paragraph_format.space_after = Pt(2)
                    paragraph.paragraph_format.line_spacing = 1.05
                    paragraph.paragraph_format.widow_control = True
                    for run in paragraph.runs:
                        style_run(
                            run,
                            size=9.5,
                            bold=True if row_index == 0 else None,
                            color="FFFFFF" if row_index == 0 else INK,
                        )

    doc.save(path)


if __name__ == "__main__":
    main()
