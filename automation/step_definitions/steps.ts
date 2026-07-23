import { Given, When, Then, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { AppiumDriverManager } from '../../core/appiumDriverManager';
import { BrowserStackDriverManager } from '../../core/browserStackDriverManager';
import { LocatorManager } from '../../core/locatorManager';
import { MobileStepExecutor } from '../../core/mobileStepExecutor';
import { PageFactory } from '../pageFactory';
import { RecordedStep } from '../../core/models';
import assert from 'assert';
import * as fs from 'fs';

setDefaultTimeout(120 * 1000);

// ─── Configuración de sesión ──────────────────────────────────────────────────
const SESSION_CONFIG_PATH = './resources/session_config.json';

function loadSessionConfig(): any {
    try {
        return JSON.parse(fs.readFileSync(SESSION_CONFIG_PATH, 'utf-8'));
    } catch {
        return null;
    }
}

// ─── Dependencias compartidas ─────────────────────────────────────────────────
const lm = new LocatorManager('./resources/locators/recorded.locators');
let dm: AppiumDriverManager;

Before(async () => {
    const cfg = loadSessionConfig();

    if (cfg?.type === 'browserstack') {
        console.log(`[Test] BrowserStack — ${cfg.platform || 'android'} — ${cfg.deviceName}`);
        dm = new BrowserStackDriverManager();
    } else {
        console.log('[Test] Local — dispositivo físico');
        dm = new AppiumDriverManager();
    }

    await dm.init(cfg ?? {
        deviceName:      process.env.DEVICE_NAME      || 'SM-A566E',
        udid:            process.env.DEVICE_UDID      || 'R5GL34VQKAX',
        platformVersion: process.env.PLATFORM_VERSION || '16',
        appPackage:      process.env.APP_PACKAGE      || 'com.yape.qa',
        appActivity:     process.env.APP_ACTIVITY     || '.MainActivity',
    });

    const executor = new MobileStepExecutor(dm, lm);
    PageFactory.init(dm, executor, lm);
});

After(async () => {
    await dm.quit();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolve(locator: string): string {
    return locator.startsWith('{') ? lm.resolve(locator) : locator;
}

async function waitForElement(selector: string, timeoutMs = 15000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const el = await dm.findElement(selector);
            if (await el.isDisplayed()) return;
        } catch {}
        await new Promise(r => setTimeout(r, 800));
    }
    throw new Error(`Elemento no encontrado despues de ${timeoutMs}ms: ${selector}`);
}

function step(s: RecordedStep) {
    return PageFactory.base['executor'].execute(s);
}

// ─── Steps ───────────────────────────────────────────────────────────────────
Given('el usuario abre la app {string}', async (pkg: string) => {
    await step({ action: 'ABRIR_APP', value: pkg });
});

When('el usuario hace click en {string}', async (locator: string) => {
    const sel = resolve(locator);
    await waitForElement(sel);
    const r = await step({ action: 'CLICK', selector: sel });
    assert.ok(r.success, r.message);
});

When('el usuario escribe {string} en {string}', async (texto: string, locator: string) => {
    const sel = resolve(locator);
    await waitForElement(sel);
    const r = await step({ action: 'ESCRIBIR', selector: sel, value: texto });
    assert.ok(r.success, r.message);
});

When('el usuario limpia el campo {string}', async (locator: string) => {
    const sel = resolve(locator);
    await waitForElement(sel);
    await step({ action: 'LIMPIAR', selector: sel });
});

When('el usuario hace scroll hacia abajo', async () => {
    await step({ action: 'SCROLL_DOWN' });
});

When('el usuario hace scroll hacia arriba', async () => {
    await step({ action: 'SCROLL_UP' });
});

When('el usuario hace scroll hasta {string}', async (locator: string) => {
    await step({ action: 'SCROLL_HASTA', selector: resolve(locator) });
});

When('el usuario hace swipe {string}', async (direction: string) => {
    await step({ action: 'SWIPE', value: direction });
});

When('el usuario hace presion larga en {string}', async (locator: string) => {
    const sel = resolve(locator);
    await waitForElement(sel);
    await step({ action: 'PRESION_LARGA', selector: sel });
});

When('el usuario presiona volver', async () => {
    await step({ action: 'VOLVER' });
});

When('el usuario espera {string} segundos', async (seg: string) => {
    await step({ action: 'ESPERAR', value: seg });
});

When('el usuario toma una captura {string}', async (_nombre: string) => {
    await step({ action: 'SCREENSHOT' });
});

Then('el usuario verifica el texto {string} en {string}', async (texto: string, locator: string) => {
    const sel = resolve(locator);
    await waitForElement(sel);
    const r = await step({ action: 'VERIFICAR_TEXTO', selector: sel, value: texto });
    assert.ok(r.success, r.message);
});

Then('el elemento {string} es visible', async (locator: string) => {
    const sel = resolve(locator);
    await waitForElement(sel);
    const r = await step({ action: 'VERIFICAR_EXISTE', selector: sel });
    assert.ok(r.success, r.message);
});

Then('el elemento {string} no es visible', async (locator: string) => {
    const r = await step({ action: 'VERIFICAR_NO_EXISTE', selector: resolve(locator) });
    assert.ok(r.success, r.message);
});
