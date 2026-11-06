import { Component, computed, input } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';

/** Placeholder rows shown while a list or table loads for the first time. */
@Component({
  selector: 'app-list-skeleton',
  imports: [SkeletonModule],
  template: `
    <div class="rows" aria-busy="true" aria-label="Načítava sa">
      @for (row of rowIndexes(); track row) {
        <div class="row">
          <p-skeleton width="5rem" height="0.875rem" />
          <p-skeleton [width]="row % 2 ? '45%' : '60%'" height="0.875rem" />
          <p-skeleton width="4.5rem" height="0.875rem" />
        </div>
      }
    </div>
  `,
  styles: `
    .row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: var(--et-s4);
      padding: 0.875rem var(--et-s2);
      border-bottom: 1px solid var(--et-surface-2);
    }

    .row:last-child {
      border-bottom: none;
    }
  `,
})
export class ListSkeletonComponent {
  readonly rows = input(5);
  protected readonly rowIndexes = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
}
