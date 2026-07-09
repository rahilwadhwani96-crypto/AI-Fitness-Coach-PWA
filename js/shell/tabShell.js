import { ICONS } from './icons.js';
import { attachCoachFab } from './coachFab.js';
import { renderHome, refreshHome } from '../screens/home.js';
import { renderWeekly, refreshWeekly } from '../screens/weekly.js';
import { renderProgress, refreshProgress } from '../screens/progress.js';
import { renderFood } from '../screens/food.js';
import { renderProfile } from '../screens/profile.js';

const TABS = [
  { id: 'home', label: 'Home', icon: ICONS.home, render: renderHome, refresh: refreshHome },
  { id: 'weekly', label: 'Weekly', icon: ICONS.weekly, render: renderWeekly, refresh: refreshWeekly },
  { id: 'progress', label: 'Progress', icon: ICONS.progress, render: renderProgress, refresh: refreshProgress },
  { id: 'food', label: 'Food', icon: ICONS.food, render: renderFood },
  { id: 'profile', label: 'Profile', icon: ICONS.profile, render: renderProfile },
];

const SWIPE_THRESHOLD_RATIO = 0.22; // fraction of panel width needed to change tabs
const PULL_THRESHOLD = 70; // px of downward pull needed to trigger a refresh

/**
 * Renders the full app shell (5 swipeable tabs, bottom nav, floating AI
 * Coach button) into `root`. `context` (profile, equipment, …) is passed
 * through to every screen's render function.
 */
export function renderTabShell(root, context) {
  let activeIndex = 0;

  root.innerHTML = `
    <div class="tab-shell">
      <div class="tab-panels" id="tab-panels">
        ${TABS.map(
          (tab) => `
          <section class="tab-panel" data-tab="${tab.id}">
            <div class="pull-indicator" data-pull></div>
            <div class="tab-panel-scroll" data-scroll></div>
          </section>
        `
        ).join('')}
      </div>

      <nav class="tab-bar" id="tab-bar">
        ${TABS.map(
          (tab, i) => `
          <button type="button" class="tab-bar-item${i === 0 ? ' tab-bar-item--active' : ''}" data-index="${i}">
            <span class="tab-bar-icon">${tab.icon}</span>
            <span class="tab-bar-label">${tab.label}</span>
          </button>
        `
        ).join('')}
      </nav>
    </div>
  `;

  const panelsEl = root.querySelector('#tab-panels');
  const tabBarEl = root.querySelector('#tab-bar');
  const panels = [...root.querySelectorAll('.tab-panel')];
  const scrollAreas = [...root.querySelectorAll('[data-scroll]')];

  // Render every screen's content up front. They're all in the DOM at
  // once (side by side) so swiping between them is instant with no
  // re-render — only the transform on #tab-panels moves.
  TABS.forEach((tab, i) => tab.render(scrollAreas[i], context));

  function goToIndex(index, animate = true) {
    activeIndex = Math.max(0, Math.min(TABS.length - 1, index));
    panelsEl.style.transition = animate ? 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    panelsEl.style.transform = `translateX(-${activeIndex * (100 / TABS.length)}%)`;
    tabBarEl.querySelectorAll('.tab-bar-item').forEach((btn, i2) => {
      btn.classList.toggle('tab-bar-item--active', i2 === activeIndex);
    });
  }

  tabBarEl.addEventListener('click', (event) => {
    const button = event.target.closest('.tab-bar-item');
    if (!button) return;
    goToIndex(Number(button.dataset.index));
  });

  attachSwipeHandling(panelsEl, () => activeIndex, goToIndex);
  panels.forEach((panel, i) => attachPullToRefresh(panel, scrollAreas[i], context));

  attachCoachFab(root.querySelector('.tab-shell'), { screen: () => TABS[activeIndex].id });

  goToIndex(0, false);
}

/**
 * Horizontal swipe between tabs. Standard iOS direct-manipulation feel:
 * content tracks the finger 1:1 while dragging, and on release either
 * completes the transition to the next/previous tab or snaps back.
 * Drag left -> next tab, drag right -> previous tab (matches Photos,
 * App Store, Safari tab switching, etc).
 */
function attachSwipeHandling(panelsEl, getActiveIndex, goToIndex) {
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let horizontal = false;
  const tabCount = TABS.length;
  const panelWidth = () => panelsEl.parentElement.clientWidth;

  panelsEl.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      dragging = true;
      horizontal = false;
      panelsEl.style.transition = 'none';
    },
    { passive: true }
  );

  panelsEl.addEventListener(
    'touchmove',
    (e) => {
      if (!dragging) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!horizontal) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        horizontal = Math.abs(dx) > Math.abs(dy);
        if (!horizontal) {
          dragging = false;
          return;
        }
      }

      const activeIndex = getActiveIndex();
      const percentOfOnePanel = (dx / panelWidth()) * (100 / tabCount);
      const basePercent = activeIndex * (100 / tabCount);
      panelsEl.style.transform = `translateX(-${basePercent - percentOfOnePanel}%)`;
    },
    { passive: true }
  );

  panelsEl.addEventListener('touchend', (e) => {
    if (!dragging || !horizontal) {
      dragging = false;
      return;
    }
    dragging = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const ratio = dx / panelWidth();
    const activeIndex = getActiveIndex();

    if (ratio <= -SWIPE_THRESHOLD_RATIO) {
      goToIndex(activeIndex + 1);
    } else if (ratio >= SWIPE_THRESHOLD_RATIO) {
      goToIndex(activeIndex - 1);
    } else {
      goToIndex(activeIndex);
    }
  });
}

/**
 * Pull-to-refresh on a single tab's scroll area. Only engages when that
 * tab is already scrolled to the top (so it never fights normal
 * scrolling), and calls the tab's own onRefresh() if it has one.
 */
function attachPullToRefresh(panel, scrollEl, context) {
  const indicator = panel.querySelector('[data-pull]');
  const tabId = panel.dataset.tab;
  const tab = TABS.find((t) => t.id === tabId);

  let startY = 0;
  let pulling = false;

  scrollEl.addEventListener(
    'touchstart',
    (e) => {
      pulling = scrollEl.scrollTop <= 0;
      startY = e.touches[0].clientY;
    },
    { passive: true }
  );

  scrollEl.addEventListener(
    'touchmove',
    (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) {
        pulling = false;
        indicator.style.height = '0px';
        return;
      }
      const clamped = Math.min(dy * 0.5, PULL_THRESHOLD * 1.4);
      indicator.style.height = `${clamped}px`;
      indicator.classList.toggle('pull-indicator--ready', clamped >= PULL_THRESHOLD);
    },
    { passive: true }
  );

  scrollEl.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;
    const ready = indicator.classList.contains('pull-indicator--ready');
    indicator.classList.remove('pull-indicator--ready');

    if (ready && tab && typeof tab.refresh === 'function') {
      indicator.classList.add('pull-indicator--loading');
      try {
        await tab.refresh(scrollEl, context);
        indicator.classList.remove('pull-indicator--loading');
        indicator.classList.add('pull-indicator--done');
        await new Promise((resolve) => setTimeout(resolve, 700));
      } catch (err) {
        // Swallow — the tab's own refresh already shows its own error state if needed.
      } finally {
        indicator.classList.remove('pull-indicator--loading', 'pull-indicator--done');
        indicator.style.height = '0px';
      }
    } else {
      indicator.style.height = '0px';
    }
  });
}
