export async function waitForPaceLoad(page) {
  await page.waitForFunction(() => {
    const pace = document.querySelector('.pace');
    return pace && pace.classList.contains('pace-inactive');
  });
}
export async function login(page) {
  await page.goto('adminLogin.php');
  await page.waitForTimeout(3000);
  await page.getByRole('textbox', { name: 'Enter Username/Email' }).fill('abc_admin');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin@123');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('adminDashboard.php');
  await page.waitForTimeout(5000);
}

export async function login_superadmin(page){
  await page.goto('superAdminLogin.php');
  await page.locator('#usernameInput').waitFor({state: 'visible'});
  await page.locator('#usernameInput').click();
  await page.locator('#usernameInput').fill('super_123');
  await page.locator('#passwordInput').click();
  await page.locator('#passwordInput').fill('pass_123');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('superAdminShowAdmins.php');
  await page.waitForTimeout(5000);
}
export async function execute_learningplan_activation_cron(page){
  await page.goto('superAdminLogin.php');
  await page.locator('#usernameInput').waitFor({state: 'visible'});
  await page.locator('#usernameInput').click();
  await page.locator('#usernameInput').fill('pass_123');
  await page.locator('#passwordInput').click();
  await page.locator('#passwordInput').fill('pass_123');
  await page.getByRole('button', { name: 'Login' }).click();
  await waitForPaceLoad(page);
  await page.getByRole('link', { name: 'Crons' }).click();
  await waitForPaceLoad(page);
  await page.getByRole('row', { name: '4 LearningPlansActivation' }).getByRole('button').first().click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'OK' }).click();
  await page.waitForTimeout(2000);
  const successToast = page.locator('.toast-message', { hasText: /Successfully/i }).first();
  try {
      await Promise.race([
        successToast.waitFor({ state: 'visible', timeout: 4000 }),
      ]);
      if (await successToast.isVisible()) {
        console.log(`\x1b[32m ✅lp activation cron executed  success message showed successfully!\x1b[0m`);
      }
    } catch (e) {
      console.log("⚠️ lp activation cron  success message not showed (validation / no toastr /save button didn't trigger)");
    }
}

export async function click_checkboxes_of_permissions_throgh_superadmin(page) {
  const checkboxes = page.locator('.icheckbox_square-green');
  const count = await checkboxes.count();

  for (let i = 0; i < count; i++) {
    const checkbox = checkboxes.nth(i);

    const cls = await checkbox.getAttribute("class");
    const isChecked = cls.includes("checked");

    if (!isChecked) {
      console.log(`✔ Checking checkbox #${i}`);
      await checkbox.click();
    } else {
      console.log(`⚠ Already checked #${i}`);
    }
  }
}
export async function tostr_detector(page, timeout = 4000) {
  const anyToast = page.locator('.toast-message');
  const results = [];
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      // If page is navigating, this will throw — so we catch it.
      const count = await anyToast.count().catch(() => -1);
      if (count === -1) {
        // Navigation happened → stop detection cleanly
        console.log('⚠️ Stopping toast detection (navigation detected).');
        break;
      }

      if (count === 0) {
        await page.waitForTimeout(150);
        continue;
      }

      for (let i = 0; i < count; i++) {
        const toast = anyToast.nth(i);

        const isVisible = await toast.isVisible().catch(() => false);
        if (!isVisible) continue;

        const text = await toast.innerText().catch(() => null);
        if (!text) continue;

        let type = 'other';
        if (/success/i.test(text)) type = 'success';
        else if (/error|fail|exception|sql|invalid/i.test(text)) type = 'error';

        if (!results.find(r => r.text === text)) {
          results.push({ type, text });
        }

        // Wait for toast to disappear (ignore errors)
        await toast.waitFor({ state: 'hidden' }).catch(() => {});
      }
    } catch {
      console.log('⚠️ Toast detector caught navigation, stopping.');
      break;
    }
  }

  // Log results
  if (results.length === 0) {
    console.log('⚠️ No toasts appeared.');
  } else {
    for (const r of results) {
      if (r.type === 'success') console.log(`\x1b[32m✅ Success Toast: ${r.text} \x1b[0m`);
      else if (r.type === 'error') console.log(`\x1b[31m ❌ Error Toast: ${r.text} \x1b[0m`);
      else console.log(`\x1b[35m ⚠️ Other Toast: ${r.text}\x1b[0m`);
    }
  }

  return results;
}


export async function attachNetworkLogger(page) {

  // Defined all error strings to watch for here
  const errorPatterns = [
    "Error validating token",
    "Error fetching data from",
    "Error fetching multiple APIs",
    "Error downloading the PDF:"
  ].map(p => p.toLowerCase()); 

  // Console.error logs
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;

    const text = msg.text().toLowerCase();

    if (errorPatterns.some(pattern => text.includes(pattern))) {
      console.log(`\x1b[31m❌ MATCHED CONSOLE ERROR: ${msg.text()}\x1b[0m`);
    }
  });

  // Network responses with status >= 400
  page.on("response", async (response) => {
    const status = response.status();
    if (status < 400) return;

    const url = response.url();
    const body = await safeJson(response);
    const combined = `${url} ${JSON.stringify(body)}`.toLowerCase();

    if (errorPatterns.some(pattern => combined.includes(pattern))) {
      console.log(`\x1b[31m❌ MATCHED NETWORK ERROR: ${status} | ${url}\x1b[0m`);
      console.log("📦 Payload:", body );
    }
  });

  // Failed requests (timeout, DNS, blocked, etc.)
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText.toLowerCase() || "";

    if (errorPatterns.some(pattern => failure.includes(pattern))) {
      console.log(`\x1b[31m❌ MATCHED FAILED REQUEST: ${request.url()} - ${failure}\x1b[0m`);
    }
  });
}
// Safe JSON parsing
async function safeJson(response) {
  try { return await response.json(); }
  catch { return {}; }
}

