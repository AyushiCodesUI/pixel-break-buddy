const fs = require("node:fs");
const path = require("node:path");
const { normalize, valid } = require("./mascot-art");
function createPreferenceStore(directory, options = {}) {
  const normalizeValue = options.normalize || normalize;
  const validateValue = options.valid || valid;
  const file = path.join(directory, options.filename || "mascot-preferences.json");
  let current;
  try { current = normalizeValue(JSON.parse(fs.readFileSync(file, "utf8"))); }
  catch (error) {
    if (error.code !== "ENOENT") console.warn("[preferences] Using defaults:", error.message);
    current = normalizeValue(null);
  }
  return {
    get: () => ({ ...current }),
    save(value) {
      if (!validateValue(value)) throw new Error("Invalid preferences");
      const next = normalizeValue(value);
      fs.mkdirSync(directory, { recursive: true });
      const temporary = `${file}.tmp`;
      try {
        fs.writeFileSync(temporary, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
        fs.renameSync(temporary, file);
      } catch (error) {
        try { fs.unlinkSync(temporary); } catch {}
        throw error;
      }
      current = next;
      return { ...current };
    },
  };
}
module.exports = { createPreferenceStore };
