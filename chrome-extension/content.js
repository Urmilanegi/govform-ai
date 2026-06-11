// GovForm AI — Content Script
// Auto-fill engine for Indian government portals + localhost handoff bridge

(function () {
  if (window.__govformInjected) return;
  window.__govformInjected = true;

  const FIELD_DEFS = [
    { key: 'fullName', hints: ['full name', 'fullname', 'candidate name', 'applicant name', 'name of candidate', 'your name', 'applicant_name', 'candidatename', 'txtname', 'txtfullname', 'txtcandidatename', 'txtapplicantname', 'पूरा नाम'] },
    { key: 'fatherName', hints: ["father's name", 'father name', 'fathername', 'father_name', 'txtfather', 'fathersname', 'name of father', 'पिता का नाम'] },
    { key: 'motherName', hints: ["mother's name", 'mother name', 'mothername', 'mother_name', 'txtmother', 'माता का नाम'] },
    { key: 'dateOfBirth', hints: ['date of birth', 'dob', 'birth date', 'dateofbirth', 'txtdob', 'txtbirthdate', 'जन्म तिथि', 'dd/mm/yyyy'] },
    { key: 'gender', hints: ['gender', 'sex', 'लिंग'] },
    { key: 'category', hints: ['category', 'caste', 'social category', 'caste_category', 'castecategory', 'वर्ग', 'जाति'] },
    { key: 'nationality', hints: ['nationality', 'राष्ट्रीयता'] },
    { key: 'religion', hints: ['religion', 'धर्म'] },
    { key: 'maritalStatus', hints: ['marital', 'married', 'maritalstatus', 'वैवाहिक'] },
    { key: 'mobileNumber', hints: ['mobile', 'phone', 'contact no', 'mobileno', 'mobile_no', 'phone_no', 'txmobile', 'txtmobile', 'txtphone', 'मोबाइल'] },
    { key: 'email', hints: ['email', 'e-mail', 'email_id', 'emailid', 'txtemail', 'ईमेल'] },
    { key: 'permanentAddress', hints: ['permanent address', 'address', 'house no', 'street', 'permanentaddress', 'txtaddress', 'पता'] },
    { key: 'correspondenceAddress', hints: ['correspondence address', 'mailing address', 'communication address'] },
    { key: 'pinCode', hints: ['pin', 'pincode', 'postal', 'zip', 'txtpin', 'txtpincode', 'पिन कोड'] },
    { key: 'state', hints: ['state', 'province', 'ddlstate', 'txtstate', 'राज्य'] },
    { key: 'district', hints: ['district', 'ddldistrict', 'txtdistrict', 'जिला'] },
    { key: 'identificationMark', hints: ['identification mark', 'visible identification mark', 'identificationmark', 'visible mark', 'identification'] },
    { key: 'aadhaarNumber', hints: ['aadhaar', 'aadhar', 'uid', 'txtaadhaar', 'txtaadhar', 'आधार'] },
    { key: 'aadhaarVid', hints: ['vid', 'virtual id', 'virtual identification number'] },
    { key: 'panNumber', hints: ['pan', 'pan number', 'panno', 'txtpan', 'पैन'] },
    { key: 'class10School', hints: ['10th school', 'matric school', 'school name 10', 'school 10'] },
    { key: 'class10Board', hints: ['10th board', 'matric board', '10 board', 'ssc board', 'board_10', '10thboard'] },
    { key: 'class10RollNumber', hints: ['10th roll number', 'matric roll number', 'roll no 10', 'matric roll no'] },
    { key: 'class10Year', hints: ['10th year', 'matric year', 'passing year 10', '10th passing', 'year_10'] },
    { key: 'class10Percentage', hints: ['10th percentage', 'matric percentage', '10th marks', 'percentage_10', '10th%'] },
    { key: 'class12School', hints: ['12th school', 'inter school', 'school name 12', 'school 12'] },
    { key: 'class12Board', hints: ['12th board', 'inter board', '12 board', 'hsc board', 'board_12', '12thboard'] },
    { key: 'class12Year', hints: ['12th year', 'inter year', 'passing year 12', '12th passing', 'year_12'] },
    { key: 'class12Percentage', hints: ['12th percentage', 'inter percentage', '12th marks', 'percentage_12', '12th%'] },
    { key: 'graduationDegree', hints: ['degree', 'graduation degree', 'ug degree', 'graduate degree'] },
    { key: 'graduationCollege', hints: ['college name', 'graduation college', 'college', 'institute name'] },
    { key: 'graduationUniversity', hints: ['university', 'college', 'institution', 'graduationuniversity', 'txtuniversity'] },
    { key: 'graduationYear', hints: ['graduation year', 'passing year', 'ug year', 'grad year'] },
    { key: 'graduationPercentage', hints: ['graduation percentage', 'ug percentage', 'grad %', 'graduation%'] },
    { key: 'highestQualification', hints: ['highest qualification', 'highest education', 'education qualification', 'qualification level'] },
    { key: 'pwdCategory', hints: ['disability', 'pwd', 'benchmark disability', 'disability category'] },
    { key: 'exServiceman', hints: ['ex serviceman', 'ex-serviceman', 'armed forces', 'serving in armed forces'] },
    { key: 'height', hints: ['height', 'height in cm'] },
    { key: 'weight', hints: ['weight', 'weight in kg'] },
    { key: 'bankName', hints: ['bank name', 'bankname', 'txtbank', 'बैंक'] },
    { key: 'accountNumber', hints: ['account number', 'acc no', 'accountno', 'accountnumber', 'txtaccount', 'खाता'] },
    { key: 'ifscCode', hints: ['ifsc', 'ifsccode', 'txtifsc', 'आईएफएससी'] },
    { key: 'domicileState', hints: ['domicile', 'domicile state', 'mool niwas', 'txdomicile'] },
  ];

  const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
  const STORAGE_KEYS = [
    'govform_profile',
    'govform_portal',
    'govform_credentials',
    'govform_filled_form',
    'govform_auto_active',
  ];
  const WINDOW_CONTEXT_PREFIX = 'govform-context=';

  let lastSeenUrl = window.location.href;
  let lastAutomationAt = 0;
  let lastToastKey = '';
  let lastLoginSubmitKey = '';
  let observerStarted = false;
  let browserContextFetchInFlight = false;
  let sscIdentityPreference = '';
  let sscOtpRequestedAt = 0;
  let sscFreezeAutomationUntil = 0;
  let sscPersonalDetailsAutoFilled = false;
  const actionHistory = new Set();
  const completedFieldKeys = new Set();

  function isLocalHost() {
    return LOCAL_HOSTS.has(window.location.hostname);
  }

  function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function normalizeLooseText(value) {
    return normalizeText(value).replace(/[^a-z0-9\u0900-\u097f]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function getAllInputs(options = {}) {
    const { includePassword = false } = options;
    return Array.from(document.querySelectorAll('input, select, textarea')).filter((el) => {
      const type = normalizeText(el.getAttribute('type'));
      if (el.disabled || el.readOnly) return false;
      if (['hidden', 'submit', 'button', 'file', 'image', 'reset'].includes(type)) return false;
      if (!includePassword && type === 'password') return false;
      return true;
    });
  }

  function getElementLabelledByText(el) {
    const ids = String(el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
    if (!ids.length) return '';

    return ids
      .map((id) => document.getElementById(id)?.textContent || '')
      .join(' ');
  }

  function getLabelText(el) {
    let label = '';

    if (el.id) {
      const byFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (byFor) label += ` ${byFor.textContent || ''}`;
    }

    const parentLabel = el.closest('label');
    if (parentLabel) label += ` ${parentLabel.textContent || ''}`;

    const parentTd = el.closest('td');
    if (parentTd?.previousElementSibling) label += ` ${parentTd.previousElementSibling.textContent || ''}`;

    if (el.getAttribute('aria-label')) label += ` ${el.getAttribute('aria-label')}`;
    if (el.getAttribute('aria-labelledby')) label += ` ${getElementLabelledByText(el)}`;
    if (el.getAttribute('title')) label += ` ${el.getAttribute('title')}`;
    if (el.placeholder) label += ` ${el.placeholder}`;

    const fieldContainer = el.closest('mat-form-field, .mat-mdc-form-field, .mat-form-field, .form-group, .field, .input-group, .row, .col, td, div');
    if (fieldContainer) {
      const containerLabel = fieldContainer.querySelector('mat-label, .mat-mdc-floating-label, .mat-form-field-label, label, .form-label');
      if (containerLabel) label += ` ${containerLabel.textContent || ''}`;
    }

    return normalizeText(label);
  }

  function getElementText(el) {
    const name = normalizeText(el.name);
    const id = normalizeText(el.id);
    const placeholder = normalizeText(el.placeholder);
    const label = getLabelText(el);
    const autoComplete = normalizeText(el.getAttribute('autocomplete'));
    const formControlName = normalizeText(el.getAttribute('formcontrolname'));
    const ngName = normalizeText(el.getAttribute('ng-reflect-name'));
    const dataName = normalizeText(el.getAttribute('data-name'));
    const textContent = normalizeText(el.textContent);
    return normalizeText(`${name} ${id} ${placeholder} ${label} ${autoComplete} ${formControlName} ${ngName} ${dataName} ${textContent}`);
  }

  function getFieldScopeText(el) {
    if (!el) return '';

    const scopedContainer = el.closest('mat-form-field, .mat-mdc-form-field, .mat-form-field, .form-group, .field, .input-group, .col-12, .col-sm-12, .col-md-6, .col-md-12, .col-lg-12, .col-xl-12, .col-xxl-12, td');
    const fallbackContainer = el.parentElement;
    const container = scopedContainer || fallbackContainer;
    if (!container) {
      return getElementText(el);
    }

    const ownText = getElementText(el);
    const containerText = normalizeText(container.textContent || '');
    return normalizeText(`${ownText} ${containerText}`);
  }

  function descriptorMatchesVerifyMode(descriptor, options = {}) {
    const { requireVerify = false, avoidVerify = false } = options;
    const looseDescriptor = normalizeLooseText(descriptor);
    const hasVerifyToken = /\bverify\b/.test(looseDescriptor);

    if (requireVerify) {
      return hasVerifyToken;
    }

    if (avoidVerify && hasVerifyToken) {
      return false;
    }

    return true;
  }

  function resolveClickableCustomSelect(el) {
    if (!el) return null;
    if (el.matches('[role="combobox"], .mat-mdc-select-trigger, .mat-select-trigger, .ng-select-container, .ng-value-container, .value-area')) {
      return el;
    }

    return el.querySelector('[role="combobox"], .mat-mdc-select-trigger, .mat-select-trigger, .ng-select-container, .ng-value-container, .value-area')
      || el;
  }

  function getAllCustomSelects() {
    const seen = new Set();
    const controls = [];

    for (const el of document.querySelectorAll('[role="combobox"], .mat-mdc-select-trigger, .mat-select-trigger, .ng-select-container, .ng-value-container, .value-area, app-dropdown')) {
      if (el.matches('input, select, textarea')) continue;

      const resolved = resolveClickableCustomSelect(el);
      if (!resolved || !isVisibleElement(resolved) || seen.has(resolved)) continue;

      seen.add(resolved);
      controls.push(resolved);
    }

    return controls;
  }

  function scoreMatch(el, hints) {
    const haystack = getElementText(el);
    const looseHaystack = normalizeLooseText(haystack);
    let score = 0;

    for (const hint of hints) {
      const normalizedHint = normalizeText(hint);
      const looseHint = normalizeLooseText(hint);
      if (!normalizedHint) continue;
      if (haystack.includes(normalizedHint) || (looseHint && looseHaystack.includes(looseHint))) {
        score += normalizedHint.split(' ').length;
      }
    }

    return score;
  }

  function clickElement(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.click();
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function setTextLikeValue(el, value) {
    const tag = el.tagName.toLowerCase();
    const proto = tag === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

    if (nativeSetter) {
      nativeSetter.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  async function typeTextLikeHuman(el, value) {
    const tag = el.tagName.toLowerCase();
    const proto = tag === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    const setNativeValue = (nextValue) => {
      if (nativeSetter) {
        nativeSetter.call(el, nextValue);
      } else {
        el.value = nextValue;
      }
    };

    el.focus();
    clickElement(el);
    await wait(40);

    setNativeValue('');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(40);

    let typedValue = '';
    for (const ch of String(value || '')) {
      typedValue += ch;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keypress', { key: ch, bubbles: true }));
      setNativeValue(typedValue);

      try {
        el.dispatchEvent(new InputEvent('input', {
          data: ch,
          inputType: 'insertText',
          bubbles: true,
        }));
      } catch {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      el.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true }));
      await wait(35);
    }

    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  }

  function formatValueForInput(el, value) {
    const type = normalizeText(el.getAttribute('type'));
    const fieldText = getElementText(el);
    const digits = digitsOnly(value);

    if (/\bvid\b|virtual id/.test(fieldText) && digits.length >= 16) {
      return digits.slice(0, 16);
    }

    if (/aadhaar|aadhar|uid/.test(fieldText) && digits.length >= 12) {
      return digits.slice(0, 12);
    }

    if (/mobile|phone|contact no/.test(fieldText) && digits.length >= 10) {
      return digits.slice(0, 10);
    }

    if (/pin|pincode|postal|zip/.test(fieldText) && digits.length >= 6) {
      return digits.slice(0, 6);
    }

    if (type !== 'date') return value;

    const normalized = String(value || '').trim();
    const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return value;

    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  function markAsFilled(el, color = '#22c55e') {
    el.dataset.govformFilled = '1';
    el.style.outline = `2px solid ${color}`;
    el.style.outlineOffset = '2px';
  }

  function isSscAadhaarStep() {
    if (!isSscPortalPage()) return false;

    const path = currentPath();
    const text = pageText();
    if (!/one-time-registration\/personal-details/.test(path)
      && !(/one time registration/.test(text) && /aadhaar card/.test(text) && /uid\/vid/.test(text))) {
      return false;
    }

    const otpButtonVisible = Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .some((el) => isVisibleElement(el) && /send otp|resend otp/.test(normalizeText(el.textContent || el.getAttribute('aria-label'))));
    const otpFieldVisible = Boolean(document.querySelector('input[name*="otp" i], input[id*="otp" i], input[autocomplete="one-time-code"]'));
    const aadhaarPromptsVisible = /enter your aadhaar details/.test(text) && /verify aadhaar details/.test(text);

    return aadhaarPromptsVisible && (otpButtonVisible || otpFieldVisible);
  }

  function hasSscAadhaarValidationError() {
    const text = pageText();
    return /aadhaar number is not valid|aadhar number is not valid|uid\/vid is not valid|invalid aadhaar|invalid aadhar|invalid vid number in input|invalid uid number in input|invalid uid\/vid/.test(text);
  }

  function getSscAadhaarValidationState() {
    const text = pageText();
    return {
      invalidUid: /invalid uid number in input|aadhaar number is not valid|aadhar number is not valid|invalid aadhaar|invalid aadhar/.test(text),
      invalidVid: /invalid vid number in input/.test(text),
      mismatch: /aadhaar number is not matching|aadhar number is not matching|uid\/vid.*not matching/.test(text),
    };
  }

  function dismissVisibleErrorDialog() {
    const closeAction = Array.from(document.querySelectorAll('button, [role="button"], span, div'))
      .find((el) => {
        if (!isVisibleElement(el)) return false;
        const text = normalizeText(el.textContent || el.getAttribute('aria-label'));
        return text === 'x' || text === 'close' || text === 'ok';
      });

    if (closeAction) {
      clickElement(closeAction);
    }
  }

  function isSscOtpFieldVisible() {
    return Boolean(document.querySelector('input[name*="otp" i], input[id*="otp" i], input[autocomplete="one-time-code"]'));
  }

  function hasFormattedFieldValue(el, value) {
    const formatted = formatValueForInput(el, value);
    return normalizeLooseText(el.value || '') === normalizeLooseText(formatted);
  }

  function setCheckboxChecked(el) {
    if (!el) return false;

    const clickable = el.closest('label, .mat-mdc-checkbox, .checkbox, .form-check, div') || el;
    clickElement(clickable);

    if (el.checked) {
      return true;
    }

    el.checked = true;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.checked;
  }

  async function syncSscAadhaarInputs(aadhaarInputs, identity) {
    let localFilled = 0;
    const localLog = [];
    const nextValue = String(identity?.value || '').trim();

    if (!nextValue) {
      return { filled: 0, log: [] };
    }

    for (const el of aadhaarInputs) {
      if (hasFormattedFieldValue(el, nextValue)) {
        markAsFilled(el);
        continue;
      }

      await typeTextLikeHuman(el, nextValue);
      if (!hasFormattedFieldValue(el, nextValue)) {
        setTextLikeValue(el, nextValue);
      }

      markAsFilled(el);
      localFilled += 1;
      localLog.push({ field: identity.label, value: nextValue, element: el.name || el.id || el.tagName });
      await wait(120);
    }

    document.body.click();
    await wait(350);
    return {
      filled: localFilled,
      log: localLog,
    };
  }

  async function maybeHandleSscAadhaarStep(profile) {
    if (!isSscAadhaarStep()) {
      return { filled: 0, log: [] };
    }

    const aadhaarDigits = digitsOnly(profile?.aadhaarNumber);
    const vidDigits = digitsOnly(profile?.aadhaarVid);
    const identityOptions = [];
    if (aadhaarDigits.length >= 12) {
      identityOptions.push({ label: 'aadhaarNumber', value: aadhaarDigits.slice(0, 12) });
    }

    if (vidDigits.length >= 16) {
      identityOptions.push({ label: 'aadhaarVid', value: vidDigits.slice(0, 16) });
    }

    if (!identityOptions.length) {
      return { filled: 0, log: [] };
    }

    const log = [];
    let filled = 0;
    const otpActionKeyBase = `ssc-send-otp:${window.location.href}`;

    const aadhaarYesRadio = Array.from(document.querySelectorAll('input[type="radio"]'))
      .find((el) => {
        if (!isVisibleElement(el)) return false;
        const label = getLabelText(el);
        const containerText = normalizeText(el.closest('fieldset, .form-group, .mat-mdc-radio-group, .radio-group, div')?.textContent || '');
        return /yes/.test(label) && /aadhaar card/.test(containerText);
      });

    if (aadhaarYesRadio && !aadhaarYesRadio.checked) {
      clickElement(aadhaarYesRadio);
      markAsFilled(aadhaarYesRadio, '#60a5fa');
      filled += 1;
      log.push({ field: 'aadhaarRadio', value: 'Yes', element: aadhaarYesRadio.name || aadhaarYesRadio.id || 'radio' });
      await wait(120);
    }

    const aadhaarInputs = getAllInputs({ includePassword: true })
      .filter((el) => isVisibleElement(el))
      .filter((el) => /aadhaar|aadhar|uid|vid/.test(getElementText(el)))
      .slice(0, 2);
    const validationState = getSscAadhaarValidationState();
    let chosenIdentity = identityOptions.find((option) => option.label === sscIdentityPreference) || identityOptions[0];

    if (validationState.invalidVid && chosenIdentity?.label === 'aadhaarVid') {
      dismissVisibleErrorDialog();
      chosenIdentity = identityOptions.find((option) => option.label === 'aadhaarNumber') || chosenIdentity;
    } else if (validationState.invalidUid && chosenIdentity?.label === 'aadhaarNumber') {
      dismissVisibleErrorDialog();
      chosenIdentity = identityOptions.find((option) => option.label === 'aadhaarVid') || chosenIdentity;
    }

    if (isSscOtpFieldVisible() || (Date.now() - sscOtpRequestedAt < 25000 && actionHistory.has(otpActionKeyBase))) {
      return { filled, log };
    }

    if (chosenIdentity) {
      const syncResult = await syncSscAadhaarInputs(aadhaarInputs, chosenIdentity);
      sscIdentityPreference = chosenIdentity.label;
      filled += syncResult.filled;
      log.push(...syncResult.log);
    }

    const activeIdentityValue = chosenIdentity?.value || '';
    const aadhaarInputsReady = aadhaarInputs.length > 0
      && aadhaarInputs.every((el) => hasFormattedFieldValue(el, activeIdentityValue));

    const consentCheckbox = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      .find((el) => {
        if (!isVisibleElement(el)) return false;
        const label = getLabelText(el);
        const containerText = normalizeText(el.closest('label, .form-group, div, section')?.textContent || label);
        return /aadhaar|aadhar|authentication|ekyc|consent|i hereby state|objection/.test(`${label} ${containerText}`);
      });

    if (consentCheckbox && !consentCheckbox.checked && !hasSscAadhaarValidationError()) {
      const didCheck = setCheckboxChecked(consentCheckbox);
      if (didCheck) {
        markAsFilled(consentCheckbox, '#60a5fa');
        filled += 1;
        log.push({ field: 'aadhaarConsent', value: 'checked', element: consentCheckbox.name || consentCheckbox.id || 'checkbox' });
        await wait(180);
      }
    }

    const sendOtpButton = Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .find((el) => isVisibleElement(el) && /send otp/.test(normalizeText(el.textContent || el.getAttribute('aria-label'))));

    if (sendOtpButton && !hasSscAadhaarValidationError() && aadhaarInputsReady && consentCheckbox?.checked) {
      if (isActionAllowed(otpActionKeyBase)) {
        await wait(220);
        clickElement(sendOtpButton);
        await wait(500);
        log.push({ field: 'aadhaarOtp', value: 'requested', element: sendOtpButton.id || sendOtpButton.tagName });
        sscOtpRequestedAt = Date.now();
        sscFreezeAutomationUntil = Date.now() + 12000;

        if (hasSscAadhaarValidationError()) {
          dismissVisibleErrorDialog();
          const alternateIdentity = identityOptions.find((option) => option.label !== sscIdentityPreference);
          if (alternateIdentity) {
            sscIdentityPreference = alternateIdentity.label;
            actionHistory.delete(otpActionKeyBase);
            sscFreezeAutomationUntil = 0;
          }
        }
      }
    }

    if (actionHistory.has(otpActionKeyBase) && (isSscOtpFieldVisible() || (aadhaarInputsReady && consentCheckbox?.checked && !hasSscAadhaarValidationError()))) {
      return { filled, log };
    }

    return { filled, log };
  }

  function findBestCustomSelectByHints(hints) {
    let best = null;
    let bestScore = 0;

    for (const el of getAllCustomSelects()) {
      const score = scoreMatch(el, hints);
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return bestScore > 0 ? best : null;
  }

  function findBestOptionNode(normalizedValue) {
    const options = Array.from(document.querySelectorAll('[role="option"], mat-option, .mat-mdc-option, .mat-option, .ng-option, .drop-list.active li, .drop-list li, ul.list.scroll li'))
      .filter((el) => isVisibleElement(el))
      .filter((el) => !normalizeText(el.getAttribute('aria-disabled')).includes('true'))
      .filter((el) => !/\blisthead\b/i.test(el.className || ''));
    const looseValue = normalizeLooseText(normalizedValue);

    return options.find((el) => normalizeText(el.textContent) === normalizedValue)
      || options.find((el) => normalizeText(el.getAttribute('data-value')) === normalizedValue)
      || options.find((el) => normalizeLooseText(el.textContent) === looseValue)
      || options.find((el) => normalizeText(el.textContent).includes(normalizedValue))
      || options.find((el) => normalizeLooseText(el.textContent).includes(looseValue))
      || options.find((el) => normalizedValue.includes(normalizeText(el.textContent)) && normalizeText(el.textContent).length > 2);
  }

  async function fillCustomSelect(el, value) {
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) return false;

    clickElement(resolveClickableCustomSelect(el));
    await wait(140);

    let option = findBestOptionNode(normalizedValue);
    if (!option) {
      const searchInput = document.querySelector('.ng-dropdown-panel input, .mat-mdc-select-panel input, [role="listbox"] input');
      if (searchInput) {
        setTextLikeValue(searchInput, value);
        await wait(120);
        option = findBestOptionNode(normalizedValue);
      }
    }

    if (!option) {
      document.body.click();
      return false;
    }

    clickElement(option);
    await wait(120);
    return true;
  }

  async function fillCustomSelectCandidates(el, values) {
    const candidates = Array.isArray(values) ? values : [values];

    for (const value of candidates) {
      if (!String(value || '').trim()) continue;
      const didFill = await fillCustomSelect(el, value);
      if (didFill) return String(value).trim();
    }

    return '';
  }

  function scoreTextAgainstHints(text, hints) {
    const normalizedText = normalizeText(text);
    const looseText = normalizeLooseText(text);
    let score = 0;

    for (const hint of hints || []) {
      const normalizedHint = normalizeText(hint);
      const looseHint = normalizeLooseText(hint);
      if (!normalizedHint) continue;

      if (normalizedText.includes(normalizedHint) || (looseHint && looseText.includes(looseHint))) {
        score += normalizedHint.split(' ').length;
      }
    }

    return score;
  }

  function findBestFieldControlByHints(hints, controlSelector, options = {}) {
    let best = null;
    let bestScore = 0;
    let bestTextLength = Number.POSITIVE_INFINITY;

    for (const control of document.querySelectorAll(controlSelector)) {
      if (!isVisibleElement(control)) continue;

      const descriptor = getFieldScopeText(control);
      if (!descriptorMatchesVerifyMode(descriptor, options)) continue;

      const score = scoreTextAgainstHints(descriptor, hints);
      const textLength = normalizeText(descriptor).length;

      if (score > bestScore || (score === bestScore && score > 0 && textLength < bestTextLength)) {
        best = control;
        bestScore = score;
        bestTextLength = textLength;
      }
    }

    return bestScore > 0 ? best : null;
  }

  async function fillSscTextFieldByHints(hints, value, field) {
    if (!String(value || '').trim()) {
      return { filled: 0, log: [] };
    }

    if (isFieldCompleted(field)) {
      return { filled: 0, log: [] };
    }

    const input = findBestFieldControlByHints(
      hints,
      'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="file"]):not([type="button"]):not([type="submit"]), textarea',
      {
        requireVerify: /verify/i.test(field),
        avoidVerify: !/verify/i.test(field),
      }
    );

    if (!input) {
      return { filled: 0, log: [] };
    }

    const nextValue = formatValueForInput(input, String(value).trim());
    if (normalizeLooseText(input.value || '') === normalizeLooseText(nextValue)) {
      markAsFilled(input);
      markFieldCompleted(field);
      return { filled: 0, log: [] };
    }

    await typeTextLikeHuman(input, nextValue);
    if (normalizeLooseText(input.value || '') !== normalizeLooseText(nextValue)) {
      setTextLikeValue(input, nextValue);
      input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    }
    markAsFilled(input);
    markFieldCompleted(field);
    return {
      filled: 1,
      log: [{ field, value: nextValue, element: input.name || input.id || input.tagName }],
    };
  }

  async function fillSscSelectFieldByHints(hints, values, field) {
    if (isFieldCompleted(field)) {
      return { filled: 0, log: [] };
    }

    const trigger = findBestFieldControlByHints(
      hints,
      '[role="combobox"], .mat-mdc-select-trigger, .mat-select-trigger, .ng-select-container, .ng-value-container, .value-area, app-dropdown',
      {
        requireVerify: /verify/i.test(field),
        avoidVerify: !/verify/i.test(field),
      }
    );

    if (!trigger) {
      return { filled: 0, log: [] };
    }

    const candidates = (Array.isArray(values) ? values : [values]).filter((value) => String(value || '').trim());
    if (!candidates.length) {
      return { filled: 0, log: [] };
    }

    const triggerText = normalizeLooseText(trigger.textContent || trigger.getAttribute('aria-label'));
    const alreadySelected = candidates.some((value) => {
      const looseValue = normalizeLooseText(value);
      return looseValue && (triggerText.includes(looseValue) || looseValue.includes(triggerText));
    });

    if (alreadySelected) {
      markAsFilled(trigger);
      markFieldCompleted(field);
      return { filled: 0, log: [] };
    }

    const matchedValue = await fillCustomSelectCandidates(trigger, candidates);
    if (!matchedValue) {
      return { filled: 0, log: [] };
    }

    markAsFilled(trigger);
    markFieldCompleted(field);
    return {
      filled: 1,
      log: [{ field, value: matchedValue, element: trigger.getAttribute('formcontrolname') || trigger.id || trigger.tagName }],
    };
  }

  function uniqueFilledValues(values) {
    return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
  }

  function getSscBoardCandidates(value) {
    const normalized = normalizeLooseText(value);
    const candidates = [
      value,
      String(value || '').replace(/,/g, ''),
      String(value || '').replace(/\s*,\s*/g, ' '),
    ];

    if (/board of secondary education/.test(normalized) && /(rajasthan|ajmer)/.test(normalized)) {
      candidates.unshift('Board of Secondary Education, Rajasthan');
      candidates.push('Board of Secondary Education Rajasthan');
      candidates.push('Rajasthan Board of Secondary Education');
      candidates.push('Rajasthan Board');
    }

    if (/central board of secondary education|cbse/.test(normalized)) {
      candidates.push('Central Board of Secondary Education');
      candidates.push('CBSE');
    }

    return uniqueFilledValues(candidates);
  }

  function getSscHighestQualificationCandidates(profile) {
    if (profile?.highestQualification) {
      return uniqueFilledValues([profile.highestQualification]);
    }

    if (profile?.postGraduationDegree || profile?.postGraduationYear) {
      return uniqueFilledValues(['Post Graduate', 'Post Graduation', 'Masters Degree', 'Master Degree']);
    }

    if (profile?.graduationDegree || profile?.graduationYear || profile?.graduationUniversity) {
      return uniqueFilledValues(['Graduation and above', 'Graduate and above', 'Graduate', 'Graduation', 'Bachelor Degree']);
    }

    if (profile?.class12Year || profile?.class12Board) {
      return uniqueFilledValues(['Higher Secondary (10+2)', 'Senior Secondary', '12th Pass']);
    }

    if (profile?.class10Year || profile?.class10Board) {
      return uniqueFilledValues(['Matriculation', '10th Pass']);
    }

    return [];
  }

  function isDropdownOverlayOpen() {
    return Boolean(document.querySelector('.drop-list.active, .ng-dropdown-panel, .mat-mdc-select-panel, .mat-select-panel, [role="listbox"]'));
  }

  async function maybeHandleSscPersonalDetailsStep(profile) {
    if (!isSscPersonalDetailsPage()) {
      return { filled: 0, log: [] };
    }

    const aadhaarStepResult = await maybeHandleSscAadhaarStep(profile);
    let filled = aadhaarStepResult.filled;
    const log = [...aadhaarStepResult.log];

    const textFields = [
      { hints: ['5 date of birth', 'date of birth'], value: String(profile?.dateOfBirth || '').replace(/\//g, '-'), field: 'dateOfBirth' },
      { hints: ['verify date of birth'], value: String(profile?.dateOfBirth || '').replace(/\//g, '-'), field: 'dateOfBirthVerify' },
      { hints: ['2 candidate name', "candidate's name", 'candidate name', 'full name'], value: profile?.fullName, field: 'fullName' },
      { hints: ["verify candidate's name", 'verify candidate name', 'verify full name'], value: profile?.fullName, field: 'fullNameVerify' },
      { hints: ["6 father's name", "father's name", 'father name'], value: profile?.fatherName, field: 'fatherName' },
      { hints: ["verify father's name", 'verify father name'], value: profile?.fatherName, field: 'fatherNameVerify' },
      { hints: ["7 mother's name", "mother's name", 'mother name'], value: profile?.motherName, field: 'motherName' },
      { hints: ["verify mother's name", 'verify mother name'], value: profile?.motherName, field: 'motherNameVerify' },
      { hints: ['9 roll number', 'roll number'], value: profile?.class10RollNumber, field: 'class10RollNumber' },
      { hints: ['verify roll number'], value: profile?.class10RollNumber, field: 'class10RollNumberVerify' },
      { hints: ["candidate's mobile number", 'mobile number'], value: profile?.mobileNumber, field: 'mobileNumber' },
      { hints: ["candidate's email id", 'email id', 'email address'], value: profile?.email, field: 'email' },
    ];

    for (const fieldConfig of textFields) {
      const result = await fillSscTextFieldByHints(fieldConfig.hints, fieldConfig.value, fieldConfig.field);
      filled += result.filled;
      log.push(...result.log);
    }

    const selectFields = [
      { hints: ['4 gender', 'gender'], values: uniqueFilledValues([profile?.gender]), field: 'gender' },
      { hints: ['verify gender'], values: uniqueFilledValues([profile?.gender]), field: 'genderVerify' },
      { hints: ['8 matriculation 10th class education board', 'matriculation 10th class education board'], values: getSscBoardCandidates(profile?.class10Board), field: 'class10Board' },
      { hints: ['verify matriculation 10th class education board'], values: getSscBoardCandidates(profile?.class10Board), field: 'class10BoardVerify' },
      { hints: ['10 year of passing', 'year of passing'], values: uniqueFilledValues([profile?.class10Year]), field: 'class10Year' },
      { hints: ['verify year of passing'], values: uniqueFilledValues([profile?.class10Year]), field: 'class10YearVerify' },
      { hints: ['11 highest level of education qualification', 'highest level of education qualification'], values: getSscHighestQualificationCandidates(profile), field: 'highestQualification' },
      { hints: ['verify highest level of education qualification'], values: getSscHighestQualificationCandidates(profile), field: 'highestQualificationVerify' },
    ];

    for (const fieldConfig of selectFields) {
      const result = await fillSscSelectFieldByHints(fieldConfig.hints, fieldConfig.values, fieldConfig.field);
      filled += result.filled;
      log.push(...result.log);
    }

    return { filled, log };
  }

  async function fillElement(el, value) {
    if (!value) return false;

    const tag = el.tagName.toLowerCase();
    const type = normalizeText(el.getAttribute('type'));

    if (tag === 'select') {
      const options = Array.from(el.options);
      const normalizedValue = normalizeText(value);
      const option = options.find((opt) => normalizeText(opt.text) === normalizedValue)
        || options.find((opt) => normalizeText(opt.value) === normalizedValue)
        || options.find((opt) => normalizeText(opt.text).includes(normalizedValue))
        || options.find((opt) => normalizedValue.includes(normalizeText(opt.text)) && normalizeText(opt.text).length > 2);

      if (!option) return false;

      el.value = option.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    if (type === 'radio') {
      const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`);
      const normalizedValue = normalizeText(value);

      for (const radio of radios) {
        const label = getLabelText(radio);
        if (label.includes(normalizedValue) || normalizeText(radio.value) === normalizedValue) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }

      return false;
    }

    if (type === 'checkbox') return false;

    setTextLikeValue(el, formatValueForInput(el, value));
    return true;
  }

  async function fillForm(profile) {
    const inputs = getAllInputs();
    const specialPageResult = await maybeHandleSscPersonalDetailsStep(profile);
    let filled = specialPageResult.filled;
    let skipped = 0;
    const log = [...specialPageResult.log];

    for (const def of FIELD_DEFS) {
      const value = profile?.[def.key];
      if (!value) continue;
      if (isSscPersonalDetailsPage() && ['aadhaarNumber', 'aadhaarVid'].includes(def.key)) continue;
      if (isSscPersonalDetailsPage() && isFieldCompleted(def.key)) continue;

      let best = null;
      let bestScore = 0;

      for (const el of inputs) {
        if (el.dataset.govformFilled) continue;
        const score = scoreMatch(el, def.hints);
        if (score > bestScore) {
          bestScore = score;
          best = el;
        }
      }

      if (best && bestScore > 0) {
        const didFill = await fillElement(best, value);
        if (didFill) {
          markAsFilled(best);
          filled += 1;
          log.push({ field: def.key, value, element: best.name || best.id || best.tagName });
        } else {
          skipped += 1;
        }
        continue;
      }

      const customSelect = findBestCustomSelectByHints(def.hints);
      if (customSelect && !customSelect.dataset.govformFilled) {
        const didFill = await fillCustomSelect(customSelect, value);
        if (didFill) {
          markAsFilled(customSelect);
          filled += 1;
          log.push({ field: def.key, value, element: customSelect.getAttribute('formcontrolname') || customSelect.id || customSelect.tagName });
        } else {
          skipped += 1;
        }
      }
    }

    return { filled, skipped, total: FIELD_DEFS.length, log };
  }

  function getPortalHost(portal) {
    if (!portal) return '';

    try {
      const url = portal.loginUrl || portal.applyUrl || '';
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function doesPortalMatchCurrentPage(portal) {
    const portalHost = getPortalHost(portal);
    if (!portalHost) return true;

    const currentHost = window.location.hostname.replace(/^www\./, '');
    if (currentHost === portalHost || currentHost.endsWith(`.${portalHost}`) || portalHost.endsWith(`.${currentHost}`)) {
      return true;
    }

    const text = pageText();
    const path = currentPath();
    const visibleInputs = getAllInputs({ includePassword: true }).filter((el) => isVisibleElement(el)).length;
    return visibleInputs >= 2 && /register|registration|application|apply|candidate|personal details|education|address|profile|signup|sign up|login/.test(`${path} ${text}`);
  }

  function hasChallengeField() {
    if (
      document.querySelector('iframe[src*="captcha"], img[src*="captcha"], input[name*="captcha"], input[id*="captcha"], input[name*="otp"], input[id*="otp"], input[autocomplete="one-time-code"]')
    ) {
      return true;
    }

    const pageText = normalizeText(document.body?.innerText || '');
    return /captcha|one time password|otp|verification code|security code/.test(pageText);
  }

  function detectPreviewPage() {
    const pageText = normalizeText(document.body?.innerText || '');
    return /\/preview\b/.test(currentPath())
      || /preview|final submit|verify all details|review your application|application preview/.test(pageText);
  }

  function findBestInputByHints(hints, options = {}) {
    const { includePassword = false, preferredTypes = [] } = options;
    let best = null;
    let bestScore = 0;

    for (const el of getAllInputs({ includePassword })) {
      const type = normalizeText(el.getAttribute('type'));
      if (preferredTypes.length && !preferredTypes.includes(type || 'text')) continue;
      const score = scoreMatch(el, hints);
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return bestScore > 0 ? best : null;
  }

  function findBestButtonByHints(hints) {
    const candidates = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"]'));
    let best = null;
    let bestScore = 0;

    for (const el of candidates) {
      const text = normalizeText(el.textContent || el.value || `${el.name || ''} ${el.id || ''}`);
      let score = 0;

      for (const hint of hints || []) {
        const normalizedHint = normalizeText(hint);
        if (text.includes(normalizedHint)) score += normalizedHint.split(' ').length;
      }

      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return bestScore > 0 ? best : null;
  }

  function isVisibleElement(el) {
    return Boolean(el) && (el.offsetParent !== null || el.getClientRects().length > 0);
  }

  function isActionAllowed(key) {
    if (actionHistory.has(key)) return false;
    actionHistory.add(key);
    return true;
  }

  function pageText() {
    return normalizeText(document.body?.innerText || '');
  }

  function currentPath() {
    return normalizeText(window.location.pathname);
  }

  function isSscPersonalDetailsPage() {
    return isSscPortalPage() && /one-time-registration\/personal-details/.test(currentPath());
  }

  function fieldCompletionKey(field) {
    return `${currentPath()}::${field}`;
  }

  function isFieldCompleted(field) {
    return completedFieldKeys.has(fieldCompletionKey(field));
  }

  function markFieldCompleted(field) {
    completedFieldKeys.add(fieldCompletionKey(field));
  }

  function currentRouteKey() {
    return `${window.location.hostname}${currentPath()}`;
  }

  function isSscCalmPage() {
    return isSscPersonalDetailsPage();
  }

  function isSscPortalPage() {
    return window.location.hostname.includes('ssc.gov.in');
  }

  function detectPasswordChangePage() {
    const text = pageText();
    const path = currentPath();
    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'))
      .filter((el) => isVisibleElement(el)).length;

    return (
      /password|create-password|change-password|password-creation/.test(path)
      || passwordInputs >= 2
    )
      && /change password|create password|new password|confirm password/.test(text)
      && !/forgot password/.test(text);
  }

  function maybeActivateCandidateTab() {
    if (!isSscPortalPage() || !/login/.test(currentPath())) return { clicked: false };

    const tabs = Array.from(document.querySelectorAll('button, a, [role="tab"]'))
      .filter((el) => isVisibleElement(el));
    const candidateTab = tabs.find((el) => /candidate/.test(normalizeText(el.textContent || el.getAttribute('aria-label'))));
    if (!candidateTab) return { clicked: false };

    const selected = normalizeText(candidateTab.getAttribute('aria-selected'))
      || normalizeText(candidateTab.getAttribute('aria-pressed'))
      || normalizeText(candidateTab.className);
    if (/true|active|selected/.test(selected)) return { clicked: false };

    const key = `candidate-tab:${window.location.href}`;
    if (!isActionAllowed(key)) return { clicked: false };

    setTimeout(() => clickElement(candidateTab), 250);
    return { clicked: true };
  }

  function hasLoginCredentials(credentials) {
    const username = String(credentials?.username || '').trim();
    const password = String(credentials?.password || '').trim();
    return Boolean(username || password);
  }

  function maybeAdvanceSscRegistration(context) {
    if (!isSscPortalPage() || hasLoginCredentials(context.credentials)) {
      return { clicked: false };
    }

    const path = currentPath();
    const text = pageText();

    if (/\/login\b/.test(path) || /login to your account/.test(text)) {
      const registerNow = Array.from(document.querySelectorAll('p.regeister, a, button, [role="button"]'))
        .find((el) => isVisibleElement(el) && /register now/.test(normalizeText(el.textContent || el.getAttribute('aria-label'))));

      if (!registerNow) return { clicked: false };

      const key = `ssc-register-now:${window.location.href}`;
      if (!isActionAllowed(key)) return { clicked: false };

      setTimeout(() => clickElement(registerNow), 600);
      return { clicked: true, stage: 'register-now' };
    }

    const looksLikeRegistrationHome = /one-time-registration\/home-page/.test(path)
      || (/new candidate/.test(text) && /one time registration/.test(text) && /continue/.test(text));

    if (!looksLikeRegistrationHome) {
      return { clicked: false };
    }

    const continueButton = findBestButtonByHints(['continue', 'start registration', 'proceed']);
    if (!continueButton || !isVisibleElement(continueButton)) return { clicked: false };

    const key = `ssc-registration-continue:${window.location.href}`;
    if (!isActionAllowed(key)) return { clicked: false };

    setTimeout(() => clickElement(continueButton), 700);
    return { clicked: true, stage: 'continue' };
  }

  function maybeAcceptDeclarationPage() {
    const text = pageText();
    const looksLikeDeclaration = /declaration|i agree|agree to the declaration/.test(text);
    const looksFinal = /preview|final submit|review your application|verify all details/.test(text);

    if (!looksLikeDeclaration || looksFinal) return { clicked: false };

    const checkbox = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"]'))
      .find((el) => isVisibleElement(el) && /agree|declaration/.test(getLabelText(el)));
    if (checkbox && !checkbox.checked) {
      clickElement(checkbox);
    }

    const action = findBestButtonByHints(['i agree', 'agree', 'next', 'continue', 'proceed']);
    if (!action || !isVisibleElement(action)) return { clicked: false };

    const key = `declaration:${window.location.href}`;
    if (!isActionAllowed(key)) return { clicked: false };

    setTimeout(() => clickElement(action), 700);
    return { clicked: true };
  }

  function findExamApplyAction(context) {
    const portalHints = [...(context.portal?.applyHints || [])];
    const examName = context.filledForm?.examName;

    if (examName) portalHints.push(examName);
    if (!portalHints.length) return null;

    const containers = Array.from(document.querySelectorAll('tr, li, article, section, div'));

    for (const container of containers) {
      const text = normalizeText(container.textContent || '');
      if (!text) continue;
      if (!portalHints.some((hint) => text.includes(normalizeText(hint)))) continue;

      const action = Array.from(container.querySelectorAll('a, button, [role="button"], input[type="button"], input[type="submit"]'))
        .find((el) => /apply|apply now|continue|complete application|proceed/.test(normalizeText(el.textContent || el.value || '')));

      if (action && isVisibleElement(action)) return action;
    }

    const fallbackActions = Array.from(document.querySelectorAll('a, button, [role="button"], input[type="button"], input[type="submit"]'));
    let best = null;
    let bestScore = 0;

    for (const el of fallbackActions) {
      if (!isVisibleElement(el)) continue;

      const ownText = normalizeText(el.textContent || el.value || '');
      if (!/apply|continue|proceed/.test(ownText)) continue;

      const nearbyText = normalizeText(el.closest('tr, li, article, section, div')?.textContent || ownText);
      let score = ownText.includes('apply') ? 2 : 0;

      for (const hint of portalHints) {
        const normalizedHint = normalizeText(hint);
        if (nearbyText.includes(normalizedHint)) score += normalizedHint.split(' ').length * 2;
        if (ownText.includes(normalizedHint)) score += normalizedHint.split(' ').length;
      }

      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return bestScore > 0 ? best : null;
  }

  function maybeOpenExamApply(context) {
    const dashboardHints = context.portal?.dashboardHints || [];
    if (!dashboardHints.length) return { clicked: false };

    const text = pageText();
    if (!dashboardHints.some((hint) => text.includes(normalizeText(hint)))) {
      return { clicked: false };
    }

    const action = findExamApplyAction(context);
    if (!action) return { clicked: false };

    const key = `apply:${context.portal?.examId || 'portal'}:${window.location.href}`;
    if (!isActionAllowed(key)) return { clicked: false };

    setTimeout(() => action.click(), 800);
    return { clicked: true };
  }

  function hasValueForRequiredField(el) {
    const tag = el.tagName.toLowerCase();
    const type = normalizeText(el.getAttribute('type'));

    if (type === 'radio') {
      const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`);
      return Array.from(group).some((radio) => radio.checked);
    }

    if (type === 'checkbox') {
      return el.checked;
    }

    if (type === 'file') {
      return Boolean(el.files && el.files.length);
    }

    if (tag === 'select') {
      return Boolean(el.value && !/^select\b/.test(normalizeText(el.value)));
    }

    return Boolean(String(el.value || '').trim());
  }

  function getRequiredFieldState() {
    const elements = Array.from(document.querySelectorAll('input, select, textarea'))
      .filter((el) => isVisibleElement(el))
      .filter((el) => el.required || normalizeText(el.getAttribute('aria-required')) === 'true');

    if (!elements.length) {
      return { total: 0, missing: 0, allFilled: true };
    }

    let total = 0;
    let missing = 0;
    const seenRadioGroups = new Set();

    for (const el of elements) {
      const type = normalizeText(el.getAttribute('type'));
      if (['hidden', 'submit', 'button', 'reset'].includes(type)) continue;

      if (type === 'radio') {
        const groupName = el.name || el.id;
        if (!groupName || seenRadioGroups.has(groupName)) continue;
        seenRadioGroups.add(groupName);
      }

      total += 1;
      if (!hasValueForRequiredField(el)) missing += 1;
    }

    return { total, missing, allFilled: missing === 0 };
  }

  function isIgnorableEditableField(el) {
    const text = getElementText(el);
    const type = normalizeText(el.getAttribute('type'));
    return !isVisibleElement(el)
      || /search|captcha|otp|verification code|security code/.test(text)
      || ['hidden', 'submit', 'button', 'reset'].includes(type);
  }

  function getEditableFieldState() {
    const elements = Array.from(document.querySelectorAll('input, select, textarea'))
      .filter((el) => !isIgnorableEditableField(el));

    if (!elements.length) {
      return { total: 0, empty: 0, allFilled: true };
    }

    let empty = 0;
    const seenRadioGroups = new Set();

    for (const el of elements) {
      const type = normalizeText(el.getAttribute('type'));
      if (type === 'radio') {
        const groupName = el.name || el.id;
        if (!groupName || seenRadioGroups.has(groupName)) continue;
        seenRadioGroups.add(groupName);
      }

      if (!hasValueForRequiredField(el)) empty += 1;
    }

    return { total: elements.length, empty, allFilled: empty === 0 };
  }

  function maybeAutoAdvance(context) {
    if (!context.portal?.autoAdvance) return { clicked: false };
    if (hasChallengeField() || detectPreviewPage() || detectPasswordChangePage()) return { clicked: false };
    if (/auth\/login|login/.test(window.location.href)) return { clicked: false };

    const requiredState = getRequiredFieldState();
    const editableState = getEditableFieldState();
    const routeDrivenPage = /(register|personal|educational|professional|photo|apply)/.test(`${currentPath()} ${pageText()}`);
    const canAdvanceByHeuristic = routeDrivenPage && editableState.total >= 2 && editableState.allFilled;
    if ((!requiredState.total || !requiredState.allFilled) && !canAdvanceByHeuristic) {
      return { clicked: false, requiredState, editableState };
    }

    const nextButton = findBestButtonByHints(context.portal?.nextBtnHints || ['save and next', 'next', 'continue', 'proceed']);
    if (!nextButton || !isVisibleElement(nextButton)) return { clicked: false, requiredState, editableState };

    const buttonText = normalizeText(nextButton.textContent || nextButton.value || '');
    if (/submit|final|preview|payment|pay|declaration/.test(buttonText)) {
      return { clicked: false, requiredState, editableState };
    }

    const key = `next:${window.location.href}:${buttonText}`;
    if (!isActionAllowed(key)) return { clicked: false, requiredState, editableState };

    setTimeout(() => clickElement(nextButton), 900);
    return { clicked: true, requiredState, editableState };
  }

  function fillLoginFields(context) {
    const credentials = context.credentials;
    const portal = context.portal;

    if (!credentials || !portal || !doesPortalMatchCurrentPage(portal)) {
      return { filled: 0, autoSubmitted: false, challengeDetected: false };
    }

    const username = String(credentials.username || '').trim();
    const password = String(credentials.password || '').trim();
    if (!username && !password) {
      return { filled: 0, autoSubmitted: false, challengeDetected: false };
    }

    const usernameInput = username
      ? findBestInputByHints(portal.loginHints?.username || [], { preferredTypes: ['text', 'email', 'tel', 'number', 'date'] })
      : null;
    const passwordInput = password
      ? findBestInputByHints(portal.loginHints?.password || [], { includePassword: true })
        || document.querySelector('input[type="password"]')
      : null;

    let filled = 0;

    if (usernameInput && !usernameInput.dataset.govformLoginFilled) {
      setTextLikeValue(usernameInput, username);
      usernameInput.dataset.govformLoginFilled = '1';
      usernameInput.style.outline = '2px solid #60a5fa';
      usernameInput.style.outlineOffset = '2px';
      filled += 1;
    }

    if (passwordInput && !passwordInput.dataset.govformLoginFilled) {
      setTextLikeValue(passwordInput, password);
      passwordInput.dataset.govformLoginFilled = '1';
      passwordInput.style.outline = '2px solid #60a5fa';
      passwordInput.style.outlineOffset = '2px';
      filled += 1;
    }

    const challengeDetected = hasChallengeField();
    let autoSubmitted = false;
    const submitButton = findBestButtonByHints(portal.loginHints?.submitBtn || []);

    if (
      credentials.autoSubmitLogin &&
      submitButton &&
      filled > 0 &&
      !challengeDetected
    ) {
      const submitKey = `${window.location.href}|${username}|${password}`;
      if (submitKey !== lastLoginSubmitKey) {
        lastLoginSubmitKey = submitKey;
        autoSubmitted = true;
        setTimeout(() => submitButton.click(), 700);
      }
    }

    return { filled, autoSubmitted, challengeDetected };
  }

  function showToast(filledCount, customMessage) {
    if (isLocalHost()) return;

    const existing = document.getElementById('govform-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'govform-toast';
    const message = customMessage || (filledCount > 0
      ? `✅ ${filledCount} fields auto-filled by GovForm AI!`
      : '⚠️ Koi field match nahi hua — manually check karo.');

    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      right: '24px',
      zIndex: '9999999',
      background: filledCount > 0 ? '#166534' : '#7c2d12',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '12px',
      fontFamily: 'sans-serif',
      fontSize: '14px',
      fontWeight: 'bold',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      border: `1px solid ${filledCount > 0 ? '#22c55e' : '#ef4444'}`,
      transition: 'opacity 0.3s',
      opacity: '1',
      maxWidth: '360px',
    });

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function postToPage(payload) {
    window.postMessage(payload, '*');
  }

  function announceExtensionReady() {
    postToPage({ type: 'GOVFORM_EXTENSION_READY' });
  }

  function saveLastFill(result) {
    chrome.runtime.sendMessage({ type: 'FILL_RESULT', result }, () => {});
  }

  function fetchLatestBrowserContext() {
    if (browserContextFetchInFlight) {
      return;
    }

    browserContextFetchInFlight = true;
    chrome.runtime.sendMessage({ type: 'FETCH_BROWSER_CONTEXT' }, (response) => {
      browserContextFetchInFlight = false;

      if (!response?.success || !response?.profile) {
        return;
      }

      chrome.runtime.sendMessage({
        type: 'SAVE_AUTOMATION_CONTEXT',
        profile: response.profile,
        portal: response.portal || null,
        credentials: null,
        filledForm: response.filledForm || null,
        autoActive: true,
      }, (saveResponse) => {
        if (saveResponse?.success) {
          setTimeout(() => runAutomation('localhost-fallback', true), 250);
        }
      });
    });
  }

  function decodeWindowContext() {
    const hash = String(window.location.hash || '');
    const hashPrefix = `#${WINDOW_CONTEXT_PREFIX}`;

    if (!hash.startsWith(hashPrefix)) {
      return null;
    }

    try {
      const encodedPayload = hash.slice(hashPrefix.length);
      return JSON.parse(decodeURIComponent(atob(encodedPayload)));
    } catch (error) {
      console.error('GovForm URL context decode failed:', error);
      return null;
    }
  }

  function hydrateContextFromWindowName(callback) {
    const windowContext = decodeWindowContext();
    if (!windowContext?.profile) {
      callback?.(false);
      return;
    }

    chrome.runtime.sendMessage({
      type: 'SAVE_AUTOMATION_CONTEXT',
      profile: windowContext.profile,
      portal: windowContext.portal || null,
      credentials: windowContext.credentials || null,
      filledForm: windowContext.filledForm || null,
      autoActive: windowContext.autoActive !== false,
    }, (response) => {
      if (window.location.hash.startsWith(`#${WINDOW_CONTEXT_PREFIX}`)) {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
      callback?.(Boolean(response?.success));
    });
  }

  function runAutomation(reason = 'auto', forceToast = false) {
    const now = Date.now();
    if (!forceToast && now - lastAutomationAt < 1200) return;
    if (!forceToast && now < sscFreezeAutomationUntil && isSscPortalPage() && /one-time-registration\/personal-details/.test(currentPath())) return;
    if (!forceToast && isDropdownOverlayOpen()) return;
    if (!forceToast && isSscCalmPage() && sscPersonalDetailsAutoFilled && !['manual', 'route-change', 'window-handoff', 'hydrated-context', 'localhost-fallback', 'otp-post-verify'].includes(reason)) {
      return;
    }
    lastAutomationAt = now;

    if (isLocalHost()) return;

    chrome.storage.local.get(STORAGE_KEYS, async (data) => {
      const context = {
        profile: data.govform_profile || null,
        portal: data.govform_portal || null,
        credentials: data.govform_credentials || null,
        filledForm: data.govform_filled_form || null,
        autoActive: Boolean(data.govform_auto_active),
      };

      if (!context.profile) {
        fetchLatestBrowserContext();
        return;
      }
      if (!context.autoActive && !forceToast) return;
      if (!doesPortalMatchCurrentPage(context.portal)) return;

      const candidateTabResult = maybeActivateCandidateTab();
      if (candidateTabResult.clicked) {
        return;
      }

      const registrationAdvanceResult = maybeAdvanceSscRegistration(context);
      if (registrationAdvanceResult.clicked) {
        const result = {
          filled: 0,
          skipped: 0,
          total: FIELD_DEFS.length,
          loginFilled: 0,
          autoSubmittedLogin: false,
          challengeDetected: false,
          previewDetected: false,
          applyOpened: false,
          autoAdvanced: false,
          url: window.location.href,
          reason,
          at: Date.now(),
        };
        saveLastFill(result);
        showToast(0, registrationAdvanceResult.stage === 'continue'
          ? '➡️ Registration start kar raha hoon... agla Aadhaar step auto-fill hoga.'
          : '🚀 SSC registration page khol raha hoon...');
        return;
      }

      const loginResult = fillLoginFields(context);
      const applyResult = maybeOpenExamApply(context);

      if (applyResult.clicked) {
        const result = {
          filled: 0,
          skipped: 0,
          total: FIELD_DEFS.length,
          loginFilled: loginResult.filled,
          autoSubmittedLogin: loginResult.autoSubmitted,
          challengeDetected: loginResult.challengeDetected,
          previewDetected: false,
          applyOpened: true,
          autoAdvanced: false,
          url: window.location.href,
          reason,
          at: Date.now(),
        };
        saveLastFill(result);
        showToast(0, '🚀 SSC dashboard se apply form open kar raha hoon...');
        return;
      }

      const fillResult = await fillForm(context.profile);
      const previewDetected = detectPreviewPage();
      const passwordChangeDetected = detectPasswordChangePage();
      const declarationResult = maybeAcceptDeclarationPage();
      if (declarationResult.clicked) {
        showToast(fillResult.filled + loginResult.filled, '➡️ Declaration accept karke next step khol raha hoon...');
        return;
      }
      const autoAdvanceResult = maybeAutoAdvance(context);

      const result = {
        ...fillResult,
        loginFilled: loginResult.filled,
        autoSubmittedLogin: loginResult.autoSubmitted,
        challengeDetected: loginResult.challengeDetected,
        previewDetected,
        passwordChangeDetected,
        applyOpened: false,
        autoAdvanced: autoAdvanceResult.clicked,
        url: window.location.href,
        reason,
        at: Date.now(),
      };

      if (isSscCalmPage() && (fillResult.filled > 0 || result.challengeDetected || isSscOtpFieldVisible())) {
        sscPersonalDetailsAutoFilled = true;
        sscFreezeAutomationUntil = Date.now() + 6000;
      }

      saveLastFill(result);

      const toastKey = `${window.location.href}|${fillResult.filled}|${loginResult.filled}|${previewDetected}|${loginResult.challengeDetected}`;
      if (!forceToast && toastKey === lastToastKey) return;
      lastToastKey = toastKey;

      if (previewDetected) {
        showToast(fillResult.filled, '✅ Preview page aa gayi. Details check karke final submit karo.');
        return;
      }

      if (passwordChangeDetected) {
        showToast(fillResult.filled + loginResult.filled, '🔐 Ab naya password set karo. Iske baad login karke form flow continue hoga.');
        return;
      }

      if (loginResult.challengeDetected && loginResult.filled > 0) {
        showToast(fillResult.filled + loginResult.filled, '🔐 Login fields fill ho gaye. Captcha / OTP complete karo, baaki pages auto-fill hoti rahengi.');
        return;
      }

      if (loginResult.autoSubmitted) {
        showToast(fillResult.filled + loginResult.filled, '⚡ Login details fill ho gayi. Submit try kar diya gaya hai, agla page auto-fill hoga.');
        return;
      }

      if (autoAdvanceResult.clicked) {
        showToast(fillResult.filled + loginResult.filled, '➡️ Current SSC page fill ho gayi. Save & Next khol raha hoon...');
        return;
      }

      if (fillResult.filled > 0 || loginResult.filled > 0 || forceToast) {
        showToast(fillResult.filled + loginResult.filled);
      }
    });
  }

  function injectFloatingButton() {
    if (isLocalHost() || document.getElementById('govform-ai-float')) return;

    const btn = document.createElement('div');
    btn.id = 'govform-ai-float';
    btn.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">🇮🇳</span>
        <span>GovForm AI</span>
      </div>
      <div style="font-size:10px;opacity:0.8;margin-top:2px;">Auto-fill active</div>
    `;

    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '999999',
      background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
      color: 'white',
      padding: '12px 18px',
      borderRadius: '14px',
      cursor: 'pointer',
      fontFamily: 'sans-serif',
      fontSize: '13px',
      fontWeight: 'bold',
      boxShadow: '0 8px 32px rgba(124,58,237,0.5)',
      userSelect: 'none',
      transition: 'transform 0.2s',
      border: '1px solid rgba(255,255,255,0.2)',
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
    });

    btn.addEventListener('click', () => {
      runAutomation('manual', true);
    });

    document.body.appendChild(btn);
  }

  function startObservers() {
    if (observerStarted) return;
    observerStarted = true;

    const observer = new MutationObserver(() => {
      if (isSscCalmPage()) return;
      clearTimeout(observer._govformTimer);
      observer._govformTimer = setTimeout(() => runAutomation('mutation'), 900);
    });

    if (document.body && !isLocalHost()) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener('focus', () => {
      if (isSscCalmPage()) return;
      setTimeout(() => runAutomation('focus'), 700);
    });

    document.addEventListener('focusin', (event) => {
      const target = event.target;
      if (!(target instanceof Element) || isLocalHost()) return;
      if (isSscCalmPage()) return;
      if (isSscAadhaarStep()) return;
      if (!target.matches('input, select, textarea')) return;

      setTimeout(() => runAutomation('field-focus'), 250);
    }, true);

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element) || isLocalHost()) return;
      if (isSscCalmPage()) {
        const verifyOtpButton = target.closest('button, a, [role="button"]');
        const verifyOtpText = normalizeText(verifyOtpButton?.textContent || verifyOtpButton?.getAttribute('aria-label'));
        if (verifyOtpButton && /verify otp/.test(verifyOtpText)) {
          sscFreezeAutomationUntil = Date.now() + 5000;
          setTimeout(() => {
            sscPersonalDetailsAutoFilled = false;
            runAutomation('otp-post-verify', true);
          }, 4500);
        }
        return;
      }
      if (isSscAadhaarStep()) return;

      const trigger = target.closest('input, select, textarea');
      if (!trigger) return;

      setTimeout(() => runAutomation('field-click'), 250);
    }, true);

    setInterval(() => {
      if (window.location.href !== lastSeenUrl) {
        lastSeenUrl = window.location.href;
        if (!isSscPersonalDetailsPage()) {
          sscPersonalDetailsAutoFilled = false;
        }
        setTimeout(() => runAutomation('route-change', true), 1100);
      }
    }, 700);
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data?.type === 'GOVFORM_PING_EXTENSION') {
      announceExtensionReady();
      return;
    }

    if (event.data?.type === 'GOVFORM_SAVE_PROFILE' && event.data?.profile) {
      chrome.runtime.sendMessage({
        type: 'SAVE_AUTOMATION_CONTEXT',
        profile: event.data.profile,
        portal: event.data.portal || null,
        credentials: event.data.credentials || null,
        filledForm: event.data.filledForm || null,
        autoActive: event.data.autoActive !== false,
      }, (response) => {
        postToPage({ type: 'GOVFORM_PROFILE_SAVED', success: Boolean(response?.success) });
      });
      return;
    }

    if (event.data?.type === 'GOVFORM_OPEN_PORTAL_FLOW' && event.data?.profile && event.data?.portal) {
      chrome.runtime.sendMessage({
        type: 'OPEN_PORTAL_FLOW',
        profile: event.data.profile,
        portal: event.data.portal,
        credentials: event.data.credentials || null,
        filledForm: event.data.filledForm || null,
        autoActive: event.data.autoActive !== false,
      }, (response) => {
        postToPage({
          type: 'GOVFORM_PORTAL_FLOW_RESULT',
          success: Boolean(response?.success),
          url: response?.url || null,
          tabId: response?.tabId || null,
        });
      });
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'HYDRATE_CONTEXT' && message.profile) {
      chrome.runtime.sendMessage({
        type: 'SAVE_AUTOMATION_CONTEXT',
        profile: message.profile,
        portal: message.portal || null,
        credentials: message.credentials || null,
        filledForm: message.filledForm || null,
        autoActive: message.autoActive !== false,
      }, (response) => {
        if (response?.success) {
          setTimeout(() => runAutomation('hydrated-context', true), 250);
        }
        sendResponse({ success: Boolean(response?.success) });
      });
      return true;
    }

    if (message.type === 'DO_FILL') {
      (async () => {
        const result = await fillForm(message.profile || {});
        showToast(result.filled);
        sendResponse(result);
        chrome.runtime.sendMessage({ type: 'FILL_RESULT', result: { ...result, url: window.location.href, at: Date.now(), reason: 'popup-manual' } }, () => {});
      })();
      return true;
    }

    if (message.type === 'PING') {
      sendResponse({ alive: true, url: window.location.href });
      return true;
    }
  });

  function init() {
    hydrateContextFromWindowName((hydratedFromWindow) => {
      injectFloatingButton();
      startObservers();
      announceExtensionReady();

      if (!isLocalHost()) {
        setTimeout(() => runAutomation(hydratedFromWindow ? 'window-handoff' : 'init', true), hydratedFromWindow ? 400 : 1400);
      }
    });
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
