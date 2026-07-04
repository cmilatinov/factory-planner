import { expect, test } from '@playwright/test'

test('planner blueprint workflow', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear()
  })
  await page.goto('/')

  await expect(page.getByTestId('panel-planner')).toBeVisible()
  await page.getByTestId('panel-planner').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Show Statistics' }).click()
  await expect(page.getByRole('dialog', { name: 'Production planner - Statistics' })).toBeVisible()
  await page.getByRole('button', { name: 'Close Production planner - Statistics' }).click()

  await page.getByRole('tab', { name: 'Recipe Library' }).click()
  await page
    .getByTestId('recipe-row-iron-plate')
    .dragTo(page.getByTestId('planner-canvas'), { targetPosition: { x: 300, y: 160 } })
  await expect(page.locator('[data-id^="node-iron-plate-"]').first()).toBeVisible()

  await page.getByRole('button', { name: /Generate all blueprints for plan/i }).click()
  await page.getByRole('tab', { name: 'Blueprint List' }).click()
  await expect(page.getByRole('textbox', { name: /Rename Iron Plate - 2x Constructor/i })).toBeVisible()

  await page.getByRole('button', { name: /Open/i }).first().click()
  await expect(page.getByTestId('placement-preview')).toContainText('Valid placement')
  await page.getByRole('button', { name: /Collision preview/i }).click()
  await expect(page.getByTestId('placement-preview')).toContainText(/Collision blocks|Clipping allowed/)

  await page.getByRole('button', { name: /Stack belts/i }).click()
  await expect(page.getByTestId('stack-count-badge').first()).toHaveText('x3')

  await page.getByRole('button', { name: /Reset layout/i }).first().click()
  await expect(page.getByTestId('panel-planner')).toBeVisible()
})
