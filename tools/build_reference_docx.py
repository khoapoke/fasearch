#!/usr/bin/env python3
"""Build the Word reference document used by Pandoc for the project handbook."""

from io import BytesIO
from pathlib import Path
import subprocess
import sys

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Mm, Pt, RGBColor


FONT = "Times New Roman"
INK = RGBColor(0x16, 0x24, 0x36)
BLUE = RGBColor(0x1F, 0x4E, 0x78)


def set_font(style, name: str, size: float, *, bold=False, italic=False, color=INK):
    style.font.name = name
    style.font.size = Pt(size)
    style.font.bold = bold
    style.font.italic = italic
    style.font.color.rgb = color
    rpr = style.element.get_or_add_rPr()
    rfonts = rpr.rFonts
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    for attr in ("ascii", "hAnsi", "eastAsia", "cs"):
        rfonts.set(qn(f"w:{attr}"), name)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: build_reference_docx.py OUTPUT.docx")
    output = Path(sys.argv[1]).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    # Start from Pandoc's own reference file. It contains essential styles such
    # as Compact and Table that Pandoc writes into the converted document.
    # Building a blank python-docx file from scratch leaves those styles
    # undefined and LibreOffice can then lay out tables incorrectly.
    default_reference = subprocess.check_output(
        ["pandoc", "--print-default-data-file=reference.docx"]
    )
    doc = Document(BytesIO(default_reference))
    section = doc.sections[0]
    section.page_width = Mm(210)
    section.page_height = Mm(297)
    section.top_margin = Mm(25)
    section.bottom_margin = Mm(25)
    section.left_margin = Mm(30)
    section.right_margin = Mm(20)
    section.header_distance = Mm(12)
    section.footer_distance = Mm(12)

    styles = doc.styles
    normal = styles["Normal"]
    set_font(normal, FONT, 12)
    normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    normal.paragraph_format.first_line_indent = Mm(10)
    normal.paragraph_format.line_spacing = 1.28
    normal.paragraph_format.space_after = Pt(5)
    normal.paragraph_format.widow_control = True

    title = styles["Title"]
    set_font(title, FONT, 20, bold=True, color=BLUE)
    title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_before = Pt(80)
    title.paragraph_format.space_after = Pt(16)
    title.paragraph_format.keep_with_next = True

    subtitle = styles["Subtitle"]
    set_font(subtitle, FONT, 14, italic=True, color=INK)
    subtitle.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_after = Pt(24)
    subtitle.paragraph_format.keep_with_next = True

    for style_name in ("Author", "Date"):
        if style_name in styles:
            style = styles[style_name]
            set_font(style, FONT, 12, color=INK)
            style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
            style.paragraph_format.first_line_indent = Mm(0)
            style.paragraph_format.space_after = Pt(8)

    heading_specs = {
        "Heading 1": (16, BLUE, 18, 8),
        "Heading 2": (14, INK, 14, 6),
        "Heading 3": (12.5, INK, 10, 4),
        "Heading 4": (12, INK, 8, 3),
    }
    for name, (size, color, before, after) in heading_specs.items():
        style = styles[name]
        set_font(style, FONT, size, bold=True, color=color)
        style.paragraph_format.first_line_indent = Mm(0)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.keep_together = True

    for name in ("Caption", "Image Caption"):
        if name in styles:
            style = styles[name]
            set_font(style, FONT, 10, italic=True, color=INK)
            style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
            style.paragraph_format.first_line_indent = Mm(0)
            style.paragraph_format.space_before = Pt(3)
            style.paragraph_format.space_after = Pt(8)

    if "Block Text" in styles:
        style = styles["Block Text"]
        set_font(style, FONT, 11)
        style.paragraph_format.left_indent = Mm(8)
        style.paragraph_format.right_indent = Mm(8)
        style.paragraph_format.first_line_indent = Mm(0)
        style.paragraph_format.space_after = Pt(5)

    if "Source Code" in styles:
        style = styles["Source Code"]
        set_font(style, "Consolas", 8.5, color=INK)
        style.paragraph_format.first_line_indent = Mm(0)
        style.paragraph_format.left_indent = Mm(4)
        style.paragraph_format.right_indent = Mm(4)
        style.paragraph_format.space_before = Pt(3)
        style.paragraph_format.space_after = Pt(5)
        style.paragraph_format.line_spacing = 1.0

    if "TOC Heading" in styles:
        style = styles["TOC Heading"]
        set_font(style, FONT, 16, bold=True, color=BLUE)
        style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
        style.paragraph_format.first_line_indent = Mm(0)
        style.paragraph_format.space_after = Pt(12)

    for level in range(1, 4):
        name = f"TOC {level}"
        if name in styles:
            style = styles[name]
            set_font(style, FONT, 10.5 if level == 1 else 10)
            style.paragraph_format.first_line_indent = Mm(0)
            style.paragraph_format.space_after = Pt(2)

    doc.core_properties.title = (
        "Tài liệu định hướng nghiên cứu và triển khai hệ thống tìm kiếm "
        "thời trang đa phương thức"
    )
    doc.core_properties.subject = "Nguồn tham chiếu tổng thể cho đồ án tốt nghiệp"
    doc.core_properties.author = "Tạ Minh Khoa; Đỗ Hoàng Anh Khoa; Trần Nhật Hào"
    doc.core_properties.keywords = (
        "fashion retrieval, CLIP, tiếng Việt, composed retrieval, taxonomy, explainability"
    )

    doc.save(output)


if __name__ == "__main__":
    main()
