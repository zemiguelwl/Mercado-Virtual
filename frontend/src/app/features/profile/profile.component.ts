import { Component, OnInit } from '@angular/core';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: false,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  user: any = null;
  orderCount = 0;
  topProducts: any[] = [];
  form = { name: '', phone: '', address: '' };
  loading = false;
  saving = false;
  successMessage = '';
  errorMessage = '';

  constructor(private profileService: ProfileService, private authService: AuthService) {}

  ngOnInit(): void {
    this.loading = true;
    this.profileService.getProfile().subscribe({
      next: (res: any) => {
        this.user = res.user;
        this.orderCount = res.orderCount;
        this.topProducts = res.topProducts;
        this.form = { name: this.user.name, phone: this.user.phone, address: this.user.address };
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }

  onSave(): void {
    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.profileService.updateProfile(this.form).subscribe({
      next: (res: any) => {
        this.user = res.user;
        this.saving = false;
        this.successMessage = 'Perfil atualizado com sucesso!';
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err.error?.message || 'Erro ao atualizar perfil.';
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
