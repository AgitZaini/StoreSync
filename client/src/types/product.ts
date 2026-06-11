export type StockStatus = "SAFE" | "LOW" | "OUT";

export type ProductCategory = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  purchasePrice: string;
  sellingPrice: string;
  stockQuantity: number;
  minimumStock: number;
  stockStatus: StockStatus;
  isActive: boolean;
  category?: ProductCategory | null;
};

export type ProductsResponse = {
  products: Product[];
};

export type CategoriesResponse = {
  categories: ProductCategory[];
};
