(function () {
  'use strict';

  /* ========================================================================
     Chomsky — Grammatical Passphrase Generator
     Static, dependency‑free, browser‑based.
     ======================================================================== */

  // ── Constants ───────────────────────────────────────────────────────────

  var POS_OPTIONS = [
    { value: 'adjective', label: 'Adjective' },
    { value: 'adverb',   label: 'Adverb' },
    { value: 'noun',     label: 'Noun' },
    { value: 'verb',     label: 'Verb' }
  ];

  // Maps spinner POS value → wordLists key (identity by design; see note in
  // generateAndDisplay about wordLists construction).
  var POS_MAP = {
    adjective: 'adjective',
    adverb:    'adverb',
    noun:      'noun',
    verb:      'verb'
  };

  // Default pattern for the first five slots.
  var BASE_PATTERN_5 = ['adjective', 'adjective', 'noun', 'verb', 'adverb'];
  // Cycle pattern for slots beyond index 4.
  var CYCLE_PATTERN   = ['adjective', 'adverb', 'noun', 'verb'];

  var MIN_COUNT = 3;
  var MAX_COUNT = 8;
  var DEFAULT_COUNT = 5;

  // ── State ───────────────────────────────────────────────────────────────

  /** @type {{ noun: string[], adj: string[], verb: string[], adv: string[] }} */
  var activeWords = {
    noun: [],
    adj:  [],
    verb: [],
    adv:  []
  };

  /** @type {HTMLSelectElement[]} */
  var templateSpinners = [];

  // ── DOM references (lazily resolved in init) ────────────────────────────

  var $ = {};  // will be populated in init()

  // ── Crypto RNG (no Math.random) ─────────────────────────────────────────

  /**
   * Return a uniform random integer in [0, max).  Uses rejection sampling
   * on crypto.getRandomValues to avoid modulo bias.
   * @param {number} max  Exclusive upper bound; must be > 0.
   * @returns {number}
   */
  function getSecureRandomIndex(max) {
    if (max <= 0) throw new RangeError('max must be > 0');
    var limit = Math.floor(0xffffffff / max) * max;
    var v;
    do {
      var buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      v = buf[0];
    } while (v >= limit);
    return v % max;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Parse a multi‑line / comma‑separated string into a deduplicated array of
   * lowercase words.
   * @param {string} text
   * @returns {string[]}
   */
  function parseWordList(text) {
    var seen = {};
    var result = [];
    var parts = text.split(/[\r\n,]+/);
    for (var i = 0; i < parts.length; i++) {
      var w = parts[i].trim().toLowerCase();
      if (w !== '' && !seen.hasOwnProperty(w)) {
        seen[w] = true;
        result.push(w);
      }
    }
    return result;
  }

  /**
   * Sync activeWords[pos] from its textarea, update the count span, then
   * regenerate.
   * @param {'noun'|'adj'|'verb'|'adv'} pos
   */
  function syncWordsFromTextarea(pos) {
    var textarea = $[pos + '-textarea'];
    var words = parseWordList(textarea.value);
    activeWords[pos] = words;
    $[pos + '-count'].textContent = words.length.toLocaleString();
    generateAndDisplay();
  }

  /**
   * Reset one POS's textarea + active list back to the built‑in default.
   * @param {'noun'|'adj'|'verb'|'adv'} pos
   */
  function resetPos(pos) {
    var defaults = {
      noun: typeof WORDS_NOUN !== 'undefined' ? WORDS_NOUN : [],
      adj:  typeof WORDS_ADJ  !== 'undefined' ? WORDS_ADJ  : [],
      verb: typeof WORDS_VERB !== 'undefined' ? WORDS_VERB : [],
      adv:  typeof WORDS_ADV  !== 'undefined' ? WORDS_ADV  : []
    };
    var words = defaults[pos].slice();
    activeWords[pos] = words;
    $[pos + '-textarea'].value = words.join('\n');
    $[pos + '-count'].textContent = words.length.toLocaleString();
    $['validation-msg'].textContent = '';
    generateAndDisplay();
  }

  /**
   * Read the word‑count input, clamp to valid range.
   * @returns {number}
   */
  function getWordCount() {
    var raw = parseInt($['word-count'].value, 10);
    if (isNaN(raw)) return DEFAULT_COUNT;
    if (raw < MIN_COUNT) return MIN_COUNT;
    if (raw > MAX_COUNT) return MAX_COUNT;
    return raw;
  }

  // ── Template spinners ───────────────────────────────────────────────────

  /**
   * Return the default POS value for a given spinner index.
   * @param {number} index
   * @returns {string}
   */
  function defaultForIndex(index) {
    if (index < BASE_PATTERN_5.length) {
      return BASE_PATTERN_5[index];
    }
    return CYCLE_PATTERN[(index - BASE_PATTERN_5.length) % CYCLE_PATTERN.length];
  }

  /**
   * Render template spinners inside the container.
   * @param {number} count  Number of spinners to create.
   */
  function renderSpinners(count) {
    // Preserve existing selections.
    var oldSelections = templateSpinners.map(function (sel) {
      return sel.value;
    });

    var container = $['template-spinners'];
    container.innerHTML = '';
    templateSpinners = [];

    for (var i = 0; i < count; i++) {
      var select = document.createElement('select');
      select.className = 'template-spinner';

      // Build <option>s
      for (var o = 0; o < POS_OPTIONS.length; o++) {
        var opt = document.createElement('option');
        opt.value = POS_OPTIONS[o].value;
        opt.textContent = POS_OPTIONS[o].label;
        select.appendChild(opt);
      }

      // Restore previous selection or use default.
      var saved = (i < oldSelections.length) ? oldSelections[i] : null;
      select.value = (saved !== null && saved !== undefined) ? saved : defaultForIndex(i);

      // Wire change → regenerate.
      select.addEventListener('change', function () {
        generateAndDisplay();
      });

      container.appendChild(select);
      templateSpinners.push(select);
    }
  }

  /**
   * Read current spinner values as an array of POS strings.
   * @returns {string[]}
   */
  function getTemplate() {
    var t = [];
    for (var i = 0; i < templateSpinners.length; i++) {
      t.push(templateSpinners[i].value);
    }
    return t;
  }

  // ── Core generation ─────────────────────────────────────────────────────

  /**
   * Generate a passphrase from the given template and word lists.
   *
   * @param {string[]} template        Array of POS values e.g. ['adjective','noun',…]
   * @param {Object}   wordLists       Keys matching POS_MAP values; each value is string[].
   * @param {Object}   [options]
   * @param {string}   [options.separator='-']
   * @param {string}   [options.includeNumber='end']  'end' | 'anywhere' | 'none'
   * @param {boolean}  [options.capitalize=true]
   * @returns {string}
   */
  function generatePassphrase(template, wordLists, options) {
    options = options || {};
    var separator    = options.separator != null ? options.separator : '-';
    var includeNumber = options.includeNumber != null ? options.includeNumber : 'end';
    var capitalize   = options.capitalize !== false;

    var words = [];
    for (var i = 0; i < template.length; i++) {
      var pos      = template[i];
      var listName = POS_MAP[pos];
      var list     = wordLists[listName];
      if (!list || list.length === 0) {
        throw new Error('Empty word list for ' + pos);
      }
      var idx  = getSecureRandomIndex(list.length);
      var word = list[idx];
      if (capitalize) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      }
      words.push(word);
    }

    var passphrase = words.join(separator);

    if (includeNumber !== 'none') {
      var digit = getSecureRandomIndex(10).toString();
      if (includeNumber === 'end') {
        passphrase += separator + digit;
      } else if (includeNumber === 'anywhere') {
        var parts = passphrase.split(separator);
        var pos_  = getSecureRandomIndex(parts.length + 1);
        parts.splice(pos_, 0, digit);
        passphrase = parts.join(separator);
      }
    }

    return passphrase;
  }

  /**
   * Calculate entropy (bits) for a given template and word lists.
   *
   * @param {string[]} template
   * @param {Object}   wordLists
   * @param {Object}   [options]
   * @param {string}   [options.includeNumber='end']
   * @returns {number}
   */
  function calculateEntropy(template, wordLists, options) {
    options = options || {};
    var includeNumber = options.includeNumber != null ? options.includeNumber : 'end';

    var bits = 0;
    for (var i = 0; i < template.length; i++) {
      var pos      = template[i];
      var listName = POS_MAP[pos];
      var list     = wordLists[listName];
      if (list && list.length > 0) {
        bits += Math.log2(list.length);
      }
    }

    if (includeNumber !== 'none') {
      bits += Math.log2(10);
      if (includeNumber === 'anywhere') {
        bits += Math.log2(template.length + 1);
      }
    }

    return bits;
  }

  // ── Display & stats ─────────────────────────────────────────────────────

  /**
   * Update the stats row after generation.
   *
   * @param {string[]} template
   * @param {Object}   wordLists
   * @param {string}   passphrase
   * @param {string}   includeNumber
   * @param {string}   separator
   */
  function updateStats(template, wordLists, passphrase, includeNumber, separator) {
    // Current length
    $['passphrase-current-length'].textContent = passphrase.length;

    // Entropy
    var bits = calculateEntropy(template, wordLists, { includeNumber: includeNumber });
    $['passphrase-strength'].textContent = Math.floor(bits);

    // Combinations
    var combos;
    if (bits >= 53) {
      combos = '9,223,372,036,854,775,807+';
    } else {
      var num = Math.pow(2, bits);
      combos = num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    $['passphrase-count'].textContent = combos;

    // Min / max possible length
    var sepLen   = separator.length;
    var slotCount = template.length;
    var minTotal = 0;
    var maxTotal = 0;

    for (var i = 0; i < template.length; i++) {
      var pos      = template[i];
      var listName = POS_MAP[pos];
      var list     = wordLists[listName];
      // (lists are guaranteed non‑empty at this point)
      var minLen = Infinity;
      var maxLen = 0;
      for (var w = 0; w < list.length; w++) {
        var l = list[w].length;
        if (l < minLen) minLen = l;
        if (l > maxLen) maxLen = l;
      }
      minTotal += minLen;
      maxTotal += maxLen;
    }

    minTotal += sepLen * (slotCount - 1);
    maxTotal += sepLen * (slotCount - 1);

    if (includeNumber !== 'none') {
      minTotal += sepLen + 1;
      maxTotal += sepLen + 1;
    }

    $['passphrase-min-length'].textContent = minTotal;
    $['passphrase-max-length'].textContent = maxTotal;

    // Fit font to the MAX possible length so every passphrase in this config
    // fits on one line (stable per configuration, not per generated phrase).
    fitPassphraseFont(maxTotal);
  }

  /**
   * Main generate‑and‑display routine.
   */
  function generateAndDisplay() {
    // 1. Sync all POS from textareas so in‑page edits take effect.
    var posKeys = ['noun', 'adj', 'verb', 'adv'];
    for (var p = 0; p < posKeys.length; p++) {
      var pk    = posKeys[p];
      var ta    = $[pk + '-textarea'];
      var words = parseWordList(ta.value);
      activeWords[pk] = words;
      $[pk + '-count'].textContent = words.length.toLocaleString();
    }

    // 2. Read controls.
    var count       = getWordCount();
    var template    = getTemplate().slice(0, count);
    var separator   = $['separator'].value;
    var includeNumber = $['include-number'].value;

    // 3. Validate.
    var uniquePOS = {};
    for (var t = 0; t < template.length; t++) {
      uniquePOS[template[t]] = true;
    }

    var hasEmpty = false;
    for (var posLabel in uniquePOS) {
      if (uniquePOS.hasOwnProperty(posLabel)) {
        var listName = POS_MAP[posLabel];
        // activeWords[listName] — listName is 'adjective' etc., but
        // activeWords keys are 'adj', 'noun', 'verb', 'adv'.  Map them:
        var activeKey = posLabel === 'adjective' ? 'adj'
                      : posLabel === 'adverb'    ? 'adv'
                      : posLabel; // 'noun' or 'verb'
        var lst = activeWords[activeKey];
        if (!lst || lst.length === 0) {
          hasEmpty = true;
          break;
        }
      }
    }

    if (template.length < 1) {
      $['validation-msg'].textContent = 'Word count must be at least 1.';
      return;
    }

    if (hasEmpty) {
      $['validation-msg'].textContent = 'One or more selected word lists are empty.';
      return;
    }

    // Clear validation message.
    $['validation-msg'].textContent = '';

    // 4. Build wordLists object for the core functions.
    // Keys match POS_MAP values so lookups succeed.
    var wordLists = {
      adjective: activeWords.adj,
      adverb:    activeWords.adv,
      noun:      activeWords.noun,
      verb:      activeWords.verb
    };

    // 5. Generate.
    var passphrase = generatePassphrase(template, wordLists, {
      separator: separator,
      includeNumber: includeNumber,
      capitalize: true
    });

    // 6. Display.
    $['passphrase-output'].textContent = passphrase;
    $['passphrase-output'].classList.remove('placeholder');
    $['copy-btn'].disabled = false;

    // 7. Stats (also computes max possible length for font fitting).
    updateStats(template, wordLists, passphrase, includeNumber, separator);
  }

  // Base font size (rem) that comfortably fits TARGET_CHARS characters on one
  // line at the desktop max-width (720px container, 1.25rem container padding,
  // 1.5rem card padding -> ~632px usable). Longer configurations scale down.
  var BASE_FONT_REM = 1.27;
  var TARGET_CHARS = 50;
  // Most recent max possible length, so resize can re‑fit without regenerating.
  var lastMaxLen = 0;

  /**
   * Scale the passphrase font down only when the MAX possible length for the
   * current configuration exceeds TARGET_CHARS, so every passphrase in that
   * configuration fits on a single line (no wrap, no scroll). Stable per config.
   * @param {number} maxLen  Max possible passphrase length for current settings.
   */
  function fitPassphraseFont(maxLen) {
    lastMaxLen = maxLen || 0;
    var el = $['passphrase-output'];
    if (lastMaxLen <= TARGET_CHARS) {
      el.style.fontSize = '';
      return;
    }
    // Shrink proportionally: each extra char reduces font by 1/char.
    var scale = TARGET_CHARS / lastMaxLen;
    var newRem = BASE_FONT_REM * scale;
    // Don't go absurdly small.
    if (newRem < 0.6) newRem = 0.6;
    el.style.fontSize = newRem.toFixed(3) + 'rem';
  }

  // ── Initialization ──────────────────────────────────────────────────────

  function init() {
    // --- Gather DOM references ---
    var ids = [
      'word-count',
      'separator',
      'include-number',
      'generate-btn',
      'passphrase-output',
      'passphrase-count',
      'copy-btn',
      'validation-msg',
      'template-spinners',
      'controls-header',
      'controls-toggle',
      'controls-body',
      'noun-textarea',
      'adj-textarea',
      'verb-textarea',
      'adv-textarea',
      'noun-count',
      'adj-count',
      'verb-count',
      'adv-count',
      'noun-file',
      'adj-file',
      'verb-file',
      'adv-file',
      'passphrase-current-length',
      'passphrase-min-length',
      'passphrase-max-length',
      'passphrase-strength'
    ];

    for (var i = 0; i < ids.length; i++) {
      $[ids[i]] = document.getElementById(ids[i]);
    }

    // Optional reset button.
    var resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      $['reset-btn'] = resetBtn;
    }

    // --- Seed builtin word lists ---
    var seedMap = {
      noun: typeof WORDS_NOUN !== 'undefined' ? WORDS_NOUN : [],
      adj:  typeof WORDS_ADJ  !== 'undefined' ? WORDS_ADJ  : [],
      verb: typeof WORDS_VERB !== 'undefined' ? WORDS_VERB : [],
      adv:  typeof WORDS_ADV  !== 'undefined' ? WORDS_ADV  : []
    };

    var posKeys = ['noun', 'adj', 'verb', 'adv'];
    for (var s = 0; s < posKeys.length; s++) {
      var pk  = posKeys[s];
      activeWords[pk] = seedMap[pk].slice(); // shallow copy
      $[pk + '-textarea'].value = activeWords[pk].join('\n');
      $[pk + '-count'].textContent = activeWords[pk].length.toLocaleString();
    }

    // --- Controls toggle initial state ---
    // Body starts collapsed per HTML; set toggle text to match.
    $['controls-toggle'].textContent = 'Show \u25BE';

    // --- Initial spinner render (5) ---
    renderSpinners(DEFAULT_COUNT);

    // --- Wire listeners ---

    // Per‑POS textarea
    for (var t = 0; t < posKeys.length; t++) {
      var pk2 = posKeys[t];
      (function (pos) {
        $[pos + '-textarea'].addEventListener('input', function () {
          syncWordsFromTextarea(pos);
        });
      })(pk2);
    }

    // Per‑POS file upload
    for (var u = 0; u < posKeys.length; u++) {
      var pk3 = posKeys[u];
      (function (pos) {
        $[pos + '-file'].addEventListener('change', function (e) {
          var fileInput = e.target;
          var file = fileInput.files && fileInput.files[0];
          if (!file) return;

          var reader = new FileReader();
          reader.addEventListener('load', function (evt) {
            var text    = evt.target.result;
            var words   = parseWordList(text);
            if (words.length === 0) {
              $['validation-msg'].textContent = 'Uploaded file contained no valid words.';
              return;
            }
            activeWords[pos] = words;
            $[pos + '-textarea'].value = words.join('\n');
            $[pos + '-count'].textContent = words.length.toLocaleString();
            $['validation-msg'].textContent = 'Loaded ' + words.length + ' words into ' + pos + '.';
            generateAndDisplay();
          });
          reader.readAsText(file);
          // Allow re‑selecting the same file.
          fileInput.value = '';
        });
      })(pk3);
    }

    // Word‑count change
    $['word-count'].addEventListener('input', function () {
      var count = getWordCount();
      renderSpinners(count);
      generateAndDisplay();
    });

    // Separator input
    $['separator'].addEventListener('input', generateAndDisplay);

    // Include‑number change
    $['include-number'].addEventListener('change', generateAndDisplay);

    // Generate button
    $['generate-btn'].addEventListener('click', generateAndDisplay);

    // Per‑POS "Reset to Default" buttons
    var resetBtns = document.querySelectorAll('.reset-pos-btn');
    for (var rb = 0; rb < resetBtns.length; rb++) {
      resetBtns[rb].addEventListener('click', function () {
        resetPos(this.getAttribute('data-pos'));
      });
    }

    // Re‑fit font if the viewport width changes (affects available space).
    window.addEventListener('resize', function () {
      fitPassphraseFont(lastMaxLen);
    });

    // Copy button
    $['copy-btn'].addEventListener('click', function () {
      var text = $['passphrase-output'].textContent;
      if (!text) return;
      var origLabel = $['copy-btn'].textContent;
      navigator.clipboard.writeText(text).then(function () {
        $['copy-btn'].textContent = 'Copied \u2713';
        $['copy-btn'].classList.add('copy-feedback');
        setTimeout(function () {
          $['copy-btn'].textContent = origLabel;
          $['copy-btn'].classList.remove('copy-feedback');
        }, 1500);
      }).catch(function () {
        $['validation-msg'].textContent = 'Copy failed.';
      });
    });

    // Controls header toggle
    $['controls-header'].addEventListener('click', function () {
      var body = $['controls-body'];
      var isCollapsed = body.classList.contains('collapsed');
      if (isCollapsed) {
        body.classList.remove('collapsed');
        $['controls-toggle'].textContent = 'Hide \u25B4';
      } else {
        body.classList.add('collapsed');
        $['controls-toggle'].textContent = 'Show \u25BE';
      }
    });

    // Reset button (optional)
    if ($['reset-btn']) {
      $['reset-btn'].addEventListener('click', function () {
        // Re‑seed from globals.
        var seedMap2 = {
          noun: typeof WORDS_NOUN !== 'undefined' ? WORDS_NOUN : [],
          adj:  typeof WORDS_ADJ  !== 'undefined' ? WORDS_ADJ  : [],
          verb: typeof WORDS_VERB !== 'undefined' ? WORDS_VERB : [],
          adv:  typeof WORDS_ADV  !== 'undefined' ? WORDS_ADV  : []
        };
        var resetPos = ['noun', 'adj', 'verb', 'adv'];
        for (var r = 0; r < resetPos.length; r++) {
          var rk = resetPos[r];
          activeWords[rk] = seedMap2[rk].slice();
          $[rk + '-textarea'].value = activeWords[rk].join('\n');
          $[rk + '-count'].textContent = activeWords[rk].length.toLocaleString();
        }
        var rc = getWordCount();
        renderSpinners(rc);
        generateAndDisplay();
      });
    }

    // Enter key shortcut (not in textarea or text inputs)
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var el = document.activeElement;
        if (el && el.tagName === 'TEXTAREA') return;
        if (el && el.type === 'text') return;
        $['generate-btn'].click();
      }
    });

    // Initial generation.
    generateAndDisplay();
  }

  // --- Bootstrap ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
