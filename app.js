/* «Проверь вакансию и посчитай заработок»
   Инструмент для канала «Подработка с ежедневной оплатой — Новосибирск» */

(function () {
  'use strict';

  /* ====== НАСТРОЙКА: ссылка на Telegram-канал ====== */
  var CHANNEL_URL = 'https://t.me/oplatazaden';
  /* ================================================= */

  var rub = new Intl.NumberFormat('ru-RU');
  function fmtRub(n) { return rub.format(Math.round(n)) + ' ₽'; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ---------- Тост ---------- */
  var toastTimer = null;
  function showToast(msg) {
    var t = $('#toast');
    if (!t) { return; }
    t.textContent = msg;
    t.classList.add('is-visible');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { t.classList.remove('is-visible'); }, 2600);
  }

  /* ---------- Кнопки «Открыть канал» ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-channel]') : null;
    if (!el) { return; }
    e.preventDefault();
    if (!CHANNEL_URL) {
      showToast('Ссылка на канал ещё не подключена');
      return;
    }
    window.open(CHANNEL_URL, '_blank', 'noopener');
  });

  /* ---------- Вкладки ---------- */
  var currentTab = 'check';

  function activateTab(name, updateHash) {
    currentTab = (name === 'calc') ? 'calc' : 'check';
    $$('.tab').forEach(function (btn) {
      var active = btn.getAttribute('data-tab') === currentTab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $('#panel-check').classList.toggle('is-hidden', currentTab !== 'check');
    $('#panel-calc').classList.toggle('is-hidden', currentTab !== 'calc');
    if (updateHash !== false) {
      try { history.replaceState(null, '', '#' + currentTab); } catch (err) { /* file:// безопасно игнорируем */ }
    }
  }

  $$('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () { activateTab(btn.getAttribute('data-tab')); });
  });

  /* ---------- «Поделиться» ---------- */
  function share(text) {
    var url = location.href.split('#')[0] + '#' + currentTab;
    if (navigator.share) {
      navigator.share({ title: 'Проверь вакансию и посчитай заработок', text: text, url: url }).catch(function () { /* отменено — ок */ });
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text + ' ' + url).then(
        function () { showToast('Ссылка скопирована'); },
        function () { showToast(url); }
      );
      return;
    }
    showToast(url);
  }

  /* ================= СВЕТОФОР ВАКАНСИИ ================= */

  var QUESTIONS = [
    { t: 'Просят деньги вперёд: залог, «страховку», оплату обучения или формы?', w: [3, 0, 1] },
    { t: 'Обещают подозрительно много — например, «до 15 000 ₽ в день без опыта»?', w: [2, 0, 0] },
    { t: 'Нет конкретики: ни адреса, ни точной ставки, ни времени смены?', w: [2, 0, 1] },
    { t: 'Общается аноним в мессенджере — компанию не найти по названию?', w: [2, 0, 1] },
    { t: 'Просят фото паспорта, СМС-коды или оформить что-то «на себя» до первого выхода?', w: [3, 0, 1] },
    { t: 'Оплату обещают не в конкретные даты, а «потом»?', w: [2, 0, 1] },
    { t: 'Проверить работодателя нечем — нет отзывов и знакомых, кто там работал?', w: [1, 0, 1] }
  ];

  var LEVELS = {
    green: {
      cls: 'green',
      title: 'Похоже на надёжную подработку',
      text: 'Условия конкретные, серьёзных тревожных звоночков нет. Перед первым выходом уточните детали и сохраните переписку.',
      tips: [
        'Согласуйте адрес, время смены и сумму оплаты до выхода',
        'Договоритесь в переписке, когда именно вам заплатят',
        'Не отдавайте оригиналы документов и не платите ничего вперёд'
      ]
    },
    yellow: {
      cls: 'yellow',
      title: 'Есть тревожные звоночки',
      text: 'Похоже, вам рассказали не всё. Задайте работодателю прямые вопросы до того, как соглашаться.',
      tips: [
        'Спросите точную ставку, адрес и время смены',
        'Уточните, как и когда происходит оплата, — лучше в переписке',
        'Поищите отзывы о компании и спросите знакомых'
      ]
    },
    red: {
      cls: 'red',
      title: 'Высокий риск — скорее всего, развод',
      text: 'Слишком много признаков обмана. Не переводите деньги, не отдавайте документы и коды — сначала проверьте компанию.',
      tips: [
        'Не платите ничего вперёд — честной подработке это не нужно',
        'Не отправляйте фото паспорта и СМС-коды',
        'Проверьте название компании в поиске и обсудите вакансию с близкими'
      ]
    }
  };

  var qIndex = 0;
  var qScores = [];

  function computeLevel(total) {
    if (total >= 8) { return LEVELS.red; }
    if (total >= 4) { return LEVELS.yellow; }
    return LEVELS.green;
  }

  function quizProgress() {
    $('#quiz-progress-label').textContent = 'Вопрос ' + (qIndex + 1) + ' из ' + QUESTIONS.length;
    $('#progress-fill').style.width = Math.round((qIndex / QUESTIONS.length) * 100) + '%';
  }

  function renderQuestion() {
    quizProgress();
    var q = QUESTIONS[qIndex];
    var html = '';
    html += '<div class="q-text">' + q.t + '</div>';
    html += '<div class="q-answers">';
    html += '<button class="btn btn-yes" data-a="0" type="button">Да</button>';
    html += '<button class="btn btn-no" data-a="1" type="button">Нет</button>';
    html += '<button class="btn btn-unknown" data-a="2" type="button">Не знаю</button>';
    html += '</div>';
    if (qIndex > 0) { html += '<button class="btn-back" id="q-back" type="button">← Назад</button>'; }
    $('#quiz-body').innerHTML = html;
  }

  function renderResult() {
    var total = 0;
    for (var i = 0; i < qScores.length; i++) { total += qScores[i] || 0; }
    var level = computeLevel(total);

    $('#quiz-progress-label').textContent = 'Результат';
    $('#progress-fill').style.width = '100%';

    var html = '';
    html += '<div class="result">';
    html += '<div class="traffic ' + level.cls + '" aria-hidden="true"><span></span><span></span><span></span></div>';
    html += '<div class="result-title">' + level.title + '</div>';
    html += '<p class="result-text">' + level.text + '</p>';
    html += '<ul class="result-tips">';
    for (var j = 0; j < level.tips.length; j++) { html += '<li>' + level.tips[j] + '</li>'; }
    html += '</ul>';
    html += '<p class="mini muted">Это чек-лист внимательности, а не юридическая проверка.</p>';
    html += '<div class="cta">';
    html += '<div class="cta-text">Свежие подработки с оплатой в день — в нашем канале.</div>';
    html += '<a class="cta-btn" data-channel href="#">Открыть канал</a>';
    html += '</div>';
    html += '<div class="result-actions">';
    html += '<button class="btn" id="q-restart" type="button">Пройти заново</button>';
    html += '<button class="btn btn-share" id="q-share" type="button">Поделиться</button>';
    html += '</div>';
    html += '</div>';

    $('#quiz-body').innerHTML = html;
  }

  $('#quiz-body').addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-a], #q-back, #q-restart, #q-share') : null;
    if (!el) { return; }

    if (el.hasAttribute('data-a')) {
      qScores[qIndex] = QUESTIONS[qIndex].w[Number(el.getAttribute('data-a'))] || 0;
      if (qIndex < QUESTIONS.length - 1) { qIndex++; renderQuestion(); }
      else { renderResult(); }
      return;
    }
    if (el.id === 'q-back') { if (qIndex > 0) { qIndex--; renderQuestion(); } return; }
    if (el.id === 'q-restart') { qIndex = 0; qScores = []; renderQuestion(); return; }
    if (el.id === 'q-share') { share('«Светофор вакансии» — проверь подработку на развод за минуту'); return; }
  });

  /* ================= КАЛЬКУЛЯТОР ================= */

  var PRESETS = [
    { name: 'Курьер', rate: 350 },
    { name: 'Грузчик', rate: 300 },
    { name: 'Промоутер', rate: 300 },
    { name: 'Упаковщик', rate: 280 },
    { name: 'Официант', rate: 320 },
    { name: 'Разнорабочий', rate: 280 },
    { name: 'Другое', rate: 0 }
  ];

  var calcState = { mode: 'hour', hours: 4, days: 5, rate: 350, shift: 2500, shifts: 5 };

  var hoursInput = $('#in-hours');
  var daysInput = $('#in-days');
  var rateInput = $('#in-rate');
  var shiftInput = $('#in-shift');
  var shiftsInput = $('#in-shifts');
  var chipsBox = $('#rate-chips');
  var modeBox = $('#rate-mode');
  var modeHour = $('#mode-hour');
  var modeShift = $('#mode-shift');

  function clampInt(v, min, max) {
    v = parseInt(v, 10);
    if (isNaN(v)) { return min; }
    if (v < min) { return min; }
    if (v > max) { return max; }
    return v;
  }

  function calcUpdateOutputs() {
    var perDay, perWeek;
    if (calcState.mode === 'shift') {
      perDay = calcState.shift;
      perWeek = calcState.shift * calcState.shifts;
      $('#out-day-label').textContent = 'За смену';
    } else {
      perDay = calcState.hours * calcState.rate;
      perWeek = perDay * calcState.days;
      $('#out-day-label').textContent = 'За день';
    }
    $('#out-day').textContent = fmtRub(perDay);
    $('#out-week').textContent = fmtRub(perWeek);
    $('#out-month').textContent = fmtRub(perWeek * 4);
  }

  function calcRenderChips() {
    var html = '';
    for (var i = 0; i < PRESETS.length; i++) {
      var label = PRESETS[i].name;
      if (PRESETS[i].rate > 0) { label += ' · ~' + PRESETS[i].rate + ' ₽/ч'; }
      html += '<button class="chip' + (i === 0 ? ' is-active' : '') + '" data-i="' + i + '" type="button">' + label + '</button>';
    }
    chipsBox.innerHTML = html;
  }

  chipsBox.addEventListener('click', function (e) {
    var chip = e.target && e.target.closest ? e.target.closest('.chip') : null;
    if (!chip) { return; }
    $$('.chip', chipsBox).forEach(function (c) { c.classList.remove('is-active'); });
    chip.classList.add('is-active');
    var preset = PRESETS[Number(chip.getAttribute('data-i'))];
    if (preset && preset.rate > 0) {
      calcState.rate = preset.rate;
      rateInput.value = preset.rate;
      calcUpdateOutputs();
    } else {
      rateInput.focus();
      if (rateInput.select) { rateInput.select(); }
    }
  });

  modeBox.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('.mode-btn') : null;
    if (!btn) { return; }
    var mode = btn.getAttribute('data-mode');
    if (mode !== 'hour' && mode !== 'shift') { return; }
    calcState.mode = mode;
    $$('.mode-btn', modeBox).forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-mode') === mode);
    });
    modeHour.classList.toggle('is-hidden', mode !== 'hour');
    modeShift.classList.toggle('is-hidden', mode !== 'shift');
    calcUpdateOutputs();
  });

  hoursInput.addEventListener('input', function () {
    calcState.hours = clampInt(hoursInput.value, 1, 16);
    calcUpdateOutputs();
  });
  daysInput.addEventListener('input', function () {
    calcState.days = clampInt(daysInput.value, 1, 7);
    calcUpdateOutputs();
  });
  rateInput.addEventListener('input', function () {
    calcState.rate = clampInt(rateInput.value, 50, 5000);
    calcUpdateOutputs();
  });
  hoursInput.addEventListener('blur', function () { hoursInput.value = calcState.hours; });
  daysInput.addEventListener('blur', function () { daysInput.value = calcState.days; });
  rateInput.addEventListener('blur', function () { rateInput.value = calcState.rate; });
  shiftInput.addEventListener('input', function () {
    calcState.shift = clampInt(shiftInput.value, 100, 50000);
    calcUpdateOutputs();
  });
  shiftsInput.addEventListener('input', function () {
    calcState.shifts = clampInt(shiftsInput.value, 1, 7);
    calcUpdateOutputs();
  });
  shiftInput.addEventListener('blur', function () { shiftInput.value = calcState.shift; });
  shiftsInput.addEventListener('blur', function () { shiftsInput.value = calcState.shifts; });

  function bindStepper(btnId, prop, delta, min, max) {
    $(btnId).addEventListener('click', function () {
      var v = calcState[prop] + delta;
      if (v < min) { v = min; }
      if (v > max) { v = max; }
      calcState[prop] = v;
      if (prop === 'hours') { hoursInput.value = v; }
      if (prop === 'days') { daysInput.value = v; }
      if (prop === 'rate') { rateInput.value = v; }
      if (prop === 'shift') { shiftInput.value = v; }
      if (prop === 'shifts') { shiftsInput.value = v; }
      calcUpdateOutputs();
    });
  }
  bindStepper('#hours-minus', 'hours', -1, 1, 16);
  bindStepper('#hours-plus', 'hours', 1, 1, 16);
  bindStepper('#days-minus', 'days', -1, 1, 7);
  bindStepper('#days-plus', 'days', 1, 1, 7);
  bindStepper('#rate-minus', 'rate', -10, 50, 5000);
  bindStepper('#rate-plus', 'rate', 10, 50, 5000);
  bindStepper('#shift-minus', 'shift', -100, 100, 50000);
  bindStepper('#shift-plus', 'shift', 100, 100, 50000);
  bindStepper('#shifts-minus', 'shifts', -1, 1, 7);
  bindStepper('#shifts-plus', 'shifts', 1, 1, 7);

  $('#calc-share').addEventListener('click', function () {
    share('Посчитай, сколько можно заработать на подработке в Новосибирске');
  });

  /* ---------- Инициализация ---------- */
  calcRenderChips();
  calcUpdateOutputs();

  if (location.hash === '#calc') { activateTab('calc', false); } else { activateTab('check', false); }
  renderQuestion();

})();
