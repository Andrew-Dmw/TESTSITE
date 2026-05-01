console.log("S-2 worked!");

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

//подтверждение имени
document.addEventListener('DOMContentLoaded', () => {
    let nameZ = "";
    while (!nameZ || nameZ.trim() === ""){
        nameZ = prompt("Как тебя зовут?");
        const adminName = "AdminX10";
        if (nameZ === null){
            alert("Ввод имени отменён.");
            nameZ = "Гость";
            break;
        }else if (nameZ === adminName) {
            alert("Welcome to the club body");
            console.log("Welcome");
            break;
        }else if (nameZ.trim() === ""){
            alert("Имя - это не пробел. Пожалуйста введите имя.");
            console.error("errName: Invalid_name");
            continue
        }else{
            alert("Привет, " + nameZ + "!");
            const greeting = document.getElementById("grt");
            greeting.textContent = nameZ + ", добро "
            break;
        };
    }
    const greeting = document.getElementById("grt");
    if (greeting) greeting.textContent = nameZ + ", добро ";
});

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