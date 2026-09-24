console.log('S-1 loaded');

// Опрос — один раз за сессию, не раньше 5 минут на странице
(function () {
    if (sessionStorage.getItem('feedbackAsked')) return;
    const metaCsrf = document.querySelector('meta[name="csrf-token"]');
    if (!metaCsrf) return;

    setTimeout(() => {
        if (sessionStorage.getItem('feedbackAsked')) return;
        const wantToSuggest = confirm('Хотите оставить предложения по улучшению сайта?');
        sessionStorage.setItem('feedbackAsked', '1');
        if (!wantToSuggest) return;

        const suggestion = prompt('Опишите ваши предложения:');
        if (!suggestion || !suggestion.trim()) return;
        if (!confirm(`Отправить:\n\n"${suggestion}"?`)) return;

        fetch('/submit-feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': metaCsrf.getAttribute('content') || '',
            },
            credentials: 'same-origin',
            body: JSON.stringify({ feedback: suggestion.trim() }),
        })
        .then(r => r.ok ? alert('Спасибо!') : alert('Не удалось отправить.'))
        .catch(() => alert('Ошибка соединения.'));
    }, 5 * 60 * 1000);
})();