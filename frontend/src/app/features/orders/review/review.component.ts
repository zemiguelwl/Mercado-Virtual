import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';

@Component({
  selector: 'app-review',
  standalone: false,
  templateUrl: './review.component.html',
  styleUrl: './review.component.css'
})
export class ReviewComponent implements OnInit {
  order: any = null;
  delivery: any = null;
  form = { supermarketRating: 0, supermarketComment: '', courierRating: 0, courierComment: '' };
  loading = false;
  submitting = false;
  errorMessage = '';
  stars = [1, 2, 3, 4, 5];

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
        if (this.order.status !== 'delivered' || this.order.reviewSubmitted) {
          this.router.navigate(['/orders', id]);
        }
        this.loading = false;
      },
      error: () => { this.loading = false; this.router.navigate(['/orders']); }
    });
  }

  setStar(type: 'supermarket' | 'courier', value: number): void {
    if (type === 'supermarket') this.form.supermarketRating = value;
    else this.form.courierRating = value;
  }

  onSubmit(): void {
    if (!this.form.supermarketRating && !this.form.courierRating) {
      this.errorMessage = 'Seleciona pelo menos uma avaliação.';
      return;
    }
    this.submitting = true;
    this.errorMessage = '';
    this.orderService.submitReview(this.order._id, this.form).subscribe({
      next: () => this.router.navigate(['/orders', this.order._id]),
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.message || 'Erro ao submeter avaliação.';
      }
    });
  }
}
