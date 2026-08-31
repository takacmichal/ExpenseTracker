import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

import { Category, TransactionType } from '../models';
import { environment } from '../../../environments/environment';

export interface CategoryPayload {
  name: string;
  color: string | null;
  icon: string | null;
  type: TransactionType;
  parentId: string | null;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/categories`;

  private readonly items = signal<Category[]>([]);
  readonly categories = this.items.asReadonly();

  load() {
    return this.http
      .get<Category[]>(this.baseUrl)
      .pipe(tap((categories) => this.items.set(categories)));
  }

  create(payload: CategoryPayload) {
    return this.http.post<Category>(this.baseUrl, payload).pipe(tap(() => this.load().subscribe()));
  }

  update(id: string, payload: CategoryPayload) {
    return this.http
      .put<Category>(`${this.baseUrl}/${id}`, payload)
      .pipe(tap(() => this.load().subscribe()));
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(tap(() => this.load().subscribe()));
  }

  createDefaults() {
    return this.http
      .post<Category[]>(`${this.baseUrl}/defaults`, {})
      .pipe(tap(() => this.load().subscribe()));
  }
}
