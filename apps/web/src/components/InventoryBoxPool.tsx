import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Boxes, RefreshCw, Save, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { InventoryBox } from "@/models/InventoryBox";
import { Product } from "@/models/Product";
import {
  createInventoryBox,
  deleteInventoryBox,
  getInventoryBoxes,
  updateInventoryBox,
} from "@/services/inventory-box-endpoints";
import { getProducts } from "@/services/product-endpoints";

function todayIso() {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
}

interface InventoryBoxPoolProps {
  isAdmin: boolean;
  refreshKey?: number;
  onChanged?: () => void;
  onStatsChange?: (stats: { activeBoxCount: number; activeUnitCount: number }) => void;
}

interface BoxDraft {
  box_code: string;
  product_id: string;
  quantity: string;
  box_date: string;
}

const emptyDraft = (): BoxDraft => ({
  box_code: "",
  product_id: "",
  quantity: "",
  box_date: todayIso(),
});

export default function InventoryBoxPool({
  isAdmin,
  refreshKey = 0,
  onChanged,
  onStatsChange,
}: InventoryBoxPoolProps) {
  const { i18n, t } = useTranslation();
  const [boxes, setBoxes] = useState<InventoryBox[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<BoxDraft>(emptyDraft);
  const [editBoxId, setEditBoxId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<BoxDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeBoxes = useMemo(() => boxes.filter((box) => box.is_active), [boxes]);
  const activeUnitCount = activeBoxes.reduce((sum, box) => sum + box.quantity, 0);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [boxRes, productRes] = await Promise.all([
        getInventoryBoxes(),
        getProducts(),
      ]);
      setBoxes(boxRes.data);
      setProducts(productRes.data);
      const active = boxRes.data.filter((box) => box.is_active);
      onStatsChange?.({
        activeBoxCount: active.length,
        activeUnitCount: active.reduce((sum, box) => sum + box.quantity, 0),
      });
    } catch {
      setError(t("snapshots.boxes.errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [refreshKey]);

  const selectedProduct = products.find((product) => product.id.toString() === draft.product_id);

  const handleCreate = async () => {
    const productId = Number(draft.product_id);
    const quantity = Number(draft.quantity);
    if (!productId || quantity <= 0 || !draft.box_date) {
      setError(t("snapshots.boxes.errors.invalid"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createInventoryBox({
        box_code: draft.box_code.trim() || null,
        product_id: productId,
        quantity,
        box_date: draft.box_date,
      });
      setDraft(emptyDraft());
      await loadData();
      onChanged?.();
    } catch {
      setError(t("snapshots.boxes.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (box: InventoryBox) => {
    setEditBoxId(box.id);
    setEditDraft({
      box_code: box.box_code,
      product_id: box.product_id.toString(),
      quantity: box.quantity.toString(),
      box_date: box.box_date,
    });
  };

  const handleSaveEdit = async (boxId: number) => {
    const productId = Number(editDraft.product_id);
    const quantity = Number(editDraft.quantity);
    if (!productId || quantity <= 0 || !editDraft.box_date || !editDraft.box_code.trim()) {
      setError(t("snapshots.boxes.errors.invalid"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateInventoryBox(boxId, {
        box_code: editDraft.box_code.trim(),
        product_id: productId,
        quantity,
        box_date: editDraft.box_date,
      });
      setEditBoxId(null);
      await loadData();
      onChanged?.();
    } catch {
      setError(t("snapshots.boxes.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (boxId: number) => {
    setSaving(true);
    setError(null);
    try {
      await deleteInventoryBox(boxId);
      await loadData();
      onChanged?.();
    } catch {
      setError(t("snapshots.boxes.errors.remove"));
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value: string) => {
    return new Date(`${value}T00:00:00`).toLocaleDateString(i18n.resolvedLanguage);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <CardTitle>{t("snapshots.boxes.title")}</CardTitle>
          <CardDescription>{t("snapshots.boxes.description")}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={activeBoxes.length ? "blue" : "neutral"}>
            {t("common.formats.boxes", { count: activeBoxes.length })}
          </Badge>
          <Badge tone={activeUnitCount ? "green" : "neutral"}>
            {t("common.formats.units", { count: activeUnitCount })}
          </Badge>
          <Button variant="secondary" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : undefined} />
            {t("common.actions.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="rounded-2xl border border-[#F7B8A4] bg-[#FFF1ED] px-4 py-3 text-sm font-semibold text-[#C2410C]">
            {error}
          </div>
        )}

        {isAdmin && (
          <div className="grid gap-3 rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-4 lg:grid-cols-[1.2fr_1fr_0.8fr_0.9fr_auto]">
            <Input
              value={draft.box_code}
              onChange={(event) => setDraft({ ...draft, box_code: event.target.value })}
              placeholder={t("snapshots.boxes.form.boxCodePlaceholder")}
            />
            <select
              className="h-10 rounded-xl border border-[#D9E4DD] bg-white px-3 text-sm text-[#10231B] outline-none focus:border-[#00684A] focus:ring-4 focus:ring-[rgba(0,104,74,0.12)]"
              value={draft.product_id}
              onChange={(event) => setDraft({ ...draft, product_id: event.target.value })}
            >
              <option value="">{t("snapshots.boxes.form.productPlaceholder")}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min="1"
              value={draft.quantity}
              onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
              placeholder={t("snapshots.boxes.form.quantityPlaceholder")}
            />
            <Input
              type="date"
              value={draft.box_date}
              onChange={(event) => setDraft({ ...draft, box_date: event.target.value })}
            />
            <Button onClick={handleCreate} disabled={saving || products.length === 0}>
              <Save size={16} />
              {t("common.actions.add")}
            </Button>
            {selectedProduct && (
              <p className="text-xs font-medium text-[#5B6B63] lg:col-span-5">
                {t("snapshots.boxes.form.selectedProduct", {
                  sku: selectedProduct.sku,
                  value: selectedProduct.value,
                })}
              </p>
            )}
          </div>
        )}

        {loading ? (
          <EmptyState icon={Boxes} title={t("snapshots.boxes.loadingTitle")} description={t("snapshots.boxes.loadingDescription")} />
        ) : boxes.length === 0 ? (
          <EmptyState icon={Boxes} title={t("snapshots.boxes.emptyTitle")} description={t("snapshots.boxes.emptyDescription")} />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#D9E4DD]">
            <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#F7FAF8] text-xs font-medium uppercase text-[#5B6B63]">
                  {[
                    t("common.labels.box"),
                    t("common.labels.product"),
                    t("common.labels.quantity"),
                    t("common.labels.date"),
                    t("common.labels.status"),
                    t("common.labels.actions"),
                  ].map((heading) => (
                    <th key={heading} className="border-b border-[#D9E4DD] px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {boxes.map((box) => {
                  const isEditing = editBoxId === box.id;
                  return (
                    <tr key={box.id} className="hover:bg-[#F7FAF8]">
                      <td className="border-b border-[#D9E4DD] px-4 py-3 font-semibold text-[#10231B]">
                        {isEditing ? (
                          <Input
                            value={editDraft.box_code}
                            onChange={(event) => setEditDraft({ ...editDraft, box_code: event.target.value })}
                          />
                        ) : (
                          box.box_code
                        )}
                      </td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">
                        {isEditing ? (
                          <select
                            className="h-10 w-full rounded-xl border border-[#D9E4DD] bg-white px-3 text-sm text-[#10231B] outline-none focus:border-[#00684A] focus:ring-4 focus:ring-[rgba(0,104,74,0.12)]"
                            value={editDraft.product_id}
                            onChange={(event) => setEditDraft({ ...editDraft, product_id: event.target.value })}
                          >
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            <p className="font-semibold text-[#10231B]">{box.product.name}</p>
                            <p className="text-xs text-[#5B6B63]">{box.product.sku}</p>
                          </div>
                        )}
                      </td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="1"
                            value={editDraft.quantity}
                            onChange={(event) => setEditDraft({ ...editDraft, quantity: event.target.value })}
                          />
                        ) : (
                          <Badge tone="green">{t("common.badges.quantity", { count: box.quantity })}</Badge>
                        )}
                      </td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editDraft.box_date}
                            onChange={(event) => setEditDraft({ ...editDraft, box_date: event.target.value })}
                          />
                        ) : (
                          formatDate(box.box_date)
                        )}
                      </td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">
                        <Badge tone={box.is_active ? "blue" : "neutral"}>
                          {box.is_active ? t("snapshots.boxes.status.active") : t("snapshots.boxes.status.removed")}
                        </Badge>
                      </td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">
                        {isAdmin && (
                          <div className="flex flex-wrap gap-2">
                            {isEditing ? (
                              <>
                                <Button size="icon" variant="soft" aria-label={t("common.actions.save")} onClick={() => void handleSaveEdit(box.id)} disabled={saving}>
                                  <Save size={15} />
                                </Button>
                                <Button size="icon" variant="secondary" aria-label={t("common.actions.cancel")} onClick={() => setEditBoxId(null)}>
                                  <X size={15} />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="secondary" onClick={() => startEdit(box)}>
                                  {t("common.actions.edit")}
                                </Button>
                                {box.is_active && (
                                  <Button size="icon" variant="danger" aria-label={t("common.actions.delete")} onClick={() => void handleRemove(box.id)} disabled={saving}>
                                    <Trash2 size={15} />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
