import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Edit3,
  ImageIcon,
  Images,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import GallerySelector from "@/components/GallerySelector";
import { Input } from "@/components/ui/input";
import { ProductDTO, ProductUpdateDTO } from "@/dtos/ProductDTO";
import { MediaAsset } from "@/models/Media";
import { Product } from "@/models/Product";
import { createProduct, deleteProduct, getProducts, updateProduct } from "@/services/product-endpoints";
import { updateProductMedia } from "@/services/media-endpoints";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8003";

const emptyDraft: ProductDTO = {
  name: "",
  value: 0,
  sku: "",
  location_site: "",
  location_aisle: "",
  location_rack: "",
  raw_materials: "",
};

function productLocation(product: Product | ProductDTO) {
  return [product.location_site, product.location_aisle, product.location_rack]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" / ");
}

function toEditDraft(product: Product): ProductUpdateDTO {
  return {
    name: product.name,
    value: product.value,
    sku: product.sku || "",
    qr_code_pattern: product.qr_code_pattern || "",
    location_site: product.location_site || "",
    location_aisle: product.location_aisle || "",
    location_rack: product.location_rack || "",
    raw_materials: product.raw_materials || "",
  };
}

function cleanDraft(draft: ProductDTO | ProductUpdateDTO) {
  return Object.fromEntries(
    Object.entries(draft).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]),
  ) as ProductDTO | ProductUpdateDTO;
}

function mediaAttachments(images: MediaAsset[], primaryImageId: number | null) {
  return images.map((image, index) => ({
    media_asset_id: image.id,
    sort_order: index,
    is_primary: image.id === primaryImageId,
  }));
}

export default function ProductsPage() {
  const { t } = useTranslation();
  const isAdmin = useAuthStore((state) => state.isAdmin());
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<ProductDTO>(emptyDraft);
  const [createImages, setCreateImages] = useState<MediaAsset[]>([]);
  const [createPrimaryImageId, setCreatePrimaryImageId] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<ProductUpdateDTO>({});
  const [mediaProduct, setMediaProduct] = useState<Product | null>(null);
  const [mediaDraftImages, setMediaDraftImages] = useState<MediaAsset[]>([]);
  const [mediaDraftPrimaryId, setMediaDraftPrimaryId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = () => {
    setLoading(true);
    setError(null);
    getProducts()
      .then((res) => setProducts(res.data))
      .catch(() => {
        const message = t("products.errors.load");
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setDraft(emptyDraft);
    setCreateImages([]);
    setCreatePrimaryImageId(null);
  };

  useEffect(() => {
    if (!createModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCreateModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createModalOpen]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((product) => {
      const haystack = [
        product.name,
        product.sku,
        product.location_site,
        product.location_aisle,
        product.location_rack,
        product.raw_materials,
        product.primary_image?.original_filename,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [products, query]);

  const handleCreate = async () => {
    const cleaned = cleanDraft(draft) as ProductDTO;
    const value = Number(cleaned.value);
    if (!cleaned.name) {
      const message = t("products.errors.nameRequired");
      setError(message);
      toast.error(message);
      return;
    }
    if (!cleaned.sku) {
      const message = t("products.errors.skuRequired");
      setError(message);
      toast.error(message);
      return;
    }
    if (Number.isNaN(value)) {
      const message = t("products.errors.invalidValue");
      setError(message);
      toast.error(message);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const productRes = await createProduct({ ...cleaned, value });
      if (createImages.length > 0) {
        await updateProductMedia(productRes.data.id, {
          attachments: mediaAttachments(createImages, createPrimaryImageId),
        });
      }
      setDraft(emptyDraft);
      setCreateImages([]);
      setCreatePrimaryImageId(null);
      setCreateModalOpen(false);
      fetchProducts();
      toast.success(t("products.success.create", { name: productRes.data.name }));
    } catch {
      const message = t("products.errors.create");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (product: Product) => {
    setEditingId(product.id);
    setEditDraft(toEditDraft(product));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditDraft({});
  };

  const handleUpdate = (productId: number) => {
    const cleaned = cleanDraft(editDraft) as ProductUpdateDTO;
    if (!cleaned.name) {
      const message = t("products.errors.nameRequired");
      setError(message);
      toast.error(message);
      return;
    }
    if (!cleaned.sku) {
      const message = t("products.errors.skuRequired");
      setError(message);
      toast.error(message);
      return;
    }

    const value = Number(cleaned.value);
    if (Number.isNaN(value)) {
      const message = t("products.errors.invalidValue");
      setError(message);
      toast.error(message);
      return;
    }

    setSaving(true);
    setError(null);
    updateProduct(productId, { ...cleaned, value })
      .then((res) => {
        cancelEditing();
        fetchProducts();
        toast.success(t("products.success.update", { name: res.data.name }));
      })
      .catch(() => {
        const message = t("products.errors.update");
        setError(message);
        toast.error(message);
      })
      .finally(() => setSaving(false));
  };

  const handleDelete = (id: number) => {
    const product = products.find((item) => item.id === id);
    setError(null);
    deleteProduct(id)
      .then(() => {
        fetchProducts();
        toast.success(t("products.success.delete", { name: product?.name ?? t("common.labels.product") }));
      })
      .catch(() => {
        const message = t("products.errors.delete");
        setError(message);
        toast.error(message);
      });
  };

  const startMediaEditing = (product: Product) => {
    setMediaProduct(product);
    const images = product.images ?? [];
    setMediaDraftImages(images);
    setMediaDraftPrimaryId(product.primary_image?.id ?? images[0]?.id ?? null);
  };

  const cancelMediaEditing = () => {
    setMediaProduct(null);
    setMediaDraftImages([]);
    setMediaDraftPrimaryId(null);
  };

  const handleMediaSave = () => {
    if (!mediaProduct) return;
    setSaving(true);
    setError(null);
    updateProductMedia(mediaProduct.id, {
      attachments: mediaAttachments(mediaDraftImages, mediaDraftPrimaryId),
    })
      .then((res) => {
        setProducts((current) => current.map((product) => (product.id === res.data.id ? res.data : product)));
        cancelMediaEditing();
        toast.success(t("products.success.updateImages", { name: res.data.name }));
      })
      .catch(() => {
        const message = t("products.errors.updateImages");
        setError(message);
        toast.error(message);
      })
      .finally(() => setSaving(false));
  };

  const tableHeadings = isAdmin
    ? [
        t("common.labels.product"),
        t("common.labels.image"),
        t("common.labels.sku"),
        t("common.labels.value"),
        t("common.labels.rawMaterials"),
        t("common.labels.location"),
        t("common.labels.schemaFields"),
        t("common.labels.actions"),
      ]
    : [
        t("common.labels.product"),
        t("common.labels.image"),
        t("common.labels.sku"),
        t("common.labels.value"),
        t("common.labels.rawMaterials"),
        t("common.labels.location"),
        t("common.labels.schemaFields"),
      ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="mt-3 text-3xl font-light text-[#10231B]">{t("products.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">
            {t("products.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus size={16} />
              {t("products.create.openButton")}
            </Button>
          )}
          <Button variant="secondary" onClick={fetchProducts} disabled={loading}>
            <RefreshCw size={16} />
            {t("common.actions.refresh")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#F7B8A4] bg-[#FFF1ED] px-4 py-3 text-sm font-semibold text-[#C2410C]">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle>{t("products.table.title")}</CardTitle>
            <CardDescription>{t("common.formats.visibleProducts", { count: filteredProducts.length })}</CardDescription>
          </div>
          <div className="w-full xl:w-80">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} leftSlot={<Search size={16} />} placeholder={t("products.table.searchPlaceholder")} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <EmptyState icon={Package} title={t("products.table.loadingTitle")} description={t("products.table.loadingDescription")} />
          ) : filteredProducts.length === 0 ? (
            <EmptyState icon={Package} title={t("products.table.emptyTitle")} description={t("products.table.emptyDescription")} />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#D9E4DD]">
              <table className="w-full min-w-[1260px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-[#F7FAF8] text-xs font-medium uppercase text-[#5B6B63]">
                    {tableHeadings.map((heading) => (
                      <th key={heading} className="border-b border-[#D9E4DD] px-4 py-3">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredProducts.map((product) => {
                    const isEditing = isAdmin && editingId === product.id;
                    const location = productLocation(product);
                    const thumbnail = product.primary_image;
                    return (
                      <tr key={product.id} className="hover:bg-[#F7FAF8]">
                        <td className="border-b border-[#D9E4DD] px-4 py-3">
                          {isEditing ? (
                            <Input value={editDraft.name || ""} onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })} />
                          ) : (
                            <div>
                              <p className="font-medium text-[#10231B]">{product.name}</p>
                              <p className="text-xs text-[#5B6B63]">{t("common.formats.productId", { id: product.id })}</p>
                            </div>
                          )}
                        </td>
                        <td className="border-b border-[#D9E4DD] px-4 py-3">
                          <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl border border-[#D9E4DD] bg-[#EEF4F0]">
                            {thumbnail ? (
                              <img
                                src={`${API_URL}/uploads/${thumbnail.file_path}`}
                                alt={thumbnail.original_filename || product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ImageIcon size={20} className="text-[#5B6B63]" />
                            )}
                          </div>
                        </td>
                        <td className="border-b border-[#D9E4DD] px-4 py-3">
                          {isEditing ? (
                            <Input value={editDraft.sku || ""} onChange={(event) => setEditDraft({ ...editDraft, sku: event.target.value })} />
                          ) : (
                            <Badge tone={product.sku ? "green" : "neutral"}>{product.sku || t("common.states.pending")}</Badge>
                          )}
                        </td>
                        <td className="border-b border-[#D9E4DD] px-4 py-3">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editDraft.value ?? ""}
                              onChange={(event) => setEditDraft({ ...editDraft, value: Number(event.target.value) })}
                            />
                          ) : (
                            <span className="font-semibold text-[#00684A]">{t("common.formats.currencyTry", { value: product.value })}</span>
                          )}
                        </td>
                        <td className="border-b border-[#D9E4DD] px-4 py-3">
                          {isEditing ? (
                            <Input value={editDraft.raw_materials || ""} onChange={(event) => setEditDraft({ ...editDraft, raw_materials: event.target.value })} placeholder={t("products.create.placeholders.rawMaterials")} />
                          ) : (
                            <span className="line-clamp-2 text-[#5B6B63]">
                              {product.raw_materials || t("products.table.rawMaterialsPending")}
                            </span>
                          )}
                        </td>
                        <td className="border-b border-[#D9E4DD] px-4 py-3">
                          {isEditing ? (
                            <div className="grid grid-cols-3 gap-2">
                              <Input value={editDraft.location_site || ""} onChange={(event) => setEditDraft({ ...editDraft, location_site: event.target.value })} placeholder={t("products.create.placeholders.site")} />
                              <Input value={editDraft.location_aisle || ""} onChange={(event) => setEditDraft({ ...editDraft, location_aisle: event.target.value })} placeholder={t("products.create.placeholders.aisle")} />
                              <Input value={editDraft.location_rack || ""} onChange={(event) => setEditDraft({ ...editDraft, location_rack: event.target.value })} placeholder={t("products.create.placeholders.rack")} />
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-[#5B6B63]">
                              <MapPin size={15} />
                              {location || t("products.table.locationPending")}
                            </span>
                          )}
                        </td>
                        <td className="border-b border-[#D9E4DD] px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={product.qr_code_pattern ? "blue" : "neutral"}>
                              {t("common.badges.qrStatus", { status: product.qr_code_pattern ? t("common.states.set") : t("common.states.pending") })}
                            </Badge>
                            <Badge tone={product.sku ? "green" : "warning"}>
                              {t("common.badges.skuStatus", { status: product.sku ? t("common.states.ready") : t("common.states.missing") })}
                            </Badge>
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="border-b border-[#D9E4DD] px-4 py-3">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleUpdate(product.id)} disabled={saving}>
                                  <Save size={14} />
                                  {t("common.actions.save")}
                                </Button>
                                <Button size="sm" variant="secondary" onClick={cancelEditing}>
                                  <X size={14} />
                                  {t("common.actions.cancel")}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button size="icon" variant="secondary" aria-label={t("common.aria.manageImages")} onClick={() => startMediaEditing(product)}>
                                  <Images size={15} />
                                </Button>
                                <Button size="icon" variant="secondary" aria-label={t("common.aria.editProduct")} onClick={() => startEditing(product)}>
                                  <Edit3 size={15} />
                                </Button>
                                <Button size="icon" variant="danger" aria-label={t("common.aria.deleteProduct")} onClick={() => handleDelete(product.id)}>
                                  <Trash2 size={15} />
                                </Button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && createModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#10231B]/55 px-4 py-8" role="presentation" onMouseDown={closeCreateModal}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-product-modal-title"
            aria-describedby="create-product-modal-description"
            className="w-full max-w-5xl rounded-2xl border border-[#D9E4DD] bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-4 border-b border-[#D9E4DD] px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle id="create-product-modal-title">{t("products.create.title")}</CardTitle>
                <CardDescription id="create-product-modal-description">
                  {t("products.create.description")}
                </CardDescription>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={closeCreateModal} aria-label={t("common.actions.cancel")}>
                <X size={17} />
              </Button>
            </div>
            <div className="space-y-5 px-5 py-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={t("products.create.placeholders.name")} />
                <Input value={draft.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} placeholder={t("products.create.placeholders.sku")} />
                <Input
                  type="number"
                  value={draft.value || ""}
                  onChange={(event) => setDraft({ ...draft, value: Number(event.target.value) })}
                  placeholder={t("products.create.placeholders.value")}
                />
                <Input value={draft.location_site} onChange={(event) => setDraft({ ...draft, location_site: event.target.value })} placeholder={t("products.create.placeholders.site")} />
                <Input value={draft.location_aisle} onChange={(event) => setDraft({ ...draft, location_aisle: event.target.value })} placeholder={t("products.create.placeholders.aisle")} />
                <Input value={draft.location_rack} onChange={(event) => setDraft({ ...draft, location_rack: event.target.value })} placeholder={t("products.create.placeholders.rack")} />
                <div className="md:col-span-2 xl:col-span-3">
                  <Input value={draft.raw_materials} onChange={(event) => setDraft({ ...draft, raw_materials: event.target.value })} placeholder={t("products.create.placeholders.rawMaterials")} />
                </div>
              </div>
              <GallerySelector
                selectedImages={createImages}
                primaryImageId={createPrimaryImageId}
                onChange={(images, primaryImageId) => {
                  setCreateImages(images);
                  setCreatePrimaryImageId(primaryImageId);
                }}
                title={t("products.create.galleryTitle")}
                description={t("products.create.galleryDescription")}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closeCreateModal}>
                  <X size={16} />
                  {t("common.actions.cancel")}
                </Button>
                <Button type="button" onClick={handleCreate} disabled={saving}>
                  <Plus size={16} />
                  {t("common.actions.add")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && mediaProduct && (
        <Card>
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>{t("products.gallery.title", { product: mediaProduct.name })}</CardTitle>
              <CardDescription>{t("products.gallery.description")}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={cancelMediaEditing}>
                <X size={16} />
                {t("common.actions.cancel")}
              </Button>
              <Button onClick={handleMediaSave} disabled={saving}>
                <Save size={16} />
                {t("common.actions.save")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <GallerySelector
              selectedImages={mediaDraftImages}
              primaryImageId={mediaDraftPrimaryId}
              onChange={(images, primaryImageId) => {
                setMediaDraftImages(images);
                setMediaDraftPrimaryId(primaryImageId);
              }}
              description={t("products.gallery.selectorDescription")}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
