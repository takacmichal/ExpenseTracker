import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { ImportBatch, ImportPreview, UndoImportResult } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/import`;

  /** With an account, rows that account already holds come back flagged as duplicates. */
  preview(file: File, accountId?: string | null) {
    const params = accountId ? new HttpParams().set('accountId', accountId) : undefined;
    return this.http.post<ImportPreview>(`${this.baseUrl}/csv/preview`, this.toFormData(file), {
      params,
    });
  }

  confirm(file: File, accountId: string) {
    return this.http.post<ImportBatch>(`${this.baseUrl}/csv`, this.toFormData(file), {
      params: new HttpParams().set('accountId', accountId),
    });
  }

  batches() {
    return this.http.get<ImportBatch[]>(`${this.baseUrl}/batches`);
  }

  /** Deletes every transaction the batch created, then the batch. */
  undo(batchId: string) {
    return this.http.delete<UndoImportResult>(`${this.baseUrl}/batches/${batchId}`);
  }

  private toFormData(file: File): FormData {
    const formData = new FormData();
    formData.append('file', file);
    return formData;
  }
}
