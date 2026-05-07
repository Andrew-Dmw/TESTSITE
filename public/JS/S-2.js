console.log("S-2 worked!");
// Генерация и вывод ASCII-сердечка с именем X10
(function drawHeart() {
    const heart = [];
    const name = " X10 ";
    const size = 6; // размер сердца
    for (let y = size; y >= -size; y--) {
        let line = "";
        for (let x = -size; x <= size; x++) {
            // формула сердца: (x^2 + y^2 - 1)^3 - x^2 * y^3 <= 0
            const x2 = x * 0.8;
            const y2 = y;
            const formula = Math.pow((x2 * x2 + y2 * y2 - 1), 3) - (x2 * x2 * Math.pow(y2, 3));
            if (formula <= 0) {
                line += "* "; // красное сердечко или можно использовать '*'
            } else {
                line += "  ";
            }
        }
        heart.push(line);
    }
    
    // Находим середину сердца и вставляем имя
    const middleIndex = Math.floor(heart.length / 2);
    const originalLine = heart[middleIndex];
    const trimmedLine = originalLine.substring(0, originalLine.length / 2 - name.length / 2) + name + 
                        originalLine.substring(originalLine.length / 2 + name.length / 2);
    heart[middleIndex] = trimmedLine;
    
    // Выводим сердце в консоль
    console.log("%c" + heart.join("\n"), "color: #ff3366; font-size: 14px; font-family: monospace;");
})();

//Игра "кто ты в цифровом мире?"
const button2 = document.getElementById("Numer");
    function who_are_you() {
    let userName = prompt("Как тебя зовут?");
    if (userName === null || userName.trim() === "") {
        alert("Игра отменена или имя не введено.");
        return;
    }
    alert("Привет, " + userName + "! сейчас мы узнаем кто ты в мире интернета...");

    const ageInput = prompt("Сколько тебе лет?");
    if (ageInput === null) {
        alert("Игра отменена.");
        return;
    }
    const userAge = Number(ageInput);
    if (isNaN(userAge)) {
        alert("Возраст не распознан, продолжаем...");
    } else if (userAge < 10) {
        alert("Ты слишком молод, но кто мы такие, чтобы судить?");
    } else {
        alert("Возраст принят, продолжаем...");
    }

    const role = prompt("Кто ты? Гость или пользователь? Введите в поле: guest или user");
    if (role === null) {
        alert("Игра отменена.");
        return;
    }
    if (role === "user") {
        alert("Добро пожаловать обратно!");
    } else if (role === "guest") {
        alert("Здравствуй гость! Посмотри, но ничего не трогай.");
    } else {
        alert("Роль не распознана, считаем гостем.");
    }

    let social = prompt("В какой соцсети ты чаще всего зависаешь? (youtube, tiktok, instagram, vk)");
    if (social === null) {
        alert("Игра отменена.");
        return;
    }
    social = social.toLowerCase();
    let description = "";
    switch (social) {
        case "youtube":
            alert("Контент - это жизнь. Понимаем!");
            description = "Вечный зритель. Даже рекламу не пропускаешь.";
            break;
        case "tiktok":
            alert("Интересная соцсеть, но алгоритмы зло.");
            description = "больше скрола!";
            break;
        case "instagram":
            alert("So good.");
            description = "Главное - не жизнь, а красивый завтрак";
            break;
        case "vk":
            alert("Старое доброе ВК. Классика.");
            description = "Классика";
            break;
        default:
            alert("Интересный выбор. Мы тебя оценили!");
            description = "вне матрицы. Мы не знаем как ты сюда попал.";
    }
    alert("Анализ завершён. " + userName + ", ты - " + description);
}
button2.addEventListener ("click", who_are_you);

//изменение темы
const buttonl = document.getElementById("backgroundCSS"); 
function background(){
    const box = document.getElementById("color");
    box.classList.toggle("bodyBlack");
}
buttonl.addEventListener("click", background);

//про любимые дни недели
const butto =document.getElementById("ClickMe");
function D (){
    let days = prompt("Какой твой любимый день недели?");
    if (days) {
        days = days.toLowerCase();
        switch (days) {
            case "понедельник":
                alert("Понедельник - день тяжёлый.");
                break;
            case "пятница":
                alert("Осталось чуть-чуть.");
                break;
            case "суббота":
                alert("Выходные, выходные!");
                break;
            case "воскресенье":
                alert("Скоро по новой.");
                break;
            default:
                alert("Обычный день.");
            };
    } else {
        alert("Вы не ввели день недели.");
    };
};
butto.addEventListener ("click", D);
//.innerHTML - это способ изменять содержимое элемента вместе с html.
//"mouseover" - когда наведена мышка, "input" - ввод текста.

    function setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = name + "=" + value + "; expires=" + date.toUTCString() + "; path=/; SameSite=Lax";
    }
    function getCookie(name) {
        const value = "; " + document.cookie;
        const parts = value.split("; " + name + "=");
        if (parts.length === 2) return parts.pop().split(";").shift();
        return null;
    }

    const banner = document.getElementById('cookie-banner');
    if (banner) {
        const consent = getCookie('cookie_consent');
        if (consent === null) {
            banner.style.display = 'block';
        } else {
            banner.style.display = 'none';
        }

        document.getElementById('accept-cookies').onclick = () => {
            setCookie('cookie_consent', 'accepted', 365);
            banner.style.display = 'none';
            //отправить событие на сервер (логирование согласия)
            fetch('/log-cookie-consent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'CSRF-Token': '<%= csrfToken %>' },
                body: JSON.stringify({ consent: 'accepted' })
            }).catch(e => console.error);
        };
        document.getElementById('reject-cookies').onclick = () => {
            setCookie('cookie_consent', 'rejected', 365);
            banner.style.display = 'none';
            fetch('/log-cookie-consent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'CSRF-Token': '<%= csrfToken %>' },
                body: JSON.stringify({ consent: 'rejected' })
            }).catch(e => console.error);
        };
    }
//подтверждение имени (не актуально)
/*document.addEventListener('DOMContentLoaded', () => {
    const greetingElement = document.getElementById("grt");
    if (!greetingElement) return;

    let storedName = localStorage.getItem("userName");
    if (storedName && storedName !== "Гость" && storedName !== "null") {
        greetingElement.textContent = storedName + ", добро пожаловать на сайт!";
        return;
    }

    let nameZ = "";
    while (!nameZ || nameZ.trim() === "") {
        nameZ = prompt("Как тебя зовут?");
        if (nameZ === null) {
            nameZ = "Гость";
            break;
        } else if (nameZ.trim() === "") {
            alert("Имя не может состоять из пробелов. Попробуйте ещё раз.");
            continue;
        } else {
            const trimmedName = nameZ.trim();
            localStorage.setItem("userName", trimmedName);
            greetingElement.textContent = trimmedName + ", добро пожаловать на сайт!";
            alert("Привет, " + trimmedName + "!");
            return;
        }
    }
    if (nameZ === "Гость") {
        greetingElement.textContent = "Добро пожаловать, Гость!";
    }
});
*/
//защита от повторного использования
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('myForm');
    const submitBtn = document.getElementById('submitButton');
    if (form && submitBtn) {
        form.addEventListener('submit', function() {
            submitBtn.disabled = true;
            submitBtn.value = 'Отправка...';
        });
    }
});