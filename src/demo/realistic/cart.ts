export interface CartItem {
  quantity: number;
  price: number;
}

export function calculateCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
