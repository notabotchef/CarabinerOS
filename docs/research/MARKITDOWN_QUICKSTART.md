# MarkItDown Quick Start for CarabinerOS

## TL;DR

**What**: Python library that converts PDFs, images, audio, Word docs, Excel sheets, etc. → Markdown (token-efficient for LLMs)

**Why**: Chef uploads recipe photo → gets structured markdown. Vendor PDF → parsed into data. Voice memo → transcript. All in formats A0 understands natively.

**Install**:
```bash
pip install 'markitdown[pdf,docx,xlsx,pptx,audio-transcription]'

# If using LLM Vision OCR (for scanned docs):
pip install markitdown-ocr openai
```

**Basic usage**:
```python
from markitdown import MarkItDown

md = MarkItDown()
result = md.convert("invoice.pdf")
print(result.markdown)  # Markdown text suitable for LLM context
```

**With LLM Vision (image descriptions, OCR)**:
```python
from markitdown import MarkItDown
from openai import OpenAI

md = MarkItDown(
    enable_plugins=True,
    llm_client=OpenAI(),
    llm_model="gpt-4o"
)

result = md.convert("recipe_photo.jpg")  # Includes LLM description
result = md.convert("scanned_invoice.pdf")  # Includes OCR via LLM Vision
```

---

## Supported Formats (Relevant to Restaurant)

| Format | Example | Output |
|--------|---------|--------|
| **PDF** | Vendor invoice, menu | Markdown with tables |
| **Images (JPG, PNG)** | Recipe photo, dish plating | EXIF + LLM description |
| **Word (.docx)** | Supplier documentation | Markdown with formatting |
| **Excel (.xlsx)** | Cost spreadsheet, inventory | Markdown tables |
| **PowerPoint (.pptx)** | Training materials | Slides as Markdown sections |
| **Audio (MP3, WAV)** | Voice memo, kitchen notes | Transcript + metadata |
| **YouTube URL** | Training video | Video transcript |

---

## CarabinerOS Integration Points

### 1. Recipe Photo Upload
```python
# Chef takes photo of cookbook recipe
# System extracts via LLM Vision → feeds to A0 context
```

### 2. Invoice PDF Processing
```python
# Vendor sends invoice PDF
# System parses → extracts cost data for financial tracking
```

### 3. Prep Sheet Digitization
```python
# Handwritten/printed prep sheet → photo or scan
# System OCRs → creates digital task list
```

### 4. Competitor Menu Analysis
```python
# Download competitor menu PDF
# System parses → structured menu data
```

### 5. Voice Notes
```python
# Chef records morning notes on phone
# System transcribes → action items for A0
```

---

## API Pattern for Flask Backend

```python
from markitdown import MarkItDown
from flask import request, jsonify

@app.route("/api/document/convert", methods=["POST"])
async def convert_document():
    """Convert uploaded document to Markdown."""

    file = request.files.get("file")

    try:
        md = MarkItDown(
            enable_plugins=True,
            llm_client=get_openai_client(),  # Reuse A0's client
            llm_model="gpt-4o"
        )

        result = md.convert(file.stream)

        return {
            "ok": True,
            "data": {
                "filename": file.filename,
                "markdown": result.markdown,
                "title": result.title
            }
        }

    except Exception as e:
        return {
            "ok": False,
            "error": str(e)
        }
```

---

## Dependencies by Use Case

**Just PDFs + Office docs** (MVP):
```bash
pip install 'markitdown[pdf,docx,xlsx,pptx]'
```

**+ Audio transcription**:
```bash
pip install 'markitdown[pdf,docx,xlsx,pptx,audio-transcription]'
```

**+ LLM Vision OCR** (scanned invoices, handwritten prep sheets):
```bash
pip install 'markitdown[pdf,docx,xlsx,pptx,audio-transcription]' markitdown-ocr openai
```

---

## Performance Expectations

| Task | Time | Notes |
|------|------|-------|
| Simple PDF (5 pages) | 1-2s | Text extraction + table parsing |
| Image with LLM description | 5-30s | Network call to GPT-4o |
| Scanned invoice (OCR via LLM) | 10-60s | Per page |
| Audio transcription (1 min) | 30-120s | Speech recognition |
| Excel spreadsheet | 1-5s | Cell parsing + table render |

---

## Accuracy Notes

- **Text documents**: 95%+ accurate
- **PDFs (text-based)**: 85-90% (layout-dependent)
- **PDFs (scanned, OCR)**: 70-85% (LLM Vision quality)
- **Audio transcription**: 85-95% (depends on audio quality)
- **Images with descriptions**: Subjective (LLM-dependent)

**Action**: Always validate OCR/transcription output before using for critical decisions (billing, inventory).

---

## Error Handling

```python
from markitdown import (
    MarkItDown,
    MissingDependencyException,
    FileConversionException,
    UnsupportedFormatException,
)

try:
    result = md.convert("file.xyz")
except MissingDependencyException:
    # Missing optional dep (e.g., pdfminer not installed)
    pass
except FileConversionException:
    # Recognized format, but conversion failed
    pass
except UnsupportedFormatException:
    # Unknown format
    pass
```

---

## CLI for Testing

```bash
# Convert file to stdout
markitdown invoice.pdf

# Save to file
markitdown recipe.jpg -o recipe.md

# With OCR plugin
markitdown scanned_doc.pdf --use-plugins --llm-client openai --llm-model gpt-4o

# From stdin
cat menu.pdf | markitdown > menu.md
```

---

## Cost Analysis

- **MarkItDown**: Free (MIT)
- **markitdown-ocr plugin**: Free (MIT)
- **OpenAI Vision calls**: ~$0.01-0.02 per image (depends on image size)
  - 1000 invoice OCR calls ≈ $10-20
  - 100 recipe photos ≈ $1-2
- **SpeechRecognition**: Free (uses OS-level speech API)

---

## Next Steps

1. **Add to requirements.txt**:
   ```
   markitdown[pdf,docx,xlsx,pptx,audio-transcription]>=0.1.0
   markitdown-ocr>=0.1.0
   ```

2. **Create `/api/document/convert` endpoint** in Flask blueprint

3. **Test with real restaurant documents**:
   - Sample vendor invoice
   - Menu PDF
   - Recipe photo

4. **Integrate with A0 chat context**:
   ```
   User: "Upload invoice"
   → Backend: convert PDF → Markdown
   → A0: "Received document:\n\n" + markdown
   ```

5. **Monitor OCR costs** and accuracy feedback

---

## Resources

- **Full Research**: `/Users/estebannunez/Projects/carabiner-os/MARKITDOWN_RESEARCH.md`
- **GitHub**: https://github.com/microsoft/markitdown
- **OCR Plugin**: https://github.com/microsoft/markitdown/tree/main/packages/markitdown-ocr
- **PyPI**: https://pypi.org/project/markitdown/

---

**Status**: Ready for Phase 1 integration. Recommend MVP without OCR plugin first, add LLM Vision as usage patterns emerge.
