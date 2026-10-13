/**
 * DevSync Pagination Component
 */

export function renderPagination(container, { currentPage = 1, totalPages = 1, onPageChange }) {
  if (!container || totalPages <= 1) {
    if (container) container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="pagination-info">Page ${currentPage} of ${totalPages}</div>
    <div class="pagination-controls">
      <button class="pagination-btn btn-prev" ${currentPage <= 1 ? 'disabled' : ''}>&larr; Prev</button>
      <button class="pagination-btn btn-next" ${currentPage >= totalPages ? 'disabled' : ''}>Next &rarr;</button>
    </div>
  `;

  container.querySelector('.btn-prev')?.addEventListener('click', () => {
    if (currentPage > 1 && onPageChange) onPageChange(currentPage - 1);
  });

  container.querySelector('.btn-next')?.addEventListener('click', () => {
    if (currentPage < totalPages && onPageChange) onPageChange(currentPage + 1);
  });
}
