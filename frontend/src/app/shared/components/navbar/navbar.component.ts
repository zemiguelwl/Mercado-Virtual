import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';

@Component({
  selector: 'app-navbar',
  standalone: false,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  cartCount = 0;
  private subs: Subscription[] = [];

  constructor(private authService: AuthService, private cartService: CartService) {}

  ngOnInit(): void {
    this.subs.push(
      this.authService.currentUser$.subscribe((u) => (this.currentUser = u)),
      this.cartService.cart$.subscribe(() => (this.cartCount = this.cartService.itemCount))
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  logout(): void {
    this.authService.logout();
  }
}
