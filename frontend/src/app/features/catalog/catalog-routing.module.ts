import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CatalogComponent } from './catalog/catalog.component';
import { CompareComponent } from './compare/compare.component';
import { SupermarketListComponent } from './supermarket-list/supermarket-list.component';

const routes: Routes = [
  { path: '', component: CatalogComponent },
  { path: 'compare', component: CompareComponent },
  { path: 'supermarkets', component: SupermarketListComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CatalogRoutingModule {}
