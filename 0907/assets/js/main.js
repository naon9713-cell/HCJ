/* ============================================================
   TABI KOREA (旅コリア) — main.js
   index.html의 모든 인터랙션을 담당하는 커스텀 스크립트입니다.
   모듈 패턴(IIFE)으로 구성되어 있으며 jQuery는 DOM 조작 보조용으로만
   사용하고, 핵심 로직은 순수 JS로 작성했습니다.
   ============================================================ */

(function (root, $) {
  'use strict';

  var STORAGE_KEY = 'tabikorea_plan_v1';

  /* ============================================================
     0. Utilities
     ============================================================ */
  var Store = {
    load: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },
    save: function (items) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (e) { /* storage unavailable: fail silently */ }
    }
  };

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ============================================================
     1. Header: scroll style + mobile drawer + scrollspy
     ============================================================ */
  var HeaderModule = (function () {
    var header = qs('#mainHeader');
    var mobileBtn = qs('#mobileMenuBtn');
    var mobileDrawer = qs('#mobileDrawer');
    var navLinks = qsa('.nav-link');
    var mobileNavLinks = qsa('.mobile-nav-link');
    var sections = navLinks
      .map(function (a) { return document.getElementById((a.getAttribute('href') || '').replace('#', '')); })
      .filter(Boolean);

    function onScroll() {
      if (!header) return;
      if (window.scrollY > 24) header.classList.add('is-scrolled');
      else header.classList.remove('is-scrolled');
    }

    function toggleMobileDrawer(forceClose) {
      if (!mobileDrawer) return;
      var shouldClose = forceClose === true || !mobileDrawer.classList.contains('hidden');
      if (forceClose === false) shouldClose = false;
      if (shouldClose) {
        mobileDrawer.classList.add('hidden');
        if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'false');
      } else {
        mobileDrawer.classList.remove('hidden');
        if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'true');
      }
    }

    function setActiveNav(id) {
      navLinks.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + id);
      });
      mobileNavLinks.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + id);
      });
    }

    function initScrollSpy() {
      if (!('IntersectionObserver' in window) || !sections.length) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActiveNav(entry.target.id);
        });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
      sections.forEach(function (sec) { io.observe(sec); });
    }

    function init() {
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();

      if (mobileBtn) {
        mobileBtn.setAttribute('aria-expanded', 'false');
        mobileBtn.addEventListener('click', function () { toggleMobileDrawer(); });
      }
      mobileNavLinks.forEach(function (a) {
        a.addEventListener('click', function () { toggleMobileDrawer(true); });
      });

      initScrollSpy();
    }

    return { init: init };
  })();

  /* ============================================================
     2. Spot Detail Modal (with focus trap)
     ============================================================ */
  var ModalModule = (function () {
    var overlay = qs('#modalOverlay');
    var backdrop = qs('#modalBackdrop');
    var closeBtn = qs('#closeModalBtn');
    var container = overlay ? qs('.modal-container', overlay) : null;
    var lastFocused = null;

    var fields = {
      img: qs('#modalSpotImg'),
      category: qs('#modalSpotCategory'),
      area: qs('#modalSpotArea'),
      title: qs('#modalSpotTitle'),
      desc: qs('#modalSpotDesc'),
      station: qs('#modalSpotStation'),
      tips: qs('#modalSpotTips')
    };

    function getFocusable() {
      if (!container) return [];
      return qsa('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', container);
    }

    function open(data, triggerEl) {
      if (!overlay) return;
      lastFocused = triggerEl || document.activeElement;

      if (fields.img) { fields.img.src = data.img || ''; fields.img.alt = data.title || ''; }
      if (fields.category) fields.category.textContent = data.category || '';
      if (fields.area) fields.area.textContent = data.area || '';
      if (fields.title) fields.title.textContent = data.title || '';
      if (fields.desc) fields.desc.textContent = data.desc || '';
      if (fields.station) fields.station.textContent = data.station || '';
      if (fields.tips) fields.tips.textContent = data.tips || '';

      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      setTimeout(function () {
        if (closeBtn) closeBtn.focus();
      }, 30);

      document.addEventListener('keydown', onKeydown);
    }

    function close() {
      if (!overlay) return;
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeydown);
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    function onKeydown(e) {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key === 'Tab') {
        var focusable = getFocusable();
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function init() {
      if (!overlay) return;
      overlay.setAttribute('aria-hidden', 'true');

      qsa('.open-spot-modal').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var card = btn.closest('.spot-card');
          if (!card) return;
          open({
            img: card.getAttribute('data-spot-img'),
            category: card.getAttribute('data-spot-category'),
            area: card.getAttribute('data-spot-area'),
            title: card.getAttribute('data-spot-title'),
            desc: card.getAttribute('data-spot-desc'),
            station: card.getAttribute('data-spot-station'),
            tips: card.getAttribute('data-spot-tips')
          }, btn);
        });
      });

      if (closeBtn) closeBtn.addEventListener('click', close);
      if (backdrop) backdrop.addEventListener('click', close);
    }

    return { init: init, close: close };
  })();

  /* ============================================================
     3. Toast notifications
     ============================================================ */
  var ToastModule = (function () {
    var toast = qs('#toastNotice');
    var msgEl = qs('#toastMessage');
    var timer = null;

    function show(message) {
      if (!toast || !msgEl) return;
      msgEl.textContent = message;
      toast.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(function () {
        toast.classList.remove('show');
      }, 2400);
    }

    function init() {
      if (toast) toast.classList.remove('show');
    }

    return { init: init, show: show };
  })();

  /* ============================================================
     4. Bookmark + My Plan Drawer (localStorage)
     ============================================================ */
  var PlanModule = (function () {
    var items = Store.load();

    var floatingBtn = qs('#floatingPlanBtn');
    var navOpenBtn = qs('#navOpenPlanBtn');
    var mobileOpenBtn = qs('#mobileOpenPlanBtn');
    var drawer = qs('#planDrawer');
    var drawerOverlay = qs('#planDrawerOverlay');
    var closeDrawerBtn = qs('#closePlanDrawerBtn');
    var clearBtn = qs('#clearPlanBtn');
    var countBadge = qs('#planCountBadge');
    var emptyState = qs('#planEmptyState');
    var itemsList = qs('#planItemsList');
    var actionFooter = qs('#planActionFooter');

    function findIndex(id) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) return i;
      }
      return -1;
    }

    function isSaved(id) { return findIndex(id) > -1; }

    function syncBookmarkButtons() {
      qsa('.btn-bookmark').forEach(function (btn) {
        var id = btn.getAttribute('data-spot-id');
        btn.classList.toggle('is-saved', isSaved(id));
        btn.setAttribute('aria-pressed', isSaved(id) ? 'true' : 'false');
      });
    }

    function renderList() {
      if (!itemsList) return;
      itemsList.innerHTML = '';

      var hasItems = items.length > 0;
      if (emptyState) emptyState.style.display = hasItems ? 'none' : '';
      if (actionFooter) actionFooter.style.display = hasItems ? '' : 'none';

      items.forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'plan-item';

        var text = document.createElement('div');
        text.innerHTML =
          '<div class="plan-item-title"></div>' +
          '<div class="plan-item-meta"></div>';
        text.querySelector('.plan-item-title').textContent = item.title;
        text.querySelector('.plan-item-meta').textContent = [item.area, item.category].filter(Boolean).join(' · ');

        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.setAttribute('aria-label', item.title + '을(를) 마이 旅リスト에서 삭제');
        removeBtn.innerHTML =
          '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
        removeBtn.addEventListener('click', function () { toggle(item.id, item, false); });

        row.appendChild(text);
        row.appendChild(removeBtn);
        itemsList.appendChild(row);
      });

      if (countBadge) {
        countBadge.textContent = String(items.length);
        countBadge.style.display = items.length > 0 ? '' : 'none';
      }
    }

    function toggle(id, meta, notify) {
      var idx = findIndex(id);
      var added;
      if (idx > -1) {
        items.splice(idx, 1);
        added = false;
      } else {
        items.push({
          id: id,
          title: (meta && meta.title) || id,
          area: meta && meta.area,
          category: meta && meta.category
        });
        added = true;
      }
      Store.save(items);
      syncBookmarkButtons();
      renderList();
      if (notify !== false) {
        ToastModule.show(added ? 'マイ旅リストに追加しました' : 'マイ旅リストから削除しました');
      }
    }

    function openDrawer() {
      if (!drawer) return;
      drawer.classList.add('open');
      if (drawerOverlay) drawerOverlay.classList.add('active');
      drawer.setAttribute('aria-hidden', 'false');
    }

    function closeDrawer() {
      if (!drawer) return;
      drawer.classList.remove('open');
      if (drawerOverlay) drawerOverlay.classList.remove('active');
      drawer.setAttribute('aria-hidden', 'true');
    }

    function init() {
      syncBookmarkButtons();
      renderList();

      qsa('.btn-bookmark').forEach(function (btn) {
        btn.addEventListener('click', function () {
          toggle(btn.getAttribute('data-spot-id'), {
            title: btn.getAttribute('data-spot-title'),
            area: btn.getAttribute('data-spot-area'),
            category: btn.getAttribute('data-spot-category')
          });
        });
      });

      [floatingBtn, navOpenBtn, mobileOpenBtn].forEach(function (btn) {
        if (btn) btn.addEventListener('click', openDrawer);
      });
      if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
      if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          if (!items.length) return;
          items = [];
          Store.save(items);
          syncBookmarkButtons();
          renderList();
          ToastModule.show('リストをすべてリセットしました');
        });
      }

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && drawer && drawer.classList.contains('open')) closeDrawer();
      });
    }

    return { init: init };
  })();

  /* ============================================================
     5. Interactive Seoul Map (chips + pins + detail panel)
     ============================================================ */
  var MapModule = (function () {
    var AREA_DATA = {
      seongsu: {
        region: '江北・東部 (地下鉄2号線 聖水駅)',
        name: '聖水洞 (ソンスドン)',
        desc: '工場リノベカフェと週末限定ポップアップストアが密集する、ソウルで最もホットな若者・クリエイターの街。',
        time: '約3〜4時間 (午後の散策推奨)',
        highlights: '大林倉庫, TAMBURINS聖水フラッグシップ, アトリエ通り',
        query: '성수동 카페거리'
      },
      hannam: {
        region: '江北・龍山区 (地下鉄6号線 漢江鎮駅)',
        name: '漢南洞 (ハンナムドン)',
        desc: '各国大使館と高級住宅街に囲まれた閑静なエリア。モード系ブランドと洗練されたギャラリーカフェが集まります。',
        time: '約2〜3時間',
        highlights: 'Mardi Mercredi, Leeum美術館, 大使館通り',
        query: '한남동 편집숍'
      },
      myeongdong: {
        region: '都心・中区 (地下鉄4号線 明洞駅)',
        name: '明洞 (ミョンドン)',
        desc: '日本人旅行者の王道拠点。コスメ旗艦店、公認両替所、夜の屋台グルメが密集するショッピングタウン。',
        time: '約2〜3時間 (夕方以降がおすすめ)',
        highlights: 'オリーブヤング明洞タウン, 明洞聖堂, 明洞屋台通り',
        query: '명동거리'
      },
      hongdae: {
        region: '西部・麻浦区 (地下鉄2号線 弘大入口駅)',
        name: '弘大・延南洞 (ホンデ・ヨンナムドン)',
        desc: 'サブカルチャーとナイトライフの街。京義線スッキル沿いには個性的な雑貨屋と隠れ家カフェが点在します。',
        time: '約3時間 (夜まで楽しめる)',
        highlights: '京義線スッキル, 弘大クラブ通り, 駐車場通り',
        query: '홍대 걷고싶은거리'
      },
      ikseon: {
        region: '都心・鐘路区 (地下鉄 鐘路3街駅)',
        name: '益善洞 (イクソンドン)',
        desc: '1920年代の韓屋密集地をリノベーションした、瓦屋根の路地に映えるカフェとレストランが並ぶレトロタウン。',
        time: '約2時間 (午前中が比較的空いています)',
        highlights: '清水堂(チョンスダン), 益善洞韓屋通り, 小夏塩田',
        query: '익선동 한옥거리'
      },
      gangnam: {
        region: '江南エリア (地下鉄3号線 新沙駅)',
        name: '江南・新沙洞 (カンナム・シンサドン)',
        desc: 'ガロスキル(街路樹通り)を中心に、ハイブランドとセレクトショップ、裏路地のおしゃれカフェが集まる洗練された街。',
        time: '約3時間',
        highlights: 'ガロスキル, セロスキル(裏通り), 新沙洞カンジャンケジャン通り',
        query: '가로수길'
      },
      jamsil: {
        region: '江南・東部 (地下鉄2号線 蚕室駅)',
        name: '蚕室 (チャムシル)',
        desc: 'ロッテワールドタワーの展望台と遊園地、石村湖の夜景まで一日中楽しめるファミリー・エンタメエリア。',
        time: '半日〜1日',
        highlights: 'ロッテワールドタワー展望台, ロッテワールド, 石村湖',
        query: '잠실 롯데월드타워'
      },
      dongdaemun: {
        region: '都心・東部 (地下鉄 東大門歴史文化公園駅)',
        name: '東大門 (トンデムン / DDP)',
        desc: 'ザハ・ハディッド設計の近未来的建築DDPと、深夜まで営業する卸売ファッションビルが共存するナイトショッピングの聖地。',
        time: '約2〜3時間 (夜がおすすめ)',
        highlights: 'DDP(東大門デザインプラザ), 東大門総合市場, 平和市場',
        query: '동대문디자인플라자'
      }
    };

    var chips = qsa('.map-chip-btn');
    var markers = qsa('.map-marker');
    var regionEl = qs('#mapDetailRegion');
    var nameEl = qs('#mapDetailName');
    var descEl = qs('#mapDetailDesc');
    var timeEl = qs('#mapDetailTime');
    var highlightsEl = qs('#mapDetailHighlights');
    var naverLink = qs('#mapNaverLink');

    function applyChipStyle(chip, active) {
      chip.classList.toggle('is-active', active);
      if (active) {
        chip.className = 'map-chip-btn is-active bg-blue-900 text-white font-bold px-3.5 py-1.5 rounded-full text-xs border border-blue-700 transition-colors shadow-sm';
      } else {
        chip.className = 'map-chip-btn bg-white text-slate-700 px-3.5 py-1.5 rounded-full text-xs border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm';
      }
    }

    function selectArea(key) {
      var data = AREA_DATA[key];
      if (!data) return;

      chips.forEach(function (chip) {
        applyChipStyle(chip, chip.getAttribute('data-area-key') === key);
      });
      markers.forEach(function (marker) {
        marker.classList.toggle('active', marker.getAttribute('data-area-key') === key);
      });

      if (regionEl) regionEl.textContent = data.region;
      if (nameEl) nameEl.textContent = data.name;
      if (descEl) descEl.textContent = data.desc;
      if (timeEl) timeEl.textContent = data.time;
      if (highlightsEl) highlightsEl.textContent = data.highlights;
      if (naverLink) naverLink.href = 'https://map.naver.com/p/search/' + encodeURIComponent(data.query);
    }

    function init() {
      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          selectArea(chip.getAttribute('data-area-key'));
        });
      });
      markers.forEach(function (marker) {
        marker.addEventListener('click', function () {
          selectArea(marker.getAttribute('data-area-key'));
        });
        marker.setAttribute('tabindex', '0');
        marker.setAttribute('role', 'button');
        marker.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectArea(marker.getAttribute('data-area-key'));
          }
        });
      });
    }

    return { init: init };
  })();

  /* ============================================================
     6. Theme filter tabs (jQuery-assisted)
     ============================================================ */
  var ThemeFilterModule = (function () {
    // jQuery가 정상적으로 로드된 경우: jQuery 기반 필터
    function initWithJQuery() {
      var $tabs = $('.tab-btn');
      var $items = $('.theme-card-item');

      $tabs.on('click', function () {
        var filter = $(this).data('filter');

        $tabs.removeClass('active').attr('aria-pressed', 'false');
        $(this).addClass('active').attr('aria-pressed', 'true');

        $items.each(function () {
          var $item = $(this);
          var match = filter === 'all' || $item.data('category') === filter;
          $item.attr('hidden', match ? null : true);
        });
      });
    }

    // jQuery CDN이 차단/실패한 경우를 대비한 순수 JS 폴백
    function initVanilla() {
      var tabs = qsa('.tab-btn');
      var items = qsa('.theme-card-item');

      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          var filter = tab.getAttribute('data-filter');

          tabs.forEach(function (t) {
            t.classList.remove('active');
            t.setAttribute('aria-pressed', 'false');
          });
          tab.classList.add('active');
          tab.setAttribute('aria-pressed', 'true');

          items.forEach(function (item) {
            var match = filter === 'all' || item.getAttribute('data-category') === filter;
            if (match) item.removeAttribute('hidden');
            else item.setAttribute('hidden', 'true');
          });
        });
      });
    }

    function init() {
      if (!qs('.tab-btn')) return;
      // jQuery가 있으면 jQuery로, 없거나 CDN 로드가 실패했다면 순수 JS로 동작
      if (typeof $ === 'function' && $.fn) {
        initWithJQuery();
      } else {
        initVanilla();
      }
    }
    return { init: init };
  })();

  /* ============================================================
     7. Phrase cards: copy to clipboard + text-to-speech
     ============================================================ */
  var PhraseModule = (function () {
    function fallbackCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* noop */ }
      document.body.removeChild(ta);
    }

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
      } else {
        fallbackCopy(text);
      }
    }

    function speak(text) {
      if (!('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        var utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'ko-KR';
        utter.rate = 0.9;
        window.speechSynthesis.speak(utter);
      } catch (e) { /* speech synthesis unavailable */ }
    }

    function init() {
      qsa('.copy-phrase-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var korean = btn.getAttribute('data-phrase-korean') || '';
          copyText(korean);
          speak(korean);

          btn.classList.add('is-copied');
          var label = qs('span', btn);
          var original = label ? label.textContent : null;
          if (label) label.textContent = 'コピーしました ✓ (音声再生中)';

          ToastModule.show('韓国語フレーズをコピーしました');

          setTimeout(function () {
            btn.classList.remove('is-copied');
            if (label && original) label.textContent = original;
          }, 1800);
        });
      });
    }

    return { init: init };
  })();

  /* ============================================================
     8. Weather season tabs
     ============================================================ */
  var SeasonModule = (function () {
    var tabs = qsa('.season-tab');
    var seasons = ['spring', 'summer', 'autumn', 'winter'];

    function select(season) {
      tabs.forEach(function (tab) {
        tab.classList.toggle('active', tab.getAttribute('data-season') === season);
      });
      seasons.forEach(function (s) {
        var panel = qs('#seasonPanel_' + s);
        if (panel) panel.classList.toggle('hidden', s !== season);
      });
    }

    function init() {
      if (!tabs.length) return;
      tabs.forEach(function (tab, idx) {
        tab.setAttribute('role', 'tab');
        tab.addEventListener('click', function () { select(tab.getAttribute('data-season')); });
        tab.addEventListener('keydown', function (e) {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          var nextIdx = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
          tabs[nextIdx].focus();
          select(tabs[nextIdx].getAttribute('data-season'));
        });
      });
    }

    return { init: init };
  })();

  /* ============================================================
     9. Currency calculator (KRW -> JPY)
     ============================================================ */
  var CurrencyModule = (function () {
    var RATE = 0.112; // 100 KRW ≒ 11.2 JPY
    var input = qs('#calcKrwInput');
    var result = qs('#calcJpyResult');
    var presets = qsa('.calc-preset-btn');

    function format(n) {
      return Math.round(n).toLocaleString('ja-JP');
    }

    function recalc() {
      if (!input || !result) return;
      var raw = parseFloat(String(input.value).replace(/[^0-9.]/g, ''));
      if (isNaN(raw) || raw < 0) raw = 0;
      result.textContent = format(raw * RATE);
    }

    function init() {
      if (!input) return;
      input.addEventListener('input', recalc);
      presets.forEach(function (btn) {
        btn.addEventListener('click', function () {
          input.value = btn.getAttribute('data-amount');
          presets.forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
          recalc();
        });
      });
      recalc();
    }

    return { init: init };
  })();

  /* ============================================================
     10. FAQ accordion
     ============================================================ */
  var FaqModule = (function () {
    function init() {
      qsa('.faq-item').forEach(function (item) {
        var header = qs('.faq-header', item);
        var content = qs('.faq-content', item);
        if (!header || !content) return;

        header.setAttribute('aria-expanded', 'false');
        header.addEventListener('click', function () {
          var isOpen = item.classList.contains('open');
          qsa('.faq-item.open').forEach(function (openItem) {
            if (openItem !== item) {
              openItem.classList.remove('open');
              qs('.faq-header', openItem).setAttribute('aria-expanded', 'false');
            }
          });
          item.classList.toggle('open', !isOpen);
          header.setAttribute('aria-expanded', String(!isOpen));
        });
      });
    }
    return { init: init };
  })();

  /* ============================================================
     Bootstrap
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    // 모듈 하나가 실패(예: 외부 CDN 차단으로 jQuery 미로딩)해도
    // 나머지 기능은 정상 동작하도록 각 init을 개별적으로 감쌉니다.
    var modules = [
      HeaderModule, ToastModule, ModalModule, PlanModule, MapModule,
      ThemeFilterModule, PhraseModule, SeasonModule, CurrencyModule, FaqModule
    ];
    modules.forEach(function (mod) {
      try {
        mod.init();
      } catch (err) {
        if (window.console && console.warn) console.warn('[TABI KOREA] module init failed:', err);
      }
    });
  });

})(window, window.jQuery);
