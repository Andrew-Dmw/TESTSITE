// регистрация
fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrfToken },
    body: JSON.stringify({ email, name, password, privacyConsent: true })
})
.then(res => res.json())
.then(data => { if (data.message) window.location.href = '/main'; })
.catch(err => console.error);

// вход
fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrfToken },
    body: JSON.stringify({ email, password })
})
.then(res => res.json())
.then(data => { if (data.message) window.location.href = '/main'; })
.catch(err => console.error);