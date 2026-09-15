(function () {
    'use strict';

    const form = document.getElementById('leadForm');
    if (!form) return;

    const submitBtn = document.getElementById('leadSubmit');
    const messageEl = document.getElementById('leadMessage');
    const sourceInput = document.getElementById('lead-source');

    // Определяем источник из UTM-метки
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source');
    const utmMedium = urlParams.get('utm_medium');
    if (utmSource) {
        sourceInput.value = utmSource + (utmMedium ? '/' + utmMedium : '');
    } else if (document.referrer && !document.referrer.includes(window.location.hostname)) {
        try {
            sourceInput.value = 'referrer:' + new URL(document.referrer).hostname;
        } catch (e) { /* ignore */ }
    }

    function setMessage(text, type = 'error') {
        messageEl.textContent = text;
        messageEl.className = 'form-message ' + type;
    }

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        submitBtn.querySelector('.btn-text').hidden = isLoading;
        submitBtn.querySelector('.btn-spinner').hidden = !isLoading;
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setMessage('');

        const fd = new FormData(form);
        const data = {
            name: (fd.get('name') || '').toString().trim(),
            contact: (fd.get('contact') || '').toString().trim(),
            message: (fd.get('message') || '').toString().trim(),
            privacyConsent: fd.get('privacyConsent') === 'on',
            honeypot: (fd.get('honeypot') || '').toString(),
            source: (fd.get('source') || 'direct').toString(),
        };

        // Клиентская валидация
        if (data.name.length < 2) return setMessage('Укажите имя (минимум 2 символа)');
        if (data.contact.length < 5) return setMessage('Укажите телефон или Telegram');

        setLoading(true);
        try {
            const res = await fetch('/submit-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(data),
            });

            const result = await res.json().catch(() => ({}));

            if (res.ok && result.ok) {
                setMessage('Заявка отправлена! Я свяжусь с вами в ближайшее время.', 'success');
                form.reset();
            } else {
                setMessage(result.error || 'Не удалось отправить заявку');
            }
        } catch (err) {
            console.error('Lead form error:', err);
            setMessage('Ошибка соединения. Попробуйте позже или позвоните напрямую.');
        } finally {
            setLoading(false);
        }
    });
})();