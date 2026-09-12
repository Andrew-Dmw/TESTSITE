(function () {
    'use strict';

    const wrapper     = document.getElementById('formsWrapper');
    const loginForm   = document.getElementById('loginForm');
    const registerForm= document.getElementById('registerForm');

    const loginMsg    = document.getElementById('loginMessage');
    const registerMsg = document.getElementById('registerMessage');

    const loginBtn    = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');

    // ------------------------------------------------------------
    // Переключение между формами (слайд влево/вправо)
    // ------------------------------------------------------------
    document.querySelectorAll('.toggle-link').forEach((link) => {
        const handler = () => {
            const target = link.dataset.target;
            if (target === 'register') {
                wrapper.classList.add('shift');
                // Фокус на первое поле регистрации для удобства
                setTimeout(() => registerForm.querySelector('input[name="name"]').focus(), 350);
            } else {
                wrapper.classList.remove('shift');
                setTimeout(() => loginForm.querySelector('input[name="email"]').focus(), 350);
            }
        };
        link.addEventListener('click', handler);
        link.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
        });
    });

    // ------------------------------------------------------------
    // Утилиты UI
    // ------------------------------------------------------------
    function setMessage(el, text, type = 'error') {
        el.textContent = text;
        el.className = 'message ' + type;
    }

    function clearMessage(el) { el.textContent = ''; el.className = 'message'; }

    function setLoading(btn, isLoading) {
        btn.disabled = isLoading;
        btn.querySelector('.btn-text').hidden    = isLoading;
        btn.querySelector('.btn-spinner').hidden = !isLoading;
    }

    // ------------------------------------------------------------
    // Отправка JSON на сервер
    // (сервер пропускает CSRF для Content-Type: application/json)
    // ------------------------------------------------------------
    async function postJSON(url, payload) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
            // по умолчанию redirect: 'follow' — сервер редиректит на /main,
            // и мы получим HTML главной страницы. Это то, что нужно.
        });

        // Если сервер редиректнул (успех) — уходим на /main
        if (response.redirected) {
            window.location.href = response.url;
            return { redirected: true };
        }

        // Пробуем распарсить JSON с ошибкой
        let data = {};
        try { data = await response.json(); } catch { /* ignore */ }
        return { ok: response.ok, status: response.status, data };
    }

    // ------------------------------------------------------------
    // Валидация (клиентская, для UX — сервер всё равно проверит)
    // ------------------------------------------------------------
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

    // ------------------------------------------------------------
    // Вход
    // ------------------------------------------------------------
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessage(loginMsg);

        const fd = new FormData(loginForm);
        const data = {
            email:     (fd.get('email') || '').toString().trim(),
            password:  (fd.get('password') || '').toString(),
            honeypot:  (fd.get('honeypot') || '').toString(),
        };

        const err = validateLogin(data);
        if (err) { setMessage(loginMsg, err); return; }

        setLoading(loginBtn, true);
        try {
            const res = await postJSON('/login', data);
            if (res.redirected) return;

            if (res.ok) {
                window.location.href = '/main';
            } else {
                setMessage(loginMsg, res.data.error || 'Не удалось войти');
            }
        } catch (e) {
            setMessage(loginMsg, 'Сетевая ошибка. Попробуйте позже.');
        } finally {
            setLoading(loginBtn, false);
        }
    });

    // ------------------------------------------------------------
    // Регистрация
    // ------------------------------------------------------------
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
                setTimeout(() => { window.location.href = '/main'; }, 600);
            } else {
                setMessage(registerMsg, res.data.error || 'Не удалось зарегистрироваться');
            }
        } catch (e) {
            setMessage(registerMsg, 'Сетевая ошибка. Попробуйте позже.');
        } finally {
            setLoading(registerBtn, false);
        }
    });

    // Автофокус на email при загрузке
    window.addEventListener('DOMContentLoaded', () => {
        loginForm.querySelector('input[name="email"]').focus();
    });
})();