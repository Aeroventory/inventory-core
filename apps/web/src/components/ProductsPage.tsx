import { useState, useEffect } from "react";
import { Product } from "../models/Product";
import {
  getProducts,
  createProduct,
  deleteProduct,
} from "../services/product-endpoints";

const inputClasses =
  "bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 rounded-lg text-sm outline-none transition-colors duration-200 focus:border-indigo-500 placeholder:text-slate-400/60";

interface Props {
  onProductsChange?: () => void;
}

export default function ProductsPage({ onProductsChange }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = () => {
    getProducts()
      .then((res) => {
        setProducts(res.data);
        onProductsChange?.();
      })
      .catch(() => setError("Failed to load products"));
  };

  const handleAdd = () => {
    const name = newName.trim();
    const value = parseInt(newValue, 10);
    if (!name) return;
    if (isNaN(value)) {
      setError("Value must be a number");
      return;
    }
    setError(null);
    createProduct({ name, value })
      .then(() => {
        setNewName("");
        setNewValue("");
        fetchProducts();
      })
      .catch(() => setError("Failed to create product"));
  };

  const handleDelete = (id: number) => {
    deleteProduct(id)
      .then(() => fetchProducts())
      .catch(() => setError("Failed to delete product"));
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-slate-100">Products</h2>

      {error && (
        <p className="text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg text-[0.8125rem] mb-4">
          {error}
        </p>
      )}

      <div className="flex gap-2 items-center mb-5">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Product name"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className={`${inputClasses} flex-1`}
        />
        <input
          type="number"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Value"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className={`${inputClasses} w-[100px]`}
        />
        <button
          onClick={handleAdd}
          className="border-none cursor-pointer font-medium rounded-lg transition-all duration-200 text-sm px-4 py-2 bg-indigo-500 text-white hover:bg-indigo-600"
        >
          Add Product
        </button>
      </div>

      {products.length === 0 ? (
        <p className="text-slate-400 text-sm italic">No products yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg transition-colors duration-200 hover:border-indigo-500"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium">{p.name}</span>
                <span className="text-emerald-500 text-[0.8125rem] font-semibold">
                  ₺{p.value}
                </span>
              </div>
              <button
                onClick={() => handleDelete(p.id)}
                className="cursor-pointer font-medium rounded-lg transition-all duration-200 text-xs px-2.5 py-1 bg-transparent text-rose-500 border border-rose-500 hover:bg-rose-500 hover:text-white"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
