import { Component, OnInit } from '@angular/core';
import { OrderService } from '../../../core/services/order.service';

@Component({
  selector: 'app-order-list',
  standalone: false,
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.css'
})
export class OrderListComponent implements OnInit {
  orders: any[] = [];
  loading = false;

  readonly statusLabel: Record<string, string> = {
    pending: 'Pendente', confirmed: 'Confirmada', preparing: 'Em preparação',
    ready: 'Pronta', in_delivery: 'Em entrega', delivered: 'Entregue', cancelled: 'Cancelada'
  };

  readonly statusColor: Record<string, string> = {
    pending: 'warn', confirmed: 'primary', preparing: 'primary',
    ready: 'accent', in_delivery: 'accent', delivered: '', cancelled: 'warn'
  };

  constructor(private orderService: OrderService) {}

  ngOnInit(): void {
    this.loading = true;
    this.orderService.getOrders().subscribe({
      next: (res: any) => { this.orders = res.orders; this.loading = false; },
      error: () => (this.loading = false)
    });
  }
}
