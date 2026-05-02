console.log("S-1 worked!");

//опрос
setTimeout(() => {
  const wantToSuggest = confirm("Видим, что вы заинтересовались сайтом. Не хотите ли добавить предложения по улучшению?");
  if (wantToSuggest) {
    let suggestion = "";
    while (true) {
      suggestion = prompt("Отлично! Напишите ваши предложения по улучшению сайта:");
      if (suggestion === null) {
        alert("Ввод отменён. Спасибо, что захотели помочь!");
        break;
      }
      if (suggestion.trim() === "") {
        alert("Отзыв не может состоять из одних пробелов. Попробуйте ещё раз.");
        continue;
      }
      break;
    }
    if (suggestion && suggestion.trim() !== "") {
      const isCorrect = confirm(`Вы ввели:\n"${suggestion}"\n\nВсё верно?`);
      if (isCorrect) {
        // Получаем CSRF-токен из мета-тега
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
        fetch("/submit-feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken && { "CSRF-Token": csrfToken })
          },
          body: JSON.stringify({ feedback: suggestion, timestamp: new Date().toISOString() })
        })
        .then(response => {
          if (response.ok) {
            alert("Ваши предложения отправлены. Благодарим за вклад в развитие сайта!");
          } else {
            alert("Произошла ошибка при отправке. Попробуйте позже.");
          }
        })
        .catch(error => {
          console.error("Ошибка отправки:", error);
          alert("Не удалось отправить данные. Проверьте соединение.");
        });
      } else {
        alert("Хорошо, можете отредактировать текст позже. Спасибо!");
      }
    }
  } else {
    alert("Хорошо, мы вас услышали. Если появятся идеи – всегда рады!");
  }
}, 200000);
  

//напоминание о перерыве
setInterval(() => {
        const BreakTime = alert("Вы провели за сайтом много времени. Не пора ли сделать перерыв?");
}, 3600000)