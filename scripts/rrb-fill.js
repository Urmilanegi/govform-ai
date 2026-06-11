// RRB Form Filler — rrbapply.gov.in
// Handles Registration (if new) → OTP → Login → Form Fill → PDF
// Communicates via stdout JSON lines

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PROFILE_DIR  = path.join(os.homedir(), '.govform', 'rrb-profile');
const CREDS_FILE   = path.join(os.homedir(), '.govform', 'credentials.json');
const OTP_FILE     = '/tmp/govform_otp.txt';
const CAPTCHA_FILE = '/tmp/govform_captcha.txt';
const STATUS_FILE  = '/tmp/govform_status.json';

function send(type, message, extra = {}) {
  const data = { type, message, ...extra };
  process.stdout.write(JSON.stringify(data) + '\n');
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data));
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

(async () => {
  const student = {
    name:       process.env.FULL_NAME    || 'SUMIT KUMAR MINA',
    dob:        process.env.DOB          || '07/07/2000',
    mobile:     process.env.MOBILE       || '',
    email:      process.env.EMAIL        || '',
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
  if (!student.mobile || !student.email || !student.motherName) {
    send('error', `❌ Missing: ${[!student.mobile&&'Mobile',!student.email&&'Email',!student.motherName&&'Mother Name'].filter(Boolean).join(', ')}`);
    process.exit(1);
  }

  // Check saved credentials
  const savedCreds = loadCreds();
  const rrbCreds   = savedCreds['rrb'] || {};
  let hasLogin   = !!(rrbCreds.regNo && rrbCreds.password);

  send('progress', hasLogin ? `✅ Saved credentials mili! Reg No: ${rrbCreds.regNo}` : '📝 Pehli baar hai — Registration karenge');

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    send('start', '🌐 RRB portal khol raha hoon...');
    await page.goto('https://www.rrbapply.gov.in', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    send('progress', `📋 Page: ${page.url()}`);

    // ── REGISTRATION (if no saved credentials) ─────────────────
    if (!hasLogin) {
      send('progress', '📝 New Registration shuru kar raha hoon...');

      // Step 1: Click "New Registration" button on landing page
      let onRegPage = false;
      const clickedReg = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button, span, li'));
        const reg = links.find(l =>
          l.textContent?.toLowerCase().match(/new.*registr|candidate.*registr|sign.*up|create.*account/i) &&
          l.getBoundingClientRect().height > 0
        );
        if (reg) { reg.click(); return true; }
        return false;
      });

      if (clickedReg) {
        send('progress', '✅ New Registration button mili — wait kar raha hoon...');
        await page.waitForTimeout(3000);
      }

      // Verify we are on a registration page (has form inputs, not 404)
      const pageCheck = await page.evaluate(() => {
        const url = window.location.href;
        const hasForm = document.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"]').length > 2;
        const is404   = url.includes('404') || document.body.innerText.toLowerCase().includes('page not found');
        return { url, hasForm, is404 };
      });
      send('progress', `📋 Registration page: ${pageCheck.url} | form: ${pageCheck.hasForm} | 404: ${pageCheck.is404}`);

      if (pageCheck.is404 || !pageCheck.hasForm) {
        send('progress', '⚠️ Registration page nahi mili — screenshot le raha hoon aur manual input maang raha hoon');
        // Take screenshot so user can see what's on screen
        const scr = await page.screenshot({ encoding: 'base64' }).catch(() => null);
        send('screenshot', '📸 Current browser screen:', { screenshot: scr });
        send('otp', '⚠️ Registration form nahi mila. Kya RRB site pe koi active notification hai? "YES" type karo agar manually dekhna chahte ho, "SKIP" type karo agar directly login karna hai:', { otpFile: OTP_FILE });
        const choice = await waitForInput(OTP_FILE);
        if (choice.toLowerCase() === 'skip') {
          send('progress', '⏭️ Registration skip — direct login try karte hain');
          hasLogin = true; // skip to login block
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
        await page.evaluate((name) => {
          const inputs = Array.from(document.querySelectorAll('input'));
          const motherInputs = inputs.filter(i => (i.placeholder+i.name+i.id+(i.labels?.[0]?.textContent||'')).toLowerCase().includes("mother"));
          motherInputs.forEach(inp => {
            const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
            s.call(inp, name);
            ['input','change','blur'].forEach(e => inp.dispatchEvent(new Event(e,{bubbles:true})));
          });
        }, student.motherName);
        send('progress', '✅ Mother Name filled');
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
        await page.waitForTimeout(400);

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

        // Scroll down to see more fields
        await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
        await page.waitForTimeout(800);

        // Screenshot before submit — let user verify
        const scrBefore = await page.screenshot({ encoding: 'base64' }).catch(() => null);
        send('screenshot', '📸 Form filled — verify karo:', { screenshot: scrBefore });

        // Click "Send OTP" / "Get OTP" button first (email OTP)
        const otpSent = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
          const btn = btns.find(b => (b.textContent||b.value||'').toLowerCase().match(/send.*otp|get.*otp|otp bhejo/i) && !b.disabled && b.getBoundingClientRect().height > 0);
          if (btn) { btn.click(); return (b.textContent||b.value||'').trim(); }
          return null;
        });
        if (otpSent) {
          send('progress', `✅ OTP button clicked: "${otpSent}" — Email pe OTP aayega`);
        } else {
          // Try submit/next button if no separate OTP button
          send('progress', '📤 Submit kar raha hoon...');
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.textContent?.toLowerCase().match(/register|submit|next|proceed/i) && b.getBoundingClientRect().height > 0 && !b.disabled);
            if (btn) btn.click();
          });
        }
        await page.waitForTimeout(3000);

        // OTP — wait for REAL OTP from user's phone/email
        send('progress', '📱 OTP bheja gaya hai tumhare mobile/email pe...');
        send('otp', '📱 Tumhare mobile ya email pe RRB ka REAL OTP aaya hoga — woh type karo (random mat dalna):', { otpFile: OTP_FILE });
        const otp = await waitForInput(OTP_FILE);
        send('progress', `✏️ OTP submit: ${otp}`);

        await fillInput(page, 'input[name*="otp" i], input[placeholder*="otp" i], input[maxlength="6"], input[maxlength="4"]', otp);
        await page.waitForTimeout(500);

        // Verify OTP
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b =>
            b.textContent?.toLowerCase().match(/verify|confirm|submit|validate/i) &&
            b.getBoundingClientRect().height > 0
          );
          if (btn) btn.click();
        });
        await page.waitForTimeout(3000);

        // Check if OTP was actually accepted
        const otpResult = await page.evaluate(() => {
          const txt = document.body.innerText.toLowerCase();
          const failed  = txt.includes('invalid otp') || txt.includes('wrong otp') || txt.includes('incorrect otp') || txt.includes('otp expired');
          const success = txt.includes('success') || txt.includes('verified') || txt.includes('password') || txt.includes('registration no');
          return { failed, success, url: window.location.href };
        });

        if (otpResult.failed) {
          send('progress', '❌ OTP galat tha! Naya OTP maango...');
          send('otp', '❌ OTP galat! Dobara check karo mobile/email aur sahi OTP type karo:', { otpFile: OTP_FILE });
          const otp2 = await waitForInput(OTP_FILE);
          await fillInput(page, 'input[name*="otp" i], input[placeholder*="otp" i], input[maxlength="6"]', otp2);
          await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.toLowerCase().match(/verify|confirm|submit/i));
            if (btn) btn.click();
          });
          await page.waitForTimeout(3000);
        }
        send('progress', `✅ OTP step done — Page: ${page.url()}`);
      } // end if (!hasLogin) inner

      // Password creation
      const newPassword = student.password || `RRB@${student.mobile.slice(-4)}2024`;
      await fillInput(page, 'input[name*="password" i][type="password"]:first-of-type, input[placeholder*="create password" i]', newPassword);
      await fillInput(page, 'input[name*="confirm" i], input[placeholder*="confirm password" i]', newPassword);
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent?.toLowerCase().match(/register|submit|create|next/i) && !b.disabled);
        if (btn) btn.click();
      });
      await page.waitForTimeout(3000);

      // Get registration number from page
      const regNo = await page.evaluate(() => {
        const txt = document.body.innerText;
        const match = txt.match(/(?:registration|reg|application)\s*(?:no|number|id)[:\s#]*([A-Z0-9\-]{6,20})/i);
        return match ? match[1] : null;
      });

      if (regNo) {
        saveCreds('rrb', { regNo, password: newPassword, dob: student.dob });
        send('progress', `🎉 Registration successful! Reg No: ${regNo} — Saved!`);
        send('creds', `✅ Login credentials save ho gayi:\nReg No: ${regNo}\nPassword: ${newPassword}`, { regNo, password: newPassword });
      } else {
        send('progress', '⚠️ Reg No auto-detect nahi hua — please note down karo page se');
        // Ask user for reg number
        send('otp', '📋 Page pe jo Registration Number dikh raha hai woh type karo:', { otpFile: OTP_FILE });
        const manualRegNo = await waitForInput(OTP_FILE);
        saveCreds('rrb', { regNo: manualRegNo, password: newPassword, dob: student.dob });
        send('progress', `✅ Credentials saved: ${manualRegNo}`);
      }

      rrbCreds.regNo     = loadCreds()['rrb']?.regNo || regNo;
      rrbCreds.password  = newPassword;
    }

    // ── LOGIN ──────────────────────────────────────────────────
    send('progress', '🔐 Login kar raha hoon...');
    await page.goto('https://rrbapply.gov.in/#/auth/candidate-login', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    await fillInput(page, 'input[name*="regNo" i], input[name*="registration" i], input[placeholder*="registration" i]', rrbCreds.regNo || '');
    await fillInput(page, 'input[name*="dob" i], input[placeholder*="date of birth" i], input[type="date"]', rrbCreds.dob || student.dob);
    await fillInput(page, 'input[type="password"]', rrbCreds.password || '');
    await page.waitForTimeout(500);

    // CAPTCHA (if present)
    const hasCaptcha = await page.$('canvas[id*="captcha"], img[src*="captcha"], .captcha');
    if (hasCaptcha) {
      const captchaText = await page.evaluate(() => {
        const el = document.querySelector('.captcha, [class*="captcha"]');
        return el?.textContent?.replace(/\s+/g,'').trim() || '';
      });
      send('captcha', 'CAPTCHA type karo:', { captchaText });
      const sol = await waitForInput(CAPTCHA_FILE);
      await fillInput(page, 'input[placeholder*="captcha" i], input[name*="captcha" i]', sol);
    }

    // Submit login
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent?.toLowerCase().match(/^login$|^sign in$/i) && !b.disabled);
      if (btn) btn.click();
    });

    try {
      await page.waitForFunction(
        () => window.location.href.includes('dashboard') || window.location.href.includes('home') || window.location.href.includes('apply'),
        { timeout: 12000 }
      );
      send('progress', '✅ Login successful!');
    } catch {
      send('progress', `⚠️ Login redirect nahi hua — current: ${page.url()}`);
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
    await fillInput(page, 'input[name*="mother" i]', student.motherName);
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

    // Screenshot + PDF
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true }).catch(() => null);
    await page.emulateMedia({ media: 'print' });
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } }).catch(() => null);
    await page.emulateMedia({ media: 'screen' });

    if (pdfBuf && pdfBuf.length > 5000) {
      fs.writeFileSync('/tmp/rrb_printout.pdf', pdfBuf);
      send('progress', '✅ PDF saved: /tmp/rrb_printout.pdf');
    }

    send('done', '🎉 RRB Form fill ho gaya! PDF ready hai.', {
      screenshot,
      pdfPath: '/tmp/rrb_printout.pdf',
    });

  } catch (err) {
    const scr = await page.screenshot({ encoding: 'base64' }).catch(() => null);
    send('error', `❌ Error: ${err.message}`, { screenshot: scr });
  }

  await new Promise(r => setTimeout(r, 600000));
  await context.close();
})();
