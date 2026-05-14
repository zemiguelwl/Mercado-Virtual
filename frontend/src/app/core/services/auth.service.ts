import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  address?: string;
  phone?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = '/api/v1/auth';
  private readonly TOKEN_KEY = 'mv_token';
  private readonly USER_KEY = 'mv_user';

  private currentUserSubject = new BehaviorSubject<User | null>(this.loadUser());
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  register(data: { name: string; email: string; password: string; phone: string; address: string; role: string }): Observable<any> {
    return this.http.post(`${this.API}/register`, data);
  }

  verifyEmail(userId: string, code: string): Observable<any> {
    return this.http.post(`${this.API}/verify-email`, { userId, code });
  }

  resendVerification(userId: string): Observable<any> {
    return this.http.post(`${this.API}/resend-verification`, { userId });
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post<{ token: string; user: User }>(`${this.API}/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(this.TOKEN_KEY, res.token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
        this.currentUserSubject.next(res.user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }
}
