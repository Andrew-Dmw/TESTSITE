console.log('S-3 worked!');
    (function() {
        // Переключение вкладок
        const tabBtns = document.querySelectorAll('.tab-btn');
        const contents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                // Убираем active у всех кнопок и контента
                tabBtns.forEach(b => b.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                // Активируем нужные
                btn.classList.add('active');
                document.getElementById(tabId).classList.add('active');
            });
        });

        // Аккордеон для определений
        const accordionItems = document.querySelectorAll('.accordion-item');
        accordionItems.forEach(item => {
            const header = item.querySelector('.accordion-header');
            header.addEventListener('click', () => {
                item.classList.toggle('active');
            });
        });

        // Имитация скачивания (заглушка)
        const downloadButtons = document.querySelectorAll('.doc-item');
        downloadButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!btn.hasAttribute('onclick')) {
                    alert('Скачивание началось.');
                }
            });
        });
    })();