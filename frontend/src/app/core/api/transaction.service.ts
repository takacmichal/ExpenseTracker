import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { Page, Transaction, TransactionRequest, TransactionType } from '../models';
import { environment } from '../../../environments/environment';

export interface TransactionFilter {
  from?: string | null;
  to?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  type?: TransactionType | null;
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/transactions`;

  search(filter: TransactionFilter) {
    let params = new HttpParams();

    for (const [key, value] of Object.entries(filter)) {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    }

    return this.http.get<Page<Transaction>>(this.baseUrl, { params });
  }

  create(payload: TransactionRequest) {
    return this.http.post<Transaction>(this.baseUrl, payload);
  }

  update(id: string, payload: TransactionRequest) {
    return this.http.put<Transaction>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  categorise() {
    return this.http.post<{ updated: number }>(`${this.baseUrl}/categorise`, {});
  }
}
