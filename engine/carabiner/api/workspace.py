"""CRUD endpoints for all workspace modules."""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from carabiner.api.schemas import (
    CampaignOut,
    EmailWebhookPayload,
    FoodCostOut,
    InboxItemCreate,
    InboxItemOut,
    InboxItemUpdate,
    InventoryOut,
    InvoiceOut,
    InvoiceUpdate,
    MenuOut,
    OrderCreate,
    OrderOut,
    OrderUpdate,
    PrepOut,
)
from carabiner.db import repositories as repo

router = APIRouter(prefix="/api", tags=["workspace"])

# Uploads directory for invoice files
UPLOADS_DIR = Path(os.environ.get("UPLOADS_DIR", Path(__file__).resolve().parents[2] / "uploads"))
INVOICES_DIR = UPLOADS_DIR / "invoices"

# Allowed MIME types for invoice uploads
ALLOWED_INVOICE_MIMES = {"application/pdf", "image/jpeg", "image/png"}


# ---------------------------------------------------------------------------
# Inbox
# ---------------------------------------------------------------------------

@router.get("/inbox", response_model=List[InboxItemOut])
async def list_inbox(location_id: Optional[uuid.UUID] = Query(None)) -> list:
    items = await repo.list_inbox(location_id)
    return [InboxItemOut.model_validate(i) for i in items]


@router.get("/inbox/{item_id}", response_model=InboxItemOut)
async def get_inbox(item_id: uuid.UUID) -> InboxItemOut:
    item = await repo.get_inbox(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Inbox item not found")
    return InboxItemOut.model_validate(item)


@router.post("/inbox", response_model=InboxItemOut, status_code=201)
async def create_inbox(body: InboxItemCreate) -> InboxItemOut:
    item = await repo.create_inbox(body.model_dump())
    return InboxItemOut.model_validate(item)


@router.patch("/inbox/{item_id}", response_model=InboxItemOut)
async def update_inbox(item_id: uuid.UUID, body: InboxItemUpdate) -> InboxItemOut:
    item = await repo.update_inbox(item_id, body.model_dump(exclude_unset=True))
    if item is None:
        raise HTTPException(status_code=404, detail="Inbox item not found")
    return InboxItemOut.model_validate(item)


@router.delete("/inbox/{item_id}", status_code=204)
async def delete_inbox(item_id: uuid.UUID) -> None:
    deleted = await repo.delete_inbox(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Inbox item not found")


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

@router.get("/orders", response_model=List[OrderOut])
async def list_orders(location_id: Optional[uuid.UUID] = Query(None)) -> list:
    items = await repo.list_orders(location_id)
    return [OrderOut.model_validate(i) for i in items]


@router.get("/orders/{item_id}", response_model=OrderOut)
async def get_order(item_id: uuid.UUID) -> OrderOut:
    item = await repo.get_order(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderOut.model_validate(item)


@router.post("/orders", response_model=OrderOut, status_code=201)
async def create_order(body: OrderCreate) -> OrderOut:
    item = await repo.create_order(body.model_dump())
    return OrderOut.model_validate(item)


@router.patch("/orders/{item_id}", response_model=OrderOut)
async def update_order(item_id: uuid.UUID, body: OrderUpdate) -> OrderOut:
    item = await repo.update_order(item_id, body.model_dump(exclude_unset=True))
    if item is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderOut.model_validate(item)


@router.delete("/orders/{item_id}", status_code=204)
async def delete_order(item_id: uuid.UUID) -> None:
    deleted = await repo.delete_order(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Order not found")


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

@router.get("/inventory", response_model=List[InventoryOut])
async def list_inventory(location_id: Optional[uuid.UUID] = Query(None)) -> list:
    items = await repo.list_inventory(location_id)
    return [InventoryOut.model_validate(i) for i in items]


@router.get("/inventory/{item_id}", response_model=InventoryOut)
async def get_inventory(item_id: uuid.UUID) -> InventoryOut:
    item = await repo.get_inventory(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return InventoryOut.model_validate(item)


# ---------------------------------------------------------------------------
# Prep
# ---------------------------------------------------------------------------

@router.get("/prep", response_model=List[PrepOut])
async def list_prep(location_id: Optional[uuid.UUID] = Query(None)) -> list:
    items = await repo.list_prep(location_id)
    return [PrepOut.model_validate(i) for i in items]


@router.get("/prep/{item_id}", response_model=PrepOut)
async def get_prep(item_id: uuid.UUID) -> PrepOut:
    item = await repo.get_prep(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Prep task not found")
    return PrepOut.model_validate(item)


# ---------------------------------------------------------------------------
# Food Cost
# ---------------------------------------------------------------------------

@router.get("/food-cost", response_model=List[FoodCostOut])
async def list_food_cost(location_id: Optional[uuid.UUID] = Query(None)) -> list:
    items = await repo.list_food_cost(location_id)
    return [FoodCostOut.model_validate(i) for i in items]


@router.get("/food-cost/{item_id}", response_model=FoodCostOut)
async def get_food_cost(item_id: uuid.UUID) -> FoodCostOut:
    item = await repo.get_food_cost(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Food cost item not found")
    return FoodCostOut.model_validate(item)


# ---------------------------------------------------------------------------
# Menu
# ---------------------------------------------------------------------------

@router.get("/menu", response_model=List[MenuOut])
async def list_menu(location_id: Optional[uuid.UUID] = Query(None)) -> list:
    items = await repo.list_menu(location_id)
    return [MenuOut.model_validate(i) for i in items]


@router.get("/menu/{item_id}", response_model=MenuOut)
async def get_menu(item_id: uuid.UUID) -> MenuOut:
    item = await repo.get_menu(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return MenuOut.model_validate(item)


# ---------------------------------------------------------------------------
# Marketing (Campaigns)
# ---------------------------------------------------------------------------

@router.get("/marketing", response_model=List[CampaignOut])
async def list_campaigns(location_id: Optional[uuid.UUID] = Query(None)) -> list:
    items = await repo.list_campaigns(location_id)
    return [CampaignOut.model_validate(i) for i in items]


@router.get("/marketing/{item_id}", response_model=CampaignOut)
async def get_campaign(item_id: uuid.UUID) -> CampaignOut:
    item = await repo.get_campaign(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return CampaignOut.model_validate(item)


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------

@router.get("/invoices", response_model=List[InvoiceOut])
async def list_invoices(location_id: Optional[uuid.UUID] = Query(None)) -> list:
    items = await repo.list_invoices(location_id)
    return [InvoiceOut.model_validate(i) for i in items]


@router.get("/invoices/{item_id}", response_model=InvoiceOut)
async def get_invoice(item_id: uuid.UUID) -> InvoiceOut:
    item = await repo.get_invoice(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return InvoiceOut.model_validate(item)


@router.post("/invoices/upload", response_model=InvoiceOut, status_code=201)
async def upload_invoice(
    location_id: uuid.UUID = Query(...),
    file: UploadFile = File(...),
) -> InvoiceOut:
    """Upload an invoice PDF or image for processing."""
    # Validate MIME type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_INVOICE_MIMES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Allowed: PDF, JPEG, PNG.",
        )

    # Ensure uploads directory exists
    INVOICES_DIR.mkdir(parents=True, exist_ok=True)

    # Generate unique filename preserving extension
    ext_map = {"application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png"}
    ext = ext_map.get(content_type, "")
    file_id = uuid.uuid4()
    filename = f"{file_id}{ext}"
    dest = INVOICES_DIR / filename

    # Write file to disk
    contents = await file.read()
    dest.write_bytes(contents)

    # Create invoice record
    invoice = await repo.create_invoice({
        "location_id": location_id,
        "status": "uploaded",
        "source": "upload",
        "file_path": str(dest),
        "file_mime": content_type,
        "summary": f"Uploaded invoice: {file.filename or filename}",
    })
    return InvoiceOut.model_validate(invoice)


@router.patch("/invoices/{item_id}", response_model=InvoiceOut)
async def update_invoice(item_id: uuid.UUID, body: InvoiceUpdate) -> InvoiceOut:
    item = await repo.update_invoice(item_id, body.model_dump(exclude_unset=True))
    if item is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return InvoiceOut.model_validate(item)


@router.delete("/invoices/{item_id}", status_code=204)
async def delete_invoice(item_id: uuid.UUID) -> None:
    deleted = await repo.delete_invoice(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Invoice not found")


@router.post("/invoices/email-webhook", response_model=InvoiceOut, status_code=201)
async def invoice_email_webhook(body: EmailWebhookPayload) -> InvoiceOut:
    """Stub endpoint for email-forwarded invoices.

    Accepts a JSON payload simulating an email forward and creates an invoice
    record with status ``uploaded``. The attachment is not downloaded yet —
    this is a placeholder for future email integration.
    """
    invoice = await repo.create_invoice({
        "location_id": body.location_id,
        "status": "uploaded",
        "source": "email",
        "vendor_name": body.from_address,
        "summary": f"Email invoice: {body.subject}",
        "extracted_data": {
            "email_from": body.from_address,
            "email_subject": body.subject,
            "email_body": body.body,
            "attachment_url": body.attachment_url,
        },
    })
    return InvoiceOut.model_validate(invoice)


# ---------------------------------------------------------------------------
# Connectors
# ---------------------------------------------------------------------------

@router.get("/connectors")
async def list_connectors() -> list:
    from carabiner.domain.connectors import list_connector_capabilities
    caps = list_connector_capabilities()
    return [
        {
            "provider_id": c["provider_id"],
            "provider_name": c["provider_name"],
            "channels": [ch.value if hasattr(ch, "value") else ch for ch in c["channels"]],
            "default_channel": c["default_channel"].value if hasattr(c["default_channel"], "value") else c["default_channel"],
            "fallback_channel": c["fallback_channel"].value if c["fallback_channel"] and hasattr(c["fallback_channel"], "value") else c["fallback_channel"],
        }
        for c in caps
    ]
