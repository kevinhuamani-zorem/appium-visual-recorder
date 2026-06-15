import { Given, When, Then, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { AppiumDriverManager } from '../../core/appiumDriverManager';
import { LocatorManager } from '../../core/locatorManager';
import { MobileStepExecutor } from '../../core/mobileStepExecutor';
import { RecordedStep } from '../../core/models';
import assert from 'assert';
import * as fs from 'fs';

setDefaultTimeout(60 * 1000);

const dm = new AppiumDriverManager();
const lm = new LocatorManager('./resources/locators/recorded.locators');
let executor: MobileStepExecutor;

Before(async () => {
    await dm.init({
        deviceName:      'SM-A566E',
        udid:            'R5GL34VQKAX',
        platformVersion: '16',
        appPackage:      process.env.APP_PACKAGE || 'com.yape.qa',
        appActivity:     process.env.APP_ACTIVITY || '.MainActivity',
    });
    executor = new MobileStepExecutor(dm, lm);
});

After(async () => {
    await dm.quit();
});

function step(s: RecordedStep) { return executor.execute(s); }

function resolve(locator: string): string {
    return locator.startsWith('{') ? lm.resolve(locator) : locator;
}

async function waitForElement(selector: string, timeoutMs = 15000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const el = await dm.findElement(selector);
            const displayed = await el.isDisplayed();
            if (displayed) return;
        } catch {}
        await new Promise(r => setTimeout(r, 800));
    }
    throw new Error(`Elemento no encontrado despues de ${timeoutMs}ms: ${selector}`);
}

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
    const sel = resolve(locator);
    const r = await step({ action: 'VERIFICAR_NO_EXISTE', selector: sel });
    assert.ok(r.success, r.message);
});

// ── Linked steps (scenario_linked.json) ──────────────────────────────────────

const LINKED_STEPS_PATH = './resources/scenario_linked.json';
const SKIP_ACTIONS = new Set(['ABRIR_APP']);
const NEEDS_WAIT = new Set(['CLICK', 'ESCRIBIR', 'LIMPIAR', 'PRESION_LARGA',
    'SCROLL_HASTA', 'VERIFICAR_TEXTO', 'VERIFICAR_EXISTE', 'VERIFICAR_NO_EXISTE']);

function loadLinkedSteps(): Record<string, RecordedStep[]> {
    try {
        return JSON.parse(fs.readFileSync(LINKED_STEPS_PATH, 'utf-8'));
    } catch {
        return {};
    }
}

const linkedStepsMap = loadLinkedSteps();

Object.entries(linkedStepsMap).forEach(([stepText, steps]) => {
    Given(stepText, async () => {
        for (const s of steps) {
            if (SKIP_ACTIONS.has(s.action)) continue;
            const resolvedSelector = s.variableName
                ? lm.resolve(s.variableName)
                : (s.selector ? resolve(s.selector) : undefined);
            const normalizedStep = { ...s, selector: resolvedSelector };
            if (resolvedSelector && NEEDS_WAIT.has(s.action)) {
                await waitForElement(resolvedSelector);
            }
            const r = await executor.execute(normalizedStep);
            if (r && !r.success) {
                assert.ok(r.success, r.message);
            }
        }
    });
});
