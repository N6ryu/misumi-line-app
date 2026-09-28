document.addEventListener('DOMContentLoaded', () => {
  // スプラッシュ画面の制御
  const splash = document.getElementById('splashScreen');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('hide');
    }, 800);
  }

  // --- 画面切り替え & スライド処理 ---
  const viewsWrapper = document.getElementById('viewsWrapper');
  const navBtns = document.querySelectorAll('.bottom-nav .nav-btn');
  const views = document.querySelectorAll('.view');
  let currentViewIndex = 0;

  function navigateToView(index) {
    if (index < 0 || index >= views.length) return;
    currentViewIndex = index;

    if (viewsWrapper) {
      viewsWrapper.style.transform = `translateX(-${index * 25}%)`;
    }

    views.forEach((v, i) => {
      v.classList.toggle('active', i === index);
    });

    navBtns.forEach((btn) => {
      const target = parseInt(btn.getAttribute('data-target'), 10);
      btn.classList.toggle('active', target === index);
    });
  }

  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetIndex = parseInt(btn.getAttribute('data-target'), 10);
      navigateToView(targetIndex);
    });
  });

  // --- 横スワイプ検知 ---
  const main = document.querySelector('.app-main');
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  if (main) {
    main.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    main.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].clientX;
      touchEndY = e.changedTouches[0].clientY;
      handleSwipe();
    }, { passive: true });

    function handleSwipe() {
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      const minSwipeDistance = 50;

      if (Math.abs(diffX) > minSwipeDistance && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          navigateToView(currentViewIndex + 1);
        } else {
          navigateToView(currentViewIndex - 1);
        }
      }
    }
  }

  // --- ⚙️ 設定ボトムシートの開閉 ---
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const closeSettingsBtnAction = document.getElementById('closeSettingsBtnAction');
  const settingsBackdrop = document.getElementById('settingsBackdrop');
  const settingsSheet = document.getElementById('settingsSheet');

  function openSettings() {
    if (!settingsBackdrop || !settingsSheet) return;
    settingsBackdrop.hidden = false;
    settingsSheet.hidden = false;
    requestAnimationFrame(() => {
      settingsBackdrop.classList.add('open');
      settingsSheet.classList.add('open');
    });
  }

  function closeSettings() {
    if (!settingsBackdrop || !settingsSheet) return;
    settingsBackdrop.classList.remove('open');
    settingsSheet.classList.remove('open');
    setTimeout(() => {
      settingsBackdrop.hidden = true;
      settingsSheet.hidden = true;
    }, 200);
  }

  if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettings);
  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);
  if (closeSettingsBtnAction) closeSettingsBtnAction.addEventListener('click', closeSettings);
  if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeSettings);
});
