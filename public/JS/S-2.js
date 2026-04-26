console.log("S-2 worked!");

//Игра "кто ты в цифровом мире?"
function who_are_you (){
    const userName = prompt("Как тебя зовут?");
    alert("Привет, " + userName + "! сейчас мы узнаем кто ты в мире интернета...");
    const userAge = Number(prompt("Сколько тебе лет?"));
    if (userAge < 10){
        alert("Ты слишком молод, но кто мы такие, чтобы судить?");
    }else{
        alert("Возраст принят, продолжаем...");
        const role = prompt("Кто ты? Гость или пользователь? Введи в поле: guest или user");
        const userMessage = role === "user" ? alert("Добро пожаловать обратно!"): alert("Привет гость! Посмотри, но ничего не трогай.");
        let social = prompt("В какой соцсети ты чаще всего зависаешь?");
        
        switch (social ){
            case "youtube":
                alert("Контент - это жизнь. Понимаем!");
                description = "Вечный зритель. Даже рекламу не пропускаешь.";
                break;
            case "tiktok":
                alert("Интересная соцсеть, но алгоритмы зло.");
                description = "Е, больше скрола!"
                break;
            case "instagram":
                alert("So good.");
                description ="Главное - не жизнь, а красивый завтрак. Одобряем.";
                break;
            case "vk":
            alert("Старое доброе ВК. Классика.");
            description ="Классика. Одобряем."
            break;
        default:
            alert("Интересный выбор. Мы тебя оценили!");
            description ="Вне матрицы. Мы не знаем как ты сюда попал."
    }
    alert("Анализ завершён. " + userName + + ", ты - " + description);
}
};

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
    let nameZ = "";
    while (!nameZ || nameZ.trim() === ""){
        nameZ = prompt("Как тебя зовут?");
        const adminName = "AdminX10";
        if (nameZ === null){
            alert("Ввод имени отменён.");
            break;
        }else if (nameZ === adminName) {
            alert("Welcome to the club body");
            console.log("Welcome");
            break;
        }else if (nameZ.trim() === ""){
            alert("Имя - это не пробел. Пожалуйста введите имя.");
            console.error("errName: Invalid_name");
        }else{
            alert("Привет, " + nameZ + "!");
            const greeting = document.getElementById("grt");
            greeting.textContent = nameZ + ", добро "
            break;
        };
    }

    //защита от повторного использования
        document.addEventListener('DOMContentLoaded', function() {
          document.getElementById('myForm').addEventListener('submit', function() {
            document.getElementById('submitButton').disabled = true;
            document.getElementById('submitButton').value = 'Отправка...';
          });
        });