(function () {
  "use strict";

  const api = globalThis.browser || globalThis.chrome;

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DAY_BUDGET = 100 / 7; // ~14.28%
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const CONTAINER_ID = "claude-budget-daily";

  // --- DOM helpers ---

  function findWeeklyAllModelsRow() {
    const headings = document.querySelectorAll("h2");
    let weeklySection = null;
    for (const h of headings) {
      if (h.textContent.trim() === "Weekly limits") {
        weeklySection = h.closest(".space-y-6") || h.parentElement;
        break;
      }
    }
    if (!weeklySection) return null;

    const rows = weeklySection.querySelectorAll('[role="progressbar"]');
    for (const bar of rows) {
      const row = bar.closest(".flex.flex-row");
      if (!row) continue;
      const labels = row.querySelectorAll("p");
      for (const label of labels) {
        if (label.textContent.trim() === "All models") {
          return { row, bar };
        }
      }
    }
    return null;
  }

  function getResetText(row) {
    const paragraphs = row.querySelectorAll("p");
    for (const p of paragraphs) {
      if (/^Resets\s+\w+\s+\d/i.test(p.textContent.trim())) {
        return p.textContent.trim();
      }
    }
    return null;
  }

  // --- Time calculations ---

  function parseResetTime(text) {
    const match = text.match(
      /Resets\s+(\w+)\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i
    );
    if (!match) return null;

    const [, dayStr, hourStr, minStr, ampm] = match;
    let hours = parseInt(hourStr, 10);
    if (ampm.toUpperCase() === "PM" && hours !== 12) hours += 12;
    if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
    const minutes = parseInt(minStr, 10);

    const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const targetDay = dayMap[dayStr.toLowerCase().slice(0, 3)];
    if (targetDay === undefined) return null;

    const now = new Date();
    const reset = new Date(now);
    reset.setHours(hours, minutes, 0, 0);

    let diff = (targetDay - now.getDay() + 7) % 7;
    if (diff === 0 && now >= reset) diff = 7;
    reset.setDate(now.getDate() + diff);

    return reset;
  }

  function calculateWeekBounds(resetTime) {
    const now = new Date();
    const weekStart = new Date(resetTime.getTime() - 7 * MS_PER_DAY);
    const elapsed = now.getTime() - weekStart.getTime();
    const currentDayIndex = Math.min(6, Math.max(0, Math.floor(elapsed / MS_PER_DAY)));
    const dayStartMs = weekStart.getTime() + currentDayIndex * MS_PER_DAY;
    const fractionOfDay = Math.min(1, (now.getTime() - dayStartMs) / MS_PER_DAY);

    const today = now.getDay(); // 0=Sun .. 6=Sat
    const dayLabels = [];
    for (let i = 0; i < 7; i++) {
      const dayIdx = (today - currentDayIndex + i + 7) % 7;
      dayLabels.push(DAY_NAMES[dayIdx]);
    }

    return { weekStart, currentDayIndex, fractionOfDay, dayLabels };
  }

  // --- Budget calculations ---


  function calculateAdaptiveBudget(usagePercent, resetTime, currentDayIndex) {
    const now = new Date();
    const remainingMs = resetTime.getTime() - now.getTime();
    const remainingDays = Math.max(0.01, remainingMs / MS_PER_DAY);
    const remainingBudget = Math.max(0, 100 - usagePercent);

    const futureDays = 6 - currentDayIndex;
    const currentDaySegStart = (currentDayIndex / 7) * 100;
    const progressReachedCurrentDay = usagePercent > currentDaySegStart;
    const divisor = Math.max(1, futureDays + (progressReachedCurrentDay ? 0 : 1));
    const adaptiveDailyBudget = remainingBudget / divisor;

    const segments = [];
    for (let i = 0; i < 7; i++) {
      let fill = 0;
      let colorClass = "cbt-fill-ok";

      const segStart = (i / 7) * 100;
      const segEnd = ((i + 1) / 7) * 100;

      if (usagePercent >= segEnd) {
        fill = 100;
      } else if (usagePercent > segStart) {
        fill = ((usagePercent - segStart) / (100 / 7)) * 100;
      }

      if (i === currentDayIndex) {
        const dayStart = segStart;
        const dayUsed = Math.max(0, usagePercent - dayStart);
        const dayBudget = adaptiveDailyBudget;
        if (dayUsed > dayBudget) colorClass = "cbt-fill-over";
        else if (dayUsed > dayBudget * 0.7) colorClass = "cbt-fill-warn";
      } else if (i > currentDayIndex && fill > 0) {
        colorClass = "cbt-fill-over";
      }

      segments.push({ fill, colorClass });
    }

    return { segments, adaptiveDailyBudget, remainingDays, progressReachedCurrentDay };
  }

  // --- Rendering ---

  function createBarBlock(label, segments, dayLabels, currentDayIndex, statusText, segmentLabels, fractionOfDay) {
    const block = document.createElement("div");
    block.className = "cbt-bar-block cbt-bar-row";

    // Left side: label + status
    const left = document.createElement("div");
    left.className = "cbt-bar-left";

    const labelEl = document.createElement("p");
    labelEl.className = "cbt-label";
    labelEl.textContent = label;
    left.appendChild(labelEl);

    const status = document.createElement("p");
    status.className = "cbt-status";
    status.textContent = statusText;
    left.appendChild(status);

    block.appendChild(left);

    // Right side: matches original layout — flex-1 flex items-center gap-3 md:max-w-xl
    const right = document.createElement("div");
    right.className = "flex-1 flex items-center gap-3 md:max-w-xl";

    // Inner wrapper for day labels + bar
    const barWrapper = document.createElement("div");
    barWrapper.className = "cbt-bar-right flex-1 min-w-[200px]";

    // Day labels
    const dayRow = document.createElement("div");
    dayRow.className = "cbt-day-labels";
    dayLabels.forEach((name, i) => {
      const span = document.createElement("span");
      span.className = "cbt-day" + (i === currentDayIndex ? " cbt-today" : "");
      span.textContent = name;
      if (i === currentDayIndex && fractionOfDay != null) {
        const clock = document.createElement("span");
        clock.className = "cbt-day-clock";
        clock.style.background = `conic-gradient(currentColor ${fractionOfDay}turn, transparent ${fractionOfDay}turn)`;
        span.appendChild(clock);
      }
      dayRow.appendChild(span);
    });
    barWrapper.appendChild(dayRow);

    // Segmented bar — uses same Tailwind classes as original claude.ai progressbar
    const bar = document.createElement("div");
    bar.className = "w-full bg-bg-000 rounded border border-border-300 shadow-sm h-4 flex";
    bar.style.alignItems = "stretch";

    segments.forEach((seg, i) => {
      const segment = document.createElement("div");
      segment.className = "cbt-segment";
      if (i < segments.length - 1) {
        segment.style.borderRight = "1px solid rgba(128, 128, 128, 0.35)";
      }

      const fill = document.createElement("div");
      fill.className = "cbt-segment-fill";
      fill.style.width = Math.min(100, Math.max(0, seg.fill)) + "%";
      const colors = { "cbt-fill-ok": "#7c6bde", "cbt-fill-warn": "#f59e0b", "cbt-fill-over": "#ef4444" };
      fill.style.backgroundColor = colors[seg.colorClass] || colors["cbt-fill-ok"];
      segment.appendChild(fill);

      if (segmentLabels && segmentLabels[i]) {
        const lbl = document.createElement("span");
        lbl.className = "cbt-segment-label";
        lbl.textContent = segmentLabels[i];
        segment.appendChild(lbl);
      }

      bar.appendChild(segment);
    });
    barWrapper.appendChild(bar);
    right.appendChild(barWrapper);

    // Spacer to match original "X% used" text width
    const spacer = document.createElement("p");
    spacer.className = "font-base text-text-400 whitespace-nowrap text-right min-w-[5.5rem]";
    spacer.style.visibility = "hidden";
    spacer.textContent = "\u00A0";
    right.appendChild(spacer);

    block.appendChild(right);

    return block;
  }

  function render(row, usagePercent, resetTime) {
    const { currentDayIndex, fractionOfDay, dayLabels } =
      calculateWeekBounds(resetTime);

    const adaptiveData = calculateAdaptiveBudget(usagePercent, resetTime, currentDayIndex);

    // Remove old container if exists
    const old = document.getElementById(CONTAINER_ID);
    if (old) old.remove();

    const container = document.createElement("div");
    container.id = CONTAINER_ID;
    container.className = "claude-budget-tracker";

    const divisor = adaptiveData.progressReachedCurrentDay
      ? 6 - currentDayIndex
      : 7 - currentDayIndex;
    const adaptiveStatus =
      `Adaptive budget: ~${adaptiveData.adaptiveDailyBudget.toFixed(1)}% × ${divisor} remaining day${divisor !== 1 ? "s" : ""}`;

    // Build segment labels — only for segments without fill
    const adaptiveLabels = dayLabels.map((_, i) => {
      if (i < currentDayIndex) return null;
      if (i === currentDayIndex && adaptiveData.progressReachedCurrentDay) return null;
      return adaptiveData.adaptiveDailyBudget.toFixed(1) + "%";
    });

    container.appendChild(
      createBarBlock(
        "Adaptive daily budget",
        adaptiveData.segments,
        dayLabels,
        currentDayIndex,
        adaptiveStatus,
        adaptiveLabels,
        fractionOfDay
      )
    );

    row.insertAdjacentElement("afterend", container);

    // Check notifications
    checkNotifications(usagePercent, currentDayIndex, fractionOfDay, adaptiveData.adaptiveDailyBudget);
  }

  // --- In-page banner notifications ---

  const shownBanners = new Set();

  function showBanner(id, title, message, type) {
    if (shownBanners.has(id)) return;
    shownBanners.add(id);

    const banner = document.createElement("div");
    banner.className = "cbt-banner " + (type === "over" ? "cbt-banner-over" : "cbt-banner-warn");
    banner.id = "cbt-banner-" + id;

    const text = document.createElement("div");
    text.className = "cbt-banner-text";

    const titleEl = document.createElement("div");
    titleEl.className = "cbt-banner-title";
    titleEl.textContent = title;
    text.appendChild(titleEl);

    const msgEl = document.createElement("div");
    msgEl.textContent = message;
    text.appendChild(msgEl);

    const close = document.createElement("button");
    close.className = "cbt-banner-close";
    close.textContent = "\u2715";
    close.addEventListener("click", () => banner.remove());

    banner.appendChild(text);
    banner.appendChild(close);
    document.body.appendChild(banner);
  }

  // --- Notifications ---

  function checkNotifications(usagePercent, currentDayIndex, fractionOfDay, adaptiveDailyBudget) {
    const dayStart = currentDayIndex * DAY_BUDGET;
    const dayUsed = Math.max(0, usagePercent - dayStart);

    const dailyBudget = Math.min(DAY_BUDGET, adaptiveDailyBudget);
    const dailyUsagePercent = dailyBudget > 0 ? (dayUsed / dailyBudget) * 100 : 0;
    const rounded = Math.round(dailyUsagePercent);

    const today = new Date().toISOString().slice(0, 10);

    // In-page banners (persistent until manually closed)
    if (rounded >= 100) {
      showBanner("over-" + today,
        "Daily budget exceeded",
        "You've used 100% of today's daily budget allocation.",
        "over");
    } else if (rounded >= 70) {
      showBanner("warn-" + today,
        "Daily budget warning",
        `You've used ${rounded}% of today's daily budget.`,
        "warn");
    }

    // System notifications
    api.runtime.sendMessage({
      type: "checkNotification",
      dailyUsagePercent: rounded,
      dayKey: today,
    });
  }

  // --- Main logic ---

  function update() {
    if (!window.location.pathname.includes("/settings/usage")) return;

    const found = findWeeklyAllModelsRow();
    if (!found) return;

    const { row, bar } = found;
    const usagePercent = parseInt(bar.getAttribute("aria-valuenow"), 10) || 0;
    const resetText = getResetText(row);
    if (!resetText) return;

    const resetTime = parseResetTime(resetText);
    if (!resetTime) return;

    render(row, usagePercent, resetTime);
  }

  // --- Observer setup ---

  function setupObserver() {
    let debounceTimer = null;
    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(update, 300);
    };

    const observer = new MutationObserver((mutations) => {
      // Check if our container was removed (React re-render)
      if (!document.getElementById(CONTAINER_ID)) {
        debouncedUpdate();
        return;
      }

      // Check if progressbar value changed
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "aria-valuenow") {
          debouncedUpdate();
          return;
        }
        if (m.type === "childList") {
          debouncedUpdate();
          return;
        }
      }
    });

    const target = document.getElementById("main-content") || document.body;
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-valuenow"],
    });
  }

  // --- Init ---

  function init() {
    update();
    setupObserver();
  }

  // --- Test helper (call from browser console) ---
  // Usage: __cbtTest(75)  — triggers 70% notification
  //        __cbtTest(100) — triggers exceeded notification
  function setupTestHelper() {
    const script = document.createElement("script");
    script.textContent = `
      window.__cbtTest = function(pct) {
        document.dispatchEvent(new CustomEvent("__cbt_test", { detail: pct }));
        console.log("[CBT] Test notification requested: " + pct + "%");
      };
    `;
    document.documentElement.appendChild(script);
    script.remove();

    document.addEventListener("__cbt_test", async (e) => {
      const dailyUsagePercent = e.detail;
      const today = new Date().toISOString().slice(0, 10);

      // Reset banner state so they can appear again
      shownBanners.delete("warn-" + today);
      shownBanners.delete("over-" + today);
      document.querySelectorAll("[id^='cbt-banner-']").forEach(el => el.remove());

      // Show in-page banner
      if (dailyUsagePercent >= 100) {
        showBanner("over-" + today, "Daily budget exceeded",
          "You've used 100% of today's daily budget allocation.", "over");
      } else if (dailyUsagePercent >= 70) {
        showBanner("warn-" + today, "Daily budget warning",
          `You've used ${dailyUsagePercent}% of today's daily budget.`, "warn");
      }

      // System notification
      await api.storage.local.remove(["lastNotified70", "lastNotified100"]);
      api.runtime.sendMessage({
        type: "checkNotification",
        dailyUsagePercent: dailyUsagePercent,
        dayKey: today,
      });
    });
  }
  setupTestHelper();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
