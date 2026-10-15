const button = document.getElementById("fill");
const status = document.getElementById("status");

button.addEventListener("click", async () => {
  button.disabled = true;
  status.textContent = "Filling…";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || "")) {
      throw new Error("Open a regular webpage first.");
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      files: ["content.js"]
    });
    const result = results?.[0]?.result;
    status.textContent = result?.message || "Done.";
  } catch (error) {
    status.textContent = error?.message || "Could not fill this page.";
  } finally {
    button.disabled = false;
  }
});
