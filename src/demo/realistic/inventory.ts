export interface InventoryItem {
  sku: string;
  count: number;
}

export function hasStock(items: InventoryItem[], sku: string): boolean {
  return items.some((item) => item.sku === sku);
}
