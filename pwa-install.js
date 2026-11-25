(() => {
  const APP_NAME = "AMWEMARI";
  const ACCENT = "#f97316";
  const BG = "#10243a";
  const boot = () => {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('/sw.js').catch(error => console.warn(APP_NAME + ' service worker:', error));
    }
    document.querySelectorAll('.brand, .admin-brand').forEach(node => {
      if (node.querySelector('.pwa-brand-icon')) return;
      const img = document.createElement('img');
      img.className = 'pwa-brand-icon';
      img.src = '/icons/icon.svg';
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      node.prepend(img);
    });
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) return;
    if (document.getElementById('pwa-install-panel')) return;
    const style = document.createElement('style');
    style.textContent = `
      .pwa-brand-icon{width:30px;height:30px;object-fit:contain;vertical-align:middle;flex:0 0 auto;margin-right:8px}
      .pwa-install-panel{position:fixed;right:14px;bottom:14px;z-index:99999;width:min(310px,calc(100vw - 28px));padding:13px 14px;border:1px solid #dbe3ec;border-radius:16px;background:#fff;color:#172033;box-shadow:0 12px 40px #0002;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
      .pwa-install-logo{display:block;width:100%;height:44px;object-fit:contain;object-position:left center;margin:0 0 8px}\n      .pwa-install-head{display:flex;align-items:center;gap:10px;margin-bottom:9px}
      .pwa-install-head img{width:38px;height:38px;border-radius:10px;background:${BG};padding:3px}
      .pwa-install-title{font-weight:800;font-size:14px}
      .pwa-install-sub{font-size:12px;color:#64748b}
      .pwa-install-btn{width:100%;border:0;border-radius:10px;padding:11px 13px;background:${ACCENT};color:${BG};font:750 14px system-ui;cursor:pointer;min-height:44px}
      .pwa-install-help{display:none;margin:10px 2px 0;color:#475569;font-size:12px}
      .pwa-install-help.open{display:block}
      .pwa-install-close{position:absolute;right:9px;top:7px;border:0;background:transparent;color:#64748b;font-size:20px;cursor:pointer;padding:2px 6px}
      @media(max-width:480px){.pwa-install-panel{right:10px;bottom:10px}}
    `;
    document.head.appendChild(style);
    const panel = document.createElement('aside');
    panel.id = 'pwa-install-panel';
    panel.className = 'pwa-install-panel';
    panel.innerHTML = `
      <button type="button" class="pwa-install-close" aria-label="Close install panel">×</button>
      <img class="pwa-install-logo" src="/icons/logo.svg" alt="App logo"><div class="pwa-install-head"><img src="/icons/icon.svg" alt=""><div><div class="pwa-install-title">Install ${APP_NAME}</div><div class="pwa-install-sub">Sakinisha kwenye simu au kompyuta</div></div></div>
      <button type="button" class="pwa-install-btn" id="pwa-install-action">Install App · Sakinisha</button>
      <div class="pwa-install-help" id="pwa-install-help"></div>`;
    document.body.appendChild(panel);
    let installPrompt = null;
    const action = panel.querySelector('#pwa-install-action');
    const help = panel.querySelector('#pwa-install-help');
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      installPrompt = event;
      action.textContent = 'Install App · Sakinisha';
    });
    window.addEventListener('appinstalled', () => {
      panel.innerHTML = '<strong>' + APP_NAME + ' imewekwa kwenye kifaa chako.</strong>';
      setTimeout(() => panel.remove(), 3500);
    });
    action.addEventListener('click', async () => {
      if (installPrompt) {
        installPrompt.prompt();
        const result = await installPrompt.userChoice;
        installPrompt = null;
        if (result && result.outcome === 'accepted') action.textContent = 'Inasakinishwa…';
        return;
      }
      help.classList.toggle('open');
      help.textContent = /iPhone|iPad|iPod/i.test(navigator.userAgent)
        ? 'iPhone/iPad: fungua Share, kisha chagua Add to Home Screen.'
        : 'Chrome: gusa menyu ya nukta tatu (⋮), kisha chagua Install app au Add to Home screen. Kama chaguo halionekani, fungua tovuti kwa Chrome na uhakikishe mtandao upo.';
    });
    panel.querySelector('.pwa-install-close').addEventListener('click', () => panel.remove());
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();