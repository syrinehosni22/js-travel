/**
 * Diagnostic des clics sur téléphone : ouvrir le site avec #debug-clics à la fin de l'adresse.
 * À chaque appui, un bandeau en haut indique l'élément réellement touché (et ce qui le recouvre),
 * et toute erreur JavaScript. Désactivation : #debug-clics-off.
 */
const KEY = 'debug-clics';
const describe = (n) => {
  if (!n || n.nodeType !== 1) return '(rien)';
  const cls = typeof n.className === 'string' && n.className.trim() ? `.${n.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
  const txt = (n.getAttribute('aria-label') || n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  const cs = getComputedStyle(n);
  return `${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ''}${cls}${txt ? ` « ${txt} »` : ''} [${cs.position}, z=${cs.zIndex}]`;
};

export function installTapDebug() {
  try {
    if (location.hash === `#${KEY}-off`) localStorage.removeItem(KEY);
    if (location.hash === `#${KEY}`) localStorage.setItem(KEY, '1');
    if (localStorage.getItem(KEY) !== '1') return;
  } catch { return; }
  const box = document.createElement('div');
  box.setAttribute('style', 'position:fixed;left:6px;right:6px;top:6px;z-index:2147483647;background:#111;color:#fff;font:12px/1.4 monospace;padding:8px;border-radius:8px;opacity:.92;pointer-events:none;white-space:pre-wrap;word-break:break-all');
  const log = [];
  const show = (line) => { log.unshift(line); box.textContent = `DIAGNOSTIC CLICS (#debug-clics-off pour arrêter)\n${log.slice(0, 6).join('\n')}`; if (!box.isConnected) document.body.appendChild(box); };
  show(`écran ${innerWidth}×${innerHeight} · ${navigator.userAgent.slice(0, 60)}`);
  document.addEventListener('pointerdown', (e) => {
    const top = document.elementFromPoint(e.clientX, e.clientY);
    const chain = [];
    for (let n = top; n && n !== document.body && chain.length < 3; n = n.parentElement) chain.push(describe(n));
    show(`appui (${Math.round(e.clientX)},${Math.round(e.clientY)}) → ${chain.join(' ⊂ ')}`);
  }, true);
  document.addEventListener('click', (e) => show(`clic reçu par ${describe(e.target)}${e.defaultPrevented ? ' (bloqué)' : ''}`), true);
  window.addEventListener('error', (e) => show(`ERREUR JS : ${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => show(`ERREUR promesse : ${e.reason?.message || e.reason}`));
}
