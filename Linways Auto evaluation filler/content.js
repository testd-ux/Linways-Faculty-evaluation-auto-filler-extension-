(() => {
  const isUsable = (input) => {
    if (input.disabled || input.closest("fieldset[disabled]")) return false;
    const style = getComputedStyle(input);
    if (style.display === "none" || style.visibility === "hidden") {
      const labels = Array.from(input.labels || []);
      return labels.some((label) => label.getClientRects().length > 0);
    }
    return input.getClientRects().length > 0;
  };

  const formKey = (input) => input.form || document;
  const groupByName = (inputs) => {
    const byForm = new Map();
    for (const input of inputs) {
      const name = input.name.trim();
      if (!name) continue;
      const form = formKey(input);
      if (!byForm.has(form)) byForm.set(form, new Map());
      const byName = byForm.get(form);
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(input);
    }
    return Array.from(byForm.values()).flatMap((m) => Array.from(m.values()));
  };

  const visibleInputs = (selector) => Array.from(document.querySelectorAll(selector)).filter(isUsable);

  const radioGroups = () => {
    const radios = visibleInputs('input[type="radio"]');
    const named = groupByName(radios).filter((g) => g.length > 1);
    const unnamed = radios.filter((r) => !r.name.trim()).map((input) => {
      const container = input.closest("fieldset, [role=group]");
      if (!container) return [input];
      return visibleInputs('input[type="radio"]').filter((r) => container.contains(r));
    }).filter((g) => g.length > 1);
    return uniqueGroups([...named, ...unnamed]);
  };

  const checkboxGroups = () => {
    const boxes = visibleInputs('input[type="checkbox"]');
    const groups = [];

    // Prefer question containers (fieldsets, ARIA groups, or the nearest ancestor
    // that contains exactly five usable checkboxes).
    for (const box of boxes) {
      let node = box.parentElement;
      let found = null;
      while (node && node !== document.body && node !== document.documentElement) {
        const inside = boxes.filter((candidate) => node.contains(candidate));
        if ((node.matches("fieldset, [role=group]") && inside.length >= 2) || inside.length === 5) {
          found = inside;
          break;
        }
        node = node.parentElement;
      }
      if (found) groups.push(found);
    }

    // Some forms use the same name for the five checkboxes in each question.
    groups.push(...groupByName(boxes).filter((g) => g.length > 1));
    return uniqueGroups(groups);
  };

  function uniqueGroups(groups) {
    const seen = new Set();
    return groups.filter((group) => {
      const cleaned = group.filter(isUsable);
      if (cleaned.length < 2) return false;
      const key = cleaned.map((el) => {
        if (!el.dataset.randomFillerId) {
          el.dataset.randomFillerId = `${Math.random().toString(36).slice(2)}`;
        }
        return el.dataset.randomFillerId;
      }).sort().join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      group.splice(0, group.length, ...cleaned);
      return true;
    });
  }

  const byPreference = (groups) => [
    ...groups.filter((g) => g.length === 5),
    ...groups.filter((g) => g.length !== 5)
  ];

  const chooseAndClick = (group) => {
    const available = group.filter(isUsable);
    if (!available.length) return false;
    const choice = available[Math.floor(Math.random() * available.length)];
    choice.click();
    return true;
  };

  const gibberish = () => {
    const starts = ["br", "cl", "dr", "fl", "gr", "kr", "pl", "qu", "str", "tr", "v", "z", "m", "n"];
    const vowels = ["a", "e", "i", "o", "u", "ae", "oo"];
    const ends = ["m", "n", "sh", "k", "v", "th", "r", "z", "l"];
    const word = () => {
      const syllables = 2 + Math.floor(Math.random() * 3);
      let result = "";
      for (let i = 0; i < syllables; i++) {
        result += starts[Math.floor(Math.random() * starts.length)] +
          vowels[Math.floor(Math.random() * vowels.length)] +
          ends[Math.floor(Math.random() * ends.length)];
      }
      return result;
    };
    return Array.from({ length: 4 + Math.floor(Math.random() * 3) }, word).join(" ");
  };

  const textFields = visibleInputs(
    'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"]'
  ).filter((input) => !input.readOnly);
  const escapeHtml = (text) => text.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[char]);
  const editableSurfaces = Array.from(document.querySelectorAll('[contenteditable="true"], [role="textbox"][contenteditable="true"]'))
    .filter((element) => element.getClientRects().length > 0 && !element.closest('[aria-readonly="true"]'));
  const editableFrames = Array.from(document.querySelectorAll("iframe")).filter((frame) => frame.getClientRects().length > 0);
  const tinyEditors = window.tinymce?.editors || [];
  const tinyEditor = Array.from(tinyEditors).filter((editor) => {
    const container = editor.getContainer?.();
    return container?.getClientRects().length > 0 && !editor.mode?.isReadOnly?.();
  }).at(-1);

  let filledGroups = 0;
  const groups = byPreference([...radioGroups(), ...checkboxGroups()]).slice(0, 10);
  for (const group of groups) {
    if (chooseAndClick(group)) filledGroups++;
  }

  let filledText = false;
  const value = gibberish();
  if (tinyEditor) {
    tinyEditor.setContent(`<p>${escapeHtml(value)}</p>`);
    tinyEditor.save?.();
    const source = tinyEditor.getElement?.();
    source?.dispatchEvent(new Event("input", { bubbles: true }));
    source?.dispatchEvent(new Event("change", { bubbles: true }));
    filledText = true;
  } else if (editableSurfaces.length) {
    const editor = editableSurfaces[editableSurfaces.length - 1];
    editor.focus();
    editor.textContent = value;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    filledText = true;
  } else {
    const editableFrame = editableFrames.slice().reverse().find((frame) => {
      try {
        return frame.contentDocument?.body && frame.contentDocument.body.isContentEditable;
      } catch {
        return false;
      }
    });
    if (editableFrame) {
      const body = editableFrame.contentDocument.body;
      body.focus();
      body.innerHTML = `<p>${escapeHtml(value)}</p>`;
      body.dispatchEvent(new Event("input", { bubbles: true }));
      body.dispatchEvent(new Event("change", { bubbles: true }));
      filledText = true;
    }
  }

  if (!filledText && textFields.length) {
    const field = textFields[textFields.length - 1];
    field.focus();
    const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")?.set;
    if (valueSetter) valueSetter.call(field, value);
    else field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    filledText = true;
  }

  const pieces = [];
  pieces.push(`${filledGroups} choice group${filledGroups === 1 ? "" : "s"} filled`);
  pieces.push(filledText ? "last text field filled" : "no text field found");
  return { message: pieces.join("; ") + "." };
})();

