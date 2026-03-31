# MarkItDown Code Examples for CarabinerOS

## 1. Basic Document Conversion

### From File Path
```python
from markitdown import MarkItDown

md = MarkItDown()

# PDF invoice
result = md.convert("vendor_invoice.pdf")
print(result.markdown)

# Word document
result = md.convert("supplier_contract.docx")
print(result.title)  # Document title, if available

# Excel spreadsheet
result = md.convert("inventory.xlsx")
# Output: Markdown tables for each sheet
```

### From URL
```python
md = MarkItDown()

# Download and convert directly from URL
result = md.convert("https://example.com/menu.pdf")
print(result.markdown)

# YouTube video transcript
result = md.convert("https://youtube.com/watch?v=dQw4w9WgXcQ")
# Output: Full video transcript as Markdown
```

### From File Stream
```python
from markitdown import MarkItDown
import io

# From file object
with open("recipe.jpg", "rb") as f:
    md = MarkItDown()
    result = md.convert(f)
    print(result.markdown)

# From BytesIO
file_bytes = b"PDF_CONTENT_HERE"
stream = io.BytesIO(file_bytes)
md = MarkItDown()
result = md.convert(stream)
```

### From requests.Response
```python
import requests
from markitdown import MarkItDown

# Fetch and convert in one go
response = requests.get("https://example.com/document.pdf")
md = MarkItDown()
result = md.convert(response)
```

---

## 2. Image Processing with LLM Vision

### Extract Image Metadata + Description
```python
from markitdown import MarkItDown
from openai import OpenAI

# Configure with OpenAI
client = OpenAI()
md = MarkItDown(
    llm_client=client,
    llm_model="gpt-4o"
)

# Convert recipe photo
result = md.convert("recipe_photo.jpg")

# Output example:
# ImageSize: 3840x2160
# DateTimeOriginal: 2024-03-20T14:32:45
# CreateDate: 2024-03-20T14:32:45
# Artist: Chef Danny
#
# A close-up photograph of a beautifully plated pasta dish featuring...
```

### Custom Prompt for Image Analysis
```python
md = MarkItDown(
    llm_client=OpenAI(),
    llm_model="gpt-4o",
    llm_prompt="""Analyze this restaurant dish and extract:
1. Main proteins and ingredients visible
2. Plating techniques and presentation style
3. Estimated cooking method
4. Color palette and season indicators
Be concise and structured."""
)

result = md.convert("dish_photo.jpg")
print(result.markdown)
```

### Batch Process Recipe Images
```python
from pathlib import Path
from markitdown import MarkItDown
from openai import OpenAI

md = MarkItDown(
    llm_client=OpenAI(),
    llm_model="gpt-4o",
    llm_prompt="Extract recipe title, ingredients, and cooking method from this image."
)

recipe_dir = Path("./recipes")
results = {}

for image_file in recipe_dir.glob("*.jpg"):
    try:
        result = md.convert(str(image_file))
        results[image_file.name] = result.markdown
        print(f"✓ {image_file.name}")
    except Exception as e:
        print(f"✗ {image_file.name}: {e}")

# Save all recipes as Markdown
for filename, markdown in results.items():
    with open(f"output/{filename}.md", "w") as f:
        f.write(markdown)
```

---

## 3. PDF Processing (Invoices, Menus, Documents)

### Extract Vendor Invoice Data
```python
from markitdown import MarkItDown
import re

md = MarkItDown()
result = md.convert("vendor_invoice_2024_03.pdf")

# The markdown will have structured tables like:
# | Item | Qty | Unit Price | Total |
# |------|-----|------------|-------|
# | Tomatoes | 50 | $1.50 | $75 |
# ...

markdown = result.markdown
print(markdown)

# You can parse this Markdown table and feed to A0
# Example: extract line items
lines = markdown.split('\n')
```

### Parse Menu PDF into Structured Data
```python
from markitdown import MarkItDown

md = MarkItDown()
result = md.convert("competitor_menu.pdf")

# Output structure:
# # Restaurant Name
#
# ## Appetizers
# | Item | Description | Price |
# | Calamari | Crispy fried squid, served with marinara | $14 |
# ...
#
# ## Entrees
# ...

# Feed to A0 for competitive analysis
a0_context = f"""
A competitor's menu was uploaded. Here's the parsed content:

{result.markdown}

Analyze pricing strategy and identify gaps in our menu.
"""

# Send to A0 via chat API
```

### Scanned PDF with OCR
```python
from markitdown import MarkItDown
from openai import OpenAI

# For scanned documents, enable OCR plugin
md = MarkItDown(
    enable_plugins=True,  # Enable markitdown-ocr
    llm_client=OpenAI(),
    llm_model="gpt-4o"
)

# If PDF is scanned (no extractable text):
# 1. MarkItDown detects it's scanned
# 2. Renders each page at 300 DPI
# 3. Sends to GPT-4o Vision for OCR
# 4. Returns full text in Markdown

result = md.convert("handwritten_prep_sheet.pdf")
print(result.markdown)
```

---

## 4. Audio Transcription

### Transcribe Chef's Voice Notes
```python
from markitdown import MarkItDown

md = MarkItDown()

# Requires SpeechRecognition library (optional dependency)
result = md.convert("morning_briefing.mp3")

# Output:
# Title: None
# AudioDuration: 3:45
# DateTimeOriginal: 2024-03-25T06:30:00
#
# Transcription:
# "Today we're running low on halibut. I've adjusted the special to cod instead.
# The new sous chef will be shadowing me this morning. Make sure..."

print(result.markdown)
```

### Store Transcripts in Database
```python
from markitdown import MarkItDown
from datetime import datetime

md = MarkItDown()

# Chef records daily note
audio_file = "2024-03-25_morning_notes.mp3"
result = md.convert(audio_file)

# Store in database for searchability
transcript_data = {
    "date": datetime.now(),
    "source_file": audio_file,
    "transcript": result.markdown,
    "role": "kitchen_staff",
    "tags": ["morning_briefing", "inventory", "staffing"]
}

# Save to database (example)
# db.kitchen_transcripts.insert_one(transcript_data)
```

---

## 5. Office Documents (Word, Excel, PowerPoint)

### Parse Word Document Sections
```python
from markitdown import MarkItDown

md = MarkItDown()
result = md.convert("food_safety_policy.docx")

# Output preserves document structure:
# # Food Safety Policy
#
# ## Section 1: Handwashing
# Employees must wash hands...
#
# ## Section 2: Temperature Control
# All proteins must be stored...
#
# **Key Points:**
# - Point 1
# - Point 2

print(result.markdown)
```

### Extract Excel Data as Tables
```python
from markitdown import MarkItDown

md = MarkItDown()
result = md.convert("weekly_sales.xlsx")

# Each sheet becomes a Markdown table:
# # Sheet: Sales Summary
#
# | Week | Monday | Tuesday | Wednesday | Thursday | Friday | Total |
# |------|--------|---------|-----------|----------|--------|-------|
# | 1    | 1200   | 1450    | 1300      | 1500     | 2100   | 7550  |
# | 2    | 1100   | 1350    | 1250      | 1400     | 2000   | 7100  |
#
# # Sheet: Inventory
# | Item | Qty | Unit | Expires |
# ...

print(result.markdown)
```

### Convert PowerPoint Training Materials
```python
from markitdown import MarkItDown

md = MarkItDown()
result = md.convert("knife_skills_training.pptx")

# Output:
# # Slide 1: Knife Skills 101
#
# Content from slide...
#
# ## Slide 2: Grip Techniques
#
# [Image description from LLM if configured]
# - Claw grip: fingers curved inward
# - Guiding hand: keep knuckles forward
# ...

print(result.markdown)
```

---

## 6. Flask API Integration

### Document Upload Endpoint
```python
# carabiner/api/documents.py
from flask import Blueprint, request, jsonify
from markitdown import MarkItDown, MissingDependencyException, FileConversionException
from openai import OpenAI

docs_bp = Blueprint("documents", __name__, url_prefix="/api/documents")

def get_llm_client():
    """Get OpenAI client from A0 config."""
    # This would come from your existing A0 setup
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@docs_bp.route("/convert", methods=["POST"])
async def convert_document():
    """Convert uploaded document to Markdown for A0 context."""

    # Validate request
    if "file" not in request.files:
        return jsonify({"ok": False, "error": "No file provided"}), 400

    file = request.files["file"]
    use_ocr = request.args.get("ocr", "false").lower() == "true"

    if not file.filename:
        return jsonify({"ok": False, "error": "No filename"}), 400

    try:
        # Configure converter
        kwargs = {}
        if use_ocr:
            kwargs["enable_plugins"] = True
            kwargs["llm_client"] = get_llm_client()
            kwargs["llm_model"] = "gpt-4o"

        md = MarkItDown(**kwargs)

        # Convert
        result = md.convert(file.stream)

        return jsonify({
            "ok": True,
            "data": {
                "filename": file.filename,
                "title": result.title,
                "markdown": result.markdown,
                "token_estimate": len(result.markdown.split()),
            }
        })

    except MissingDependencyException as e:
        return jsonify({
            "ok": False,
            "error": f"Missing dependency: {e}. Install with: pip install 'markitdown[all]'"
        }), 400

    except FileConversionException as e:
        return jsonify({
            "ok": False,
            "error": f"Conversion failed: {e}"
        }), 422

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500

@docs_bp.route("/convert-and-chat", methods=["POST"])
async def convert_and_send_to_chat():
    """Convert document and directly send to A0 chat context."""

    file = request.files.get("file")
    chat_id = request.form.get("chat_id")

    if not all([file, chat_id]):
        return jsonify({"ok": False, "error": "Missing file or chat_id"}), 400

    try:
        md = MarkItDown()
        result = md.convert(file.stream)

        # Send to A0 chat as context
        context_msg = f"""
A user uploaded a document: **{file.filename}**

{result.markdown}

Please analyze this document and provide insights.
"""

        # Call your A0 chat endpoint
        response = await send_to_chat(
            chat_id=chat_id,
            message=context_msg,
            source="document_upload"
        )

        return jsonify({
            "ok": True,
            "data": {
                "filename": file.filename,
                "chat_id": chat_id,
                "message_id": response.get("message_id")
            }
        })

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
```

### Register in Flask App
```python
# run_ui.py or similar

from carabiner.api.documents import docs_bp

# Register blueprint
app.register_blueprint(docs_bp)
```

### Frontend Usage (TypeScript)
```typescript
// frontend/src/api/documents.ts

export async function convertDocument(
  file: File,
  useOCR: boolean = false
): Promise<{ markdown: string; title: string | null }> {
  const formData = new FormData();
  formData.append("file", file);

  const params = new URLSearchParams();
  if (useOCR) params.append("ocr", "true");

  const response = await fetch(`/api/documents/convert?${params}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Conversion failed: ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.data;
}

export async function convertAndChat(
  file: File,
  chatId: string
): Promise<{ messageId: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("chat_id", chatId);

  const response = await fetch("/api/documents/convert-and-chat", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.data;
}
```

---

## 7. Error Handling & Retry Logic

### Robust Conversion with Fallback
```python
from markitdown import (
    MarkItDown,
    MissingDependencyException,
    FileConversionException,
    UnsupportedFormatException,
)
import logging

logger = logging.getLogger(__name__)

def convert_with_fallback(file_path: str, use_ocr: bool = False) -> dict:
    """Convert document with intelligent fallbacks."""

    # First attempt: with requested settings
    try:
        kwargs = {}
        if use_ocr:
            kwargs["enable_plugins"] = True
            kwargs["llm_client"] = get_openai_client()
            kwargs["llm_model"] = "gpt-4o"

        md = MarkItDown(**kwargs)
        result = md.convert(file_path)

        logger.info(f"✓ Converted {file_path} (with OCR={use_ocr})")
        return {
            "success": True,
            "markdown": result.markdown,
            "title": result.title,
            "attempt": 1,
        }

    except MissingDependencyException as e:
        logger.warning(f"Missing dependency: {e}")
        return {
            "success": False,
            "error": f"Missing dependency. Install: pip install 'markitdown[all]'",
            "attempt": 1,
        }

    except FileConversionException:
        # Fallback: retry without OCR
        if use_ocr:
            logger.info(f"Retrying {file_path} without OCR...")
            try:
                md = MarkItDown(enable_plugins=False)
                result = md.convert(file_path)
                logger.info(f"✓ Converted {file_path} (fallback, no OCR)")
                return {
                    "success": True,
                    "markdown": result.markdown,
                    "title": result.title,
                    "attempt": 2,
                    "fallback": "ocr_disabled",
                }
            except Exception as e2:
                logger.error(f"✗ Fallback also failed: {e2}")
                return {
                    "success": False,
                    "error": f"Conversion failed even without OCR: {e2}",
                    "attempt": 2,
                }
        else:
            return {
                "success": False,
                "error": "Conversion failed and no fallback available",
                "attempt": 1,
            }

    except UnsupportedFormatException as e:
        logger.error(f"Unsupported format: {e}")
        return {
            "success": False,
            "error": f"File format not supported: {e}",
            "attempt": 1,
        }

    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return {
            "success": False,
            "error": f"Unexpected error: {e}",
            "attempt": 1,
        }
```

### Usage
```python
result = convert_with_fallback("invoice.pdf", use_ocr=True)

if result["success"]:
    print(f"Converted in {result['attempt']} attempt(s)")
    print(result["markdown"])
else:
    print(f"Error: {result['error']}")
```

---

## 8. Batch Processing Restaurant Documents

### Process All Invoices in Directory
```python
from pathlib import Path
from markitdown import MarkItDown
import json
from datetime import datetime

def batch_convert_invoices(invoice_dir: Path, output_dir: Path):
    """Convert all invoices in a directory to structured data."""

    md = MarkItDown()
    output_dir.mkdir(parents=True, exist_ok=True)

    results = {
        "processed": [],
        "failed": [],
        "timestamp": datetime.now().isoformat(),
    }

    for pdf_file in invoice_dir.glob("*.pdf"):
        try:
            result = md.convert(str(pdf_file))

            # Save markdown version
            md_output = output_dir / f"{pdf_file.stem}.md"
            md_output.write_text(result.markdown)

            results["processed"].append({
                "filename": pdf_file.name,
                "output": str(md_output),
                "title": result.title,
            })

            print(f"✓ {pdf_file.name}")

        except Exception as e:
            results["failed"].append({
                "filename": pdf_file.name,
                "error": str(e),
            })
            print(f"✗ {pdf_file.name}: {e}")

    # Save summary
    summary_file = output_dir / "batch_summary.json"
    summary_file.write_text(json.dumps(results, indent=2))

    print(f"\nProcessed: {len(results['processed'])}")
    print(f"Failed: {len(results['failed'])}")

    return results

# Usage
results = batch_convert_invoices(
    Path("./vendor_invoices"),
    Path("./converted_invoices")
)
```

---

## 9. Integration with A0 Chat Context

### Send Document to A0 with Context
```python
from markitdown import MarkItDown
import asyncio
from python.api.chat_handler import ChatHandler

async def document_upload_to_a0(file_path: str, chat_id: str, user_id: str):
    """Upload and process document through A0."""

    # Convert document
    md = MarkItDown()
    result = md.convert(file_path)

    # Build context message
    context = f"""
Document uploaded: {Path(file_path).name}
Title: {result.title or 'Untitled'}
Processing timestamp: {datetime.now().isoformat()}

---

# Document Content

{result.markdown}

---

Please analyze this document and provide:
1. Key findings
2. Action items
3. Relevant data for context
"""

    # Send to A0 via chat
    chat_handler = ChatHandler()
    response = await chat_handler.process_message(
        chat_id=chat_id,
        user_id=user_id,
        message=context,
        source="document_upload",
    )

    return response
```

---

## 10. Monitoring & Cost Tracking

### Log Conversion Metrics
```python
import time
import json
from datetime import datetime
from typing import Callable

def track_conversion(func: Callable):
    """Decorator to track conversion metrics."""

    def wrapper(*args, **kwargs):
        start_time = time.time()
        file_path = args[0] if args else kwargs.get("source")

        try:
            result = func(*args, **kwargs)
            elapsed = time.time() - start_time

            metrics = {
                "timestamp": datetime.now().isoformat(),
                "file": str(file_path),
                "success": True,
                "duration_seconds": elapsed,
                "token_count": len(result.markdown.split()),
                "use_ocr": kwargs.get("enable_plugins", False),
            }

            # Log metrics (to file, CloudWatch, etc.)
            with open("conversion_metrics.jsonl", "a") as f:
                f.write(json.dumps(metrics) + "\n")

            return result

        except Exception as e:
            elapsed = time.time() - start_time
            metrics = {
                "timestamp": datetime.now().isoformat(),
                "file": str(file_path),
                "success": False,
                "error": str(e),
                "duration_seconds": elapsed,
            }

            with open("conversion_metrics.jsonl", "a") as f:
                f.write(json.dumps(metrics) + "\n")

            raise

    return wrapper

# Usage
@track_conversion
def convert_document(source: str, enable_plugins: bool = False):
    md = MarkItDown(enable_plugins=enable_plugins)
    return md.convert(source)

# Later: analyze metrics
# cat conversion_metrics.jsonl | jq '.[] | select(.success==false)'
```

---

## Summary

These examples cover the main integration patterns for CarabinerOS:

1. **Document conversion** (PDFs, images, audio)
2. **LLM Vision** (image descriptions, OCR)
3. **API endpoints** (Flask integration)
4. **Error handling** (graceful fallbacks)
5. **Batch processing** (directory of invoices)
6. **A0 integration** (send to chat)
7. **Monitoring** (cost + performance tracking)

Start with examples 1-3 for MVP, add 4-7 as usage patterns emerge.
