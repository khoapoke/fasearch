import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/home/dolakhoa/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core");

const CHROMIUM_PATH = "/home/dolakhoa/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome";
const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:3151";
const FIXTURE_PATH = "/home/dolakhoa/.config/fasearch/customer-profile-test.json";

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
const customerAcc = fixture.accounts.find((a) => a.role === "CUSTOMER");
if (!customerAcc) {
  throw new Error("CUSTOMER account not found in test fixture");
}

async function verifyProfileKeyboardFocus() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  const viewports = [
    { name: "desktop 1440", width: 1440, height: 900 },
    { name: "mobile 390", width: 390, height: 844 },
  ];

  const results = [];

  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    // 1. Authenticate via keyboard Enter
    await page.goto(`${BASE_URL}/dang-nhap`);
    await page.waitForTimeout(500);
    const userField = page.locator("#login-username");
    await userField.focus();
    await page.keyboard.type(customerAcc.username);

    const passField = page.locator("#login-password");
    await passField.focus();
    await page.keyboard.type(customerAcc.password);

    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);

    await page.goto(`${BASE_URL}/tai-khoan/thong-tin`);
    await page.waitForTimeout(2000);

    // 2. Open edit profile form
    const editBtn = page.locator('button:has-text("Chỉnh sửa hồ sơ")');
    await editBtn.waitFor({ state: "visible", timeout: 5000 });
    await editBtn.click();

    const phoneInput = page.locator("#acct-phone");
    await phoneInput.waitFor({ state: "visible", timeout: 5000 });
    await phoneInput.fill("0123bad");

    // 3. First invalid submit via keyboard
    // Focus save button and submit via Enter
    const saveBtn = page.locator('button[type="submit"]:has-text("Lưu thay đổi")');
    await saveBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);

    const firstSubmit = await page.evaluate(() => {
      const errP = document.querySelector('.acct-edit-form [role="alert"]');
      const active = document.activeElement;
      return {
        isSameAsErrorP: active === errP,
        tagName: active ? active.tagName : null,
        role: active ? active.getAttribute("role") : null,
        hasErrorClass: active ? active.classList.contains("auth-status") : false,
        text: active ? active.textContent : null,
      };
    });

    assert.equal(
      firstSubmit.isSameAsErrorP,
      true,
      `[${vp.name}] First invalid submit must focus error <p role="alert"> directly (got ${firstSubmit.tagName})`,
    );
    assert.equal(firstSubmit.tagName, "P");
    assert.equal(firstSubmit.role, "alert");
    assert.match(firstSubmit.text || "", /Số điện thoại không đúng định dạng/);

    // 4. Tab through form back to Save button (leaving invalid value identical)
    // From error p, tab forward until activeElement is the Save button
    let tabSteps = 0;
    while (tabSteps < 15) {
      await page.keyboard.press("Tab");
      tabSteps++;
      const isSaveBtn = await page.evaluate(() => {
        const active = document.activeElement;
        return active?.tagName === "BUTTON" && active?.getAttribute("type") === "submit";
      });
      if (isSaveBtn) break;
    }

    const onSaveBeforeRepeat = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        tagName: active ? active.tagName : null,
        type: active ? active.getAttribute("type") : null,
        text: active ? active.textContent : null,
      };
    });
    assert.equal(onSaveBeforeRepeat.tagName, "BUTTON", `Must have tabbed to Save button before repeat submit`);
    assert.equal(onSaveBeforeRepeat.type, "submit");

    // 5. Repeat identical invalid submit via keyboard Enter on Save button
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);

    const repeatSubmit = await page.evaluate(() => {
      const errP = document.querySelector('.acct-edit-form [role="alert"]');
      const active = document.activeElement;
      return {
        isSameAsErrorP: active === errP,
        tagName: active ? active.tagName : null,
        role: active ? active.getAttribute("role") : null,
        hasErrorClass: active ? active.classList.contains("auth-status") : false,
        text: active ? active.textContent : null,
      };
    });

    assert.equal(
      repeatSubmit.isSameAsErrorP,
      true,
      `[${vp.name}] Repeated identical invalid submit must re-focus error <p role="alert"> (got ${repeatSubmit.tagName})`,
    );
    assert.equal(repeatSubmit.tagName, "P");
    assert.equal(repeatSubmit.role, "alert");
    assert.match(repeatSubmit.text || "", /Số điện thoại không đúng định dạng/);

    // 6. Clean up: cancel edit form
    const cancelBtn = page.locator('button:has-text("Hủy")');
    await cancelBtn.click();
    await page.waitForTimeout(200);

    results.push({
      viewport: `${vp.width}x${vp.height} (${vp.name})`,
      firstSubmitActiveElement: firstSubmit.tagName,
      firstSubmitIsErrorP: firstSubmit.isSameAsErrorP,
      repeatSubmitActiveElement: repeatSubmit.tagName,
      repeatSubmitIsErrorP: repeatSubmit.isSameAsErrorP,
      status: "PASS",
    });

    await ctx.close();
  }

  await browser.close();
  return results;
}

verifyProfileKeyboardFocus()
  .then((results) => {
    console.log(JSON.stringify({ status: "SUCCESS", results }, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error("Focus regression failed:", err);
    process.exit(1);
  });
