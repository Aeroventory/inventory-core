import api from "./axios-config";
import { Product } from "../models/Product";
import { ProductDTO, ProductUpdateDTO } from "../dtos/ProductDTO";

export const getProducts = () => {
  return api.get<Product[]>("/products/");
};

export const createProduct = (product: ProductDTO) => {
  return api.post<Product>("/products/", product);
};

export const updateProduct = (productId: number, product: ProductUpdateDTO) => {
  return api.patch<Product>(`/products/${productId}`, product);
};

export const deleteProduct = (productId: number) => {
  return api.delete(`/products/${productId}`);
};
