// Загружаем данные с сервера
fetch('/admin/env')
    .then(res => res.json())
    .then(data => renderEnv(data))
    .catch(err => console.error('Ошибка загрузки:', err));

function renderEnv(envVars) {
    const tbody = document.getElementById('env-body');
    tbody.innerHTML = '';
    envVars.forEach(env => {
        const tr = document.createElement('tr');
        const isWritable = env.writable || false;
        const isSecret = env.secret || false;

        tr.innerHTML = `
            <td><strong>${env.key}</strong></td>
            <td>
                <input type="${isSecret ? 'password' : 'text'}"
                       value="${env.value}"
                       ${!isWritable ? 'disabled' : ''}
                       data-key="${env.key}"
                       class="${!isWritable ? 'readonly' : ''}" />
            </td>
            <td>
                ${isWritable ? '<span class="badge" style="background:#7c4dff;">✏️ редакт.</span>' 
                             : '<span class="badge" style="background:#555;">🔒 системная</span>'}
                ${isSecret ? ' <span class="secret">● секрет</span>' : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function saveEnv() {
    const inputs = document.querySelectorAll('#env-body input:not([disabled])');
    const updates = {};
    inputs.forEach(inp => {
        updates[inp.dataset.key] = inp.value;
    });

    if (Object.keys(updates).length === 0) {
        document.getElementById('status').textContent = '⚠️ Нет изменяемых полей';
        setTimeout(() => document.getElementById('status').textContent = '', 3000);
        return;
    }

    document.getElementById('status').textContent = '⏳ Сохранение...';

    fetch('/admin/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'ok') {
            document.getElementById('status').textContent = '✅ Сохранено!';
            // Перезагружаем данные (чтобы скрыть новые секреты)
            fetch('/admin/env')
                .then(r => r.json())
                .then(envData => renderEnv(envData));
        } else {
            document.getElementById('status').textContent = '❌ Ошибка: ' + (data.error || '');
        }
        setTimeout(() => document.getElementById('status').textContent = '', 4000);
    })
    .catch(() => {
        document.getElementById('status').textContent = '❌ Ошибка сети';
        setTimeout(() => document.getElementById('status').textContent = '', 4000);
    });
}

function testEmail() {
    const emailInput = document.getElementById('test-email');
    const to = emailInput.value.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        document.getElementById('test-status').textContent = '⚠️ Введите корректный email';
        setTimeout(() => document.getElementById('test-status').textContent = '', 3000);
        return;
    }

    document.getElementById('test-status').textContent = '⏳ Отправка...';

    fetch('/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'ok') {
            document.getElementById('test-status').textContent = '✅ Письмо отправлено!';
        } else {
            document.getElementById('test-status').textContent = '❌ Ошибка: ' + (data.error || '');
        }
        setTimeout(() => document.getElementById('test-status').textContent = '', 5000);
    })
    .catch(() => {
        document.getElementById('test-status').textContent = '❌ Ошибка сети';
        setTimeout(() => document.getElementById('test-status').textContent = '', 3000);
    });
}