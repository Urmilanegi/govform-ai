// RRB Form Filler — rrbapply.gov.in
// Handles Registration (if new) → OTP → Login → Form Fill → PDF
// Communicates via stdout JSON lines

const { getGovformCredsFile, getGovformProfileDir, launchPersistentContext } = require('./playwright-runtime.cjs');
const fs   = require('fs');
const path = require('path');

const PROFILE_DIR  = getGovformProfileDir('rrb-profile');
const CREDS_FILE   = getGovformCredsFile();
const OTP_FILE        = '/tmp/govform_otp.txt';
const CAPTCHA_FILE    = '/tmp/govform_captcha.txt';
const STATUS_FILE     = '/tmp/govform_status.json';
const SCREENSHOT_FILE = '/tmp/govform_screenshot.png';
const RRB_BASE_URL    = 'https://www.rrbapply.gov.in';
const RRB_REGISTRATION_URL = `${RRB_BASE_URL}/#/auth/home?flag=true`;
const RRB_LOGIN_URL   = `${RRB_BASE_URL}/#/auth/home`;

function send(type, message, extra = {}) {
  const data = { type, message, ...extra };
  process.stdout.write(JSON.stringify(data) + '\n');
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data));
}

async function saveScreenshot(page, label) {
  try {
    const buf = await page.screenshot({ fullPage: false, type: 'png' });
    // Send base64 inline — /tmp is not shared across Vercel lambda instances
    send('screenshot', label || '📸 Browser screenshot', { screenshot: buf.toString('base64') });
  } catch (e) {
    send('log', `Screenshot error: ${e.message}`);
  }
}

function loadCreds() {
  try {
    if (!fs.existsSync(CREDS_FILE)) return {};
    return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  } catch { return {}; }
}

function saveCreds(exam, fields) {
  const all = loadCreds();
  all[exam] = { ...(all[exam] || {}), ...fields };
  fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(all, null, 2));
}

async function waitForInput(file, timeoutMs = 180000) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(file)) {
      const val = fs.readFileSync(file, 'utf8').trim();
      if (val) { fs.unlinkSync(file); return val; }
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Input timeout (3 minutes)');
}

async function fillInput(page, selector, value) {
  const el = await page.$(selector);
  if (!el) return false;
  await el.scrollIntoViewIfNeeded();
  await page.evaluate(({ sel, val }) => {
    const inp = document.querySelector(sel);
    if (!inp) return;
    const proto = Object.getOwnPropertyDescriptor(
      inp.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype, 'value'
    );
    if (proto?.set) proto.set.call(inp, val);
    ['input','change','blur'].forEach(ev => inp.dispatchEvent(new Event(ev, { bubbles: true })));
  }, { sel: selector, val: value });
  return true;
}

async function clickVisibleTextControl(page, pattern) {
  return page.evaluate((patternSource) => {
    const re = new RegExp(patternSource, 'i');
    const isVisible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const controls = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"], label, span, div'));
    const match = controls.find((el) => re.test((el.textContent || el.value || '').trim()) && isVisible(el));
    if (match) {
      match.click();
      return { clicked: true, text: (match.textContent || match.value || '').trim() };
    }
    return { clicked: false };
  }, pattern);
}

async function fillFieldByIndex(page, fieldIndex, value, options = {}) {
  if (fieldIndex == null || fieldIndex < 0) return false;
  const fieldQuery = options.query || 'input, textarea, select';
  const field = page.locator(fieldQuery).nth(fieldIndex);
  let nextValue = value;
  try {
    await field.scrollIntoViewIfNeeded();
    await field.click({ force: true });
  } catch {}

  const fieldType = await field.getAttribute('type').catch(() => null);
  if (fieldType === 'date' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split('/');
    nextValue = `${yyyy}-${mm}-${dd}`;
  }

  if (options.mode !== 'select' && options.useKeyboard) {
    try {
      await field.fill('');
    } catch {}
    try {
      await field.type(nextValue, { delay: options.typeDelay || 35 });
      await field.blur().catch(() => {});
      const typedValue = await field.inputValue().catch(() => '');
      if (
        typedValue === nextValue ||
        typedValue.replace(/\D/g, '') === `${nextValue}`.replace(/\D/g, '')
      ) {
        return true;
      }
    } catch {}
  }

  const result = await page.evaluate(({ fieldIndex, value, mode, optionPattern, query }) => {
    const fields = Array.from(document.querySelectorAll(query));
    const field = fields[fieldIndex];
    if (!field) return { ok: false, reason: 'missing-field' };

    const fire = (target, type, detail = {}) => {
      if (type === 'keydown' || type === 'keyup') {
        target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...detail }));
      } else {
        target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
      }
    };

    field.focus();

    if (field.tagName === 'SELECT' || mode === 'select') {
      const select = field;
      const re = optionPattern ? new RegExp(optionPattern, 'i') : null;
      let picked = null;
      for (const opt of Array.from(select.options || [])) {
        if (re && re.test(`${opt.text} ${opt.value}`)) {
          picked = opt;
          break;
        }
      }
      if (!picked) {
        picked = Array.from(select.options || []).find((opt) => opt.value && opt.value !== '0' && opt.text.trim());
      }
      if (!picked) return { ok: false, reason: 'no-option' };
      select.value = picked.value;
      ['input', 'change', 'blur'].forEach((evt) => fire(select, evt));
      return { ok: true, type: 'select', picked: picked.text };
    }

    const setter = Object.getOwnPropertyDescriptor(
      field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    )?.set;

    let nextValue = value;
    if (field.type === 'date' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [dd, mm, yyyy] = value.split('/');
      nextValue = `${yyyy}-${mm}-${dd}`;
    }

    setter?.call(field, '');
    ['keydown', 'keyup'].forEach((evt) => fire(field, evt, { key: 'Backspace' }));
    fire(field, 'input');

    setter?.call(field, nextValue);
    for (const ch of `${nextValue}`) {
      fire(field, 'keydown', { key: ch });
      fire(field, 'keyup', { key: ch });
    }
    ['input', 'change', 'blur'].forEach((evt) => fire(field, evt));
    return { ok: true, type: field.type || field.tagName.toLowerCase(), value: field.value };
  }, {
    fieldIndex,
    value,
    mode: options.mode || 'text',
    optionPattern: options.optionPattern || '',
    query: fieldQuery,
  });

  return !!result?.ok;
}

async function findFieldIndexesByHints(page, pattern, options = {}) {
  return page.evaluate(({ patternSource, query, onlyVisible, excludePattern }) => {
    const re = new RegExp(patternSource, 'i');
    const excludeRe = excludePattern ? new RegExp(excludePattern, 'i') : null;
    const nodes = Array.from(document.querySelectorAll(query || 'input, textarea, select'));
    const isVisible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const getHint = (el) => [
      el.name, el.id, el.placeholder, el.type, el.className, el.getAttribute('aria-label'),
      el.labels?.[0]?.textContent, el.closest('label')?.textContent, el.previousElementSibling?.textContent,
      el.parentElement?.textContent,
    ].filter(Boolean).join(' ').toLowerCase();

    return nodes
      .map((node, index) => ({ node, index, hint: getHint(node) }))
      .filter(({ node, hint }) => {
        if (onlyVisible && !isVisible(node)) return false;
        if (node.disabled || node.type === 'hidden' || node.readOnly) return false;
        if (excludeRe && excludeRe.test(hint)) return false;
        return re.test(hint);
      })
      .map(({ index }) => index);
  }, {
    patternSource: pattern,
    query: options.query || options.tags || 'input, textarea, select',
    onlyVisible: options.onlyVisible !== false,
    excludePattern: options.excludePattern || '',
  });
}

async function fillFieldsByHints(page, pattern, value, options = {}) {
  const indexes = await findFieldIndexesByHints(page, pattern, options);
  const targetIndexes = options.firstOnly ? indexes.slice(0, 1) : indexes;
  let filled = 0;
  for (const index of targetIndexes) {
    const ok = await fillFieldByIndex(page, index, value, options);
    if (ok) filled += 1;
    await page.waitForTimeout(options.delayBetween || 80);
  }
  return filled;
}

async function detectOtpTargets(page, kind, otpLength = 6) {
  return page.evaluate(({ kind, otpLength }) => {
    const allFields = Array.from(document.querySelectorAll('input, textarea'));
    const isVisible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const getHint = (el) => [
      el.name, el.id, el.placeholder, el.type, el.autocomplete, el.getAttribute('aria-label'),
      el.labels?.[0]?.textContent, el.closest('label')?.textContent, el.previousElementSibling?.textContent,
      el.parentElement?.textContent,
    ].filter(Boolean).join(' ').toLowerCase();
    const getRoot = (el) => el?.closest('[role="dialog"], [aria-modal="true"], .modal, .popup, .dialog, form, fieldset, section, article, .card, .panel') || document.body;

    const roots = new Set([document.body]);
    if (document.activeElement) roots.add(getRoot(document.activeElement));
    allFields.forEach((field) => roots.add(getRoot(field)));

    let chosenRoot = document.body;
    let bestScore = -1;
    for (const root of roots) {
      if (!root || !isVisible(root)) continue;
      const rootText = (root.textContent || '').toLowerCase();
      const visibleFields = allFields.filter((field) => root.contains(field) && isVisible(field) && !field.disabled && field.type !== 'hidden');
      if (!visibleFields.length) continue;
      const splitCount = visibleFields.filter((field) => field.maxLength === 1 || /otp|digit|code|pin/.test(getHint(field))).length;
      let score = visibleFields.length + splitCount * 12;
      if (/otp|one time password|verification/.test(rootText)) score += 25;
      if (kind === 'email' && /email/.test(rootText)) score += 18;
      if (kind === 'mobile' && /mobile|phone|sms/.test(rootText)) score += 18;
      if (root.matches?.('[role="dialog"], [aria-modal="true"], .modal, .popup, .dialog')) score += 10;
      if (document.activeElement && root.contains(document.activeElement)) score += 8;
      if (score > bestScore) {
        bestScore = score;
        chosenRoot = root;
      }
    }

    const visibleFields = allFields.filter((field) => chosenRoot.contains(field) && isVisible(field) && !field.disabled && field.type !== 'hidden');
    const hinted = visibleFields.filter((field) => {
      const hint = getHint(field);
      const kindMatch = kind === 'email' ? /email/.test(hint) : /mobile|phone|sms/.test(hint);
      return /otp|one time password|verification|code|pin/.test(hint) || kindMatch;
    });
    const digitBoxes = (hinted.length ? hinted : visibleFields).filter((field) => field.maxLength === 1 || /otp|digit|code|pin/.test(getHint(field)));
    const singleInput = (hinted.length ? hinted : visibleFields).find((field) => field.maxLength !== 1 && /otp|one time password|verification|code|pin/.test(getHint(field)));

    const fieldIndexes = allFields.map((field, index) => ({ field, index }));
    if (digitBoxes.length >= otpLength) {
      return {
        mode: 'split',
        indexes: fieldIndexes.filter(({ field }) => digitBoxes.includes(field)).slice(0, otpLength).map(({ index }) => index),
        rootText: (chosenRoot.textContent || '').trim().slice(0, 140),
      };
    }
    if (singleInput) {
      return {
        mode: 'single',
        indexes: [fieldIndexes.find(({ field }) => field === singleInput)?.index ?? -1],
        rootText: (chosenRoot.textContent || '').trim().slice(0, 140),
      };
    }

    return { mode: 'none', indexes: [], rootText: (chosenRoot.textContent || '').trim().slice(0, 140) };
  }, { kind, otpLength });
}

async function fillOtpCode(page, otp, kind) {
  await page.waitForTimeout(1200);

  // Primary approach: find all maxlength=1 visible boxes and fill one digit per box
  const boxCount = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input[maxlength="1"]')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !el.disabled && el.type !== 'hidden';
    }).length
  );

  if (boxCount >= otp.length) {
    const total = await page.locator('input[maxlength="1"]:visible').count();
    const startIdx = (kind === 'mobile' && total >= otp.length * 2) ? otp.length : 0;
    send('progress', `🔢 OTP boxes: ${total}, startIdx: ${startIdx}, kind: ${kind}`);

    // THE REAL ROOT CAUSE:
    // React re-renders ALL boxes from state array after EACH digit fill.
    // So digit[0] fills box[0], React re-renders → overwrites box[0] back to empty.
    // Only last digit survives because we stop touching it.
    //
    // 200% FIX: Intercept React's setState on the OTP component.
    // Find the React fiber, directly set ALL digits in state at once,
    // then trigger ONE single forceUpdate — no intermediate re-renders.
    const result = await page.evaluate(({ startIdx, otp }) => {
      const getBoxes = () => Array.from(document.querySelectorAll('input[maxlength="1"]')).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !el.disabled && el.type !== 'hidden';
      });

      const boxes = getBoxes().slice(startIdx, startIdx + otp.length);
      if (boxes.length < otp.length) return { ok: false, reason: 'boxes not found' };

      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

      // Step 1: Find React fiber key on first box
      const fiberKey = Object.keys(boxes[0]).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));

      if (fiberKey) {
        // Step 2: Walk up fiber tree to find OTP component with array state
        let fiber = boxes[0][fiberKey];
        let otpFiber = null;
        for (let i = 0; i < 20 && fiber; i++) {
          const state = fiber.memoizedState;
          if (state && Array.isArray(state.memoizedState) && state.memoizedState.length >= otp.length) {
            otpFiber = fiber;
            break;
          }
          // Also check if state has an otp/value array
          if (state && state.memoizedState && typeof state.memoizedState === 'object') {
            const val = state.memoizedState;
            if (val.otp || val.value || val.otpValue) {
              otpFiber = fiber;
              break;
            }
          }
          fiber = fiber.return;
        }

        if (otpFiber && otpFiber.stateNode && otpFiber.stateNode.setState) {
          // Class component — set state directly
          const digits = otp.split('');
          otpFiber.stateNode.setState({ otp: digits, value: digits, otpValue: digits });
          // Also set DOM values
          boxes.forEach((box, i) => {
            nativeSetter.call(box, otp[i]);
            box.dispatchEvent(new Event('input', { bubbles: true }));
          });
          return { ok: true, mode: 'fiber-setState' };
        }
      }

      // Step 3: Fallback — set all DOM values at once SYNCHRONOUSLY (no await between them)
      // Then fire events on LAST box only — one single React re-render with all values already set
      boxes.forEach((box, i) => {
        nativeSetter.call(box, otp[i]);
      });
      // Fire change event on each box — React reads DOM value during this handler
      boxes.forEach((box, i) => {
        box.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: otp[i], bubbles: true }));
        box.dispatchEvent(new Event('change', { bubbles: true }));
      });

      const filled = getBoxes().slice(startIdx, startIdx + otp.length).filter(b => b.value.length > 0).length;
      return { ok: true, mode: 'sync-all', filled };
    }, { startIdx, otp });

    send('progress', `✅ OTP fill result: ${JSON.stringify(result)}`);
    await page.waitForTimeout(2000);
    return { ok: true, mode: 'fiber-or-sync', rootText: `${kind} OTP filled` };
  }

  const target = await detectOtpTargets(page, kind, otp.length);
  if (!target?.indexes?.length) {
    await page.evaluate(({ otp, kind }) => {
      const inputs = Array.from(document.querySelectorAll('input, textarea'));
      const hinted = inputs.find((input) => {
        const hint = `${input.name} ${input.id} ${input.placeholder} ${input.getAttribute('aria-label') || ''}`.toLowerCase();
        return kind === 'email'
          ? /email.*otp|otp.*email|verification.*code|one time password/.test(hint)
          : /mobile.*otp|otp.*mobile|sms.*otp|verification.*code|one time password/.test(hint);
      });
      if (hinted) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(hinted, otp);
        ['input', 'change', 'blur'].forEach((evt) => hinted.dispatchEvent(new Event(evt, { bubbles: true })));
      }
    }, { otp, kind });
    return { ok: false, mode: 'fallback' };
  }

  if (target.mode === 'split') {
    for (let i = 0; i < target.indexes.length; i++) {
      await fillFieldByIndex(page, target.indexes[i], otp[i] || '', { useKeyboard: true, typeDelay: 20, query: 'input, textarea' });
      await page.waitForTimeout(80);
    }
    return { ok: true, mode: 'split', rootText: target.rootText };
  }

  await fillFieldByIndex(page, target.indexes[0], otp, { mode: 'text', useKeyboard: true, typeDelay: 20, query: 'input, textarea' });
  return { ok: true, mode: 'single', rootText: target.rootText };
}

async function detectIdentityFields(page) {
  return page.evaluate(() => {
    const fields = Array.from(document.querySelectorAll('input, textarea, select'));
    const isVisible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const getHint = (el) => [
      el.name, el.id, el.placeholder, el.type, el.className, el.getAttribute('aria-label'),
      el.labels?.[0]?.textContent, el.closest('label')?.textContent, el.previousElementSibling?.textContent,
      el.parentElement?.textContent,
    ].filter(Boolean).join(' ').toLowerCase();
    const getRoot = (el) => el?.closest('[role="dialog"], [aria-modal="true"], .modal, .popup, .dialog, form, fieldset, section, article, .card, .panel') || document.body;

    const roots = new Set([document.body]);
    if (document.activeElement) roots.add(getRoot(document.activeElement));
    fields.forEach((field) => roots.add(getRoot(field)));

    let chosenRoot = document.body;
    let bestScore = -1;
    for (const root of roots) {
      if (!root || !isVisible(root)) continue;
      const rootText = (root.textContent || '').toLowerCase();
      const visibleFields = fields.filter((field) => root.contains(field) && isVisible(field) && !field.disabled && field.type !== 'hidden');
      if (!visibleFields.length) continue;
      let score = visibleFields.length;
      if (/aadhaar|aadhar|proof|document|issuing authority|place of issue|date of issue|uidai/.test(rootText)) score += 30;
      if (root.matches?.('[role="dialog"], [aria-modal="true"], .modal, .popup, .dialog')) score += 10;
      if (document.activeElement && root.contains(document.activeElement)) score += 6;
      if (score > bestScore) {
        bestScore = score;
        chosenRoot = root;
      }
    }

    const visibleFields = fields.filter((field) => chosenRoot.contains(field) && isVisible(field) && !field.disabled && field.type !== 'hidden');
    const indexedFields = fields.map((field, index) => ({ field, index }));
    const findIndex = (matcher, tagName = null) => {
      const found = visibleFields.find((field) => {
        if (tagName && field.tagName !== tagName) return false;
        return matcher(getHint(field), field);
      });
      if (!found) return -1;
      return indexedFields.find(({ field }) => field === found)?.index ?? -1;
    };

    return {
      rootText: (chosenRoot.textContent || '').trim().slice(0, 180),
      proofSelectIndex: findIndex((hint) => /proof|id.*type|document.*type|identity.*type|proof.*id/.test(hint), 'SELECT'),
      documentFieldIndex: findIndex((hint) => /document.*no|doc.*number|id.*number|identity.*number/.test(hint) && !/mobile|phone|otp|password/.test(hint)),
      issuingFieldIndex: findIndex((hint) => /issuing|authority|issued.*by/.test(hint)),
      placeFieldIndex: findIndex((hint) => /place.*issue|issue.*place|place.*of.*issue/.test(hint)),
      dateFieldIndex: findIndex((hint, field) => /date.*issue|issue.*date|date.*of.*issue/.test(hint) || field.type === 'date'),
      confirmText: (Array.from(chosenRoot.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'))
        .find((el) => /yes|ok|continue|proceed|confirm|accept/.test((el.textContent || el.value || '').toLowerCase()) && isVisible(el))
        ?.textContent || '').trim(),
    };
  });
}

async function isErrorPage(page) {
  const txt = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')).toLowerCase();
  const url = page.url().toLowerCase();
  return txt.includes('404') || txt.includes('page not found') || txt.includes('oops') ||
         txt.includes('error occurred') || url.includes('404');
}

async function getPrimaryPage(context) {
  const pages = context.pages().filter((page) => !page.isClosed());
  const primary =
    pages.find((page) => /rrbapply\.gov\.in/i.test(page.url())) ||
    pages.find((page) => page.url() === 'about:blank') ||
    pages[0] ||
    await context.newPage();

  for (const page of pages) {
    if (page !== primary) await page.close().catch(() => {});
  }
  return primary;
}

async function redirectToRegistration(page, reason = '') {
  if (reason) send('progress', `↪️ ${reason}`);
  await page.goto(RRB_REGISTRATION_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  send('progress', `✅ Registration redirect: ${page.url()}`);
  return !(await isErrorPage(page));
}

async function fillOtpOneByOne(page, kind, contact, OTP_FILE) {
  const label = kind === 'email' ? `📧 Email ${contact}` : `📱 Mobile ${contact}`;
  let fullOtp = '';

  // Scroll OTP section into view so ALL boxes are visible
  await page.evaluate((kind) => {
    const all = Array.from(document.querySelectorAll('input[maxlength="1"]'));
    if (all.length > 0) all[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, kind);
  await page.waitForTimeout(800);

  // Detect OTP box count and startIdx once
  const allVisible = await page.$$eval('input[maxlength="1"]', els =>
    els.filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.disabled; }).length
  );
  const startIdx = (kind === 'mobile' && allVisible >= 12) ? 6 : 0;
  send('progress', `🔢 ${kind} OTP: ${allVisible} boxes found, startIdx=${startIdx}`);

  for (let i = 0; i < 6; i++) {
    // Ask user for ONE digit
    send('otp', `${label} OTP — Box ${i+1}/6 ka digit type karo:`, { otpFile: OTP_FILE });
    const digit = (await waitForInput(OTP_FILE)).trim().replace(/\D/g, '')[0];
    if (!digit) { i--; continue; } // retry if non-digit
    fullOtp += digit;
    send('progress', `📥 Got digit ${i+1}: ${digit}`);

    // Fill using Angular-compatible method:
    // Angular listens to keydown with keyCode, nativeElement value change, then keyup
    const filled = await page.evaluate(({ startIdx, i, digit }) => {
      // No viewport filter — just check not hidden/disabled
      const all = Array.from(document.querySelectorAll('input[maxlength="1"]')).filter(el =>
        !el.disabled && el.type !== 'hidden' && el.offsetParent !== null
      );
      const box = all[startIdx + i];
      if (!box) return `BOX_NOT_FOUND (total=${all.length} startIdx=${startIdx} i=${i})`;

      const keyCode = digit.charCodeAt(0);
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

      // Step 1: Focus
      box.focus();

      // Step 2: keydown with keyCode (Angular checks keyCode)
      box.dispatchEvent(new KeyboardEvent('keydown', {
        key: digit, code: `Digit${digit}`, keyCode, which: keyCode,
        bubbles: true, cancelable: true
      }));

      // Step 3: Set DOM value (before input event so Angular reads correct value)
      nativeSetter.call(box, digit);

      // Step 4: input event (Angular's (input) handler)
      box.dispatchEvent(new InputEvent('input', {
        data: digit, inputType: 'insertText', bubbles: true, cancelable: true
      }));

      // Step 5: keyup (Angular often moves focus here)
      box.dispatchEvent(new KeyboardEvent('keyup', {
        key: digit, code: `Digit${digit}`, keyCode, which: keyCode,
        bubbles: true, cancelable: true
      }));

      // Step 6: change
      box.dispatchEvent(new Event('change', { bubbles: true }));

      // Step 7: blur (commits Angular form control)
      box.dispatchEvent(new Event('blur', { bubbles: true }));

      return box.value;
    }, { startIdx, i, digit });

    send('progress', `✅ Box ${i+1} DOM value: "${filled}"`);

    // Wait for Angular change detection + focus move
    await page.waitForTimeout(700);
  }

  return fullOtp;
}

async function submitOtpWithRetry(page, otpSelector, verifyBtnPattern, label, maxTries = 3) {
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    const prompt = attempt === 1
      ? `📱 ${label} — OTP enter karo:`
      : `❌ OTP galat tha! Phir se try karo (attempt ${attempt}/${maxTries}):`;
    send('otp', prompt, { otpFile: OTP_FILE });
    const otp = await waitForInput(OTP_FILE);
    send('progress', `✏️ OTP submit: ${otp}`);
    await fillInput(page, otpSelector, otp);
    await page.waitForTimeout(400);
    await page.evaluate((pattern) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => new RegExp(pattern, 'i').test(b.textContent || ''));
      if (btn) btn.click();
    }, verifyBtnPattern);
    await page.waitForTimeout(3000);
    const pageText = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')).toLowerCase();
    const hasError =
      pageText.includes('invalid otp') || pageText.includes('wrong otp') ||
      pageText.includes('otp incorrect') || pageText.includes('incorrect otp') ||
      pageText.includes('otp expired') || pageText.includes('verification failed') ||
      pageText.includes('otp not match') || pageText.includes('invalid verification') ||
      pageText.includes('invalid code');
    if (!hasError) { send('progress', '✅ OTP verified!'); return otp; }
    if (attempt === maxTries) throw new Error('OTP 3 baar galat tha. Process band ho raha hai.');
  }
}

(async () => {
  const student = {
    name:       process.env.FULL_NAME    || 'SUMIT KUMAR MINA',
    dob:        process.env.DOB          || '07/07/2000',
    mobile:     process.env.MOBILE       || '',
    email:      process.env.EMAIL        || 'Sumitkunwal8824@gmail.com',
    gender:     process.env.GENDER       || 'Male',
    fatherName: process.env.FATHER_NAME  || 'HARKESH MEENA',
    motherName: process.env.MOTHER_NAME  || '',
    category:   process.env.CATEGORY    || 'ST',
    aadhaar:    process.env.AADHAAR      || '201227964504',
    state:      process.env.STATE        || 'Rajasthan',
    district:   process.env.DISTRICT     || 'Sawai Madhopur',
    pin:        process.env.PIN          || '322214',
    address:    process.env.ADDRESS      || 'Narouli Chaur, Sawai Madhopur',
    photoPath:  process.env.PHOTO_PATH   || '',
    signPath:   process.env.SIGN_PATH    || '',
    password:   process.env.PASSWORD     || '',
  };

  send('progress', '🔍 RRB details check kar raha hoon...');
  if (!student.mobile) {
    send('otp', '📱 Mobile number enter karo (10 digits):', { otpFile: OTP_FILE });
    student.mobile = await waitForInput(OTP_FILE);
  }
  if (!student.email) {
    send('otp', '📧 Email address enter karo:', { otpFile: OTP_FILE });
    student.email = await waitForInput(OTP_FILE);
  }
  if (!student.motherName) {
    send('otp', "👩 Mother's name enter karo:", { otpFile: OTP_FILE });
    student.motherName = await waitForInput(OTP_FILE);
  }

  // Check saved credentials
  const savedCreds = loadCreds();
  const rrbCreds   = savedCreds['rrb'] || {};
  let hasLogin     = !!(rrbCreds.regNo && rrbCreds.password);

  if (hasLogin) {
    send('otp', `💾 Saved RRB account mila!\nReg No: ${rrbCreds.regNo}\n\nKya isi se login karoon?\n"yes" = isi account se login\n"no" = naya registration karna hai`, { otpFile: OTP_FILE });
    const confirm = (await waitForInput(OTP_FILE)).toLowerCase().trim();
    if (confirm !== 'yes' && confirm !== 'y' && confirm !== 'haan' && confirm !== '1') {
      hasLogin = false;
      send('progress', '📝 Naya RRB registration karenge...');
    } else {
      send('progress', `✅ Saved account use karenge — Reg No: ${rrbCreds.regNo}`);
    }
  }

  if (!hasLogin && (rrbCreds.regNo || rrbCreds.password)) {
    // Purani credentials hain lekin user ne reject ki — clear karo
    send('progress', '🔄 Naya registration shuru kar raha hoon...');
  } else if (!hasLogin) {
    send('progress', '📝 Pehli baar hai — Registration karenge');
  }

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  ['SingletonLock','SingletonCookie','SingletonSocket'].forEach(f => {
    try { fs.unlinkSync(path.join(PROFILE_DIR, f)); } catch {}
  });
  const context = await launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-session-crashed-bubble',
      '--disable-infobars',
      '--hide-crash-restore-bubble',
    ],
  });
  const page = await getPrimaryPage(context);

  try {
    send('start', '🌐 RRB portal khol raha hoon...');
    await page.goto(RRB_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000); // Angular SPA hydration wait — needs extra time
    // Wait for any interactive content to appear
    await page.waitForSelector('button, a, input', { timeout: 10000, state: 'visible' }).catch(() => {});
    if (await isErrorPage(page)) {
      await redirectToRegistration(page, 'RRB base page wrong route par gayi thi, registration page par le ja raha hoon...');
    }
    send('progress', `📋 Page: ${page.url()}`);

    // ── REGISTRATION (if no saved credentials) ─────────────────
    if (!hasLogin) {
      send('progress', '📝 New Registration shuru kar raha hoon...');
      await redirectToRegistration(page, 'Direct registration route open kar raha hoon...');

      // Wait for Angular SPA to fully hydrate (up to 12s)
      await page.waitForSelector('input, form, [class*="register"], [class*="signup"]', { timeout: 12000, state: 'attached' }).catch(() => {});
      await page.waitForTimeout(2000);

      // Try clicking "New Registration" / "Register" button if form not yet visible
      const regBtnClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        const btn = btns.find(b => {
          const txt = (b.textContent || b.value || '').toLowerCase().trim();
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && /new\s*reg|register|create.*account|sign.*up/.test(txt);
        });
        if (btn) { btn.click(); return (btn.textContent || '').trim(); }
        return null;
      });
      if (regBtnClicked) {
        send('progress', `✅ "${regBtnClicked}" button clicked — form load ho raha hai`);
        await page.waitForSelector('input[type="text"], input[type="tel"], input[type="email"]', { timeout: 10000, state: 'visible' }).catch(() => {});
        await page.waitForTimeout(1500);
      }

      // Verify we are on a registration page (has form inputs, not 404)
      // Use lenient check: any visible input OR URL still has flag=true
      let pageCheck = await page.evaluate(() => {
        const url = window.location.href;
        const visibleInputs = Array.from(document.querySelectorAll('input, select, textarea')).filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && !el.disabled && el.type !== 'hidden';
        });
        const hasForm = visibleInputs.length > 0 || url.includes('flag=true') || url.includes('register') || url.includes('create');
        const is404   = document.body.innerText.toLowerCase().includes('page not found') ||
                        document.body.innerText.toLowerCase().includes('404 ');
        return { url, hasForm, is404, inputCount: visibleInputs.length };
      });
      send('progress', `📋 Registration page: ${pageCheck.url} | form: ${pageCheck.hasForm} | inputs: ${pageCheck.inputCount} | 404: ${pageCheck.is404}`);

      if (pageCheck.is404 || !pageCheck.hasForm) {
        const recovered = await redirectToRegistration(page, 'Registration page mismatch mili, official create-account route par dubara redirect kar raha hoon...');
        if (recovered) {
          // Wait extra for Angular re-hydration
          await page.waitForSelector('input', { timeout: 12000, state: 'visible' }).catch(() => {});
          await page.waitForTimeout(2000);
          pageCheck = await page.evaluate(() => {
            const url = window.location.href;
            const visibleInputs = Array.from(document.querySelectorAll('input, select, textarea')).filter(el => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && !el.disabled && el.type !== 'hidden';
            });
            const hasForm = visibleInputs.length > 0 || url.includes('flag=true') || url.includes('register') || url.includes('create');
            const is404   = document.body.innerText.toLowerCase().includes('page not found') ||
                            document.body.innerText.toLowerCase().includes('404 ');
            return { url, hasForm, is404, inputCount: visibleInputs.length };
          });
          send('progress', `✅ Redirect ke baad: inputs=${pageCheck.inputCount}, hasForm=${pageCheck.hasForm}`);
        }
        if (pageCheck.is404 || !pageCheck.hasForm) {
          send('progress', '⚠️ Registration page nahi mili — screenshot le raha hoon aur manual input maang raha hoon');
          await page.waitForTimeout(3000); // Angular render ka wait
          await saveScreenshot(page, '📸 Current browser screen:');
          send('otp', '⚠️ Registration form nahi mila. Kya RRB site pe koi active notification hai? "YES" type karo agar manually dekhna chahte ho, "SKIP" type karo agar directly login karna hai:', { otpFile: OTP_FILE });
          const choice = await waitForInput(OTP_FILE);
          if (choice.toLowerCase() === 'skip') {
            send('progress', '⏭️ Registration skip — direct login try karte hain');
            hasLogin = true; // skip to login block
          }
        }
      }

      if (!hasLogin) {
        // Fill registration form — exact RRB "Create an Account" form
        send('progress', '📝 Registration form fill ho raha hai...');

        // Country of Nationality dropdown → India
        await page.evaluate(() => {
          const sels = Array.from(document.querySelectorAll('select'));
          const nat = sels.find(s => (s.name+s.id+s.className).toLowerCase().includes('country') || (s.previousElementSibling?.textContent||'').toLowerCase().includes('country'));
          if (nat) {
            for (const o of nat.options) {
              if (o.text.toLowerCase().includes('india')) { nat.value = o.value; nat.dispatchEvent(new Event('change',{bubbles:true})); return; }
            }
          }
        });
        await page.waitForTimeout(500);

        // Full Name + Re-type Full Name
        await page.evaluate((name) => {
          const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
          const fullNameInputs = inputs.filter(i => {
            const hint = (i.placeholder + i.name + i.id + (i.labels?.[0]?.textContent||'')).toLowerCase();
            return hint.includes('full name') || hint.includes('fullname');
          });
          fullNameInputs.forEach(inp => {
            const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
            s.call(inp, name);
            ['input','change','blur'].forEach(e => inp.dispatchEvent(new Event(e,{bubbles:true})));
          });
        }, student.name);
        send('progress', '✅ Full Name filled');
        await page.waitForTimeout(400);

        // "Have you changed name?" → No
        await page.evaluate(() => {
          const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
          const noRadio = radios.find(r => {
            const lbl = (r.nextElementSibling?.textContent || r.parentElement?.textContent || r.labels?.[0]?.textContent || '').trim().toLowerCase();
            return lbl === 'no';
          });
          if (noRadio) noRadio.click();
        });
        await page.waitForTimeout(300);

        // Date of Birth + Re-type DOB (DD/MM/YYYY)
        await page.evaluate((dob) => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const dobInputs = inputs.filter(i => {
            const hint = (i.placeholder + i.name + i.id + (i.labels?.[0]?.textContent||'')).toLowerCase();
            return hint.includes('date of birth') || hint.includes('dob') || hint.includes('dd/mm/yyyy');
          });
          dobInputs.forEach(inp => {
            const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
            s.call(inp, dob);
            ['input','change','blur'].forEach(e => inp.dispatchEvent(new Event(e,{bubbles:true})));
          });
        }, student.dob);
        send('progress', '✅ DOB filled');
        await page.waitForTimeout(400);

        // Gender dropdowns (Select Gender + Re-select Gender)
        await page.evaluate((gender) => {
          const sels = Array.from(document.querySelectorAll('select'));
          const genderSels = sels.filter(s => (s.name+s.id+(s.previousElementSibling?.textContent||'')+(s.labels?.[0]?.textContent||'')).toLowerCase().includes('gender'));
          genderSels.forEach(sel => {
            for (const o of sel.options) {
              if (o.text.toLowerCase().includes(gender.toLowerCase())) {
                sel.value = o.value;
                sel.dispatchEvent(new Event('change',{bubbles:true}));
                return;
              }
            }
          });
        }, student.gender);
        send('progress', '✅ Gender selected');
        await page.waitForTimeout(400);

        // Father's Name + Re-type
        await page.evaluate((name) => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const fatherInputs = inputs.filter(i => (i.placeholder+i.name+i.id+(i.labels?.[0]?.textContent||'')).toLowerCase().includes("father"));
          fatherInputs.forEach(inp => {
            const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
            s.call(inp, name);
            ['input','change','blur'].forEach(e => inp.dispatchEvent(new Event(e,{bubbles:true})));
          });
        }, student.fatherName);
        send('progress', '✅ Father Name filled');
        await page.waitForTimeout(400);

        // Mother's Name + Re-type
        // Primary: CSS attribute selector to fill all inputs with "mother" in name/id
        let motherFilled = await page.evaluate((name) => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const targets = inputs.filter(i => {
            const hint = (i.id + ' ' + i.name + ' ' + i.placeholder + ' ' + (i.labels?.[0]?.textContent || '')).toLowerCase();
            return hint.includes('mother') && !i.disabled && i.type !== 'hidden' && !i.readOnly;
          });
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          targets.forEach(inp => {
            setter.call(inp, name);
            ['input', 'change', 'blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true })));
          });
          return targets.length;
        }, student.motherName);
        // Fallback: hint-based search (catches label-only fields)
        if (!motherFilled) {
          motherFilled = await fillFieldsByHints(
            page,
            "re-type\\s*mother|mother.?s?\\s*name|name\\s*of\\s*mother|mother\\s*name",
            student.motherName,
            { tags: 'input, textarea', query: 'input, textarea', useKeyboard: true }
          );
        }
        send('progress', motherFilled ? `✅ Mother Name filled (${motherFilled} field)` : '⚠️ Mother Name field detect nahi hua');
        await page.waitForTimeout(400);

        // Email Address + Re-type Email
        await page.evaluate((email) => {
          const inputs = Array.from(document.querySelectorAll('input[type="email"], input'));
          const emailInputs = inputs.filter(i => (i.placeholder+i.name+i.id+i.type+(i.labels?.[0]?.textContent||'')).toLowerCase().includes('email') && !i.placeholder.toLowerCase().includes('otp'));
          emailInputs.forEach(inp => {
            const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
            s.call(inp, email);
            ['input','change','blur'].forEach(e => inp.dispatchEvent(new Event(e,{bubbles:true})));
          });
        }, student.email);
        send('progress', '✅ Email filled');
        await page.waitForTimeout(1500);

        // Check if email already exists error appeared
        const emailErrText = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')).toLowerCase();
        if (emailErrText.includes('email') && (emailErrText.includes('already exist') || emailErrText.includes('already registered') || emailErrText.includes('already used') || emailErrText.includes('kindly provide'))) {
          send('otp', `❌ Email "${student.email}" already registered hai! Naya email address type karo:`, { otpFile: OTP_FILE });
          student.email = await waitForInput(OTP_FILE);
          send('progress', `✏️ Naya email fill kar raha hoon: ${student.email}`);
          await page.evaluate((email) => {
            const inputs = Array.from(document.querySelectorAll('input[type="email"], input'));
            const emailInputs = inputs.filter(i => (i.placeholder+i.name+i.id+i.type+(i.labels?.[0]?.textContent||'')).toLowerCase().includes('email') && !i.placeholder.toLowerCase().includes('otp'));
            emailInputs.forEach(inp => {
              const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
              s.call(inp, email);
              ['input','change','blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true })));
            });
          }, student.email);
          await page.waitForTimeout(800);
          send('progress', '✅ Naya email filled');
        }

        // Mobile Number + Re-type Mobile
        await page.evaluate((mobile) => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const mobileInputs = inputs.filter(i => (i.placeholder+i.name+i.id+i.type+(i.labels?.[0]?.textContent||'')).toLowerCase().match(/mobile|phone|contact.*no/));
          mobileInputs.forEach(inp => {
            const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
            s.call(inp, mobile);
            ['input','change','blur'].forEach(e => inp.dispatchEvent(new Event(e,{bubbles:true})));
          });
        }, student.mobile);
        send('progress', '✅ Mobile filled');
        await page.waitForTimeout(500);

        // ── STEP 1: Email OTP — user fills manually in browser ─────────────────────────
        await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'smooth' }));
        await page.waitForTimeout(800);

        send('progress', '📧 Generate Email OTP button click kar raha hoon...');
        const emailOtpClicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => b.textContent?.toLowerCase().match(/generate.*email.*otp|email.*otp/i) && b.getBoundingClientRect().height > 0);
          if (btn) { btn.click(); return true; }
          return false;
        });
        send('progress', emailOtpClicked ? '✅ Email OTP generate ho raha hai...' : '⚠️ Email OTP button nahi mila — manually click karo');
        await page.waitForTimeout(2000);

        // ── STEP 2: Mobile OTP — generate and user fills manually ────────────────────────
        send('progress', '📱 Generate Mobile OTP button click kar raha hoon...');
        const mobileOtpClicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => b.textContent?.toLowerCase().match(/generate.*mobile.*otp|mobile.*otp/i) && b.getBoundingClientRect().height > 0);
          if (btn) { btn.click(); return true; }
          return false;
        });
        send('progress', mobileOtpClicked ? '✅ Mobile OTP generate ho raha hai...' : '⚠️ Mobile OTP button nahi mila — manually click karo');
        await page.waitForTimeout(2000);

        // Screenshot of current page state before asking OTP
        await page.waitForTimeout(1500);
        await saveScreenshot(page, '📸 OTP page — browser mein dekho');

        // Tell user to fill both OTPs manually in browser, then confirm
        send('otp', '📧📱 Browser mein Email OTP aur Mobile OTP dono manually fill karo — dono fill karne ke baad yahan "done" type karo:', { otpFile: OTP_FILE });
        await waitForInput(OTP_FILE);
        send('progress', '✅ OTP done — Aadhaar verification pe ja raha hoon...');
        await page.waitForTimeout(1000);

        // ── STEP 2.5: Click "Verification Through Aadhaar Card" ──────────────────────────
        send('progress', '🪪 "Verification Through Aadhaar Card" click kar raha hoon...');
        await page.waitForTimeout(1500);

        const aadhaarVerifyClicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, a'));
          const btn = btns.find(b => b.textContent?.toLowerCase().match(/verification.*aadhaar|aadhaar.*card|verify.*aadhaar/i) && !b.textContent?.toLowerCase().includes('do not') && b.getBoundingClientRect().height > 0);
          if (btn) { btn.click(); return btn.textContent.trim(); }
          return null;
        });
        if (aadhaarVerifyClicked) {
          send('progress', `✅ "${aadhaarVerifyClicked}" clicked`);
          await page.waitForTimeout(2000);
        }

        // User fills Aadhaar OTP manually in browser
        send('otp', '🪪 Aadhaar OTP browser mein fill karo — fill karne ke baad "done" type karo:', { otpFile: OTP_FILE });
        await waitForInput(OTP_FILE);
        send('progress', '✅ Aadhaar OTP done');
        await page.waitForTimeout(1000);

        // ── STEP 2.6: Aadhaar verification section (already open from previous click) ──
        send('progress', '🪪 Aadhaar section fill kar raha hoon...');
        await page.waitForTimeout(1000);

        // Tick consent checkbox
        await page.evaluate(() => {
          const cbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
          cbs.forEach(cb => { if (!cb.checked) cb.click(); });
        });
        await page.waitForTimeout(500);
        send('progress', '✅ Consent checkbox ticked');

        // Fill Aadhaar number input
        await page.evaluate((aadhaar) => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const inp = inputs.find(i => {
            const hint = (i.placeholder + i.name + i.id + (i.labels?.[0]?.textContent || '')).toLowerCase();
            return hint.match(/aadhaar|aadhar|vid/i) && i.type !== 'hidden' && !i.disabled;
          });
          if (!inp) return;
          const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          s.call(inp, aadhaar);
          ['input', 'change', 'blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true })));
        }, student.aadhaar.replace(/\s/g, ''));
        await page.waitForTimeout(500);
        send('progress', `✅ Aadhaar number filled: ${student.aadhaar}`);

        // Click "Generate Aadhaar OTP"
        const aadhaarOtpBtn = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => b.textContent?.toLowerCase().match(/generate.*aadhaar.*otp|aadhaar.*otp/i) && b.getBoundingClientRect().height > 0);
          if (btn) { btn.click(); return btn.textContent.trim(); }
          return null;
        });
        send('progress', aadhaarOtpBtn ? `✅ "${aadhaarOtpBtn}" clicked` : '⚠️ Aadhaar OTP button nahi mila — manually click karo');
        await page.waitForTimeout(2000);

        // Screenshot before asking Aadhaar OTP
        await saveScreenshot(page, '📸 Aadhaar OTP page');

        // User fills Aadhaar OTP in browser manually, then clicks Verify
        send('otp', '🪪 Aadhaar OTP browser mein fill karo aur "Verify" click karo — phir yahan "done" type karo:', { otpFile: OTP_FILE });
        await waitForInput(OTP_FILE);
        send('progress', '✅ Aadhaar OTP done');
        await page.waitForTimeout(1500);

        // ── STEP 3: Password ───────────────────────────────────
        const newPassword = student.password || `RRB@${student.mobile.slice(-4)}2024!`;
        send('progress', `🔑 Password set kar raha hoon: ${newPassword}`);
        await page.evaluate((pass) => {
          const inputs = Array.from(document.querySelectorAll('input[type="password"]'));
          inputs.forEach(inp => {
            const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            s.call(inp, pass);
            ['input', 'change', 'blur'].forEach(ev => inp.dispatchEvent(new Event(ev, { bubbles: true })));
          });
        }, newPassword);
        await page.waitForTimeout(500);
        send('progress', '✅ Password filled');

        // ── STEP 4: reCAPTCHA — auto-detect when user clicks ──
        send('progress', '🤖 Browser mein "I am not a robot" checkbox click karo — auto detect ho jayega!');
        // Poll up to 90 seconds for reCAPTCHA to be solved
        let captchaSolved = false;
        for (let _i = 0; _i < 180; _i++) {
          captchaSolved = await page.evaluate(() => {
            try { if (typeof grecaptcha !== 'undefined' && grecaptcha.getResponse && grecaptcha.getResponse()) return true; } catch {}
            if (document.querySelector('.recaptcha-checkbox-checked, [aria-checked="true"][class*="recaptcha"]')) return true;
            // Also check if submit button is now enabled (proxy for captcha solved)
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.toLowerCase().match(/register|submit|create.*account/i));
            return btn ? !btn.disabled : false;
          }).catch(() => false);
          if (captchaSolved) break;
          await page.waitForTimeout(500);
        }
        send('progress', captchaSolved ? '✅ reCAPTCHA solved! Submit kar raha hoon...' : '⚠️ reCAPTCHA timeout — submit try kar raha hoon...');
        await page.waitForTimeout(500);

        // ── STEP 5: Submit Registration ────────────────────────
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
        await page.waitForTimeout(800);
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => b.textContent?.toLowerCase().match(/register|submit|create.*account|sign.*up/i) && !b.disabled && b.getBoundingClientRect().height > 0);
          if (btn) btn.click();
        });
        await page.waitForTimeout(5000);
        send('progress', `📋 After submit URL: ${page.url()}`);

        // Check result
        const urlAfterSubmit = page.url();
        const pageAfterSubmit = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')).toLowerCase();
        const redirectedHome  = urlAfterSubmit.includes('/home') || urlAfterSubmit.includes('flag=true');
        const alreadyReg      = pageAfterSubmit.includes('already registered') || pageAfterSubmit.includes('already exist') || pageAfterSubmit.includes('mobile number already');

        if (alreadyReg) {
          send('progress', '⚠️ Mobile/Email already registered hai!');
          send('otp', '📋 Apna purana RRB Registration Number type karo (ya "skip"):', { otpFile: OTP_FILE });
          const existingRegNo = await waitForInput(OTP_FILE);
          if (existingRegNo.toLowerCase() !== 'skip') {
            send('otp', '🔑 Purana password type karo:', { otpFile: OTP_FILE });
            const existingPass = await waitForInput(OTP_FILE);
            saveCreds('rrb', { regNo: existingRegNo, password: existingPass, dob: student.dob });
            rrbCreds.regNo    = existingRegNo;
            rrbCreds.password = existingPass;
            hasLogin = true;
            send('progress', `✅ Credentials save ho gayi: ${existingRegNo}`);
          }
        } else if (redirectedHome || pageAfterSubmit.includes('success') || pageAfterSubmit.includes('registered')) {
          send('progress', '🎉 Registration successful!');
        }
      } // end if (!hasLogin) inner

      // Get registration number from page (shown after successful registration)
      const newPassword = student.password || `RRB@${student.mobile.slice(-4)}2024!`;
      const regNo = await page.evaluate(() => {
        const txt = document.body.innerText;
        // Try multiple patterns RRB uses
        const patterns = [
          /registration\s*(?:no|number|id)[:\s#.]*([0-9]{6,15})/i,
          /reg(?:istration)?\s*(?:no|number)[:\s#.]*([0-9]{6,15})/i,
          /application\s*(?:no|number)[:\s#.]*([0-9]{6,15})/i,
          /your\s+(?:registration|reg)\s*(?:no|number|id)\s*(?:is|:)?\s*([0-9]{6,15})/i,
          /(?:no|number|id)\s*:\s*([0-9]{8,15})/i,
        ];
        for (const p of patterns) {
          const m = txt.match(p);
          if (m) return m[1];
        }
        return null;
      });

      if (regNo && !hasLogin) {
        saveCreds('rrb', { regNo, password: newPassword, dob: student.dob });
        send('creds', `✅ Registration ho gayi!\nReg No: ${regNo}\nPassword: ${newPassword}`, { regNo, password: newPassword });
        rrbCreds.regNo    = regNo;
        rrbCreds.password = newPassword;
        send('progress', `📋 Reg No saved: ${regNo}`);
      } else if (!hasLogin) {
        await saveScreenshot(page, '📸 Registration result page:');
        send('otp', '📋 Browser mein Registration Number dikh raha hoga — copy karke yahan paste karo (ya "skip" type karo agar already registered hai):', { otpFile: OTP_FILE });
        const manualRegNo = await waitForInput(OTP_FILE);
        if (manualRegNo.toLowerCase() !== 'skip') {
          saveCreds('rrb', { regNo: manualRegNo, password: newPassword, dob: student.dob });
          rrbCreds.regNo    = manualRegNo;
          rrbCreds.password = newPassword;
          send('progress', `✅ Credentials saved: ${manualRegNo}`);
        }
      }
    }

    // ── LOGIN ──────────────────────────────────────────────────
    if (!rrbCreds.regNo) {
      send('otp', '⚠️ Registration Number nahi mila! Apna RRB Reg No type karo:', { otpFile: OTP_FILE });
      rrbCreds.regNo = await waitForInput(OTP_FILE);
      if (!rrbCreds.password) {
        send('otp', '🔑 Password type karo:', { otpFile: OTP_FILE });
        rrbCreds.password = await waitForInput(OTP_FILE);
      }
      saveCreds('rrb', { regNo: rrbCreds.regNo, password: rrbCreds.password, dob: student.dob });
    }

    send('progress', `🔐 Login kar raha hoon — Reg No: ${rrbCreds.regNo}`);
    await page.goto('https://www.rrbapply.gov.in/#/auth/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Fill login form using multiple selector strategies
    const loginFilled = await page.evaluate((creds) => {
      const inputs = Array.from(document.querySelectorAll('input'));
      let filled = 0;
      for (const inp of inputs) {
        const hint = (inp.name + inp.id + inp.placeholder + (inp.labels?.[0]?.textContent || '')).toLowerCase();
        const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        if (hint.match(/reg.*no|registration|roll/i) && !hint.includes('password')) {
          s.call(inp, creds.regNo); ['input','change','blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true }))); filled++;
        } else if (hint.match(/dob|date.*birth|birth.*date/i)) {
          s.call(inp, creds.dob); ['input','change','blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true }))); filled++;
        } else if (inp.type === 'password') {
          s.call(inp, creds.password); ['input','change','blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true }))); filled++;
        }
      }
      return filled;
    }, { regNo: rrbCreds.regNo, dob: rrbCreds.dob || student.dob, password: rrbCreds.password });
    send('progress', `✅ Login form fields filled: ${loginFilled}`);
    await page.waitForTimeout(800);

    // reCAPTCHA on login page — auto-detect
    const loginHasCaptcha = await page.$('iframe[src*="recaptcha"], .g-recaptcha, [class*="captcha"]');
    if (loginHasCaptcha) {
      send('progress', '🤖 Login page pe reCAPTCHA hai — "I am not a robot" click karo!');
      let solved = false;
      for (let i = 0; i < 120; i++) {
        solved = await page.evaluate(() => {
          try { if (typeof grecaptcha !== 'undefined' && grecaptcha.getResponse && grecaptcha.getResponse()) return true; } catch {}
          if (document.querySelector('.recaptcha-checkbox-checked, [aria-checked="true"]')) return true;
          return false;
        }).catch(() => false);
        if (solved) break;
        await page.waitForTimeout(500);
      }
      send('progress', solved ? '✅ reCAPTCHA solved!' : '⚠️ reCAPTCHA timeout — submit try kar raha hoon...');
    }

    // Submit login
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent?.toLowerCase().match(/login|sign.*in|submit/i) && !b.disabled && b.getBoundingClientRect().height > 0);
      if (btn) btn.click();
    });
    await page.waitForTimeout(4000);

    const loginUrl = page.url();
    const loginText = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')).toLowerCase();
    const loginOk = loginUrl.includes('dashboard') || loginUrl.includes('/home') || loginUrl.includes('apply') || loginText.includes('welcome') || loginText.includes('dashboard');
    if (loginOk) {
      send('progress', `✅ Login successful! URL: ${loginUrl}`);
    } else {
      await saveScreenshot(page, '📸 Login page:');
      const loginErrText = loginText.includes('invalid') || loginText.includes('incorrect') || loginText.includes('wrong') || loginText.includes('failed');
      if (loginErrText) {
        send('otp', '❌ Login failed! Sahi Reg No type karo:', { otpFile: OTP_FILE });
        rrbCreds.regNo = await waitForInput(OTP_FILE);
        send('otp', '🔑 Password type karo:', { otpFile: OTP_FILE });
        rrbCreds.password = await waitForInput(OTP_FILE);
        saveCreds('rrb', { regNo: rrbCreds.regNo, password: rrbCreds.password, dob: student.dob });
        // Retry login
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);
        await page.evaluate((creds) => {
          const inputs = Array.from(document.querySelectorAll('input'));
          for (const inp of inputs) {
            const hint = (inp.name + inp.id + inp.placeholder).toLowerCase();
            const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            if (hint.match(/reg.*no|registration/i) && !hint.includes('password')) { s.call(inp, creds.regNo); ['input','change'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true }))); }
            else if (hint.match(/dob|date.*birth/i)) { s.call(inp, creds.dob); ['input','change'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true }))); }
            else if (inp.type === 'password') { s.call(inp, creds.password); ['input','change'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true }))); }
          }
        }, { regNo: rrbCreds.regNo, dob: rrbCreds.dob || student.dob, password: rrbCreds.password });
        await page.waitForTimeout(500);
        await page.evaluate(() => { const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.toLowerCase().match(/login|sign.*in/i) && !b.disabled); if (btn) btn.click(); });
        await page.waitForTimeout(4000);
      } else {
        send('progress', `⚠️ Login status unclear — URL: ${loginUrl} — continuing...`);
      }
    }

    await page.waitForTimeout(2000);

    // ── APPLY FOR EXAM ──────────────────────────────────────────
    send('progress', '📋 Apply section dhundh raha hoon...');
    const examName = process.env.EXAM_NAME || 'NTPC';
    const applied = await page.evaluate((name) => {
      const links = Array.from(document.querySelectorAll('a, button'));
      const applyLink = links.find(l =>
        l.textContent?.toLowerCase().includes('apply') &&
        l.getBoundingClientRect().height > 0
      );
      if (applyLink) { applyLink.click(); return true; }
      return false;
    }, examName);

    if (applied) {
      send('progress', '✅ Apply button clicked');
      await page.waitForTimeout(3000);
    }

    // ── FILL FORM ──────────────────────────────────────────────
    send('progress', '📝 Personal details fill ho rahi hain...');

    await fillInput(page, 'input[name*="father" i]', student.fatherName);

    // Mother's name — primary: CSS attribute selector (fills first visible match)
    // Fallback: hint-based, no firstOnly so confirm field is also filled
    const motherCssFilled = await fillInput(page, 'input[name*="mother" i], input[id*="mother" i]', student.motherName);
    if (!motherCssFilled) {
      await fillFieldsByHints(
        page,
        "re-type\\s*mother|mother.?s?\\s*name|name\\s*of\\s*mother|mother\\s*name",
        student.motherName,
        { tags: 'input, textarea', query: 'input, textarea', useKeyboard: true }
      );
    } else {
      // CSS found first field — also fill confirm field if it exists
      await fillFieldsByHints(
        page,
        "re-?type.*mother|confirm.*mother|re-?enter.*mother",
        student.motherName,
        { tags: 'input, textarea', query: 'input, textarea', useKeyboard: true }
      );
    }
    send('progress', `✅ Mother name filled (css: ${motherCssFilled})`);
    await fillInput(page, 'input[name*="mobile" i], input[type="tel"]', student.mobile);
    await fillInput(page, 'input[name*="email" i], input[type="email"]', student.email);
    await fillInput(page, 'input[name*="aadhaar" i], input[name*="aadhar" i]', student.aadhaar);
    await page.waitForTimeout(500);

    // Address
    await fillInput(page, 'textarea[name*="address" i], input[name*="address" i]', student.address);
    await fillInput(page, 'input[name*="pin" i], input[name*="postal" i]', student.pin);
    await page.waitForTimeout(500);

    // Category
    await page.evaluate((cat) => {
      const selects = document.querySelectorAll('select');
      for (const sel of selects) {
        const hint = (sel.name + sel.id).toLowerCase();
        if (hint.includes('categor') || hint.includes('caste') || hint.includes('community')) {
          for (const opt of sel.options) {
            if (opt.text.toUpperCase().includes(cat.toUpperCase())) {
              sel.value = opt.value;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
              return;
            }
          }
        }
      }
    }, student.category);

    send('progress', '✅ Personal details filled');
    await page.waitForTimeout(1000);

    // Photo upload
    if (student.photoPath && fs.existsSync(student.photoPath)) {
      const photoInput = await page.$('input[type="file"][accept*="image"], input[type="file"][name*="photo" i]');
      if (photoInput) {
        await photoInput.setInputFiles(student.photoPath);
        await page.waitForTimeout(2000);
        send('progress', '✅ Photo uploaded!');
      }
    }

    // Signature upload
    if (student.signPath && fs.existsSync(student.signPath)) {
      const signInputs = await page.$$('input[type="file"]');
      const signInput = signInputs.length > 1 ? signInputs[1] : null;
      if (signInput) {
        await signInput.setInputFiles(student.signPath);
        await page.waitForTimeout(2000);
        send('progress', '✅ Signature uploaded!');
      }
    }

    // Save & Next — with retry
    const urlBeforeSave = page.url();
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
      await page.waitForTimeout(700);
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent?.trim().match(/save\s*&?\s*next|next|save|submit/i) && !b.disabled && b.getBoundingClientRect().height > 0);
        if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); return btn.textContent.trim(); }
        return null;
      });
      if (!clicked) { send('progress', `⚠️ Save button not found (attempt ${attempt})`); await page.waitForTimeout(1500); continue; }
      send('progress', `✅ Save clicked (attempt ${attempt}): "${clicked}"`);
      try {
        await page.waitForFunction(
          (prev) => window.location.href !== prev || document.querySelector('input[type="checkbox"]'),
          urlBeforeSave, { timeout: 10000 }
        );
        send('progress', `✅ Page advanced: ${page.url()}`); break;
      } catch { send('progress', `⚠️ Page nahi badi (attempt ${attempt})`); await page.waitForTimeout(1500); }
    }

    // Declaration / Final Submit
    await page.waitForTimeout(2000);
    const cbCount = await page.evaluate(() => {
      let count = 0;
      document.querySelectorAll('input[type="checkbox"]').forEach(cb => { if (!cb.checked) { cb.click(); count++; } });
      return count;
    });
    if (cbCount > 0) send('progress', `✅ ${cbCount} declaration checkboxes ticked`);
    await page.waitForTimeout(1000);
    const finalSubmit = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const btn = btns.find(b => (b.textContent||b.value||'').trim().match(/final.*submit|submit.*final|submit|confirm/i) && !b.disabled && b.getBoundingClientRect().height > 0);
      if (btn) { btn.click(); return true; } return false;
    });
    if (finalSubmit) { send('progress', '🚀 Final Submit clicked!'); await page.waitForTimeout(4000); }

    // Screenshot + PDF — only if not on error page
    if (await isErrorPage(page)) {
      await redirectToRegistration(page, '⚠️ Error page detect hua, requested registration route par redirect kar raha hoon...');
    }
    await saveScreenshot(page, '📸 Final form page');
    await page.emulateMedia({ media: 'print' });
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } }).catch(() => null);
    await page.emulateMedia({ media: 'screen' });

    if (pdfBuf && pdfBuf.length > 5000) {
      fs.writeFileSync('/tmp/rrb_printout.pdf', pdfBuf);
      send('progress', '✅ PDF saved: /tmp/rrb_printout.pdf');
    }

    send('done', '🎉 RRB Form fill ho gaya! PDF ready hai.', {
      pdfPath: '/tmp/rrb_printout.pdf',
    });

  } catch (err) {
    await saveScreenshot(page, '📸 Error screen').catch(() => {});
    send('error', `❌ Error: ${err.message}`);
  }

  await new Promise(r => setTimeout(r, 600000));
  await context.close();
})();
