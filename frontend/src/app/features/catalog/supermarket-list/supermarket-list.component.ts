import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService } from '../../../core/services/catalog.service';

@Component({
  selector: 'app-supermarket-list',
  standalone: false,
  templateUrl: './supermarket-list.component.html',
  styleUrl: './supermarket-list.component.css'
})
export class SupermarketListComponent implements OnInit {
  supermarkets: any[] = [];
  loading = false;

  constructor(private catalogService: CatalogService, private router: Router) {}

  ngOnInit(): void {
    this.loading = true;
    this.catalogService.getSupermarkets().subscribe({
      next: (res: any) => { this.supermarkets = res.supermarkets; this.loading = false; },
      error: () => (this.loading = false)
    });
  }

  viewProducts(smId: string): void {
    this.router.navigate(['/catalog'], { queryParams: { supermarket: smId } });
  }

  stars(avg: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i + 1);
  }
}
