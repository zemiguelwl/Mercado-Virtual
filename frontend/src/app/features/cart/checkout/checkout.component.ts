import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { OrderService } from '../../../core/services/order.service';
import { CatalogService } from '../../../core/services/catalog.service';

@Component({
  selector: 'app-checkout',
  standalone: false,
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css'
})
export class CheckoutComponent implements OnInit {
  get cart$() { return this.cartService.cart$; }
  deliveryOptions: any[] = [];
  selectedMethod = '';
  couponCode = '';
  couponResult: any = null;
  validatingCoupon = false;
  loading = false;
  errorMessage = '';

  constructor(
    private cartService: CartService,
    private orderService: OrderService,
    private catalogService: CatalogService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const cart = this.cartService.cart;
    if (!cart.items.length || !cart.supermarketId) {
      this.router.navigate(['/cart']);
      return;
    }
    this.catalogService.getSupermarketById(cart.supermarketId).subscribe({
      next: (res: any) => {
        this.deliveryOptions = (res.supermarket.deliveryMethods || []).filter(
          (m: any) => m.active && (m.type === 'pickup' || m.type === 'courier')
        );
        if (this.deliveryOptions.length) this.selectedMethod = this.deliveryOptions[0].type;
      }
    });
  }

  get subtotal(): number { return this.cartService.subtotal; }

  get deliveryCost(): number {
    if (this.couponResult?.deliveryFree) return 0;
    const dm = this.deliveryOptions.find((d) => d.type === this.selectedMethod);
    return dm?.cost || 0;
  }

  get discount(): number { return this.couponResult?.discountAmount || 0; }

  get total(): number {
    return Math.max(0, Math.round((this.subtotal - this.discount + this.deliveryCost) * 100) / 100);
  }

  validateCoupon(): void {
    if (!this.couponCode.trim()) return;
    this.validatingCoupon = true;
    this.couponResult = null;
    this.orderService.validateCoupon(this.couponCode.trim(), this.cartService.cart.supermarketId!, this.subtotal).subscribe({
      next: (res: any) => { this.couponResult = res; this.validatingCoupon = false; },
      error: () => { this.validatingCoupon = false; this.couponResult = { valid: false, message: 'Erro ao validar.' }; }
    });
  }

  onSubmit(): void {
    if (!this.selectedMethod) { this.errorMessage = 'Escolhe um método de entrega.'; return; }
    this.loading = true;
    this.errorMessage = '';
    const cart = this.cartService.cart;

    this.orderService.checkout({
      supermarketId: cart.supermarketId!,
      items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      deliveryMethod: this.selectedMethod,
      couponCode: this.couponResult?.valid ? this.couponCode : undefined
    }).subscribe({
      next: (res: any) => {
        this.cartService.clear();
        this.router.navigate(['/orders', res.orderId]);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Erro ao criar encomenda.';
      }
    });
  }
}
