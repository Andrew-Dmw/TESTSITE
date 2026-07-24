const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
if (!csrfToken) {
    console.warn('CSRF token not found');
}
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
                line += "* ";
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

//изменение темы
const buttonl = document.getElementById("backgroundCSS"); 
function background(){
    const box = document.getElementById("color");
    box.classList.toggle("bodyBlack");
}
buttonl.addEventListener("click", background);
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


function initCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    if (!banner) return;
    
    const consent = getCookie('cookie_consent');
    if (consent === null) {
        banner.style.display = 'block';
    } else {
        banner.style.display = 'none';
    }

    document.getElementById('accept-cookies').onclick = () => {
        setCookie('cookie_consent', 'accepted', 365);
        banner.style.display = 'none';
        fetch('/log-cookie-consent', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'CSRF-Token': csrfToken   // используйте переменную из meta
            },
            body: JSON.stringify({ consent: 'accepted' })
        }).catch(e => console.error(e));
    };

    document.getElementById('reject-cookies').onclick = () => {
        setCookie('cookie_consent', 'rejected', 365);
        banner.style.display = 'none';
        fetch('/log-cookie-consent', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'CSRF-Token': csrfToken
            },
            body: JSON.stringify({ consent: 'rejected' })
        }).catch(e => console.error(e));
    };
}

// Запускаем, только если документ уже готов, иначе ждём
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieBanner);
} else {
    initCookieBanner(); // DOM уже загружен – выполняем сразу
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