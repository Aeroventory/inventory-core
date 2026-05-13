export interface ProductDTO {
  name: string;
  value: number;
  sku: string;
  qr_code_pattern?: string;
  location_site?: string;
  location_aisle?: string;
  location_rack?: string;
}

export interface ProductUpdateDTO {
  name?: string;
  value?: number;
  sku?: string;
  qr_code_pattern?: string | null;
  location_site?: string | null;
  location_aisle?: string | null;
  location_rack?: string | null;
}
