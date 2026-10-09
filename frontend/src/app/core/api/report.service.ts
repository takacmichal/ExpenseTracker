import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import {
  CategoryBreakdown,
  Forecast,
  MonthlySummary,
  RecurringReport,
  TransactionType,
  YearOverview,
} from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/reports`;

  summary(month: string) {
    return this.http.get<MonthlySummary>(`${this.baseUrl}/summary`, {
      params: new HttpParams().set('month', month),
    });
  }

  byCategory(from: string, to: string, type?: TransactionType) {
    let params = new HttpParams().set('from', from).set('to', to);
    if (type) {
      params = params.set('type', type);
    }

    return this.http.get<CategoryBreakdown>(`${this.baseUrl}/by-category`, { params });
  }

  year(year: number) {
    return this.http.get<YearOverview>(`${this.baseUrl}/year`, {
      params: new HttpParams().set('year', year),
    });
  }

  forecast(year: number) {
    return this.http.get<Forecast>(`${this.baseUrl}/forecast`, {
      params: new HttpParams().set('year', year),
    });
  }

  /** Expenses that repeat over the last twelve months, sorted by yearly cost. */
  recurring() {
    return this.http.get<RecurringReport>(`${this.baseUrl}/recurring`);
  }
}
