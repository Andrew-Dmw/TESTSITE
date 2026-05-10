// S-4.js – обработка форм регистрации и входа (без лишних полей)

// Получаем CSRF-токен из мета-тега
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
if (!csrfToken) {
    console.warn('CSRF token not found. Forms may not work correctly.');
}

// Регистрация
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(registerForm);
        const data = {
            email: formData.get('email'),
            name: formData.get('name'),
            password: formData.get('password'),
            privacyConsent: formData.get('privacyConsent') === 'on'
        };
        try {
            const res = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify(data)
            });
            if (res.redirected) {
                window.location.href = res.url;
            } else {
                const result = await res.json();
                if (result.message) {
                    window.location.href = '/main';
                } else {
                    alert(result.error || 'Ошибка регистрации');
                }
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка соединения');
        }
    });
}

// Вход (форма теперь без лишних полей)
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(loginForm);
        const data = {
            email: formData.get('email'),
            password: formData.get('password')
        };
        try {
            const res = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify(data)
            });
            if (res.redirected) {
                window.location.href = res.url;
            } else {
                const result = await res.json();
                if (result.message) {
                    window.location.href = '/main';
                } else {
                    alert(result.error || 'Ошибка входа');
                }
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка соединения');
        }
    });
}

const btns = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            contents.forEach(c => c.style.display = 'none');
            document.getElementById(tab + '-tab').style.display = 'block';
        });
    }
);