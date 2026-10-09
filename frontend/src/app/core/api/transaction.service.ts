import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import {
  BulkRequest,
  BulkResult,
  Page,
  Transaction,
  TransactionRequest,
  TransactionType,
} from '../models';
import { environment } from '../../../environments/environment';

export interface TransactionFilter {
  from?: string | null;
  to?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  type?: TransactionType | null;
  /** Text in the description or bank type; case- and accent-insensitive. */
  q?: string | null;
  /** With `categoryId`, also match every descendant category. Sent only when true. */
  includeSubcategories?: boolean;
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/transactions`;

  search(filter: TransactionFilter) {
    return this.http.get<Page<Transaction>>(this.baseUrl, { params: toParams(filter) });
  }

  /** The filtered list as a CSV file; paging is ignored, the export holds every match. */
  exportCsv(filter: TransactionFilter) {
    const { page: _page, size: _size, ...rest } = filter;
    return this.http.get(`${this.baseUrl}/export`, {
      params: toParams(rest),
      responseType: 'blob',
      observe: 'response',
    });
  }

  /** All-or-nothing: one unknown id fails the whole request and nothing changes. */
  bulk(request: BulkRequest) {
    return this.http.post<BulkResult>(`${this.baseUrl}/bulk`, request);
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

function toParams(filter: TransactionFilter): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== null && value !== undefined && value !== '' && value !== false) {
      params = params.set(key, String(value));
    }
  }
  return params;
}
