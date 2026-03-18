"use client";

import { useState } from "react";
import { useLocations } from "@/hooks/use-api";
import { useUpdateLocation, useDeleteLocation } from "@/hooks/use-mutations";
import { useToast } from "@/components/ui/toast";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Location } from "@/lib/api";

function statusVariant(s: string) {
  switch (s) {
    case "Stable":
      return "default" as const;
    case "Attention":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

const STATUS_OPTIONS = [
  { value: "Stable", label: "Stable" },
  { value: "Attention", label: "Attention" },
  { value: "Closed", label: "Closed" },
];

export default function LocationsPage() {
  const { data, isLoading } = useLocations();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Location | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const kpis = [
    { label: "Total locations", value: items.length },
    {
      label: "Stable",
      value: items.filter((l) => l.status === "Stable").length,
    },
    {
      label: "Attention",
      value: items.filter((l) => l.status === "Attention").length,
    },
  ];

  function handleEditStatus(loc: Location) {
    setEditingLocation(loc);
    setEditStatus(loc.status);
  }

  function submitStatusEdit() {
    if (!editingLocation) return;
    updateLocation.mutate(
      { id: editingLocation.id, status: editStatus },
      {
        onSuccess: () => {
          toast({
            title: "Status updated",
            description: `${editingLocation.name} set to ${editStatus}`,
            variant: "success",
          });
          setEditingLocation(null);
        },
        onError: (err) =>
          toast({
            title: "Failed to update status",
            description: err.message,
            variant: "error",
          }),
      }
    );
  }

  const locationColumns: ColumnDef<Location>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("name")}</span>
      ),
    },
    { accessorKey: "city", header: "City" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.getValue("status"))}>
          {row.getValue("status")}
        </Badge>
      ),
    },
    { accessorKey: "sales_delta", header: "Sales Delta" },
    { accessorKey: "labor_delta", header: "Labor Delta" },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon-xs"
            title="Edit status"
            onClick={() => handleEditStatus(row.original)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Remove location"
            onClick={() => setConfirmDelete(row.original)}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <WorkspaceHeader title="Locations" subtitle="Multi-location overview" />
      <div className="p-4 lg:p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={locationColumns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: Location) => setSelectedId(item.id)}
          searchPlaceholder="Search locations..."
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.name ?? ""}
        statusBadge={
          selectedItem ? { label: selectedItem.status } : undefined
        }
        fields={
          selectedItem
            ? [
                { label: "Name", value: selectedItem.name },
                { label: "City", value: selectedItem.city },
                { label: "Status", value: selectedItem.status },
                {
                  label: "Sales Delta",
                  value: selectedItem.sales_delta ?? "\u2014",
                },
                {
                  label: "Labor Delta",
                  value: selectedItem.labor_delta ?? "\u2014",
                },
              ]
            : []
        }
        summary={null}
        detailPoints={null}
        prompt={null}
        actions={
          selectedItem
            ? [
                {
                  label: "Edit Status",
                  variant: "default" as const,
                  onClick: () => {
                    if (selectedItem) handleEditStatus(selectedItem);
                  },
                },
              ]
            : undefined
        }
      />

      {/* Edit status dialog */}
      {editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setEditingLocation(null)}
          />
          <div className="relative z-50 w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
            <h3 className="text-sm font-semibold mb-4">
              Edit Status — {editingLocation.name}
            </h3>
            <Select
              options={STATUS_OPTIONS}
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingLocation(null)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={submitStatusEdit}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={() => setConfirmDelete(null)}
        title="Remove location?"
        description={`This will permanently remove ${confirmDelete?.name} from your organization.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => {
          if (confirmDelete) {
            deleteLocation.mutate(confirmDelete.id, {
              onSuccess: () => {
                toast({
                  title: "Location removed",
                  variant: "success",
                });
                setSelectedId(null);
              },
              onError: (err) =>
                toast({
                  title: "Failed to remove location",
                  description: err.message,
                  variant: "error",
                }),
            });
          }
        }}
      />
    </>
  );
}
