import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

import { Account } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/accounts`;

  private readonly items = signal<Account[]>([]);
  readonly accounts = this.items.asReadonly();

  load() {
    return this.http.get<Account[]>(this.baseUrl).pipe(tap((accounts) => this.items.set(accounts)));
  }

  create(payload: Omit<Account, 'id'>) {
    return this.http.post<Account>(this.baseUrl, payload).pipe(tap(() => this.load().subscribe()));
  }

  update(id: string, payload: Omit<Account, 'id'>) {
    return this.http
      .put<Account>(`${this.baseUrl}/${id}`, payload)
      .pipe(tap(() => this.load().subscribe()));
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(tap(() => this.load().subscribe()));
  }
}
