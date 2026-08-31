import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

import { Income, IncomePayload } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class IncomeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/incomes`;

  private readonly items = signal<Income[]>([]);
  readonly incomes = this.items.asReadonly();

  load() {
    return this.http.get<Income[]>(this.baseUrl).pipe(tap((incomes) => this.items.set(incomes)));
  }

  create(payload: IncomePayload) {
    return this.http.post<Income>(this.baseUrl, payload).pipe(tap(() => this.load().subscribe()));
  }

  update(id: string, payload: IncomePayload) {
    return this.http
      .put<Income>(`${this.baseUrl}/${id}`, payload)
      .pipe(tap(() => this.load().subscribe()));
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(tap(() => this.load().subscribe()));
  }
}
