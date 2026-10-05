"""Visual and measured review of the print exports (PDF and DOCX).

Builds the export fixture project (export_fixture.py), exports book-ready and
manuscript PDFs and DOCX files for every trim size, prints the PDFs with the
app's Electron (scripts/print_pdf.js), converts the DOCX files to PDF with
Microsoft Word when it is installed (Windows), then:

- checks every page's size against the trim
- measures the ink box on each page and checks that the inside (binding) margin
  is at least the gutter and the outside margin at least the outer margin,
  with the binding on the left of right-hand pages and on the right of
  left-hand pages
- saves contact sheets (PNG) of the first pages for a look

Needs pypdfium2 and Pillow (dev only, not shipped):
    pip install --target <dir> pypdfium2   and   set PYTHONPATH=<dir>

Run from backend/:  .venv/Scripts/python.exe tools/export_review.py <out_dir>
Exit code 1 when a check fails.
"""
import glob
import os
import subprocess
import sys

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
IDE = os.path.dirname(BACKEND)
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

import pypdfium2 as pdfium  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

import export_fixture  # noqa: E402
from export.pipeline import ExportPipeline  # noqa: E402
from export.render_html import TRIM_SIZES  # noqa: E402

TOLERANCE_IN = 0.03
GUTTER, OUTER = 0.625, 0.5


def electron_binary():
    name = "electron.exe" if os.name == "nt" else "electron"
    return os.path.join(IDE, "node_modules", "electron", "dist", name)


def print_pdfs(html_files):
    subprocess.run([electron_binary(), os.path.join(IDE, "scripts", "print_pdf.js"), *html_files],
                   check=True, capture_output=True, timeout=300)


def word_to_pdf(docx_files):
    """DOCX -> PDF through Word's COM interface; returns the PDFs made."""
    if os.name != "nt" or not docx_files:
        return []
    script = ["$w = New-Object -ComObject Word.Application", "$w.Visible = $false"]
    for f in docx_files:
        out = f[:-5] + ".word.pdf"
        script.append("$d = $w.Documents.Open('%s', $false, $true); $d.SaveAs2('%s', 17); $d.Close(0)" % (f, out))
    script.append("$w.Quit()")
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", "; ".join(script)],
                       check=True, capture_output=True, timeout=300)
    except Exception as e:
        print("  Word conversion skipped:", e)
        return []
    return [f[:-5] + ".word.pdf" for f in docx_files if os.path.exists(f[:-5] + ".word.pdf")]


def ink_box(page, scale=2.0):
    """(left, top, right, bottom) blank space around the page's ink, in inches."""
    im = page.render(scale=scale).to_pil().convert("L")
    bw = im.point(lambda v: 0 if v > 200 else 255)
    box = bw.getbbox()
    if not box:
        return None, im
    w, h = im.size
    dpi = 72 * scale
    return (box[0] / dpi, box[1] / dpi, (w - box[2]) / dpi, (h - box[3]) / dpi), im


def check_pdf(path, trim, book, label):
    """Checks page size and mirrored margins; returns a list of problems."""
    problems = []
    pdf = pdfium.PdfDocument(path)
    if book:
        want_w, want_h = TRIM_SIZES[trim][0], TRIM_SIZES[trim][1]
    else:
        want_w, want_h = 8.5, 11.0
    for i in range(len(pdf)):
        w, h = (v / 72 for v in pdf[i].get_size())
        if abs(w - want_w) > 0.02 or abs(h - want_h) > 0.02:
            problems.append("%s p%d: page is %.2f x %.2f in, want %.2f x %.2f" % (label, i + 1, w, h, want_w, want_h))
    # text pages: skip the title page (and the blank back of it in books)
    first_text = 2 if book else 1
    for i in range(first_text, len(pdf)):
        box, _ = ink_box(pdf[i])
        if not box:
            continue
        left, _, right, _ = box
        right_hand = (i + 1) % 2 == 1          # odd page numbers are right-hand pages
        inside, outside = (left, right) if right_hand else (right, left)
        if book:
            if inside < GUTTER - TOLERANCE_IN:
                problems.append("%s p%d: inside margin %.2f in < gutter %.2f" % (label, i + 1, inside, GUTTER))
            if outside < OUTER - TOLERANCE_IN:
                problems.append("%s p%d: outside margin %.2f in < outer %.2f" % (label, i + 1, outside, OUTER))
        elif min(left, right) < 1 - TOLERANCE_IN:
            problems.append("%s p%d: side margin %.2f in < 1 in" % (label, i + 1, min(left, right)))
    return problems, len(pdf)


def contact_sheet(path, out_png, pages=(0, 1, 2, 3, 4, 5)):
    pdf = pdfium.PdfDocument(path)
    ims = []
    for i in pages:
        if i < len(pdf):
            im = pdf[i].render(scale=1.4).to_pil().convert("RGB")
            ImageDraw.Draw(im).rectangle([0, 0, im.width - 1, im.height - 1], outline=(140, 140, 140))
            ims.append(im)
    if not ims:
        return
    sheet = Image.new("RGB", (sum(i.width for i in ims) + 16 * (len(ims) + 1), max(i.height for i in ims) + 32),
                      (64, 64, 64))
    x = 16
    for im in ims:
        sheet.paste(im, (x, 16))
        x += im.width + 16
    sheet.save(out_png)


def main(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    project = export_fixture.build(out_dir)
    pipe = ExportPipeline(project)
    jobs = []   # (pdf path, trim, book, label)
    html_files, docx_files = [], []
    for trim in TRIM_SIZES:
        overrides = {"trim": trim, "font_size": 11, "gutter": GUTTER, "outer": OUTER}
        chapters, _ = pipe.chapters("notes")
        html = pipe.render("notes", "pdf", True, overrides, chapters)
        base = os.path.join(out_dir, "book_%s" % trim)
        with open(base + ".print.html", "w", encoding="utf-8") as f:
            f.write(html)
        html_files.append(base + ".print.html")
        jobs.append((base + ".pdf", trim, True, "pdf book %s" % trim))
        with open(base + ".docx", "wb") as f:
            f.write(pipe.render("notes", "docx", True, overrides, chapters))
        docx_files.append(base + ".docx")
    chapters, _ = pipe.chapters("prose")
    base = os.path.join(out_dir, "manuscript")
    with open(base + ".print.html", "w", encoding="utf-8") as f:
        f.write(pipe.render("prose", "pdf", False, None, chapters))
    html_files.append(base + ".print.html")
    jobs.append((base + ".pdf", "standard", False, "pdf manuscript"))
    with open(base + ".docx", "wb") as f:
        f.write(pipe.render("prose", "docx", False, None, chapters))
    docx_files.append(base + ".docx")

    print_pdfs(html_files)
    for pdf in word_to_pdf(docx_files):
        name = os.path.basename(pdf)
        book = name.startswith("book_")
        trim = name[5:].split(".")[0] if book else "standard"
        jobs.append((pdf, trim, book, "docx %s" % (("book " + trim) if book else "manuscript")))

    problems = []
    for path, trim, book, label in jobs:
        found, pages = check_pdf(path, trim, book, label)
        problems += found
        contact_sheet(path, path[:-4] + ".png")
        print("%-24s %3d pages  %s" % (label, pages, "ok" if not found else "%d problem(s)" % len(found)))
    for p in problems:
        print("  -", p)
    print("contact sheets:", ", ".join(sorted(glob.glob(os.path.join(out_dir, "*.png")))))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(BACKEND, "..", "out", "export-review")))
