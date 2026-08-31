import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { ImportBatch, ImportPreview } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/import`;

  preview(file: File) {
    return this.http.post<ImportPreview>(`${this.baseUrl}/csv/preview`, this.toFormData(file));
  }

  confirm(file: File, accountId: string) {
    return this.http.post<ImportBatch>(`${this.baseUrl}/csv`, this.toFormData(file), {
      params: new HttpParams().set('accountId', accountId),
    });
  }

  batches() {
    return this.http.get<ImportBatch[]>(`${this.baseUrl}/batches`);
  }

  private toFormData(file: File): FormData {
    const formData = new FormData();
    formData.append('file', file);
    return formData;
  }
}
