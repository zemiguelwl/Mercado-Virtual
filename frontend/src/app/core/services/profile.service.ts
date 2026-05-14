import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly API = '/api/v1/client';

  constructor(private http: HttpClient) {}

  getProfile(): Observable<any> {
    return this.http.get(`${this.API}/profile`);
  }

  updateProfile(data: { name?: string; phone?: string; address?: string }): Observable<any> {
    return this.http.put(`${this.API}/profile`, data);
  }
}
