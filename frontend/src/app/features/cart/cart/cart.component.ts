import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartService, Cart } from '../../../core/services/cart.service';

@Component({
  selector: 'app-cart',
  standalone: false,
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css'
})
export class CartComponent implements OnInit, OnDestroy {
  cart: Cart = { supermarketId: null, supermarketName: '', items: [] };
  private sub!: Subscription;

  constructor(private cartService: CartService, private router: Router) {}

  ngOnInit(): void {
    this.sub = this.cartService.cart$.subscribe((c) => (this.cart = c));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get subtotal(): number {
    return this.cartService.subtotal;
  }

  updateQty(productId: string, qty: number): void {
    this.cartService.updateQuantity(productId, qty);
  }

  remove(productId: string): void {
    this.cartService.removeItem(productId);
  }

  clear(): void {
    if (confirm('Esvaziar o carrinho?')) this.cartService.clear();
  }

  checkout(): void {
    this.router.navigate(['/cart/checkout']);
  }
}
