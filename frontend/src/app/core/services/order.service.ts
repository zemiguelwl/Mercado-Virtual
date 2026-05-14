import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly API = '/api/v1/client';

  constructor(private http: HttpClient) {}

  getOrders(): Observable<any> {
    return this.http.get(`${this.API}/orders`);
  }

  getOrderById(id: string): Observable<any> {
    return this.http.get(`${this.API}/orders/${id}`);
  }

  cancelOrder(id: string, reason?: string): Observable<any> {
    return this.http.post(`${this.API}/orders/${id}/cancel`, { reason });
  }

  submitReview(id: string, data: { supermarketRating?: number; supermarketComment?: string; courierRating?: number; courierComment?: string }): Observable<any> {
    return this.http.post(`${this.API}/orders/${id}/review`, data);
  }

  checkout(data: { supermarketId: string; items: { productId: string; quantity: number }[]; deliveryMethod: string; couponCode?: string }): Observable<any> {
    return this.http.post(`${this.API}/checkout`, data);
  }

  validateCoupon(code: string, supermarketId: string, subtotal: number): Observable<any> {
    const params = new HttpParams()
      .set('code', code)
      .set('supermarketId', supermarketId)
      .set('subtotal', subtotal.toString());
    return this.http.get(`${this.API}/coupons/validate`, { params });
  }
}
