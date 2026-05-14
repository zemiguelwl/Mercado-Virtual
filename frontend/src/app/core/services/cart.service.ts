import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CartItem {
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string;
  quantity: number;
  stock: number;
}

export interface Cart {
  supermarketId: string | null;
  supermarketName: string;
  items: CartItem[];
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly STORAGE_KEY = 'mv_cart';

  private cartSubject = new BehaviorSubject<Cart>(this.loadCart());
  cart$ = this.cartSubject.asObservable();

  private loadCart(): Cart {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : { supermarketId: null, supermarketName: '', items: [] };
    } catch {
      return { supermarketId: null, supermarketName: '', items: [] };
    }
  }

  private save(cart: Cart): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cart));
    this.cartSubject.next(cart);
  }

  get cart(): Cart {
    return this.cartSubject.value;
  }

  get itemCount(): number {
    return this.cart.items.reduce((acc, i) => acc + i.quantity, 0);
  }

  get subtotal(): number {
    return Math.round(this.cart.items.reduce((acc, i) => acc + i.productPrice * i.quantity, 0) * 100) / 100;
  }

  addItem(product: { _id: string; name: string; price: number; image: string; stock: number; supermarket: { _id: string; name: string } }, quantity = 1): string | null {
    const cart = { ...this.cart, items: [...this.cart.items] };
    const smId = product.supermarket._id;

    if (cart.supermarketId && cart.supermarketId !== smId) {
      return 'Só podes ter produtos de um supermercado por encomenda. Esvazia o carrinho primeiro.';
    }

    const existing = cart.items.find((i) => i.productId === product._id);
    if (existing) {
      const nextQty = existing.quantity + quantity;
      if (nextQty > product.stock) return 'Stock insuficiente para esta quantidade.';
      existing.quantity = nextQty;
    } else {
      if (quantity > product.stock) return 'Stock insuficiente.';
      cart.items.push({
        productId: product._id,
        productName: product.name,
        productPrice: product.price,
        productImage: product.image,
        quantity,
        stock: product.stock
      });
    }

    cart.supermarketId = smId;
    cart.supermarketName = product.supermarket.name;
    this.save(cart);
    return null;
  }

  updateQuantity(productId: string, quantity: number): void {
    const cart = { ...this.cart, items: [...this.cart.items] };
    const item = cart.items.find((i) => i.productId === productId);
    if (!item) return;
    item.quantity = Math.max(1, Math.min(quantity, item.stock));
    this.save(cart);
  }

  removeItem(productId: string): void {
    const cart = { ...this.cart };
    cart.items = cart.items.filter((i) => i.productId !== productId);
    if (!cart.items.length) { cart.supermarketId = null; cart.supermarketName = ''; }
    this.save(cart);
  }

  clear(): void {
    const empty: Cart = { supermarketId: null, supermarketName: '', items: [] };
    this.save(empty);
  }
}
