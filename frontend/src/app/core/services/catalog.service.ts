import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly API = '/api/v1/catalog';

  constructor(private http: HttpClient) {}

  getProducts(filters: { q?: string; category?: string; supermarket?: string; sort?: string; page?: number } = {}): Observable<any> {
    let params = new HttpParams();
    if (filters.q) params = params.set('q', filters.q);
    if (filters.category) params = params.set('category', filters.category);
    if (filters.supermarket) params = params.set('supermarket', filters.supermarket);
    if (filters.sort) params = params.set('sort', filters.sort);
    if (filters.page) params = params.set('page', filters.page.toString());
    return this.http.get(`${this.API}/products`, { params });
  }

  getProductById(id: string): Observable<any> {
    return this.http.get(`${this.API}/products/${id}`);
  }

  getCategories(): Observable<any> {
    return this.http.get(`${this.API}/categories`);
  }

  getSupermarkets(): Observable<any> {
    return this.http.get(`${this.API}/supermarkets`);
  }

  getSupermarketById(id: string): Observable<any> {
    return this.http.get(`${this.API}/supermarkets/${id}`);
  }

  compareProducts(name: string): Observable<any> {
    return this.http.get(`${this.API}/compare`, { params: new HttpParams().set('name', name) });
  }
}
