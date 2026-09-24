const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

(function () {
    'use strict';

    // ============================================================
    // Утилиты UI
    // ============================================================
    function setMessage(el, text, type = 'error') {
        if (!el) return;
        el.textContent = text;
        el.className = 'message ' + type;
    }

    function clearMessage(el) {
        if (!el) return;
        el.textContent = '';
        el.className = 'message';
    }

    function setLoading(btn, isLoading) {
        if (!btn) return;
        btn.disabled = isLoading;
        const text = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.btn-spinner');
        if (text) text.hidden = isLoading;
        if (spinner) spinner.hidden = !isLoading;
    }

    // ============================================================
    // Отправка JSON на сервер
    // ============================================================
    async function postJSON(url, payload) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });

        if (response.redirected) {
            window.location.href = response.url;
            return { redirected: true };
        }

        let data = {};
        try { data = await response.json(); } catch { /* ignore */ }
        return { ok: response.ok, status: response.status, data };
    }

    // ============================================================
    // Валидация
    // ============================================================
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function validateLogin(data) {
        if (!data.email || !emailRe.test(data.email)) return 'Введите корректный email';
        if (!data.password || data.password.length < 8) return 'Пароль должен быть не менее 8 символов';
        return null;
    }

    function validateRegister(data) {
        if (!data.name || data.name.trim().length < 2) return 'Имя должно быть не менее 2 символов';
        if (!data.email || !emailRe.test(data.email)) return 'Введите корректный email';
        if (!data.password || data.password.length < 8) return 'Пароль должен быть не менее 8 символов';
        if (!data.privacyConsent) return 'Необходимо согласие с политикой конфиденциальности';
        return null;
    }

    // ============================================================
    // ФОРМА ВХОДА (если она есть на странице)
    // ============================================================
    const loginForm = document.getElementById('loginForm');
    const loginMsg  = document.getElementById('loginMessage');
    const loginBtn  = document.getElementById('loginBtn');

    if (loginForm && loginBtn) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessage(loginMsg);

            const fd = new FormData(loginForm);
            const data = {
                email:    (fd.get('email') || '').toString().trim(),
                password: (fd.get('password') || '').toString(),
                honeypot: (fd.get('honeypot') || '').toString(),
            };

            const err = validateLogin(data);
            if (err) { setMessage(loginMsg, err); return; }

            setLoading(loginBtn, true);
            try {
                const res = await postJSON('/login', data);
                if (res.redirected) return;

                if (res.ok) {
                    window.location.href = '/profile';
                } else {
                    setMessage(loginMsg, res.data.error || 'Не удалось войти');
                }
            } catch (e) {
                setMessage(loginMsg, 'Сетевая ошибка. Попробуйте позже.');
            } finally {
                setLoading(loginBtn, false);
            }
        });

        const emailInput = loginForm.querySelector('input[name="email"]');
        if (emailInput) emailInput.focus();
    }

    // ============================================================
    // ФОРМА РЕГИСТРАЦИИ (если она есть на странице)
    // ============================================================
    const registerForm = document.getElementById('registerForm');
    const registerMsg  = document.getElementById('registerMessage');
    const registerBtn  = document.getElementById('registerBtn');

    if (registerForm && registerBtn) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessage(registerMsg);

            const fd = new FormData(registerForm);
            const data = {
                name:           (fd.get('name') || '').toString().trim(),
                email:          (fd.get('email') || '').toString().trim(),
                password:       (fd.get('password') || '').toString(),
                privacyConsent: fd.get('privacyConsent') === 'on',
                honeypot:       (fd.get('honeypot') || '').toString(),
            };

            const err = validateRegister(data);
            if (err) { setMessage(registerMsg, err); return; }

            setLoading(registerBtn, true);
            try {
                const res = await postJSON('/register', data);
                if (res.redirected) return;

                if (res.ok) {
                    setMessage(registerMsg, 'Аккаунт создан! Перенаправление…', 'success');
                    setTimeout(() => { window.location.href = '/profile'; }, 600);
                } else {
                    setMessage(registerMsg, res.data.error || 'Не удалось зарегистрироваться');
                }
            } catch (e) {
                setMessage(registerMsg, 'Сетевая ошибка. Попробуйте позже.');
            } finally {
                setLoading(registerBtn, false);
            }
        });

        const nameInput = registerForm.querySelector('input[name="name"]');
        if (nameInput) nameInput.focus();
    }
})();