import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');

import path from 'path';
import { AppiumDriverManager } from '../../core/appiumDriverManager';
import { MobileInspector } from './mobileInspector';
import { MobileStepExecutor } from '../../core/mobileStepExecutor';
import { LocatorManager } from '../../core/locatorManager';
import { FeatureGenerator } from './featureGenerator';
import { RecordedStep } from '../../core/models';

let mainWindow: BrowserWindow | null = null;

const dm             = new AppiumDriverManager();
const locatorManager = new LocatorManager('./resources/locators/recorded.locators');
const featureGen     = new FeatureGenerator('./features/yape-features', './resources/locators/recorded.locators');

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
            preload: path.join(__dirname, 'preload.js')  // dist/recorder/src/preload.js ✓
        }
    });

    // __dirname = dist/recorder/src/ → subir tres niveles hasta la raíz del proyecto
    mainWindow.loadFile(path.join(__dirname, '../../../recorder/renderer/index.html'));
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.on('closed', () => { mainWindow = null; });

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
    const result = await inspector.waitForSelection(30);
    await inspector.bringPanelToFront(mainWindow);
    if (result && result.candidates.length > 0) {
        const screenshot = await inspector.captureScreenshot().catch(() => undefined);
        return {
            success:    true,
            candidates: result.candidates,   // SelectorCandidate[]
            suggested:  result.suggested,    // nombre de variable sugerido
            tag:        result.tag,
            // compatibilidad: el P1 como xpath para código que aún use result.xpath
            xpath:      result.candidates[0].selector,
            screenshot,
        };
    }
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

// ─── LINKED JSON ─────────────────────────────────────────────────────────────

ipcMain.handle('generate-linked-files', async (_, featureName: string, scenarioName: string, stepRows: { keyword: string; text: string }[], linked: Record<string, any[]>) => {
    try {
        const featuresDir = './features/yape-features';
        const jsonDir     = './resources';
        fs.mkdirSync(featuresDir, { recursive: true });
        fs.mkdirSync(jsonDir, { recursive: true });

        // Generar .feature con keywords elegidos por el usuario
        const fileName = featureName.toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
        const featurePath = `${featuresDir}/${fileName}.feature`;
        const date = new Date().toLocaleString('es-PE');
        const lines = [
            `# Generado por Appium Visual Recorder`,
            `# Fecha: ${date}`,
            `# Locators: ./resources/locators/recorded.locators`,
            '',
            `Feature: ${featureName}`,
            '',
            `  Scenario: ${scenarioName}`,
            ...stepRows.map(r => `    ${r.keyword} ${r.text}`),
            ''
        ];
        fs.writeFileSync(featurePath, lines.join('\n'), 'utf-8');

        // Merge del JSON enlazado (agrega keys nuevas, no reemplaza el archivo)
        const jsonPath = `${jsonDir}/scenario_linked.json`;
        let existing: Record<string, any[]> = {};
        if (fs.existsSync(jsonPath)) {
            try { existing = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')); } catch { existing = {}; }
        }
        const merged = { ...existing, ...linked };
        fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2), 'utf-8');

        return { success: true, featurePath, jsonPath };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});
