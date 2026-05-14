import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: false,
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  form = { name: '', email: '', password: '', phone: '', address: '', role: 'client' };
  errorMessage = '';
  loading = false;

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    const { name, email, password, phone } = this.form;
    if (!name || !email || !password || !phone) {
      this.errorMessage = 'Preenche todos os campos obrigatórios.';
      return;
    }
    if (password.length < 6) {
      this.errorMessage = 'A password deve ter pelo menos 6 caracteres.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';

    this.authService.register(this.form).subscribe({
      next: (res: any) => {
        this.router.navigate(['/auth/verify-email'], { queryParams: { userId: res.userId } });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Erro ao criar conta.';
      }
    });
  }
}
