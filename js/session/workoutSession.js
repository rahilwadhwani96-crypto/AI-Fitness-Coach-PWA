import { callApi, ApiError } from '../api/client.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { attachCoachFab } from '../shell/coachFab.js';

const DIFFICULTY_OPTIONS = ['Too Easy', 'Good', 'Hard', 'Very Hard'];

/**
 * Takes over `appRoot` entirely (escaping the tab shell) and walks the
 * user through one exercise at a time: exercise -> difficulty rating for
 * that exercise -> rest -> next exercise, then a final save screen.
 * Difficulty is asked per exercise (matching ExerciseResults' per-row
 * Difficulty column) rather than once for the whole workout. Calls
 * onEnd() once saved, so the caller can rebuild the normal app view.
 */
export function startWorkoutSession(appRoot, { workout, profile, onEnd }) {
  const exercises = workout.exercises;
  const total = exercises.length;
  const restSeconds = Number(profile.PreferredRestSeconds) || 60;
  const startedAt = Date.now();
  const difficulties = []; // one entry per exercise, same order as `exercises`
  let currentIndex = 0;

  async function begin() {
    try {
      await callApi('startWorkoutSession');
    } catch (err) {
      // Non-fatal — the user can still work through the exercises even
      // if this particular write fails; completion will attempt to save.
    }
    renderExercise();
  }

  function renderExercise() {
    const exercise = exercises[currentIndex];
    appRoot.innerHTML = `
      <div class="centered-view">
        <p class="step-indicator">Exercise ${currentIndex + 1} of ${total}</p>
        <section class="card">
          <h1 class="screen-title">${escapeHtml(exercise.name)}</h1>
          <dl class="details">
            <dt>Sets</dt><dd>${escapeHtml(exercise.sets)}</dd>
            <dt>Reps</dt><dd>${escapeHtml(exercise.reps)}</dd>
            <dt>Target muscle</dt><dd>${escapeHtml(exercise.targetMuscle)}</dd>
          </dl>
          ${renderVideo(exercise.videoId)}
          <h2>Technique</h2>
          <p class="hint">${escapeHtml(exercise.technique)}</p>
          ${exercise.notes ? `<h2>Notes</h2><p class="hint">${escapeHtml(exercise.notes)}</p>` : ''}
          <button type="button" id="complete-exercise">Mark complete</button>
        </section>
      </div>
    `;

    attachCoachFab(appRoot, {
      compact: true,
      screen: `workout session — viewing exercise: ${exercise.name}`,
      sessionContext: { currentExercise: exercise },
      onAction: (action, replacementExercise) => {
        if (action === 'skip_exercise') {
          difficulties.push('Skipped');
          currentIndex += 1;
          if (currentIndex >= total) {
            renderEnd();
          } else {
            renderRest();
          }
        } else if (action === 'swap_exercise' && replacementExercise) {
          exercises[currentIndex] = Object.assign({ videoId: null }, replacementExercise);
          renderExercise();
        }
      },
    });

    appRoot.querySelector('#complete-exercise').addEventListener('click', () => {
      renderExerciseDifficulty(exercise.name);
    });
  }

  function renderVideo(videoId) {
    if (!videoId) {
      return `<p class="hint video-unavailable">Demonstration video not available for this exercise.</p>`;
    }
    return `
      <div class="video-wrapper">
        <iframe
          src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}"
          title="Exercise demonstration"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    `;
  }

  function renderExerciseDifficulty(justCompletedName) {
    appRoot.innerHTML = `
      <div class="centered-view">
        <section class="card">
          <h2>How did "${escapeHtml(justCompletedName)}" feel?</h2>
          <div class="goal-grid" id="exercise-difficulty-grid">
            ${DIFFICULTY_OPTIONS.map(
              (label) => `
              <button type="button" class="goal-chip" data-difficulty="${label}">
                <span>${label}</span>
              </button>
            `
            ).join('')}
          </div>
        </section>
      </div>
    `;

    attachCoachFab(appRoot, { compact: true, screen: `workout session — rating exercise: ${justCompletedName}` });

    appRoot.querySelectorAll('.goal-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        difficulties.push(chip.dataset.difficulty);
        currentIndex += 1;
        if (currentIndex >= total) {
          renderEnd();
        } else {
          renderRest();
        }
      });
    });
  }

  function renderRest() {
    const nextExercise = exercises[currentIndex];
    let remaining = restSeconds;

    appRoot.innerHTML = `
      <div class="centered-view">
        <section class="card rest-card">
          <h2>Rest</h2>
          <p class="rest-timer" id="rest-timer">${formatSeconds(remaining)}</p>
          <p class="hint">Up next</p>
          <p class="screen-title" style="margin:0 0 20px;">${escapeHtml(nextExercise.name)}</p>
          <button type="button" id="skip-rest">Skip rest</button>
        </section>
      </div>
    `;

    attachCoachFab(appRoot, { compact: true, screen: `workout session — resting, next up: ${nextExercise.name}` });

    const timerEl = appRoot.querySelector('#rest-timer');
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        renderExercise();
        return;
      }
      timerEl.textContent = formatSeconds(remaining);
    }, 1000);

    appRoot.querySelector('#skip-rest').addEventListener('click', () => {
      clearInterval(interval);
      renderExercise();
    });
  }

  function renderEnd() {
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));

    appRoot.innerHTML = `
      <div class="centered-view">
        <section class="card">
          <h1 class="screen-title">Workout complete</h1>
          <dl class="details">
            <dt>Duration</dt><dd>~${elapsedMinutes} min</dd>
            <dt>Exercises completed</dt><dd>${total}</dd>
          </dl>
          <p class="form-error" id="end-error" hidden></p>
          <button type="button" id="save-workout">Save workout</button>
        </section>
      </div>
    `;

    attachCoachFab(appRoot, { compact: true, screen: 'workout session — finished, reviewing summary' });

    const saveButton = appRoot.querySelector('#save-workout');
    saveButton.addEventListener('click', async () => {
      const errorEl = appRoot.querySelector('#end-error');
      errorEl.hidden = true;
      saveButton.disabled = true;
      saveButton.textContent = 'Saving…';

      try {
        await callApi('completeWorkout', { difficulties });
        onEnd();
      } catch (err) {
        errorEl.textContent = err instanceof ApiError ? err.message : 'Could not save your workout. Try again.';
        errorEl.hidden = false;
        saveButton.disabled = false;
        saveButton.textContent = 'Save workout';
      }
    });
  }

  begin();
}

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
