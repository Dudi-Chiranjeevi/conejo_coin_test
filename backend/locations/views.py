from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from django.http import HttpResponse
from django.db.models import Prefetch
from django.utils.encoding import smart_str
from inventory.models import InventoryItem, Location
from inventory.serializers import InventoryItemSerializer, LocationSerializer
from typing import List, Dict
import io
import csv
try:
    from openpyxl import Workbook, load_workbook
    from openpyxl.styles import PatternFill
except Exception:  # openpyxl might not be installed in some envs
    Workbook = None
    load_workbook = None
    PatternFill = None

class LocationViewSet(viewsets.ModelViewSet):
   
    queryset = Location.objects.all().select_related("parent", "client")
    serializer_class = LocationSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "type", "path"]
    ordering_fields = ["created_at", "updated_at", "name", "type"]

    def get_queryset(self):
        qs = super().get_queryset()
        client_id = self.request.query_params.get("client")
        if client_id:
            qs = qs.filter(client_id=client_id)
        parent = self.request.query_params.get("parent")
        if parent == "NULL":  # roots for client
            qs = qs.filter(parent__isnull=True)
        elif parent:
            qs = qs.filter(parent_id=parent)
        t = self.request.query_params.get("type")
        if t:
            qs = qs.filter(type=t)
        return qs.order_by("type", "name")

    @action(detail=False, methods=["get"], url_path="tree")
    def tree(self, request):
        """Return a hierarchical tree (children nested)."""
        client_id = request.query_params.get("client")
        if not client_id:
            return Response({"detail": "client is required"}, status=400)

        nodes = list(
            self.get_queryset().filter(client_id=client_id).values(
                "id", "name", "type", "parent_id", "capacity", "path"
            )
        )

        by_id = {n["id"]: {**n, "children": []} for n in nodes}
        roots = []

        for n in nodes:
            pid = n["parent_id"]
            if pid and pid in by_id:
                by_id[pid]["children"].append(by_id[n["id"]])
            else:
                roots.append(by_id[n["id"]])

        return Response(roots)

    @action(detail=True, methods=["get"], url_path="breadcrumbs")
    def breadcrumbs(self, request, pk=None):
        loc = self.get_object()
        return Response({"path": loc.path})

    def clean(self):
        super().clean()
        if self.parent and self.parent.client != self.client:
            raise ValidationError("Parent location must belong to the same client")

        # Optional strict hierarchy
        allowed_parent = {
            "site":   {None},           # top-level
            "room":   {"site"},
            "shelf":  {"room"},
            "row":    {"shelf"},
            "box":    {"row"},
            "slot":   {"box"},
        }
        expected = allowed_parent.get(self.type)
        if expected is not None:
            actual = self.parent.type if self.parent else None
            if actual not in expected:
                raise ValidationError(f"{self.type} must be under {expected}.")

    @action(detail=True, methods=["patch"], url_path="move")
    def move(self, request, pk=None):
        item = self.get_object()
        loc_id = request.data.get("location")
        if not loc_id:
            return Response({"detail": "location is required"}, status=400)

        # Optional rule: only allow dropping into certain types
        allowed_drop_types = {"slot", "box"}  # tweak as you wish
        target = Location.objects.get(pk=loc_id)
        if target.type not in allowed_drop_types:
            return Response({"detail": f"Cannot move into a {target.type}."}, status=400)

        # Optional: capacity check for 'slot' or 'box'
        if target.capacity:
            current_count = type(item).objects.filter(location=target).count()
            if current_count >= target.capacity:
                return Response({"detail": "Target location is full."}, status=400)

        item.location = target
        item.save(update_fields=["location"])
        return Response({"ok": True, "item": self.get_serializer(item).data})

    # -------- Shelf-based bulk upload actions --------
    @action(detail=True, methods=["get"], url_path="slots")
    def get_shelf_slots(self, request, pk=None):
        """
        Returns a preview of all slots under a given shelf with FILLED/EMPTY status
        and names for box/row/slot. Expects pk to be a Shelf ID.
        """
        shelf: Location = self.get_object()
        if shelf.type != "shelf":
            return Response({"detail": "This endpoint requires a shelf id."}, status=400)

        # Descendant traversal: shelf -> box -> row -> slot
        boxes = list(Location.objects.filter(parent_id=shelf.id, type="box"))
        rows = list(Location.objects.filter(parent_id__in=[b.id for b in boxes], type="row"))
        slots = list(Location.objects.filter(parent_id__in=[r.id for r in rows], type="slot"))

        # Determine site and room names for header
        # Traverse upwards: shelf.parent (room) -> room.parent (site)
        room = shelf.parent
        site = room.parent if room else None

        # Inventory occupancy map
        occupied_ids = set(
            InventoryItem.objects.filter(location_id__in=[s.id for s in slots]).values_list("location_id", flat=True)
        )

        def name_by_id(map_list):
            return {x.id: x.name for x in map_list}

        box_map = name_by_id(boxes)
        row_map = name_by_id(rows)

        row_parent_map = {r.id: r.parent_id for r in rows}
        slot_parent_map = {s.id: s.parent_id for s in slots}

        data: List[Dict] = []
        empty_count = 0
        for s in slots:
            r_id = slot_parent_map.get(s.id)
            b_id = row_parent_map.get(r_id) if r_id else None
            is_filled = s.id in occupied_ids
            status_label = "FILLED" if is_filled else "EMPTY"
            if not is_filled:
                empty_count += 1
            data.append({
                "status": status_label,
                "cert_num": "-" if is_filled else "",
                "price": "-" if is_filled else "",
                "box": box_map.get(b_id, ""),
                "row": row_map.get(r_id, ""),
                "slot": s.name,
                "slot_id": s.id,
                "row_id": r_id,
                "box_id": b_id,
            })

        resp = {
            "site": site.name if site else "",
            "room": room.name if room else "",
            "shelf": shelf.name,
            "total": len(slots),
            "empty": empty_count,
            "filled": len(slots) - empty_count,
            "rows": data,
        }
        return Response(resp)

    @action(detail=True, methods=["get"], url_path="template")
    def download_shelf_template(self, request, pk=None):
        """
        Build an XLSX (primary) or CSV (optional when format=csv) template for a shelf.
        FILLED rows locked + green fill. EMPTY rows editable + red fill.
        """
        shelf: Location = self.get_object()
        if shelf.type != "shelf":
            return Response({"detail": "This endpoint requires a shelf id."}, status=400)

        preview = self.get_shelf_slots(request, pk).data
        site, room, shelf_name = preview.get("site", ""), preview.get("room", ""), preview.get("shelf", "")
        rows = preview.get("rows", [])

        # Prefer 'file_format'; fallback to 'format' for backward compatibility
        fmt = (request.query_params.get("file_format") or request.query_params.get("format") or "xlsx").lower()
        filename = f"{site}-{room}-{shelf_name}.{ 'csv' if fmt=='csv' else 'xlsx'}".replace(" ", "")

        headers = ["STATUS", "cert_num", "price", "box", "row", "slot"]

        if fmt == "csv":
            buf = io.StringIO()
            writer = csv.writer(buf)
            # Header block
            writer.writerow([f"Site: {site}"])
            writer.writerow([f"Room: {room}"])
            writer.writerow([f"Shelf: {shelf_name}"])
            writer.writerow(["Note: FILLED rows are placeholders ('-') and read-only. Do not edit them."])
            writer.writerow([])
            writer.writerow(headers)
            for r in rows:
                locked = r["status"] == "FILLED"
                cert_out = "-" if locked else r["cert_num"]
                price_out = "-" if locked else r["price"]
                writer.writerow([
                    r["status"],
                    cert_out,
                    price_out,
                    r["box"],
                    r["row"],
                    r["slot"],
                ])
            resp = HttpResponse(buf.getvalue(), content_type="text/csv")
            resp["Content-Disposition"] = f"attachment; filename={smart_str(filename)}"
            return resp

        # XLSX path using openpyxl
        if Workbook is None:
            return Response({"detail": "openpyxl not installed on server"}, status=500)

        wb = Workbook()
        ws = wb.active
        ws.title = "Shelf Template"

        # Header meta
        ws["A1"] = f"Site: {site}"
        ws["A2"] = f"Room: {room}"
        ws["A3"] = f"Shelf: {shelf_name}"

        # Write header block and guidance rows
        ws.cell(row=1, column=1, value=f"Site: {site}")
        ws.cell(row=2, column=1, value=f"Room: {room}")
        ws.cell(row=3, column=1, value=f"Shelf: {shelf_name}")
        ws.cell(
            row=4,
            column=1,
            value="Note: FILLED rows are placeholders ('-') and read-only. Do not edit them."
        )

        # Column headers (row 6)
        start_row = 6
        for idx, h in enumerate(headers, start=1):
            ws.cell(row=start_row, column=idx, value=h)

        # Colors
        green = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid") if PatternFill else None
        red = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid") if PatternFill else None

        # Rows
        for i, r in enumerate(rows, start=start_row + 1):
            locked = r["status"] == "FILLED"
            cert_val = "-" if locked else r["cert_num"]
            price_out = "-" if locked else r["price"]
            vals = [r["status"], cert_val, price_out, r["box"], r["row"], r["slot"]]
            for c, v in enumerate(vals, start=1):
                cell = ws.cell(row=i, column=c, value=v)
                if r["status"] == "FILLED" and green:
                    cell.fill = green
                elif r["status"] == "EMPTY" and red:
                    cell.fill = red
                # Locking: lock entire row if FILLED, else unlock cert_num and price only
                cell.protection = cell.protection.copy(locked=locked if c in (1, 4, 5, 6) else locked)

        # Protect sheet so locked cells are read-only, but allow editing in EMPTY rows
        ws.protection.sheet = True
        ws.protection.password = ""  # optional: set password if desired
        ws.protection.enable()

        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        resp = HttpResponse(
            out.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp["Content-Disposition"] = f"attachment; filename={smart_str(filename)}"
        return resp

    @action(detail=True, methods=["post"], url_path="upload-template")
    def upload_shelf_template(self, request, pk=None):
        """
        Validate an uploaded XLSX/CSV for the shelf. Reject changes to FILLED rows or structure,
        extra rows, edits in FILLED, and duplicate cert_num in DB.
        Returns a list of accepted entries for EMPTY rows with cert_num/price and slot mapping.
        """
        shelf: Location = self.get_object()
        if shelf.type != "shelf":
            return Response({"detail": "This endpoint requires a shelf id."}, status=400)

        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "file is required"}, status=400)

        preview = self.get_shelf_slots(request, pk).data
        rows = preview.get("rows", [])
        expected_headers = ["STATUS", "cert_num", "price", "box", "row", "slot"]

        parsed: List[Dict] = []
        errors: List[str] = []

        def validate_row(idx: int, tpl: Dict, inp: Dict):
            # idx is 0-based for parsed content excluding header rows
            # Structure: enforce STATUS, box/row/slot match
            if inp.get("STATUS") not in ("FILLED", "EMPTY"):
                errors.append(f"Row {idx+1}: STATUS must be FILLED or EMPTY")
                return
            if inp.get("box", "") != tpl.get("box", "") or inp.get("row", "") != tpl.get("row", "") or inp.get("slot", "") != tpl.get("slot", ""):
                errors.append(f"Row {idx+1}: Location fields mismatch with template")
                return
            status_inp = inp.get("STATUS")
            cert = (inp.get("cert_num") or "").strip()
            price_val = (inp.get("price") or "").strip()

            if status_inp == "FILLED":
                # Ignore FILLED rows: treat as read-only placeholders and do not error on value differences.
                # STATUS and location fields were already enforced above.
                return
            # EMPTY row: allow cert/price
            if not cert:
                return  # Accept empty entry (no-op)
            # Duplicate check in DB
            exists = InventoryItem.objects.filter(identification_number=cert).exists()
            if exists:
                errors.append(f"Row {idx+1}: cert_num already exists in DB")
                return
            # Accept numeric price
            try:
                price_parsed = float(price_val) if price_val not in (None, "") else 0.0
            except Exception:
                errors.append(f"Row {idx+1}: price must be numeric")
                return
            parsed.append({
                "cert_num": cert,
                "price": price_parsed,
                "box": tpl.get("box"),
                "row": tpl.get("row"),
                "slot": tpl.get("slot"),
                "slot_id": tpl.get("slot_id"),
            })

        # Parse CSV
        name = file_obj.name.lower()
        try:
            if name.endswith(".csv"):
                text = file_obj.read().decode("utf-8")
                reader = csv.reader(io.StringIO(text))
                lines = list(reader)
                # Expect header block followed by column headers
                # Find the header row index with expected headers
                header_idx = None
                for i, row in enumerate(lines[:12]):
                    if [c.strip() for c in row] == expected_headers:
                        header_idx = i
                        break
                if header_idx is None:
                    return Response({"detail": "Column headers not found or mismatched"}, status=400)
                data_rows = lines[header_idx + 1 :]
                if len(data_rows) > len(rows):
                    return Response({"detail": "Extra rows added beyond template"}, status=400)
                for i, row in enumerate(data_rows):
                    if not any(row):
                        continue
                    record = {expected_headers[j]: (row[j] if j < len(row) else "") for j in range(len(expected_headers))}
                    tpl = rows[i] if i < len(rows) else None
                    if not tpl:
                        errors.append(f"Row {i+1}: No matching template row")
                        continue
                    # Normalize FILLED placeholders '-' to empty strings for validation
                    if (record.get("STATUS") == "FILLED"):
                        record["cert_num"] = ""
                        record["price"] = ""
                    validate_row(i, tpl, record)
            else:
                if load_workbook is None:
                    return Response({"detail": "openpyxl not installed on server"}, status=500)
                wb = load_workbook(file_obj, data_only=True)
                ws = wb.active
                # Find headers row (look for STATUS in first column within first 10 rows)
                header_row = None
                for i in range(1, 13):
                    if (ws.cell(row=i, column=1).value or "").strip().upper() == "STATUS":
                        header_row = i
                        break
                if not header_row:
                    return Response({"detail": "Column headers not found or mismatched"}, status=400)
                headers_read = [ (ws.cell(row=header_row, column=j).value or "").strip() for j in range(1, 7) ]
                if headers_read != expected_headers:
                    return Response({"detail": "Structure modified (column mismatch or reorder)"}, status=400)
                # Iterate following rows
                i = 0
                row_idx = header_row + 1
                while True:
                    vals = [ws.cell(row=row_idx, column=j).value for j in range(1, 7)]
                    if all(v in (None, "") for v in vals):
                        break
                    record = {expected_headers[j-1]: (str(vals[j-1]).strip() if vals[j-1] is not None else "") for j in range(1, 7)}
                    tpl = rows[i] if i < len(rows) else None
                    if not tpl:
                        errors.append(f"Row {i+1}: No matching template row")
                    else:
                        # Normalize FILLED placeholders '-' to empty strings for validation
                        if record.get("STATUS") == "FILLED":
                            if record.get("cert_num") == "-":
                                record["cert_num"] = ""
                            if record.get("price") == "-":
                                record["price"] = ""
                        validate_row(i, tpl, record)
                    i += 1
                    row_idx += 1
                if i > len(rows):
                    return Response({"detail": "Extra rows added beyond template"}, status=400)
        except Exception as e:
            return Response({"detail": f"Failed to parse file: {e}"}, status=400)

        if errors:
            return Response({"ok": False, "errors": errors, "accepted": parsed}, status=400)
        return Response({"ok": True, "accepted": parsed, "summary": {"total": len(rows), "to_create": len(parsed)}})
