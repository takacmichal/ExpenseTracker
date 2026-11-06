import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { CategoryRule, CategoryRuleRequest, RuleTestRequest, RuleTestResponse } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CategoryRuleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/category-rules`;

  list() {
    return this.http.get<CategoryRule[]>(this.baseUrl);
  }

  create(payload: CategoryRuleRequest) {
    return this.http.post<CategoryRule>(this.baseUrl, payload);
  }

  update(id: string, payload: CategoryRuleRequest) {
    return this.http.put<CategoryRule>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Which existing transactions a pattern would match, without saving anything. */
  test(payload: RuleTestRequest) {
    return this.http.post<RuleTestResponse>(`${this.baseUrl}/test`, payload);
  }
}
