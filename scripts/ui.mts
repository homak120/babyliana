import type { Page } from 'playwright'

/**
 * Get a fresh context past the welcome and into the app.
 *
 * The welcome became two pages when the gate landed, and every browser suite
 * bootstrapped by filling the name field alone — so all of them stalled on page
 * one at once. One helper, so the next change to first-run costs one edit.
 */
export async function enterApp(p: Page, name = 'Anya') {
  const gate = p.locator('#code')
  if (await gate.isVisible().catch(() => false)) {
    await gate.fill('08242026')
    await p.locator('.gate .save').click()
    await p.waitForTimeout(300)
  }
  const field = p.getByPlaceholder(name)
  if (await field.isVisible().catch(() => false)) {
    await field.fill(name)
    await p.getByRole('button', { name: 'start logging' }).click()
    await p.waitForTimeout(400)
  }
}
