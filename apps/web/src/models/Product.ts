import { MediaAsset } from "./Media";

export interface Product {
  id: number;
  name: string;
  value: number;
  sku: string;
  qr_code_pattern?: string | null;
  location_site?: string | null;
  location_aisle?: string | null;
  location_rack?: string | null;
  raw_materials?: string | null;
  images?: MediaAsset[];
  primary_image?: MediaAsset | null;
}
