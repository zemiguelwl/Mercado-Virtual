import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: false,
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.css'
})
export class VerifyEmailComponent implements OnInit {
  code = '';
  userId = '';
  errorMessage = '';
  successMessage = '';
  loading = false;
  resending = false;

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.queryParams['userId'] || '';
    if (!this.userId) this.router.navigate(['/auth/register']);
  }

  onSubmit(): void {
    if (!this.code.trim()) {
      this.errorMessage = 'Introduz o código de verificação.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';

    this.authService.verifyEmail(this.userId, this.code.trim()).subscribe({
      next: () => {
        this.successMessage = 'Email verificado! A redirecionar para o login...';
        setTimeout(() => this.router.navigate(['/auth/login']), 2000);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Código inválido.';
      }
    });
  }

  resend(): void {
    this.resending = true;
    this.errorMessage = '';
    this.authService.resendVerification(this.userId).subscribe({
      next: () => {
        this.resending = false;
        this.successMessage = 'Novo código enviado para o teu email.';
      },
      error: (err) => {
        this.resending = false;
        this.errorMessage = err.error?.message || 'Erro ao reenviar.';
      }
    });
  }
}
