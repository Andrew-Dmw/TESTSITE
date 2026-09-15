(function () {
    'use strict';

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    document.querySelectorAll('[data-set-status]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('tr[data-lead-id]');
            if (!row) return;
            const leadId = row.getAttribute('data-lead-id');
            const newStatus = btn.getAttribute('data-set-status');

            const label = row.querySelector('[data-status-label]');
            const oldStatus = label.textContent.trim();

            if (oldStatus === newStatus) return;
            if (!confirm(`Изменить статус заявки #${leadId} на «${newStatus}»?`)) return;

            try {
                const res = await fetch(`/admin/leads/${leadId}/status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken || '',
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ status: newStatus }),
                });

                if (res.ok) {
                    label.textContent = newStatus;
                    label.className = `badge badge-${newStatus}`;
                } else {
                    alert('Не удалось изменить статус');
                }
            } catch (e) {
                console.error(e);
                alert('Ошибка соединения');
            }
        });
    });
})();