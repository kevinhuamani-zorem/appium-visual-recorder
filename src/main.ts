import { app, BrowserWindow, ipcMain } from 'electron';

// Fix GPU crash en macOS Apple Silicon
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');

import path from 'path';
import { AppiumDriverManager } from './appiumDriverManager';
import { MobileInspector } from './mobileInspector';
import { MobileStepExecutor } from './mobileStepExecutor';
import { LocatorManager } from './locatorManager';
import { FeatureGenerator } from './featureGenerator';
import { RecordedStep } from './models';

let mainWindow: BrowserWindow | null = null;

const dm             = new AppiumDriverManager();
const locatorManager = new LocatorManager('./recorded/locators/recorded.locators');
const featureGen     = new FeatureGenerator('./recorded/features', './recorded/locators/recorded.locators');

let inspector:     MobileInspector    | null = null;
let executor:      MobileStepExecutor | null = null;
let recordedSteps: RecordedStep[]     = [];
let sessionActive  = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 860,
        minWidth: 960,
        minHeight: 700,
        title: 'Appium Visual Recorder',
        backgroundColor: '#1E1E2E',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.on('closed', () => { mainWindow = null; });

    // Notificar al renderer cuando este listo
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('[Main] Renderer listo');
    });
}

app.whenReady().then(() => {
    console.log('[Main] Abriendo ventana...');
    createWindow();
    console.log('[Main] Ventana lista');
});

app.on('window-all-closed', async () => {
    if (sessionActive) await dm.quit();
    app.quit();
});

// ─── IPC HANDLERS ────────────────────────────────────────────────────────────

ipcMain.handle('get-devices', async () => {
    const devices = await AppiumDriverManager.getConnectedDevices();
    const enriched = await Promise.all(devices.map(async d => {
        const info = await AppiumDriverManager.getDeviceInfo(d.udid);
        return { ...d, ...info };
    }));
    return { devices: enriched };
});

ipcMain.handle('get-foreground-app', async (_, udid: string) => {
    return await AppiumDriverManager.getForegroundApp(udid);
});

ipcMain.handle('start-session', async (_, config: any) => {
    try {
        await dm.startAppiumServer();
        await dm.init(config);
        inspector  = new MobileInspector(dm);
        executor   = new MobileStepExecutor(dm, locatorManager);
        sessionActive = true;
        const screenshot = await inspector.captureScreenshot();
        return { success: true, screenshot };
    } catch (e: any) {
        console.error('[Main] Error:', e.message);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('get-screenshot', async () => {
    if (!inspector) return { success: false, error: 'Sin sesion' };
    try {
        const screenshot = await inspector.captureScreenshot();
        return { success: true, screenshot };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('activate-inspector', async () => {
    if (!inspector) return { success: false, error: 'Sin sesion activa' };
    await inspector.activate();
    const xpath = await inspector.waitForSelection(30);
    if (xpath) {
        const tag       = inspector.getLastTag();
        const suggested = inspector.suggestVariableName(xpath, tag);
        await inspector.bringPanelToFront(mainWindow);
        const screenshot = await inspector.captureScreenshot().catch(() => undefined);
        return { success: true, xpath, tag, suggested, screenshot };
    }
    await inspector.bringPanelToFront(mainWindow);
    return { success: false, error: 'Cancelado o timeout' };
});

ipcMain.handle('verify-selector', async (_, selector: string) => {
    if (!inspector) return { success: false, summary: 'Sin sesion activa' };
    try {
        const el         = await dm.findElement(selector);
        await el.waitForDisplayed({ timeout: 5000 });
        const text       = await el.getText().catch(() => '');
        const tag        = await el.getTagName().catch(() => '');
        const screenshot = await inspector.captureScreenshot().catch(() => undefined);
        return { success: true, summary: `✓ Encontrado: <${tag}>${text ? ` "${text}"` : ''}`, screenshot };
    } catch {
        return { success: false, summary: `✗ No encontrado: ${selector}` };
    }
});

ipcMain.handle('execute-step', async (_, stepData: RecordedStep) => {
    if (!executor) return { success: false, message: 'Sin sesion activa' };
    if (stepData.variableName && stepData.selector) {
        if (!locatorManager.exists(stepData.variableName)) {
            locatorManager.add(stepData.variableName, stepData.selector);
        }
    }
    const result = await executor.execute(stepData);
    if (result.success) {
        recordedSteps.push(stepData);
        const screenshot = await inspector?.captureScreenshot().catch(() => undefined);
        return { ...result, totalSteps: recordedSteps.length, screenshot };
    }
    return { ...result, totalSteps: recordedSteps.length };
});

ipcMain.handle('delete-step', async (_, index: number) => {
    if (index >= 0 && index < recordedSteps.length) recordedSteps.splice(index, 1);
    return { success: true, totalSteps: recordedSteps.length };
});

ipcMain.handle('clear-steps', async () => {
    recordedSteps = [];
    return { success: true };
});

ipcMain.handle('preview-gherkin', async (_, featureName: string, scenarioName: string) => {
    return { success: true, preview: featureGen.preview(featureName, scenarioName, recordedSteps) };
});

ipcMain.handle('generate-files', async (_, featureName: string, scenarioName: string) => {
    if (recordedSteps.length === 0) return { success: false, error: 'No hay steps grabados' };
    const filePath     = featureGen.generate(featureName, scenarioName, recordedSteps);
    const locatorsPath = locatorManager.getFilePath();
    return { success: true, featurePath: filePath, locatorsPath };
});

ipcMain.handle('get-steps', async () => ({ steps: recordedSteps }));

ipcMain.handle('close-session', async () => {
    if (sessionActive) {
        await dm.quit();
        sessionActive = false;
        inspector = null;
        executor  = null;
    }
    return { success: true };
});

ipcMain.handle('get-page-source', async () => {
    try {
        const xml = await dm.getPageSource();
        return { success: true, xml };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('find-element-at', async (_, x: number, y: number) => {
    try {
        const xml = await dm.getPageSource();
        return { success: true, xml };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});
