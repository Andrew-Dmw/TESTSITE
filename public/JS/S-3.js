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
                    alert('Демонстрация: в реальном проекте здесь будет загрузка файла.');
                }
            });
        });
    })();
  // Функция-заглушка для всех форм модели
   document.addEventListener('DOMContentLoaded', function() {
    // Находим все формы на странице с определёнными action (или все формы внутри контейнера модели)
    const forms = document.querySelectorAll('.legal-form');
    forms.forEach(form => {
      form.addEventListener('submit', function(event) {
        event.preventDefault(); // Останавливаем реальную отправку
        const formName = form.getAttribute('data-form-name') || 'формы';
        alert(`🛡️ Демонстрационный режим\n\nФорма "${formName}" не отправлена, так как это заглушка.\nВ полной версии модели здесь был бы запрос к серверу и логирование действий согласно ст. 9, 14, 21 ФЗ-152.`);
      });
    });
  });