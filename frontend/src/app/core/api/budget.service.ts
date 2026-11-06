import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { Budget, BudgetRequest, BudgetStatusReport } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/budgets`;

  list() {
    return this.http.get<Budget[]>(this.baseUrl);
  }

  /** Spending against every budget for one month; `month` is 1–12. */
  status(year: number, month: number) {
    return this.http.get<BudgetStatusReport>(`${this.baseUrl}/status`, {
      params: new HttpParams().set('year', year).set('month', month),
    });
  }

  create(payload: BudgetRequest) {
    return this.http.post<Budget>(this.baseUrl, payload);
  }

  update(id: string, payload: BudgetRequest) {
    return this.http.put<Budget>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
