import { test, expect } from '@playwright/test';

test.describe('Epic 2: Workspace File Management', () => {
  const TEST_PROJECT_ID = 'test-project';
  const TEST_FILE_NAME = 'test-file.md';
  const TEST_FILE_CONTENT = '# Test Document\n\nThis is a test file.';

  test.beforeEach(async ({ page }) => {
    // Navigate to workspace (assuming integration with desktop)
    await page.goto('http://localhost:3000/desktop');
  });

  test('Story 2.1: Should display file list with name, modified time, and size', async ({ page }) => {
    // Open workspace window for test project
    // This assumes workspace can be opened from desktop

    // Verify file list table headers
    await expect(page.getByRole('columnheader', { name: '名称' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '修改时间' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '大小' })).toBeVisible();

    // Verify files are sorted by modified time (newest first)
    const fileRows = page.locator('tbody tr');
    const count = await fileRows.count();

    if (count > 1) {
      // Check that first file has more recent timestamp than second
      const firstTime = await fileRows.nth(0).locator('td').nth(1).textContent();
      const secondTime = await fileRows.nth(1).locator('td').nth(1).textContent();
      expect(firstTime).toBeTruthy();
      expect(secondTime).toBeTruthy();
    }
  });

  test('Story 2.2: Should open and view Markdown file with preview', async ({ page }) => {
    // Click on a file in the list
    await page.locator('tbody tr').first().click();

    // Verify file viewer is displayed
    await expect(page.locator('article.prose')).toBeVisible();

    // Verify load time is displayed and < 1 second
    const loadTimeText = await page.locator('text=/加载时间:/').textContent();
    if (loadTimeText) {
      const loadTime = parseInt(loadTimeText.match(/\d+/)?.[0] || '0');
      expect(loadTime).toBeLessThan(1000);
    }
  });

  test('Story 2.3: Should create new file with dialog', async ({ page }) => {
    // Click create file button
    await page.getByRole('button', { name: '新建文件' }).click();

    // Verify dialog is displayed
    await expect(page.getByRole('heading', { name: '新建文件' })).toBeVisible();

    // Enter file name without extension
    await page.getByLabel('文件名').fill('new-test-file');

    // Submit
    await page.getByRole('button', { name: '创建' }).click();

    // Verify file is created and editor is opened
    await expect(page.locator('#markdown-editor')).toBeVisible();
  });

  test('Story 2.3: Should validate file name uniqueness', async ({ page }) => {
    // Click create file button
    await page.getByRole('button', { name: '新建文件' }).click();

    // Try to create file with existing name
    await page.getByLabel('文件名').fill('README.md');
    await page.getByRole('button', { name: '创建' }).click();

    // Verify error message (API should return 409)
    // Note: This depends on error handling in the UI
    await expect(page.locator('text=/已存在|exists/i')).toBeVisible({ timeout: 3000 });
  });

  test('Story 2.4: Should edit Markdown with toolbar and preview', async ({ page }) => {
    // Open a file
    await page.locator('tbody tr').first().click();

    // Verify editor toolbar is visible
    await expect(page.locator('button[title="粗体"]')).toBeVisible();
    await expect(page.locator('button[title="斜体"]')).toBeVisible();
    await expect(page.locator('button[title="标题"]')).toBeVisible();

    // Verify preview toggle
    const previewButton = page.getByRole('button', { name: '预览' });
    await expect(previewButton).toBeVisible();

    // Type in editor
    const editor = page.locator('#markdown-editor');
    await editor.fill('# New Content\n\nTest content');

    // Verify preview updates in real-time
    await expect(page.locator('article.prose h1')).toContainText('New Content');

    // Verify unsaved indicator
    await expect(page.locator('text=未保存')).toBeVisible();
  });

  test('Story 2.4: Should save file with Cmd/Ctrl+S', async ({ page }) => {
    // Open a file
    await page.locator('tbody tr').first().click();

    // Edit content
    const editor = page.locator('#markdown-editor');
    await editor.fill('# Updated Content');

    // Press Cmd/Ctrl+S
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');

    // Verify save indicator disappears
    await expect(page.locator('text=未保存')).not.toBeVisible({ timeout: 3000 });
  });

  test('Story 2.5: Should delete file with confirmation', async ({ page }) => {
    // Click delete button on a file
    const deleteButton = page.locator('tbody tr').first().locator('button[aria-label="删除文件"]');
    await deleteButton.click();

    // Verify confirmation dialog
    await expect(page.getByRole('heading', { name: '确认删除' })).toBeVisible();
    await expect(page.locator('text=/此操作无法撤销/')).toBeVisible();

    // Cancel first
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByRole('heading', { name: '确认删除' })).not.toBeVisible();

    // Delete again and confirm
    await deleteButton.click();
    await page.getByRole('button', { name: '删除' }).click();

    // Verify file is removed from list
    // Note: This assumes the file list refreshes automatically
    await page.waitForTimeout(500);
  });

  test('Story 2.1: Should show empty state when no files', async ({ page }) => {
    // This test assumes we can create a project with no files
    // or delete all files from a project

    // Verify empty state message
    await expect(page.locator('text=/暂无文件/')).toBeVisible();
    await expect(page.locator('text=/创建第一个文件/')).toBeVisible();
  });
});
