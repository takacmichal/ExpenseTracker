import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TransactionService } from './transaction.service';

describe('TransactionService', () => {
  let service: TransactionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TransactionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends includeSubcategories only when it is true', () => {
    service.search({ categoryId: 'c1', includeSubcategories: true, page: 0 }).subscribe();
    const withSub = http.expectOne((r) => r.url === '/api/transactions');
    expect(withSub.request.params.get('includeSubcategories')).toBe('true');
    expect(withSub.request.params.get('categoryId')).toBe('c1');
    withSub.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 });

    service.search({ categoryId: 'c1', includeSubcategories: false, page: 0 }).subscribe();
    const without = http.expectOne((r) => r.url === '/api/transactions');
    expect(without.request.params.has('includeSubcategories')).toBe(false);
    expect(without.request.params.get('page')).toBe('0');
    without.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 });
  });

  it('passes includeSubcategories to the export but drops paging', () => {
    service
      .exportCsv({ categoryId: 'c1', includeSubcategories: true, page: 2, size: 25 })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/api/transactions/export');
    expect(req.request.params.get('includeSubcategories')).toBe('true');
    expect(req.request.params.has('page')).toBe(false);
    expect(req.request.params.has('size')).toBe(false);
    req.flush(new Blob());
  });
});
