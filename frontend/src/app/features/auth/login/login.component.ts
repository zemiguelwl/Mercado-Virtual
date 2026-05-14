import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  errorMessage = '';
  loading = false;
  private returnUrl = '/catalog';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/catalog';
  }

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Preenche o email e a password.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';

    this.authService.login(this.email, this.password).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl),
      error: (err) => {
        this.loading = false;
        const body = err.error;
        if (body?.requiresVerification) {
          this.router.navigate(['/auth/verify-email'], { queryParams: { userId: body.userId } });
        } else {
          this.errorMessage = body?.message || 'Erro ao fazer login.';
        }
      }
    });
  }
}
