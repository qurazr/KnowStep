рconst tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const state = { content: null, view: 'home', levelIndex: null, topicIndex: null };

const $main = document.getElementById('main');
const $title = document.getElementById('title');
const $backBtn = document.getElementById('backBtn');
const $header = document.getElementById('header');

const progress = {
  load() {
    try { return JSON.parse(localStorage.getItem('knowstep_progress') || '{}'); }
    catch { return {}; }
  },
  save(p) { localStorage.setItem('knowstep_progress', JSON.stringify(p)); },

  // тема пройдена (все упражнения верно)
  markDone(levelId, topicId) {
    const p = this.load();
    p[levelId] = p[levelId] || {};
    p[levelId][topicId] = p[levelId][topicId] || {};
    p[levelId][topicId].finished = true;
    p[levelId][topicId].answers = p[levelId][topicId].answers || {};
    this.save(p);
  },
  isDone(levelId, topicId) {
    const p = this.load();
    return !!(p[levelId] && p[levelId][topicId] && p[levelId][topicId].finished);
  },
  countDone(levelId, topics) {
    return topics.filter(t => this.isDone(levelId, t.id)).length;
  },

  // ответы внутри урока
  getAnswers(levelId, topicId) {
    const p = this.load();
    if (p[levelId] && p[levelId][topicId] && p[levelId][topicId].answers) {
      return p[levelId][topicId].answers;
    }
    return {};
  },
  saveAnswer(levelId, topicId, index, value, correct) {
    const p = this.load();
    p[levelId] = p[levelId] || {};
    p[levelId][topicId] = p[levelId][topicId] || { answers: {} };
    p[levelId][topicId].answers = p[levelId][topicId].answers || {};
    p[levelId][topicId].answers[index] = { value, correct };
    this.save(p);
  },

  // сброс урока (для кнопки «Пройти заново»)
  resetTopic(levelId, topicId) {
    const p = this.load();
    if (p[levelId] && p[levelId][topicId]) {
      delete p[levelId][topicId];
      this.save(p);
    }
  }
};
  save(p) { localStorage.setItem('knowstep_progress', JSON.stringify(p)); },
  markDone(levelId, topicId) {
    const p = this.load();
    p[levelId] = p[levelId] || {};
    p[levelId][topicId] = true;
    this.save(p);
  },
  isDone(levelId, topicId) {
    const p = this.load();
    return !!(p[levelId] && p[levelId][topicId]);
  },
  countDone(levelId, topics) {
    return topics.filter(t => this.isDone(levelId, t.id)).length;
  }
};

function setView(view, levelIndex = null, topicIndex = null) {
  state.view = view;
  state.levelIndex = levelIndex;
  state.topicIndex = topicIndex;
  render();
}

$backBtn.addEventListener('click', () => {
  if (state.view === 'topic') setView('level', state.levelIndex);
  else if (state.view === 'level') setView('home');
});

function render() {
  $header.classList.toggle('hidden', state.view === 'home');
  $backBtn.classList.toggle('hidden', state.view === 'home');
  if (state.view === 'home') renderHome();
  else if (state.view === 'level') renderLevel();
  else if (state.view === 'topic') renderTopic();
}

function renderHome() {
  $title.textContent = 'KnowStep';
  $main.innerHTML = '';
  const intro = document.createElement('p');
  intro.className = 'stats';
  intro.textContent = 'Английский язык · A1 → B1. Выберите уровень:';
  $main.appendChild(intro);

  state.content.levels.forEach((level, i) => {
    const done = progress.countDone(level.id, level.topics);
    const total = level.topics.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h2>${level.title}</h2>
      <p>${done} из ${total} тем пройдено</p>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    `;
    card.addEventListener('click', () => setView('level', i));
    $main.appendChild(card);
  });
}

function renderLevel() {
  const level = state.content.levels[state.levelIndex];
  $title.textContent = level.title;
  $main.innerHTML = '';

  level.topics.forEach((topic, i) => {
    const done = progress.isDone(level.id, topic.id);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h2>${topic.title}${done ? ' ✓' : ''}</h2>
      <p>${topic.exercises.length} заданий</p>
    `;
    card.addEventListener('click', () => setView('topic', state.levelIndex, i));
    $main.appendChild(card);
  });
}

function renderTopic() {
  const level = state.content.levels[state.levelIndex];
  const topic = level.topics[state.topicIndex];
  $title.textContent = topic.title;
  $main.innerHTML = '';

  const saved = progress.getAnswers(level.id, topic.id);

  const theory = document.createElement('div');
  theory.className = 'theory';
  theory.textContent = topic.theory;
  $main.appendChild(theory);

  let answeredCorrect = 0;
  let answeredTotal = 0;

  topic.exercises.forEach((ex, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'exercise';

    const q = document.createElement('p');
    q.textContent = `${idx + 1}. ${ex.question}`;
    wrap.appendChild(q);

    const fb = document.createElement('div');
    fb.className = 'feedback';

    const prev = saved[idx];

    const finalizeAnswer = (value, correct) => {
      progress.saveAnswer(level.id, topic.id, idx, value, correct);
      if (correct) answeredCorrect++;
      answeredTotal++;
    };

    if (ex.type === 'choice') {
      const buttons = [];
      ex.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option';
        btn.textContent = opt;
        btn.addEventListener('click', () => {
          buttons.forEach(b => b.disabled = true);
          const correct = opt === ex.answer;
          if (correct) {
            btn.classList.add('correct');
            fb.classList.add('ok');
            fb.textContent = 'Верно';
          } else {
            btn.classList.add('wrong');
            buttons.forEach(b => {
              if (b.textContent === ex.answer) b.classList.add('correct');
            });
            fb.classList.add('err');
            fb.textContent = 'Правильный ответ: ' + ex.answer;
          }
          finalizeAnswer(opt, correct);
        });
        buttons.push(btn);
        wrap.appendChild(btn);
      });
      wrap.appendChild(fb);

      // восстановление
      if (prev) {
        buttons.forEach(b => {
          b.disabled = true;
          if (b.textContent === ex.answer) b.classList.add('correct');
          if (b.textContent === prev.value && !prev.correct) b.classList.add('wrong');
        });
        if (prev.correct) { fb.classList.add('ok'); fb.textContent = 'Верно'; }
        else { fb.classList.add('err'); fb.textContent = 'Правильный ответ: ' + ex.answer; }
        answeredCorrect += prev.correct ? 1 : 0;
        answeredTotal++;
      }

    } else if (ex.type === 'input') {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Введите ответ';
      wrap.appendChild(input);

      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'Проверить';
      wrap.appendChild(btn);
      wrap.appendChild(fb);

      btn.addEventListener('click', () => {
        if (input.disabled) return;
        input.disabled = true;
        btn.disabled = true;
        const val = input.value.trim();
        const correct = val.toLowerCase() === String(ex.answer).toLowerCase();
        if (correct) {
          fb.classList.add('ok');
          fb.textContent = 'Верно';
        } else {
          fb.classList.add('err');
          fb.textContent = 'Правильный ответ: ' + ex.answer;
        }
        finalizeAnswer(val, correct);
      });

      // восстановление
      if (prev) {
        input.value = prev.value;
        input.disabled = true;
        btn.disabled = true;
        if (prev.correct) { fb.classList.add('ok'); fb.textContent = 'Верно'; }
        else { fb.classList.add('err'); fb.textContent = 'Правильный ответ: ' + ex.answer; }
        answeredCorrect += prev.correct ? 1 : 0;
        answeredTotal++;
      }
    }

    $main.appendChild(wrap);
  });

  // если всё уже пройдено — показать сообщение и кнопку сброса
  if (answeredTotal === topic.exercises.length && answeredCorrect === topic.exercises.length) {
    progress.markDone(level.id, topic.id);
    const msg = document.createElement('div');
    msg.className = 'feedback ok';
    msg.textContent = '✓ Тема пройдена!';
    $main.appendChild(msg);
  }

  // кнопка «Пройти заново»
  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn';
  resetBtn.style.background = 'var(--secondary-bg)';
  resetBtn.style.color = 'var(--text)';
  resetBtn.textContent = 'Пройти заново';
  resetBtn.addEventListener('click', () => {
    progress.resetTopic(level.id, topic.id);
    renderTopic();
  });
  $main.appendChild(resetBtn);
}


  topic.exercises.forEach((ex, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'exercise';

    const q = document.createElement('p');
    q.textContent = `${idx + 1}. ${ex.question}`;
    wrap.appendChild(q);

    const fb = document.createElement('div');
    fb.className = 'feedback';

    if (ex.type === 'choice') {
      ex.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option';
        btn.textContent = opt;
        btn.addEventListener('click', () => {
          wrap.querySelectorAll('.option').forEach(b => b.disabled = true);
          if (opt === ex.answer) {
            btn.classList.add('correct');
            answeredCorrect++;
            fb.classList.add('ok');
            fb.textContent = 'Верно';
          } else {
            btn.classList.add('wrong');
            wrap.querySelectorAll('.option').forEach(b => {
              if (b.textContent === ex.answer) b.classList.add('correct');
            });
            fb.classList.add('err');
            fb.textContent = 'Правильный ответ: ' + ex.answer;
          }
          answeredTotal++;
          checkFinish();
        });
        wrap.appendChild(btn);
      });
      wrap.appendChild(fb);
    } else if (ex.type === 'input') {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Введите ответ';
      wrap.appendChild(input);

      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'Проверить';
      wrap.appendChild(btn);
      wrap.appendChild(fb);

      btn.addEventListener('click', () => {
        if (input.disabled) return;
        input.disabled = true;
        btn.disabled = true;
        const val = input.value.trim().toLowerCase();
        const ans = String(ex.answer).toLowerCase();
        if (val === ans) {
          answeredCorrect++;
          fb.classList.add('ok');
          fb.textContent = 'Верно';
        } else {
          fb.classList.add('err');
          fb.textContent = 'Правильный ответ: ' + ex.answer;
        }
        answeredTotal++;
        checkFinish();
      });
    }

    $main.appendChild(wrap);
  });
}

(async function init() {
  try {
    const res = await fetch('data/content.json');
    state.content = await res.json();
    render();
  } catch (e) {
    $main.innerHTML = '<p class="feedback err">Не удалось загрузить контент</p>';
    console.error(e);
  }
})();
