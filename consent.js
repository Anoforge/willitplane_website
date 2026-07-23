// Cookie consent gate for Google Analytics (GA4).
// GA4 is NOT loaded until the visitor explicitly clicks "Accept".
(() => {
  const CONSENT_KEY = 'wip-analytics-consent'; // 'granted' | 'denied'
  const GA_ID = 'G-3QH367YLCZ';

  function getConsent() {
    try { return localStorage.getItem(CONSENT_KEY); }
    catch (e) { return null; }
  }

  function setConsent(value) {
    try { localStorage.setItem(CONSENT_KEY, value); }
    catch (e) { /* ignore private-mode / storage errors */ }
  }

  function gtag() {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }
  // Make gtag available globally early, before the Google tag script loads.
  window.gtag = gtag;

  function sendConsentDefault(state) {
    // 1. Set the default consent state BEFORE the Google tag loads/configures.
    gtag('consent', 'default', {
      analytics_storage: state,
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }

  function sendConsentUpdate(state) {
    // 4. Update consent when the user makes or changes a choice.
    gtag('consent', 'update', {
      analytics_storage: state,
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }

  function loadGA() {
    if (window.__gaLoaded) return;
    window.__gaLoaded = true;

    // 2. Load the Google tag script.
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);

    // 3. Initialize and configure the tag.
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  function injectStyles() {
    if (document.getElementById('consent-banner-styles')) return;
    const style = document.createElement('style');
    style.id = 'consent-banner-styles';
    style.textContent = `
      #consent-banner {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        background: #1a1712;
        border-top: 1px solid rgba(245,166,35,0.35);
        color: #f3f0ea;
        padding: 1rem 1.25rem;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 0.75rem 1.5rem;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        box-shadow: 0 -8px 24px rgba(0,0,0,0.35);
      }
      #consent-banner p {
        margin: 0;
        color: #b8b2a6;
        font-size: 0.9rem;
        max-width: 560px;
        line-height: 1.4;
      }
      #consent-banner a {
        color: #f5a623;
      }
      #consent-banner .consent-actions {
        display: flex;
        gap: 0.6rem;
        flex-shrink: 0;
      }
      #consent-banner button {
        padding: 0.55rem 1.1rem;
        border-radius: 10px;
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        color: #f3f0ea;
        transition: transform 0.15s ease, background 0.2s ease;
      }
      #consent-banner button:hover,
      #consent-banner button:focus-visible {
        transform: translateY(-2px);
      }
      #consent-banner #consent-accept {
        background: rgba(245,166,35,0.16);
        border-color: rgba(245,166,35,0.4);
        color: #f5a623;
      }
      @media (max-width: 640px) {
        #consent-banner {
          flex-direction: column;
          align-items: stretch;
          text-align: center;
        }
        #consent-banner .consent-actions {
          justify-content: center;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function showBanner() {
    injectStyles();

    const banner = document.createElement('div');
    banner.id = 'consent-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML = `
      <p>We use cookies for basic site analytics (Google Analytics) to see how people find and use the site. No data is sold or used for ads. <a href="/privacy-policy.html">Learn more</a></p>
      <div class="consent-actions">
        <button type="button" id="consent-decline">Decline</button>
        <button type="button" id="consent-accept">Accept</button>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('consent-accept').addEventListener('click', () => {
      setConsent('granted');
      loadGA();
      sendConsentUpdate('granted');
      banner.remove();
    });
    document.getElementById('consent-decline').addEventListener('click', () => {
      setConsent('denied');
      sendConsentUpdate('denied');
      banner.remove();
    });
  }

  function init() {
    const consent = getConsent();

    // Always set default consent first, before the Google tag loads.
    sendConsentDefault('denied');

    if (consent === 'granted') {
      // Already accepted: load tag, configure, then update to granted.
      loadGA();
      sendConsentUpdate('granted');
    } else if (consent === 'denied') {
      // Previously declined: tag stays unloaded; default denied is already set.
    } else {
      // No choice yet: show the banner.
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
