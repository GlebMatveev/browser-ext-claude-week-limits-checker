const api = globalThis.browser || globalThis.chrome;

api.runtime.onMessage.addListener(async (message) => {
  if (message.type !== "checkNotification") return;

  const { dailyUsagePercent, dayKey } = message;
  const stored = await api.storage.local.get([
    "lastNotified70",
    "lastNotified100",
  ]);

  if (dailyUsagePercent >= 100 && stored.lastNotified100 !== dayKey) {
    api.notifications.create("budget-100", {
      type: "basic",
      title: "Claude: Daily budget exceeded",
      message: "You've used 100% of today's daily budget allocation.",
    });
    await api.storage.local.set({ lastNotified100: dayKey });
  } else if (dailyUsagePercent >= 70 && stored.lastNotified70 !== dayKey) {
    api.notifications.create("budget-70", {
      type: "basic",
      title: "Claude: Daily budget warning",
      message: `You've used ${dailyUsagePercent}% of today's daily budget.`,
    });
    await api.storage.local.set({ lastNotified70: dayKey });
  }
});
