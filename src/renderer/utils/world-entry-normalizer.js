export function normalizeNewWorldEntry(entry, { source = 'manual' } = {}) {
  const value = entry || {};
  value.keys = Array.isArray(value.keys) ? [...new Set(value.keys.map(key => String(key).trim()).filter(Boolean))] : [];
  value.secondary_keys = Array.isArray(value.secondary_keys) ? [...new Set(value.secondary_keys.map(key => String(key).trim()).filter(Boolean))] : [];
  value.enabled = value.enabled !== false;
  value.constant = Boolean(value.constant);
  value.selective = !value.constant && value.secondary_keys.length > 0;
  value.position = ['before_char', 'after_char', 'at_depth'].includes(value.position) ? value.position : 'after_char';
  value.insertion_order = Number.isFinite(Number(value.insertion_order)) ? Number(value.insertion_order) : 100;
  value.extensions ||= {};
  const ext = value.extensions;
  ext.probability = Math.min(100, Math.max(0, Number(ext.probability ?? 100)));
  ext.useProbability = ext.probability < 100;
  ext.depth = Math.min(20, Math.max(0, Number(ext.depth ?? 4)));
  ext.exclude_recursion = ext.exclude_recursion !== false;
  ext.prevent_recursion = value.constant ? false : ext.prevent_recursion !== false;
  ext.cooldown = Math.max(0, Number(ext.cooldown ?? 0));
  ext.delay = Math.max(0, Number(ext.delay ?? 0));
  ext.cfGeneratedSource = source;
  return value;
}
