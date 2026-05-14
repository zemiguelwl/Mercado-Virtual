import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';

@Component({
  selector: 'app-order-detail',
  standalone: false,
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.css'
})
export class OrderDetailComponent implements OnInit {
  order: any = null;
  delivery: any = null;
  canCancel = false;
  loading = false;
  cancelling = false;
  errorMessage = '';

  readonly statusLabel: Record<string, string> = {
    pending: 'Pendente', confirmed: 'Confirmada', preparing: 'Em preparação',
    ready: 'Pronta', in_delivery: 'Em entrega', delivered: 'Entregue', cancelled: 'Cancelada'
  };

  constructor(
    private orderService: OrderService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loading = true;
    const id = this.route.snapshot.paramMap.get('id')!;
    this.orderService.getOrderById(id).subscribe({
      next: (res: any) => {
        this.order = res.order;
        this.delivery = res.delivery;
        this.canCancel = res.canCancel;
        this.loading = false;
      },
      error: () => { this.loading = false; this.router.navigate(['/orders']); }
    });
  }

  cancel(): void {
    if (!confirm('Tens a certeza que queres cancelar esta encomenda?')) return;
    this.cancelling = true;
    this.orderService.cancelOrder(this.order._id).subscribe({
      next: () => window.location.reload(),
      error: (err) => {
        this.cancelling = false;
        this.errorMessage = err.error?.message || 'Não foi possível cancelar.';
      }
    });
  }

  goReview(): void {
    this.router.navigate(['/orders', this.order._id, 'review']);
  }
}
