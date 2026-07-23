import { AppiumDriverManager } from '../../../core/appiumDriverManager';
import { LocatorManager } from '../../../core/locatorManager';
import { MobileStepExecutor } from '../../../core/mobileStepExecutor';

/**
 * BasePage
 *
 * + Provee métodos comunes de interacción y espera.
 */
export class BasePage {
    protected readonly executor: MobileStepExecutor;
    protected readonly lm: LocatorManager;
    protected readonly dm: AppiumDriverManager;

    constructor(dm: AppiumDriverManager, executor: MobileStepExecutor, lm: LocatorManager) {
        this.dm       = dm;
        this.executor = executor;
        this.lm       = lm;
    }

    /** Convierte un nombre de locator en su selector XPath. */
    protected sel(name: string): string {
        return this.lm.resolve(name);
    }


    async waitFor(name: string, timeoutMs = 15_000): Promise<void> {
        const selector = this.sel(name);
        const start    = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const el        = await this.dm.findElement(selector);
                const displayed = await el.isDisplayed();
                if (displayed) return;
            } catch { /* no encontrado */ }
            await this.sleep(800);
        }
        throw new Error(`[${this.constructor.name}] Elemento no visible tras ${timeoutMs}ms: "${name}" → ${selector}`);
    }

    async waitForAny(names: string[], timeoutMs = 15_000): Promise<string> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            for (const name of names) {
                if (await this.isVisible(name)) return name;
            }
            await this.sleep(800);
        }
        throw new Error(`[${this.constructor.name}] Ninguno de [${names.join(', ')}] apareció tras ${timeoutMs}ms`);
    }

    async isVisible(name: string): Promise<boolean> {
        try {
            const el = await this.dm.findElement(this.sel(name));
            return await el.isDisplayed();
        } catch {
            return false;
        }
    }

    // ── Acciones ─────────────────────────────────────────────────────────────

    async click(name: string): Promise<void> {
        await this.waitFor(name);
        const r = await this.executor.execute({ action: 'CLICK', selector: this.sel(name) });
        if (!r.success) throw new Error(`[${this.constructor.name}] click("${name}"): ${r.message}`);
    }

    async type(name: string, value: string): Promise<void> {
        await this.waitFor(name);
        const r = await this.executor.execute({ action: 'ESCRIBIR', selector: this.sel(name), value });
        if (!r.success) throw new Error(`[${this.constructor.name}] type("${name}"): ${r.message}`);
    }

    async clear(name: string): Promise<void> {
        await this.waitFor(name);
        const r = await this.executor.execute({ action: 'LIMPIAR', selector: this.sel(name) });
        if (!r.success) throw new Error(`[${this.constructor.name}] clear("${name}"): ${r.message}`);
    }

    async verifyText(name: string, expected: string): Promise<void> {
        await this.waitFor(name);
        const r = await this.executor.execute({ action: 'VERIFICAR_TEXTO', selector: this.sel(name), value: expected });
        if (!r.success) throw new Error(`[${this.constructor.name}] verifyText("${name}"): ${r.message}`);
    }

    async swipe(direction: 'left' | 'right' | 'up' | 'down'): Promise<void> {
        await this.executor.execute({ action: 'SWIPE', value: direction });
    }

    async scrollDown(): Promise<void> {
        await this.executor.execute({ action: 'SCROLL_DOWN' });
    }

    async scrollUp(): Promise<void> {
        await this.executor.execute({ action: 'SCROLL_UP' });
    }

    async scrollTo(name: string): Promise<void> {
        await this.executor.execute({ action: 'SCROLL_HASTA', selector: this.sel(name) });
    }

    async verifyExists(name: string): Promise<void> {
        await this.waitFor(name);
        const r = await this.executor.execute({ action: 'VERIFICAR_EXISTE', selector: this.sel(name) });
        if (!r.success) throw new Error(`[${this.constructor.name}] verifyExists("${name}"): ${r.message}`);
    }

    async verifyNotExists(name: string): Promise<void> {
        const r = await this.executor.execute({ action: 'VERIFICAR_NO_EXISTE', selector: this.sel(name) });
        if (!r.success) throw new Error(`[${this.constructor.name}] verifyNotExists("${name}"): ${r.message}`);
    }

    async back(): Promise<void> {
        await this.executor.execute({ action: 'VOLVER' });
    }

    async screenshot(): Promise<void> {
        await this.executor.execute({ action: 'SCREENSHOT' });
    }

    // ── Utilidades ────────────────────────────────────────────────────────────

    protected sleep(ms: number): Promise<void> {
        return new Promise(r => setTimeout(r, ms));
    }

    async wait(seconds: number): Promise<void> {
        await this.executor.execute({ action: 'ESPERAR', value: String(seconds) });
    }
}
