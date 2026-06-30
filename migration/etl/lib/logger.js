// =====================================================================
// Logger minimalista com níveis. Sem dependências externas.
// =====================================================================
import config from './config.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const current = LEVELS[config.etl.logLevel] ?? LEVELS.info;

function ts() {
  return new Date().toISOString();
}

function emit(level, args) {
  if (LEVELS[level] > current) return;
  const tag = level.toUpperCase().padEnd(5);
  // error/warn vão para stderr; info/debug para stdout.
  const sink = level === 'error' || level === 'warn' ? console.error : console.log;
  sink(`[${ts()}] ${tag}`, ...args);
}

export const log = {
  error: (...a) => emit('error', a),
  warn: (...a) => emit('warn', a),
  info: (...a) => emit('info', a),
  debug: (...a) => emit('debug', a),
};

export default log;
