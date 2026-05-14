import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { CatalogService } from '../../../core/services/catalog.service';
import { CartService } from '../../../core/services/cart.service';

@Component({
  selector: 'app-catalog',
  standalone: false,
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.css'
})
export class CatalogComponent implements OnInit, OnDestroy {
  products: any[] = [];
  categories: any[] = [];
  supermarkets: any[] = [];
  pagination: any = {};

  filters = { q: '', category: '', supermarket: '', sort: 'name_asc', page: 1 };
  loading = false;
  addedProductId: string | null = null;

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private catalogService: CatalogService,
    private cartService: CartService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.filters.q = params['q'] || '';
      this.filters.category = params['category'] || '';
      this.filters.supermarket = params['supermarket'] || '';
      this.filters.sort = params['sort'] || 'name_asc';
      this.filters.page = parseInt(params['page'], 10) || 1;
      this.loadProducts();
    });

    this.searchSubject.pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(() => {
      this.filters.page = 1;
      this.applyFilters();
    });

    this.catalogService.getCategories().subscribe((res: any) => (this.categories = res.categories));
    this.catalogService.getSupermarkets().subscribe((res: any) => (this.supermarkets = res.supermarkets));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProducts(): void {
    this.loading = true;
    this.catalogService.getProducts(this.filters).subscribe({
      next: (res: any) => {
        this.products = res.products;
        this.pagination = res.pagination;
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.filters.q);
  }

  applyFilters(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.filters.q || null,
        category: this.filters.category || null,
        supermarket: this.filters.supermarket || null,
        sort: this.filters.sort !== 'name_asc' ? this.filters.sort : null,
        page: this.filters.page > 1 ? this.filters.page : null
      },
      queryParamsHandling: 'merge'
    });
  }

  onFilterChange(): void {
    this.filters.page = 1;
    this.applyFilters();
  }

  goToPage(page: number): void {
    this.filters.page = page;
    this.applyFilters();
  }

  addToCart(product: any): void {
    const error = this.cartService.addItem(product);
    if (error) {
      alert(error);
    } else {
      this.addedProductId = product._id;
      setTimeout(() => (this.addedProductId = null), 1500);
    }
  }

  compare(productName: string): void {
    this.router.navigate(['/catalog/compare'], { queryParams: { name: productName } });
  }

  get pages(): number[] {
    const total = this.pagination?.pages || 1;
    return Array.from({ length: total }, (_, i) => i + 1);
  }
}
