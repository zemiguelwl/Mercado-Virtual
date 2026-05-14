import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: '/catalog', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.module').then((m) => m.AuthModule)
  },
  {
    path: 'catalog',
    loadChildren: () => import('./features/catalog/catalog.module').then((m) => m.CatalogModule)
  },
  {
    path: 'cart',
    loadChildren: () => import('./features/cart/cart.module').then((m) => m.CartModule)
  },
  {
    path: 'orders',
    loadChildren: () => import('./features/orders/orders.module').then((m) => m.OrdersModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'profile',
    loadChildren: () => import('./features/profile/profile.module').then((m) => m.ProfileModule),
    canActivate: [AuthGuard]
  },
  { path: '**', redirectTo: '/catalog' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
