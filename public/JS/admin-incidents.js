(function () {
    'use strict';

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    // Русские названия статусов
    const STATUS_LABELS = {
        detected: 'обнаружено',
        investigating: 'расследуется',
        resolved: 'решено',
    };

    // Подтверждения для каждого действия
    const CONFIRM_MESSAGES = {
        investigating: 'Взять инцидент в работу?',
        resolved: 'Отметить инцидент как решённый?',
        detected: 'Переоткрыть инцидент? Он снова появится в списке обнаруженных.',
    };

    document.querySelectorAll('[data-set-status]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('tr[data-incident-id]');
            if (!row) return;

            const incidentId = row.getAttribute('data-incident-id');
            const newStatus = btn.getAttribute('data-set-status');
            const label = row.querySelector('[data-status-label]');
            const currentStatus = label.textContent.trim();

            // Проверяем, что статус действительно меняется
            const newLabel = STATUS_LABELS[newStatus];
            if (currentStatus === newLabel) return;

            // Подтверждение
            const message = CONFIRM_MESSAGES[newStatus] || `Изменить статус инцидента #${incidentId}?`;
            if (!confirm(message + `\n\nИнцидент #${incidentId}`)) return;

            btn.disabled = true;
            const originalText = btn.textContent;
            btn.textContent = '...';

            try {
                const res = await fetch(`/admin/incidents/${incidentId}/status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken || '',
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ status: newStatus }),
                });

                const data = await res.json().catch(() => ({}));

                if (res.ok && data.ok) {
                    // Перезагружаем страницу, чтобы обновились счётчики
                    // и кнопки действий (какой набор доступен — зависит от статуса)
                    window.location.reload();
                } else {
                    alert('Ошибка: ' + (data.error || 'не удалось изменить статус'));
                    btn.disabled = false;
                    btn.textContent = originalText;
                }
            } catch (e) {
                console.error(e);
                alert('Ошибка соединения');
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    });
})();