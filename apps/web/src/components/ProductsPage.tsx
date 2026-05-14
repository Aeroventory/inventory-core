import { useEffect, useMemo, useState } from "react";
import {
  Edit3,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ProductDTO, ProductUpdateDTO } from "@/dtos/ProductDTO";
import { Product } from "@/models/Product";
import { createProduct, deleteProduct, getProducts, updateProduct } from "@/services/product-endpoints";

const emptyDraft: ProductDTO = {
  name: "",
  value: 0,
  sku: "",
  location_site: "",
  location_aisle: "",
  location_rack: "",
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
  };
}

function cleanDraft(draft: ProductDTO | ProductUpdateDTO) {
  return Object.fromEntries(
    Object.entries(draft).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]),
  ) as ProductDTO | ProductUpdateDTO;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<ProductDTO>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<ProductUpdateDTO>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = () => {
    setLoading(true);
    setError(null);
    getProducts()
      .then((res) => setProducts(res.data))
      .catch(() => setError("Failed to load products from the API."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

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
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [products, query]);

  const handleCreate = () => {
    const cleaned = cleanDraft(draft) as ProductDTO;
    const value = Number(cleaned.value);
    if (!cleaned.name) {
      setError("Product name is required.");
      return;
    }
    if (!cleaned.sku) {
      setError("SKU is required.");
      return;
    }
    if (Number.isNaN(value)) {
      setError("Value must be a valid number.");
      return;
    }

    setSaving(true);
    setError(null);
    createProduct({ ...cleaned, value })
      .then(() => {
        setDraft(emptyDraft);
        fetchProducts();
      })
      .catch(() => setError("Failed to create product."))
      .finally(() => setSaving(false));
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
      setError("Product name is required.");
      return;
    }
    if (!cleaned.sku) {
      setError("SKU is required.");
      return;
    }

    const value = Number(cleaned.value);
    if (Number.isNaN(value)) {
      setError("Value must be a valid number.");
      return;
    }

    setSaving(true);
    setError(null);
    updateProduct(productId, { ...cleaned, value })
      .then(() => {
        cancelEditing();
        fetchProducts();
      })
      .catch(() => setError("Failed to update product."))
      .finally(() => setSaving(false));
  };

  const handleDelete = (id: number) => {
    setError(null);
    deleteProduct(id)
      .then(() => fetchProducts())
      .catch(() => setError("Failed to delete product."));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Badge tone="green">Products API</Badge>
          <h1 className="mt-3 text-3xl font-light text-[#10231B]">Products</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">
            Table-first CRUD tester for inventory products with required SKU and warehouse location fields.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchProducts} disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#F7B8A4] bg-[#FFF1ED] px-4 py-3 text-sm font-semibold text-[#C2410C]">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create product</CardTitle>
          <CardDescription>
            Create inventory rows with the backend product schema, including required SKU and optional location fields.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr_0.8fr_0.8fr_auto]">
            <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Product name" />
            <Input value={draft.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} placeholder="SKU" />
            <Input
              type="number"
              value={draft.value || ""}
              onChange={(event) => setDraft({ ...draft, value: Number(event.target.value) })}
              placeholder="Value"
            />
            <Input value={draft.location_site} onChange={(event) => setDraft({ ...draft, location_site: event.target.value })} placeholder="Site" />
            <Input value={draft.location_aisle} onChange={(event) => setDraft({ ...draft, location_aisle: event.target.value })} placeholder="Aisle" />
            <Input value={draft.location_rack} onChange={(event) => setDraft({ ...draft, location_rack: event.target.value })} placeholder="Rack" />
            <Button onClick={handleCreate} disabled={saving}>
              <Plus size={16} />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle>Product table</CardTitle>
            <CardDescription>{filteredProducts.length} visible products from /products</CardDescription>
          </div>
          <div className="w-full xl:w-80">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} leftSlot={<Search size={16} />} placeholder="Search name, SKU, location..." />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <EmptyState icon={Package} title="Loading products" description="Calling GET /products and waiting for the API response." />
          ) : filteredProducts.length === 0 ? (
            <EmptyState icon={Package} title="No products found" description="Create a product or clear the search filter to see rows here." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#D9E4DD]">
              <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-[#F7FAF8] text-xs font-medium uppercase text-[#5B6B63]">
                    {["Product", "SKU", "Value", "Location", "Schema Fields", "Actions"].map((heading) => (
                      <th key={heading} className="border-b border-[#D9E4DD] px-4 py-3">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredProducts.map((product) => {
                    const isEditing = editingId === product.id;
                    const location = productLocation(product);
                    return (
                      <tr key={product.id} className="hover:bg-[#F7FAF8]">
                        <td className="border-b border-[#D9E4DD] px-4 py-3">
                          {isEditing ? (
                            <Input value={editDraft.name || ""} onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })} />
                          ) : (
                            <div>
                              <p className="font-medium text-[#10231B]">{product.name}</p>
                              <p className="text-xs text-[#5B6B63]">Product #{product.id}</p>
                            </div>
                          )}
                        </td>
                        <td className="border-b border-[#D9E4DD] px-4 py-3">
                          {isEditing ? (
                            <Input value={editDraft.sku || ""} onChange={(event) => setEditDraft({ ...editDraft, sku: event.target.value })} />
                          ) : (
                            <Badge tone={product.sku ? "green" : "neutral"}>{product.sku || "pending"}</Badge>
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
                            <span className="font-semibold text-[#00684A]">₺{product.value}</span>
                          )}
                        </td>
                        <td className="border-b border-[#D9E4DD] px-4 py-3">
                          {isEditing ? (
                            <div className="grid grid-cols-3 gap-2">
                              <Input value={editDraft.location_site || ""} onChange={(event) => setEditDraft({ ...editDraft, location_site: event.target.value })} placeholder="Site" />
                              <Input value={editDraft.location_aisle || ""} onChange={(event) => setEditDraft({ ...editDraft, location_aisle: event.target.value })} placeholder="Aisle" />
                              <Input value={editDraft.location_rack || ""} onChange={(event) => setEditDraft({ ...editDraft, location_rack: event.target.value })} placeholder="Rack" />
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-[#5B6B63]">
                              <MapPin size={15} />
                              {location || "Location pending"}
                            </span>
                          )}
                        </td>
                        <td className="border-b border-[#D9E4DD] px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={product.qr_code_pattern ? "blue" : "neutral"}>QR {product.qr_code_pattern ? "set" : "pending"}</Badge>
                            <Badge tone={product.sku ? "green" : "warning"}>SKU {product.sku ? "ready" : "missing"}</Badge>
                          </div>
                        </td>
                        <td className="border-b border-[#D9E4DD] px-4 py-3">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleUpdate(product.id)} disabled={saving}>
                                <Save size={14} />
                                Save
                              </Button>
                              <Button size="sm" variant="secondary" onClick={cancelEditing}>
                                <X size={14} />
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button size="icon" variant="secondary" aria-label="Edit product" onClick={() => startEditing(product)}>
                                <Edit3 size={15} />
                              </Button>
                              <Button size="icon" variant="danger" aria-label="Delete product" onClick={() => handleDelete(product.id)}>
                                <Trash2 size={15} />
                              </Button>
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
    </div>
  );
}
